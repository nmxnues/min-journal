"use server";

import { revalidatePath } from "next/cache";
import { cookies } from "next/headers";
import {
  availableBalanceOn,
  checkCashMovementDeletion,
  validateWithdrawal,
} from "@/lib/domain/capital";
import { todayIso } from "@/lib/domain/dates";
import type { RiskMode } from "@/lib/domain/types";
import { parseNumberInput } from "@/lib/format";
import { CURRENT_ACCOUNT_COOKIE } from "@/lib/current-account";
import { createClient } from "@/lib/supabase/server";
import { getAccount, getAccountLedgerInputs, toCashMovement } from "@/lib/supabase/queries";

/**
 * Capital's writes. Every check the client already makes is repeated here —
 * the client's copy is for instant feedback, this one is the guarantee.
 * Messages are English: the screen shows its own localized copy for anything
 * a normal interaction can hit, so these only surface for a bypassed client.
 */
export type CapitalActionResult = { ok: true } | { ok: false; error: string };

function revalidateMoney() {
  revalidatePath("/capital");
  revalidatePath("/");
  revalidatePath("/trades/new");
}

export interface RecordCashMovementInput {
  accountId: string;
  type: "deposit" | "withdrawal";
  amount: string;
  date: string;
  note: string;
}

/**
 * docs/README.md § Capital: "recording cash recomputes the balance series
 * forward from that date but never touches rValueAtEntry on existing trades"
 * — the series is derived, so recomputing is simply the next read; this only
 * inserts the cash row. "A withdrawal that would exceed the balance is
 * blocked" — against the balance available from that date on, so a backdated
 * withdrawal can't overdraw a later point either.
 */
export async function recordCashMovement(input: RecordCashMovementInput): Promise<CapitalActionResult> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (user === null) return { ok: false, error: "Not signed in." };

  if (input.type !== "deposit" && input.type !== "withdrawal") {
    return { ok: false, error: "Choose deposit or withdrawal." };
  }

  const account = await getAccount(input.accountId);
  if (account === null) return { ok: false, error: "Account not found." };

  const amount = parseNumberInput(input.amount);
  if (amount === null || amount <= 0) return { ok: false, error: "Enter an amount above zero." };

  if (!/^\d{4}-\d{2}-\d{2}$/.test(input.date)) return { ok: false, error: "Pick a date." };
  if (input.date < account.startedAt) {
    return { ok: false, error: "That date is before this account started." };
  }
  if (input.date > todayIso()) return { ok: false, error: "Cash can't be recorded for a future date." };

  if (input.type === "withdrawal") {
    const { trades, cashMovements } = await getAccountLedgerInputs(account.id);
    const available = availableBalanceOn(account, cashMovements, trades, input.date);
    if (!validateWithdrawal(amount, available).ok) {
      return { ok: false, error: "This withdrawal is more than the balance available on that date." };
    }
  }

  const note = input.note.trim();
  const { error } = await supabase.from("cash_movements").insert({
    user_id: user.id,
    account_id: account.id,
    date: input.date,
    type: input.type,
    amount,
    currency: account.currency,
    note: note === "" ? null : note,
  });

  if (error) return { ok: false, error: error.message };

  revalidateMoney();
  return { ok: true };
}

/** Deleting a mistaken entry (docs/decisions.md § Phase 8) — refused if a later point would go below zero. */
export async function deleteCashMovement(id: string): Promise<CapitalActionResult> {
  const supabase = await createClient();

  const { data: row, error: readError } = await supabase
    .from("cash_movements")
    .select("*")
    .eq("id", id)
    .maybeSingle();
  if (readError) return { ok: false, error: readError.message };
  if (row === null) return { ok: false, error: "That entry no longer exists." };

  const movement = toCashMovement(row);
  const account = await getAccount(movement.accountId);
  if (account === null) return { ok: false, error: "Account not found." };

  const { trades, cashMovements } = await getAccountLedgerInputs(account.id);
  const check = checkCashMovementDeletion(account, cashMovements, trades, movement.id);
  if (!check.ok) {
    return { ok: false, error: "Deleting this deposit would take a later balance below zero." };
  }

  const { error } = await supabase.from("cash_movements").delete().eq("id", movement.id);
  if (error) return { ok: false, error: error.message };

  revalidateMoney();
  return { ok: true };
}

export interface RiskSettingInput {
  accountId: string;
  riskMode: RiskMode;
  riskPercent: string;
  fixedRiskAmount: string;
}

/**
 * docs/README.md § Capital: "changing the risk % applies to future trades
 * only". This updates the account row and nothing else: no trade row is read
 * or written, so every `r_value_at_entry` already stored stays exactly as it
 * was logged. The next trade picks the new setting up in `createTrade`. The
 * `account_risk_changes` history row is written by a database trigger on this
 * same update, so the history can't be skipped or drift from the account.
 */
export async function updateRiskSetting(input: RiskSettingInput): Promise<CapitalActionResult> {
  const account = await getAccount(input.accountId);
  if (account === null) return { ok: false, error: "Account not found." };

  let update: { risk_mode: RiskMode; risk_percent: number | null; fixed_risk_amount: number | null };

  if (input.riskMode === "percent") {
    const percent = parseNumberInput(input.riskPercent);
    if (percent === null || percent <= 0 || percent > 100) {
      return { ok: false, error: "Risk per trade must be between 0 and 100% of the balance." };
    }
    update = { risk_mode: "percent", risk_percent: percent, fixed_risk_amount: null };
  } else if (input.riskMode === "fixed") {
    const amount = parseNumberInput(input.fixedRiskAmount);
    if (amount === null || amount <= 0) return { ok: false, error: "Enter a fixed 1R amount above zero." };
    update = { risk_mode: "fixed", risk_percent: null, fixed_risk_amount: amount };
  } else {
    return { ok: false, error: "Unknown risk mode." };
  }

  const supabase = await createClient();
  const { error } = await supabase.from("accounts").update(update).eq("id", account.id);
  if (error) return { ok: false, error: error.message };

  revalidateMoney();
  return { ok: true };
}

/**
 * Switches which account every screen reads/writes against
 * (docs/decisions.md § Phase 9 multi-account follow-up) — writes the
 * `current-account-id` cookie `getCurrentAccount()` reads. Re-checks
 * ownership itself rather than trusting the id blindly (RLS makes a
 * foreign/deleted id read back null here, not an error), so this can't be
 * used to switch onto another user's account by guessing an id.
 */
export async function setCurrentAccount(accountId: string): Promise<CapitalActionResult> {
  const account = await getAccount(accountId);
  if (account === null) return { ok: false, error: "Account not found." };

  const cookieStore = await cookies();
  cookieStore.set(CURRENT_ACCOUNT_COOKIE, account.id, {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: 60 * 60 * 24 * 365,
  });

  // Every account-scoped route, not just Capital's own — the whole point of
  // switching is that Dashboard/Trades/Calendar/Playbook/New trade all pick
  // up the new account the next time they're visited, not just this screen.
  for (const path of ["/", "/trades", "/calendar", "/playbook", "/weekly-review", "/trades/new", "/capital"]) {
    revalidatePath(path);
  }
  return { ok: true };
}

/** docs/README.md § Capital: "The limit is user-set." */
export async function updateDrawdownLimit(accountId: string, rawPercent: string): Promise<CapitalActionResult> {
  const percent = parseNumberInput(rawPercent);
  if (percent === null || percent <= 0 || percent >= 100) {
    return { ok: false, error: "The drawdown limit must be between 0 and 100%." };
  }

  const supabase = await createClient();
  const { error } = await supabase
    .from("accounts")
    .update({ drawdown_limit_percent: percent })
    .eq("id", accountId);
  if (error) return { ok: false, error: error.message };

  revalidateMoney();
  return { ok: true };
}
