"use server";

import { revalidatePath } from "next/cache";
import { parseNumberInput } from "@/lib/format";
import { currentRValue, rValueAsOfDate } from "@/lib/domain/capital";
import { deriveSweepSide } from "@/lib/domain/trade";
import { todayIso } from "@/lib/domain/dates";
import type { AccountKind, SweepSide } from "@/lib/domain/types";
import { createClient } from "@/lib/supabase/server";
import { getAccountLedgerInputs, getCurrentAccount, toAccount } from "@/lib/supabase/queries";
import { attachDraftFilesToTrade } from "./attachments-actions";
import { deleteDraft } from "./draft-actions";
import { createNewTradeSchema, type NewTradeInput } from "./schema";
import type { Locale } from "@/lib/i18n/locale";

export type ActionResult = { ok: true; id: string } | { ok: false; error: string };

export interface AccountSetupInput {
  name: string;
  currency: string;
  kind: AccountKind;
  /** Only meaningful (and only shown in the form) for a backtest account — a live account always starts today. */
  startedAt: string;
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
  const startedAt = /^\d{4}-\d{2}-\d{2}$/.test(input.startedAt) ? input.startedAt : todayIso();
  if (input.kind === "backtest" && startedAt > todayIso()) {
    return { ok: false, error: "A backtest account's start date can't be in the future." };
  }

  const { data, error } = await supabase
    .from("accounts")
    .insert({
      user_id: user.id,
      name: input.name.trim() === "" ? "Main" : input.name.trim(),
      currency: input.currency,
      kind: input.kind,
      starting_capital: startingCapital,
      started_at: startedAt,
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
  draftAttachmentPaths: readonly string[] = [],
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

  const account = await getCurrentAccount();
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
   *
   * `currentRValue` sums *every currently stored* trade, which is right for a
   * "live" account (trades are always entered in the order they actually
   * happened) but wrong for a "backtest" one, which is typically filled in
   * one instrument's full date range at a time — a later block already in
   * the table would otherwise inflate an earlier block's 1R the moment it's
   * logged, even though by date it hadn't "happened" yet. `rValueAsOfDate`
   * only counts what's on or before this trade's own `v.date`
   * (docs/decisions.md § Phase 9 backtest follow-up). Live accounts keep the
   * original rule untouched.
   */
  const { trades, cashMovements, riskChanges } = await getAccountLedgerInputs(account.id);
  const rValueAtEntry =
    account.kind === "backtest"
      ? rValueAsOfDate(account, cashMovements, trades, riskChanges, v.date)
      : currentRValue(account, cashMovements, trades);
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

  // Best-effort: the trade is already saved regardless of how this goes.
  await attachDraftFilesToTrade(user.id, data.id, draftAttachmentPaths);
  await deleteDraft();

  revalidatePath("/");
  revalidatePath("/trades");
  return { ok: true, id: data.id };
}
