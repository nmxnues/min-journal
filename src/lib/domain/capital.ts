/**
 * The money layer: balance and 1R over time, the ledger, and the guards.
 *
 * docs/README.md § Capital: "risk per trade is a percentage of the balance, so
 * the currency value of 1R rises as the account grows and falls after a
 * withdrawal ... A trade stores the 1R value that applied on its log date;
 * changing the risk setting or recording cash never rewrites historical
 * trades." Nothing here ever writes back to `trade.rValueAtEntry`.
 *
 * The ledger is a selector over cash movements + trades, never a stored table.
 */

import { DRAWDOWN_WARNING_MARGIN_PCT } from "./constants";
import { memoize } from "./memoize";
import { pnlAmount, realizedR } from "./trade";
import type { Account, CashMovement, IsoDate, RiskChange, RiskSetting, Trade } from "./types";

/**
 * One balance-changing event.
 *
 * Ordering rule (docs/decisions.md): by date, and within the same date cash
 * movements come before trades — a deposit dated D funds that day's trading.
 * `createdAt` is the final tiebreak, so the ordering is total and stable.
 */
export interface TimelineEvent {
  date: IsoDate;
  createdAt: string;
  /** Signed change to the balance. */
  delta: number;
  source: { kind: "deposit" | "withdrawal"; movement: CashMovement } | { kind: "trade"; trade: Trade };
}

const KIND_ORDER = { deposit: 0, withdrawal: 0, trade: 1 } as const;

export const timeline = memoize(
  (cashMovements: readonly CashMovement[], trades: readonly Trade[]): TimelineEvent[] => {
    const events: TimelineEvent[] = [];

    for (const movement of cashMovements) {
      events.push({
        date: movement.date,
        createdAt: movement.createdAt,
        delta: movement.type === "deposit" ? movement.amount : -movement.amount,
        source: { kind: movement.type, movement },
      });
    }

    for (const trade of trades) {
      const pnl = pnlAmount(trade);
      if (pnl === null) continue; // no exit yet: hasn't moved the balance
      events.push({
        date: trade.date,
        createdAt: trade.createdAt,
        delta: pnl,
        source: { kind: "trade", trade },
      });
    }

    return events.sort((a, b) => {
      if (a.date !== b.date) return a.date.localeCompare(b.date);
      const kindDiff = KIND_ORDER[a.source.kind] - KIND_ORDER[b.source.kind];
      if (kindDiff !== 0) return kindDiff;
      return a.createdAt.localeCompare(b.createdAt);
    });
  },
);

/**
 * 1R for a given balance under a risk setting.
 * `riskPercent` is stored in percent units (1 = 1%), matching the form's
 * 0.5% / 1% / 2% options. An `Account` is a `RiskSetting` (today's).
 */
export function rValueForBalance(setting: RiskSetting, balance: number): number {
  if (setting.riskMode === "fixed") return setting.fixedRiskAmount ?? 0;
  return balance * ((setting.riskPercent ?? 0) / 100);
}

/** The UTC calendar date a risk change takes effect on. */
function effectiveDate(change: RiskChange): IsoDate {
  return change.effectiveAt.slice(0, 10);
}

const orderRiskChanges = memoize((riskChanges: readonly RiskChange[]): RiskChange[] =>
  [...riskChanges].sort(
    (a, b) => a.effectiveAt.localeCompare(b.effectiveAt) || a.createdAt.localeCompare(b.createdAt),
  ),
);

/**
 * The risk setting in force on `date`: the latest change effective on or
 * before it. A date earlier than every recorded change gets the earliest one
 * (the account's opening setting). With no history at all — accounts from
 * before the history table, or tests — the account's own current setting.
 */
export function riskSettingOn(
  account: Account,
  riskChanges: readonly RiskChange[],
  date: IsoDate,
): RiskSetting {
  const ordered = orderRiskChanges(riskChanges);
  if (ordered.length === 0) return account;

  let setting: RiskSetting = ordered[0]!;
  for (const change of ordered) {
    if (effectiveDate(change) > date) break;
    setting = change;
  }
  return setting;
}

export interface BalancePoint {
  date: IsoDate;
  balance: number;
  /** 1R in currency at this point, under the risk setting in force on its date. */
  rValue: number;
  event: TimelineEvent | null;
}

/**
 * Balance over time: starting capital, then every cash movement and trade P&L
 * in order. The first point is the account's opening balance on `startedAt`.
 *
 * `rValue` on each point is what 1R was worth at that balance under the risk
 * setting in force on that date (from `riskChanges`; today's setting when no
 * history is passed). It is for charting — never what a historical trade
 * actually used. Trades keep their own frozen `rValueAtEntry`.
 */
export const balanceSeries = memoize(
  (
    account: Account,
    cashMovements: readonly CashMovement[],
    trades: readonly Trade[],
    riskChanges: readonly RiskChange[] = [],
  ): BalancePoint[] => {
    let balance = account.startingCapital;
    const rValueOn = (date: IsoDate) =>
      rValueForBalance(riskSettingOn(account, riskChanges, date), balance);

    const points: BalancePoint[] = [
      { date: account.startedAt, balance, rValue: rValueOn(account.startedAt), event: null },
    ];

    for (const event of timeline(cashMovements, trades)) {
      balance += event.delta;
      points.push({ date: event.date, balance, rValue: rValueOn(event.date), event });
    }

    return points;
  },
);

export function currentBalance(
  account: Account,
  cashMovements: readonly CashMovement[],
  trades: readonly Trade[],
): number {
  const series = balanceSeries(account, cashMovements, trades);
  return series[series.length - 1]!.balance;
}

/**
 * Today's 1R — what the next logged trade will freeze into `rValueAtEntry`.
 * Always the account's *current* setting: a risk change applies to trades
 * logged after it, and to nothing already logged.
 */
export function currentRValue(
  account: Account,
  cashMovements: readonly CashMovement[],
  trades: readonly Trade[],
): number {
  return rValueForBalance(account, currentBalance(account, cashMovements, trades));
}

export type CapitalMarker = "start" | "deposit" | "withdrawal" | "risk" | "today";

export interface CapitalSeriesPoint {
  date: IsoDate;
  balance: number;
  rValue: number;
  setting: RiskSetting;
  /**
   * What this point is a milestone of — the "1R history" rows are exactly the
   * marked points. Null for ordinary trade points and for the "before" half of
   * a step.
   */
  marker: CapitalMarker | null;
}

/**
 * The Capital hero chart's series (docs/README.md § Capital): balance and 1R
 * on one time axis, where "deposit and withdrawal events are step
 * discontinuities". Every cash movement contributes two points on the same
 * date — the balance before, then after — and so does every risk change, for
 * the 1R line. The series ends on `today` so the line runs to the present.
 */
export const capitalSeries = memoize(
  (
    account: Account,
    cashMovements: readonly CashMovement[],
    trades: readonly Trade[],
    riskChanges: readonly RiskChange[],
    today: IsoDate,
  ): CapitalSeriesPoint[] => {
    let balance = account.startingCapital;
    let setting = riskSettingOn(account, riskChanges, account.startedAt);
    const points: CapitalSeriesPoint[] = [];

    const push = (date: IsoDate, marker: CapitalMarker | null) =>
      points.push({ date, balance, rValue: rValueForBalance(setting, balance), setting, marker });

    push(account.startedAt, "start");

    // The opening setting is already applied; later changes become steps.
    const pending = orderRiskChanges(riskChanges).filter((c) => effectiveDate(c) > account.startedAt);
    let next = 0;
    const applyRiskChangesThrough = (date: IsoDate) => {
      while (next < pending.length && effectiveDate(pending[next]!) <= date) {
        const change = pending[next]!;
        push(effectiveDate(change), null);
        setting = change;
        push(effectiveDate(change), "risk");
        next++;
      }
    };

    for (const event of timeline(cashMovements, trades)) {
      applyRiskChangesThrough(event.date);
      if (event.source.kind === "trade") {
        balance += event.delta;
        push(event.date, null);
      } else {
        push(event.date, null);
        balance += event.delta;
        push(event.date, event.source.kind);
      }
    }

    applyRiskChangesThrough(today);
    // A milestone already dated today (cash recorded or risk changed today)
    // is today's row; a second "today" point would repeat it in the history.
    const last = points[points.length - 1]!;
    const endDate = last.date > today ? last.date : today;
    if (!(last.date === endDate && last.marker !== null)) push(endDate, "today");

    return points;
  },
);

/**
 * Starting capital + deposits - withdrawals.
 *
 * Starting capital counts as money put in: mock 3a reconciles as
 * $25,000 deposited - $2,500 withdrawn + $9,680 trading = $32,180 balance,
 * with "Net deposits $22,500" and "3 in · 1 out" — so the opening $15,000 is
 * one of those three.
 */
export function netDeposits(account: Account, cashMovements: readonly CashMovement[]): number {
  return cashMovements.reduce(
    (sum, m) => sum + (m.type === "deposit" ? m.amount : -m.amount),
    account.startingCapital,
  );
}

export interface CashTotals {
  /** Starting capital + every deposit — mock 3a's "Deposited $25,000". */
  deposited: number;
  withdrawn: number;
  /** Money-in events, the opening balance included — "3 in · 1 out". */
  inCount: number;
  outCount: number;
}

export function cashTotals(account: Account, cashMovements: readonly CashMovement[]): CashTotals {
  const totals: CashTotals = {
    deposited: account.startingCapital,
    withdrawn: 0,
    inCount: account.startingCapital > 0 ? 1 : 0,
    outCount: 0,
  };
  for (const m of cashMovements) {
    if (m.type === "deposit") {
      totals.deposited += m.amount;
      totals.inCount++;
    } else {
      totals.withdrawn += m.amount;
      totals.outCount++;
    }
  }
  return totals;
}

/** Total currency P&L from trading alone. */
export const tradingPnL = memoize((trades: readonly Trade[]): number =>
  trades.reduce((sum, t) => sum + (pnlAmount(t) ?? 0), 0),
);

/**
 * Time-weighted return, chain-linked — docs/README.md § Capital asks for it
 * explicitly ("time-weighted, so deposits don't inflate it").
 *
 * The timeline is cut into sub-periods at every cash movement; each sub-period
 * returns (trading P&L / balance at the start of that sub-period); the factors
 * are multiplied. Since cash movements and trades are the only things that
 * move the balance, this is exactly the classic (V_end - CF) / V_begin - 1.
 *
 * Note: mock 3a prints "+43.0%" next to "+43.0R lifetime" — that is the plain
 * sum of R times a 1% risk, not a chain-linked return, and was taken to be the
 * mock author reusing the R figure rather than a spec for the maths
 * (docs/decisions.md). A sub-period starting at a balance <= 0 is skipped
 * rather than dividing by zero.
 */
export function timeWeightedReturn(
  account: Account,
  cashMovements: readonly CashMovement[],
  trades: readonly Trade[],
): number {
  let balance = account.startingCapital;
  let periodStartBalance = balance;
  let periodPnl = 0;
  let factor = 1;

  const closePeriod = () => {
    if (periodStartBalance > 0) {
      factor *= 1 + periodPnl / periodStartBalance;
    }
  };

  for (const event of timeline(cashMovements, trades)) {
    if (event.source.kind === "trade") {
      balance += event.delta;
      periodPnl += event.delta;
      continue;
    }

    // A cash flow closes the current sub-period, then opens the next one.
    closePeriod();
    balance += event.delta;
    periodStartBalance = balance;
    periodPnl = 0;
  }

  closePeriod();
  return factor - 1;
}

export interface DrawdownState {
  /** Highest balance reached, shifted by every cash movement since (see drawdownState). */
  peakBalance: number;
  currentBalance: number;
  /** Peak minus current, never negative. */
  drawdownAmount: number;
  /** Drawdown in percentage points of the peak, e.g. 8.2 for 8.2%. */
  drawdownPercent: number;
  limitPercent: number;
  /** Currency loss from peak at which trading stops — mock's "Stop trading at −$3,218". */
  limitAmount: number;
  /** Share of the allowed drawdown used up, for the guard card's progress bar. */
  limitConsumed: number;
  /** Within DRAWDOWN_WARNING_MARGIN_PCT of the limit: the trade form warns. */
  isNearLimit: boolean;
  hasReachedLimit: boolean;
}

/**
 * Drawdown measures trading losses only (docs/decisions.md § Phase 8).
 *
 * The peak moves with cash: a withdrawal lowers it by the amount taken out and
 * a deposit raises it by the amount put in, so taking profit out of the
 * account is never read as a drawdown, and topping up mid-drawdown doesn't
 * erase the loss already taken — it only shrinks it as a share of the peak.
 * Trades then lift the peak whenever the balance makes a new high.
 */
export function drawdownState(
  account: Account,
  cashMovements: readonly CashMovement[],
  trades: readonly Trade[],
): DrawdownState {
  let balance = account.startingCapital;
  let peakBalance = balance;

  for (const event of timeline(cashMovements, trades)) {
    balance += event.delta;
    if (event.source.kind !== "trade") peakBalance += event.delta;
    peakBalance = Math.max(peakBalance, balance);
  }

  const drawdownAmount = Math.max(0, peakBalance - balance);
  const drawdownPercent = peakBalance > 0 ? (drawdownAmount / peakBalance) * 100 : 0;
  const limitPercent = account.drawdownLimitPercent;

  return {
    peakBalance,
    currentBalance: balance,
    drawdownAmount,
    drawdownPercent,
    limitPercent,
    limitAmount: peakBalance * (limitPercent / 100),
    limitConsumed: limitPercent > 0 ? drawdownPercent / limitPercent : 0,
    isNearLimit: drawdownPercent >= limitPercent - DRAWDOWN_WARNING_MARGIN_PCT,
    hasReachedLimit: drawdownPercent >= limitPercent,
  };
}

export type WithdrawalRejection = "not_positive" | "exceeds_balance";

export interface WithdrawalCheck {
  ok: boolean;
  reason: WithdrawalRejection | null;
  balanceAfter: number;
}

/**
 * docs/README.md § Capital: "a withdrawal that would exceed the balance is
 * blocked". Returns a reason code, not a message — copy is the UI's job.
 * `balance` should come from `availableBalanceOn` when the withdrawal is dated
 * in the past.
 */
export function validateWithdrawal(amount: number, balance: number): WithdrawalCheck {
  if (!Number.isFinite(amount) || amount <= 0) {
    return { ok: false, reason: "not_positive", balanceAfter: balance };
  }
  if (amount > balance) {
    return { ok: false, reason: "exceeds_balance", balanceAfter: balance };
  }
  return { ok: true, reason: null, balanceAfter: balance - amount };
}

/**
 * The most that can come out of the account on `date` without the balance
 * dipping below zero then or at any later point.
 *
 * A cash movement dated D slots in after everything earlier and after D's
 * other cash movements, but before D's trades (the timeline ordering rule).
 * Taking W out there lowers that point and every later one by W, so the
 * ceiling is the lowest balance from that position onward — not just today's
 * balance, which a backdated withdrawal could otherwise overdraw in between.
 */
export function availableBalanceOn(
  account: Account,
  cashMovements: readonly CashMovement[],
  trades: readonly Trade[],
  date: IsoDate,
): number {
  let balance = account.startingCapital;
  let lowest: number | null = null;

  for (const event of timeline(cashMovements, trades)) {
    const isAfterSlot = event.date > date || (event.date === date && event.source.kind === "trade");
    if (isAfterSlot && lowest === null) lowest = balance;
    balance += event.delta;
    if (lowest !== null) lowest = Math.min(lowest, balance);
  }

  return lowest ?? balance;
}

export type CashDeletionRejection = "not_found" | "would_overdraw";

/**
 * Deleting a mistaken cash movement (docs/decisions.md § Phase 8). Removing a
 * withdrawal only ever raises later balances; removing a deposit is refused if
 * some later point — typically a withdrawal that deposit paid for — would end
 * up below zero.
 */
export function checkCashMovementDeletion(
  account: Account,
  cashMovements: readonly CashMovement[],
  trades: readonly Trade[],
  movementId: string,
): { ok: boolean; reason: CashDeletionRejection | null } {
  const movement = cashMovements.find((m) => m.id === movementId);
  if (movement === undefined) return { ok: false, reason: "not_found" };
  if (movement.type === "withdrawal") return { ok: true, reason: null };

  const remaining = cashMovements.filter((m) => m.id !== movementId);
  return availableBalanceOn(account, remaining, trades, movement.date) >= 0
    ? { ok: true, reason: null }
    : { ok: false, reason: "would_overdraw" };
}

export interface CashMovementPreview {
  balanceBefore: number;
  balanceAfter: number;
  rValueBefore: number;
  rValueAfter: number;
}

/**
 * The cash modal's preview panel: "Balance after" and "1R moves to $X from $Y",
 * captioned "Only trades logged after this date use the new 1R."
 */
export function previewCashMovement(
  setting: RiskSetting,
  balanceBefore: number,
  type: "deposit" | "withdrawal",
  amount: number,
): CashMovementPreview {
  const balanceAfter = balanceBefore + (type === "deposit" ? amount : -amount);
  return {
    balanceBefore,
    balanceAfter,
    rValueBefore: rValueForBalance(setting, balanceBefore),
    rValueAfter: rValueForBalance(setting, balanceAfter),
  };
}

export interface LedgerEntry {
  kind: "opening" | "deposit" | "withdrawal" | "trade";
  id: string;
  date: IsoDate;
  /** Signed currency amount. */
  amount: number;
  /** R for trade rows; null for cash rows (the UI shows an em-dash). */
  r: number | null;
  /** Running balance after this row. */
  balanceAfter: number;
  /** 1R under the setting in force on this row's date, before and after it moved the balance. */
  rValueBefore: number;
  rValueAfter: number;
  source: TimelineEvent["source"] | { kind: "opening" };
}

export type LedgerFilter = "all" | "cash" | "trades";

/**
 * Cash movements and trades merged into one date-sorted view with a running
 * balance, newest first — docs/README.md § Capital: "Rows are chronological
 * descending, and the balance column is the running total after that row."
 *
 * The opening balance is the oldest row, drawn like a deposit (mock 3a's
 * "Deposit · Starting capital"). It is synthesised from the account, not
 * stored as a cash movement — nothing about this view is stored.
 */
export const ledger = memoize(
  (
    account: Account,
    cashMovements: readonly CashMovement[],
    trades: readonly Trade[],
    riskChanges: readonly RiskChange[] = [],
  ): LedgerEntry[] => {
    const rValue = (date: IsoDate, balance: number) =>
      rValueForBalance(riskSettingOn(account, riskChanges, date), balance);

    let balance = account.startingCapital;
    const ascending: LedgerEntry[] = [];

    if (account.startingCapital > 0) {
      ascending.push({
        kind: "opening",
        id: `opening:${account.id}`,
        date: account.startedAt,
        amount: account.startingCapital,
        r: null,
        balanceAfter: balance,
        rValueBefore: 0,
        rValueAfter: rValue(account.startedAt, balance),
        source: { kind: "opening" },
      });
    }

    for (const event of timeline(cashMovements, trades)) {
      const before = balance;
      balance += event.delta;
      const source = event.source;

      ascending.push({
        kind: source.kind,
        id: source.kind === "trade" ? source.trade.id : source.movement.id,
        date: event.date,
        amount: event.delta,
        r: source.kind === "trade" ? realizedR(source.trade) : null,
        balanceAfter: balance,
        rValueBefore: rValue(event.date, before),
        rValueAfter: rValue(event.date, balance),
        source,
      });
    }

    return ascending.reverse();
  },
);

/** The ledger card's All / Cash only / Trades only control. The opening balance counts as cash. */
export function filterLedger(entries: readonly LedgerEntry[], filter: LedgerFilter): LedgerEntry[] {
  if (filter === "all") return [...entries];
  if (filter === "trades") return entries.filter((e) => e.kind === "trade");
  return entries.filter((e) => e.kind !== "trade");
}
