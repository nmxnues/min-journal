"use server";

import { revalidatePath } from "next/cache";
import { parseNumberInput } from "@/lib/format";
import { deriveSweepSide } from "@/lib/domain/trade";
import type { SweepSide } from "@/lib/domain/types";
import { CHART_SHOTS_BUCKET } from "@/lib/attachments";
import { createClient } from "@/lib/supabase/server";
import type { Locale } from "@/lib/i18n/locale";
import { createEditTradeSchema, type EditTradeInput } from "./schema";

export type ActionResult = { ok: true } | { ok: false; error: string };

/**
 * Full-field edit (docs/decisions.md § Phase 4c), confirmed with the user:
 * every column the New trade form can set is editable here too, plus
 * `exitReason`/`holdMinutes` which 4a deferred to this screen. `rValueAtEntry`
 * is not part of `EditTradeInput` at all — this action never reads or writes
 * that column, so the frozen 1R value can't be touched from this path no
 * matter what the client sends.
 */
export async function updateTrade(
  id: string,
  values: EditTradeInput,
  locale: Locale = "en",
): Promise<ActionResult> {
  const parsed = createEditTradeSchema(locale).safeParse(values);
  if (!parsed.success) {
    return { ok: false, error: parsed.error.issues[0]?.message ?? "Invalid input." };
  }
  const v = parsed.data;

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (user === null) return { ok: false, error: "Not signed in." };

  const rangeHigh = parseNumberInput(v.rangeHigh)!;
  const rangeLow = parseNumberInput(v.rangeLow)!;
  const entry = parseNumberInput(v.entry)!;
  const stop = parseNumberInput(v.stop)!;
  const size = parseNumberInput(v.size)!;
  const target = v.target === "" ? null : parseNumberInput(v.target);
  const exit = v.exit === "" ? null : parseNumberInput(v.exit);
  const holdMinutes = v.holdMinutes === "" ? null : parseNumberInput(v.holdMinutes);

  const sweepSide: SweepSide =
    v.sweepSideOverride ?? deriveSweepSide({ stop, rangeHigh, rangeLow }) ?? "none";

  const { error } = await supabase
    .from("trades")
    .update({
      date: v.date,
      instrument: v.instrument.trim(),
      direction: v.direction,
      session: v.session,
      htf_pairing: v.htfPairing,
      range_high: rangeHigh,
      range_low: rangeLow,
      sweep_side: sweepSide,
      entry,
      stop,
      target,
      exit,
      size,
      model_id: v.modelId,
      confirmation: v.confirmation.trim() === "" ? null : v.confirmation.trim(),
      result: v.result,
      exit_reason: v.exitReason.trim() === "" ? null : v.exitReason.trim(),
      hold_minutes: holdMinutes,
      tags: v.tags,
      notes: v.notes.trim() === "" ? null : v.notes.trim(),
    })
    .eq("id", id);

  if (error) return { ok: false, error: error.message };

  revalidatePath(`/trades/${id}`);
  revalidatePath("/");
  return { ok: true };
}

/**
 * Deletes a trade and everything that belongs only to it. `attachments` rows
 * cascade at the database level (`trade_id ... on delete cascade`), but that
 * cascade has no reach into Storage — a DB row disappearing doesn't delete
 * the object it pointed at — so the actual files under `{user_id}/{tradeId}/`
 * are removed explicitly first, matching the no-orphans standard set in
 * Phase 4b's draft-attachment lifecycle.
 */
export async function deleteTrade(id: string): Promise<ActionResult> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (user === null) return { ok: false, error: "Not signed in." };

  const folder = `${user.id}/${id}`;
  const { data: objects } = await supabase.storage.from(CHART_SHOTS_BUCKET).list(folder);
  if (objects !== null && objects.length > 0) {
    await supabase.storage
      .from(CHART_SHOTS_BUCKET)
      .remove(objects.map((object) => `${folder}/${object.name}`));
  }

  const { error } = await supabase.from("trades").delete().eq("id", id);
  if (error) return { ok: false, error: error.message };

  revalidatePath("/");
  return { ok: true };
}
