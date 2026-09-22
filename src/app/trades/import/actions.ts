"use server";

import { revalidatePath } from "next/cache";
import { assignBacktestRValues, type PendingBacktestTrade } from "@/lib/domain/capital";
import type { Locale } from "@/lib/i18n/locale";
import { getAccountLedgerInputs, getModels, getCurrentAccount } from "@/lib/supabase/queries";
import { createClient } from "@/lib/supabase/server";
import { csvRowSchema, toTradeInsert, type RawCsvRow } from "./schema";

export type ImportResult = { ok: true; count: number } | { ok: false; error: string };

/**
 * Re-validates every row server-side with the exact same schema the preview
 * step already ran client-side (defense in depth, same convention as every
 * other form action in this app) before a single bulk insert.
 *
 * `rValueAtEntry` goes straight from the row onto the trade for a `live`
 * account — unlike `createTrade`, which recomputes it from the account's
 * *current* balance, an imported historical trade's 1R can't be derived
 * from today's balance at all. A `backtest` account doesn't have that
 * problem: any row that left the column blank gets it computed here, the
 * same `rValueAsOfDate` rule `createTrade` uses for one trade at a time,
 * batched so the whole file costs one extra query instead of one per row
 * (docs/decisions.md § CSV import backtest 1R).
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
  const schema = csvRowSchema(locale, account.kind);

  const trades = [];
  for (const row of rows) {
    const parsed = schema.safeParse(row);
    if (!parsed.success) {
      return {
        ok: false,
        error: `A row failed server-side validation: ${parsed.error.issues[0]?.message ?? "invalid row"}`,
      };
    }
    trades.push(toTradeInsert(parsed.data, modelIdByName));
  }

  let rValues: (number | null)[] = trades.map((t) => t.r_value_at_entry);
  if (account.kind === "backtest") {
    const { trades: existingTrades, cashMovements, riskChanges } = await getAccountLedgerInputs(account.id);
    const pending: PendingBacktestTrade[] = trades.map((t) => ({
      date: t.date,
      direction: t.direction,
      entry: t.entry,
      stop: t.stop,
      exit: t.exit,
      rValueAtEntry: t.r_value_at_entry,
      // Folded into the running balance exactly as a saved row's would be, so
      // a batch of swing trades assigns the same 1R sequence it would have if
      // the rows had been imported one file at a time.
      swap: t.swap,
      entryCommission: t.entry_commission,
      exitCommission: t.exit_commission,
    }));
    rValues = assignBacktestRValues(account, cashMovements, existingTrades, riskChanges, pending);
  }

  // Guaranteed non-null by csvRowSchema for `live` and by assignBacktestRValues
  // for `backtest` (it always returns a value, computed or passed through) —
  // checked rather than trusted, since a null here would otherwise hit the
  // database's own NOT NULL constraint with a far less useful error.
  if (rValues.some((v) => v === null || !Number.isFinite(v))) {
    return { ok: false, error: "Could not resolve a 1R value for one or more rows." };
  }
  const resolvedRValues = rValues as number[];

  const inserts = trades.map((trade, i) => ({
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
    swap: trade.swap,
    size: trade.size,
    entry_commission: trade.entry_commission,
    exit_commission: trade.exit_commission,
    model_id: trade.model_id,
    confirmation: trade.confirmation,
    result: trade.result,
    exit_reason: trade.exit_reason,
    hold_minutes: trade.hold_minutes,
    r_value_at_entry: resolvedRValues[i]!,
    tags: trade.tags,
    notes: trade.notes,
  }));

  const { error } = await supabase.from("trades").insert(inserts);
  if (error) return { ok: false, error: error.message };

  revalidatePath("/trades");
  revalidatePath("/");
  revalidatePath("/calendar");
  return { ok: true, count: inserts.length };
}
