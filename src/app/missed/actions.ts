"use server";

import { revalidatePath } from "next/cache";
import { parseNumberInput } from "@/lib/format";
import type { Locale } from "@/lib/i18n/locale";
import { createClient } from "@/lib/supabase/server";
import { createMissedTradeSchema, type MissedTradeInput } from "./schema";

export type ActionResult = { ok: true; id: string } | { ok: false; error: string };

function blankToNull(value: string): string | null {
  const trimmed = value.trim();
  return trimmed === "" ? null : trimmed;
}

function toColumns(input: MissedTradeInput, locale: Locale) {
  const parsed = createMissedTradeSchema(locale).safeParse(input);
  if (!parsed.success) return { ok: false, error: parsed.error.issues[0]?.message ?? "Invalid input." } as const;
  const v = parsed.data;
  return {
    ok: true,
    columns: {
      date: v.date,
      time: v.time === "" ? null : v.time,
      session: v.session,
      instrument: v.instrument.trim().toUpperCase(),
      direction: v.direction,
      entry: parseNumberInput(v.entry),
      stop: parseNumberInput(v.stop),
      target: parseNumberInput(v.target),
      setup_note: blankToNull(v.setupNote),
      miss_reason: v.missReason,
      miss_reason_note: blankToNull(v.missReasonNote),
      result: v.result,
      notes: blankToNull(v.notes),
    },
  } as const;
}

/**
 * Writes to `missed_trades` only — never `trades`, `accounts` or anything the
 * balance reads (docs/decisions.md § Missed trades). The commission rate is
 * copied from Settings now and kept, so a later rate change doesn't rewrite
 * this row's R.
 */
export async function createMissedTrade(input: MissedTradeInput, locale: Locale = "en"): Promise<ActionResult> {
  const result = toColumns(input, locale);
  if (!result.ok) return { ok: false, error: result.error };

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (user === null) return { ok: false, error: "Not signed in." };

  const { data: settings } = await supabase.from("settings").select("commission_per_lot_per_side").maybeSingle();

  const { data, error } = await supabase
    .from("missed_trades")
    .insert({
      ...result.columns,
      user_id: user.id,
      commission_per_lot_per_side: Number(settings?.commission_per_lot_per_side ?? 0),
    })
    .select("id")
    .single();

  if (error) return { ok: false, error: error.message };
  revalidatePath("/missed");
  return { ok: true, id: data.id };
}

/** Leaves the frozen commission rate as it was logged. */
export async function updateMissedTrade(
  id: string,
  input: MissedTradeInput,
  locale: Locale = "en",
): Promise<ActionResult> {
  const result = toColumns(input, locale);
  if (!result.ok) return { ok: false, error: result.error };

  const supabase = await createClient();
  const { error } = await supabase.from("missed_trades").update(result.columns).eq("id", id);

  if (error) return { ok: false, error: error.message };
  revalidatePath("/missed");
  return { ok: true, id };
}

export async function deleteMissedTrade(id: string): Promise<ActionResult> {
  const supabase = await createClient();
  const { error } = await supabase.from("missed_trades").delete().eq("id", id);

  if (error) return { ok: false, error: error.message };
  revalidatePath("/missed");
  return { ok: true, id };
}
