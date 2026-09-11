"use server";

import { revalidatePath } from "next/cache";
import type { Locale } from "@/lib/i18n/locale";
import { getModels, getCurrentAccount } from "@/lib/supabase/queries";
import { createClient } from "@/lib/supabase/server";
import { csvRowSchema, toTradeInsert, type RawCsvRow } from "./schema";

export type ImportResult = { ok: true; count: number } | { ok: false; error: string };

/**
 * Re-validates every row server-side with the exact same schema the preview
 * step already ran client-side (defense in depth, same convention as every
 * other form action in this app) before a single bulk insert. `rValueAtEntry`
 * goes straight from the row onto the trade — unlike `createTrade`, which
 * recomputes it from the account's current balance, an imported historical
 * trade's 1R can't be derived from today's balance at all.
 */
export async function importTrades(rows: RawCsvRow[], locale: Locale = "en"): Promise<ImportResult> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (user === null) return { ok: false, error: "Not signed in." };

  const account = await getCurrentAccount();
  if (account === null) return { ok: false, error: "Set up an account first." };

  if (rows.length === 0) return { ok: false, error: "No rows to import." };

  const models = await getModels();
  const modelIdByName = new Map(models.map((m) => [m.name.trim().toLowerCase(), m.id]));
  const schema = csvRowSchema(locale);

  const inserts = [];
  for (const row of rows) {
    const parsed = schema.safeParse(row);
    if (!parsed.success) {
      return {
        ok: false,
        error: `A row failed server-side validation: ${parsed.error.issues[0]?.message ?? "invalid row"}`,
      };
    }
    const trade = toTradeInsert(parsed.data, modelIdByName);
    inserts.push({
      user_id: user.id,
      account_id: account.id,
      date: trade.date,
      instrument: trade.instrument,
      direction: trade.direction,
      session: trade.session,
      htf_pairing: trade.htf_pairing,
      range_high: trade.range_high,
      range_low: trade.range_low,
      sweep_side: trade.sweep_side,
      entry: trade.entry,
      stop: trade.stop,
      target: trade.target,
      exit: trade.exit,
      size: trade.size,
      model_id: trade.model_id,
      confirmation: trade.confirmation,
      result: trade.result,
      exit_reason: trade.exit_reason,
      hold_minutes: trade.hold_minutes,
      r_value_at_entry: trade.r_value_at_entry,
      tags: trade.tags,
      notes: trade.notes,
    });
  }

  const { error } = await supabase.from("trades").insert(inserts);
  if (error) return { ok: false, error: error.message };

  revalidatePath("/trades");
  revalidatePath("/");
  revalidatePath("/calendar");
  return { ok: true, count: inserts.length };
}
