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
import type { Account, CashMovement, IsoDate, Trade } from "./types";

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

export interface BalancePoint {
  date: IsoDate;
  balance: number;
  /** 1R in currency at this point, per the account's current risk setting. */
  rValue: number;
  event: TimelineEvent | null;
}

/**
 * 1R for a given balance under the account's risk setting.
 * `riskPercent` is stored in percent units (1 = 1%), matching the form's
 * 0.5% / 1% / 2% options.
 */
export function rValueForBalance(account: Account, balance: number): number {
  if (account.riskMode === "fixed") return account.fixedRiskAmount ?? 0;
  return balance * ((account.riskPercent ?? 0) / 100);
}

/**
 * Balance over time: starting capital, then every cash movement and trade P&L
 * in order. The first point is the account's opening balance on `startedAt`.
 *
 * `rValue` on each point is what 1R is worth at that balance *under today's
 * risk setting* — it is a projection for charting (docs/README.md § Capital's
 * dual-line chart), never what a historical trade actually used. Trades keep
 * their own frozen `rValueAtEntry`.
 */
export const balanceSeries = memoize(
  (
    account: Account,
    cashMovements: readonly CashMovement[],
    trades: readonly Trade[],
  ): BalancePoint[] => {
    let balance = account.startingCapital;

    const points: BalancePoint[] = [
      {
        date: account.startedAt,
        balance,
        rValue: rValueForBalance(account, balance),
        event: null,
      },
    ];

    for (const event of timeline(cashMovements, trades)) {
      balance += event.delta;
      points.push({
        date: event.date,
        balance,
        rValue: rValueForBalance(account, balance),
        event,
      });
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

/** Today's 1R — what the next logged trade will freeze into `rValueAtEntry`. */
export function currentRValue(
  account: Account,
  cashMovements: readonly CashMovement[],
  trades: readonly Trade[],
): number {
  return rValueForBalance(account, currentBalance(account, cashMovements, trades));
}

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

export function drawdownState(
  account: Account,
  cashMovements: readonly CashMovement[],
  trades: readonly Trade[],
): DrawdownState {
  const series = balanceSeries(account, cashMovements, trades);
  const peakBalance = Math.max(...series.map((p) => p.balance));
  const balance = series[series.length - 1]!.balance;

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
  account: Account,
  balanceBefore: number,
  type: "deposit" | "withdrawal",
  amount: number,
): CashMovementPreview {
  const balanceAfter = balanceBefore + (type === "deposit" ? amount : -amount);
  return {
    balanceBefore,
    balanceAfter,
    rValueBefore: rValueForBalance(account, balanceBefore),
    rValueAfter: rValueForBalance(account, balanceAfter),
  };
}

export interface LedgerEntry {
  kind: "deposit" | "withdrawal" | "trade";
  id: string;
  date: IsoDate;
  /** Signed currency amount. */
  amount: number;
  /** R for trade rows; null for cash rows (the UI shows an em-dash). */
  r: number | null;
  /** Running balance after this row. */
  balanceAfter: number;
  source: TimelineEvent["source"];
}

/**
 * Cash movements and trades merged into one date-sorted view with a running
 * balance, newest first — docs/README.md § Capital: "Rows are chronological
 * descending, and the balance column is the running total after that row."
 */
export const ledger = memoize(
  (
    account: Account,
    cashMovements: readonly CashMovement[],
    trades: readonly Trade[],
  ): LedgerEntry[] => {
    let balance = account.startingCapital;
    const ascending: LedgerEntry[] = [];

    for (const event of timeline(cashMovements, trades)) {
      balance += event.delta;
      const source = event.source;

      if (source.kind === "trade") {
        ascending.push({
          kind: "trade",
          id: source.trade.id,
          date: event.date,
          amount: event.delta,
          r: realizedR(source.trade),
          balanceAfter: balance,
          source,
        });
      } else {
        ascending.push({
          kind: source.kind,
          id: source.movement.id,
          date: event.date,
          amount: event.delta,
          r: null,
          balanceAfter: balance,
          source,
        });
      }
    }

    return ascending.reverse();
  },
);
