"use server";

import { revalidatePath } from "next/cache";
import { parseNumberInput } from "@/lib/format";
import { currentRValue } from "@/lib/domain/capital";
import { deriveSweepSide } from "@/lib/domain/trade";
import type { SweepSide } from "@/lib/domain/types";
import { createClient } from "@/lib/supabase/server";
import { getAccountLedgerInputs, getPrimaryAccount, toAccount } from "@/lib/supabase/queries";
import { createNewTradeSchema, type NewTradeInput } from "./schema";
import type { Locale } from "@/lib/i18n/locale";

export type ActionResult = { ok: true; id: string } | { ok: false; error: string };

export interface AccountSetupInput {
  name: string;
  currency: string;
  startingCapital: string;
  riskPercent: string;
  drawdownLimitPercent: string;
}

/**
 * First-run account setup (docs/decisions.md § Phase 4a). `trades.account_id`
 * and `trades.r_value_at_entry` are both NOT NULL, so a trade literally cannot
 * exist before an account does — and auto-creating one with a guessed starting
 * capital was rejected outright, since that number drives every figure on the
 * Capital screen. Phase 8 builds the full Capital UI on top of this same row.
 */
export async function createAccount(input: AccountSetupInput): Promise<ActionResult> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (user === null) return { ok: false, error: "Not signed in." };

  const startingCapital = parseNumberInput(input.startingCapital);
  const riskPercent = parseNumberInput(input.riskPercent);
  const drawdownLimitPercent = parseNumberInput(input.drawdownLimitPercent);

  if (startingCapital === null || startingCapital < 0) {
    return { ok: false, error: "Enter your starting capital." };
  }
  if (riskPercent === null || riskPercent <= 0) {
    return { ok: false, error: "Enter the percentage of the balance you risk per trade." };
  }
  if (drawdownLimitPercent === null || drawdownLimitPercent <= 0) {
    return { ok: false, error: "Enter a drawdown limit." };
  }

  const { data, error } = await supabase
    .from("accounts")
    .insert({
      user_id: user.id,
      name: input.name.trim() === "" ? "Main" : input.name.trim(),
      currency: input.currency,
      starting_capital: startingCapital,
      started_at: new Date().toISOString().slice(0, 10),
      risk_mode: "percent",
      risk_percent: riskPercent,
      fixed_risk_amount: null,
      drawdown_limit_percent: drawdownLimitPercent,
    })
    .select("*")
    .single();

  if (error) return { ok: false, error: error.message };

  revalidatePath("/trades/new");
  return { ok: true, id: toAccount(data).id };
}

export async function createTrade(
  values: NewTradeInput,
  locale: Locale = "en",
): Promise<ActionResult> {
  const parsed = createNewTradeSchema(locale).safeParse(values);
  if (!parsed.success) {
    return { ok: false, error: parsed.error.issues[0]?.message ?? "Invalid input." };
  }
  const v = parsed.data;

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (user === null) return { ok: false, error: "Not signed in." };

  const account = await getPrimaryAccount();
  if (account === null) return { ok: false, error: "Set up an account first." };

  const rangeHigh = parseNumberInput(v.rangeHigh)!;
  const rangeLow = parseNumberInput(v.rangeLow)!;
  const entry = parseNumberInput(v.entry)!;
  const stop = parseNumberInput(v.stop)!;
  const size = parseNumberInput(v.size)!;
  const target = v.target === "" ? null : parseNumberInput(v.target);
  const exit = v.exit === "" ? null : parseNumberInput(v.exit);

  const sweepSide: SweepSide =
    v.sweepSideOverride ?? deriveSweepSide({ stop, rangeHigh, rangeLow }) ?? "none";

  /**
   * 1R is recomputed here rather than taken from the client: it is the one
   * value frozen onto the row forever, and the whole Capital screen assumes it
   * equals the account's risk against the balance on the day it was logged.
   * The form shows the same number read-only; this is the copy that counts.
   */
  const { trades, cashMovements } = await getAccountLedgerInputs(account.id);
  const rValueAtEntry = currentRValue(account, cashMovements, trades);
  if (!Number.isFinite(rValueAtEntry) || rValueAtEntry <= 0) {
    return { ok: false, error: "This account's 1R works out to zero — check its risk settings." };
  }

  const { data, error } = await supabase
    .from("trades")
    .insert({
      user_id: user.id,
      account_id: account.id,
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
      r_value_at_entry: rValueAtEntry,
      tags: v.tags,
      notes: v.notes.trim() === "" ? null : v.notes.trim(),
    })
    .select("id")
    .single();

  if (error) return { ok: false, error: error.message };

  revalidatePath("/");
  revalidatePath("/trades");
  return { ok: true, id: data.id };
}
