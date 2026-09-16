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
 *
 * Swap rides in on `pnlAmount`, so every figure on this money axis — balance,
 * 1R-at-balance, TWR, drawdown, withdrawal headroom, the ledger — already
 * nets it out. It is a trade delta and never a cash movement: financing is a
 * cost of the position, so TWR must feel it (booking it as a cash flow would
 * chain-link it away and overstate the return) and the drawdown peak must not
 * step for it (only real deposits and withdrawals move the peak — Phase 8 §2).
 * The R axis in stats.ts stays swap-free (docs/decisions.md § Swap).
 */

import { DRAWDOWN_WARNING_MARGIN_PCT } from "./constants";
import { memoize } from "./memoize";
import { pnlAmount, pricePnlAmount, realizedR, swapAmount } from "./trade";
import type { Account, CashMovement, Direction, IsoDate, RiskChange, RiskSetting, Trade } from "./types";

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

/**
 * Balance using only events dated on or before `date` — ignoring anything
 * dated after it, regardless of when it was actually entered into the app.
 *
 * `currentBalance` sums *every currently stored* event, which is exactly
 * right for a `kind: "live"` account (trades are always entered in the order
 * they actually happened, so "everything stored so far" already *is* "as of
 * now"). A `kind: "backtest"` account breaks that assumption on purpose — the
 * natural way to fill one in is a full date range of one instrument, then a
 * full date range of another, not true chronological order across
 * instruments — so `currentBalance` would let a later-dated block already in
 * the database inflate an earlier-dated trade's `rValueAtEntry` the moment it
 * gets logged. This is what `createTrade` uses instead for those accounts
 * (docs/decisions.md § Phase 9 backtest follow-up).
 *
 * `series` is already chronological (see `balanceSeries`), so this is a
 * single forward scan, not a fresh sort.
 */
export function balanceAsOfDate(
  account: Account,
  cashMovements: readonly CashMovement[],
  trades: readonly Trade[],
  date: IsoDate,
): number {
  const series = balanceSeries(account, cashMovements, trades);
  let balance = account.startingCapital;
  for (const point of series) {
    if (point.date > date) break;
    balance = point.balance;
  }
  return balance;
}

/** `rValueForBalance`, but for `balanceAsOfDate` — what a backtest account freezes onto a trade dated `date`. */
export function rValueAsOfDate(
  account: Account,
  cashMovements: readonly CashMovement[],
  trades: readonly Trade[],
  riskChanges: readonly RiskChange[],
  date: IsoDate,
): number {
  const balance = balanceAsOfDate(account, cashMovements, trades, date);
  return rValueForBalance(riskSettingOn(account, riskChanges, date), balance);
}

export interface PendingBacktestTrade {
  date: IsoDate;
  direction: Direction;
  entry: number;
  stop: number;
  exit: number | null;
  /** An explicit value from the CSV row; `null` means "compute from the balance as of this row's own date." */
  rValueAtEntry: number | null;
  /** Swap from the CSV row, `null` when it left the column blank. Folds into the running balance like a real row's would. */
  swap: number | null;
}

/**
 * Batch form of what `createTrade` does for one backtest trade at a time
 * (`rValueAsOfDate`) — assigns every row in `rows` its 1R by walking one
 * merged chronological pass over the account's *existing* events plus the
 * batch itself, so a row earlier in the batch is already "on the books" for
 * a later one, exactly as if it had already been saved to the database.
 * `rows` need not be date-sorted — a hand-authored backtest CSV commonly
 * isn't; same-date rows within the batch net together in the order given
 * (`rows`' own index), matching the same "entry order" rule same-day trades
 * already follow via `createdAt` once they're real rows (docs/decisions.md §
 * Backtest data entry). A row that already carries an explicit
 * `rValueAtEntry` is left untouched but still folds into the running
 * balance for whatever comes after it, so a CSV can freely mix rows that
 * already know their own 1R with rows that don't.
 */
export function assignBacktestRValues(
  account: Account,
  cashMovements: readonly CashMovement[],
  existingTrades: readonly Trade[],
  riskChanges: readonly RiskChange[],
  rows: readonly PendingBacktestTrade[],
): number[] {
  const existingEvents = timeline(cashMovements, existingTrades);
  const order = rows
    .map((row, index) => ({ row, index }))
    .sort((a, b) => a.row.date.localeCompare(b.row.date) || a.index - b.index);

  let balance = account.startingCapital;
  let eventPointer = 0;
  const results = new Array<number>(rows.length);

  for (const { row, index } of order) {
    while (eventPointer < existingEvents.length && existingEvents[eventPointer]!.date <= row.date) {
      balance += existingEvents[eventPointer]!.delta;
      eventPointer += 1;
    }

    const rValue = row.rValueAtEntry ?? rValueForBalance(riskSettingOn(account, riskChanges, row.date), balance);
    results[index] = rValue;

    // Mirrors `pnlAmount` exactly — price term plus swap — so a row later in
    // the batch sees the same balance it would have seen had the earlier rows
    // already been saved and read back through the timeline.
    const realized = realizedR(row);
    if (realized !== null) balance += realized * rValue + swapAmount(row);
  }

  return results;
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

/**
 * Total currency P&L from trading alone — price movement *and* the swap paid
 * or earned holding those positions, i.e. everything trading did to the
 * balance as against everything cash movements did.
 */
export const tradingPnL = memoize((trades: readonly Trade[]): number =>
  trades.reduce((sum, t) => sum + (pnlAmount(t) ?? 0), 0),
);

/**
 * The swap half of `tradingPnL`, so a screen showing the net figure can say
 * where it came from. Open trades contribute nothing (their swap isn't
 * confirmed until the close), keeping this a strict decomposition of
 * `tradingPnL` rather than a separate total that wouldn't add up.
 */
export const tradingSwap = memoize((trades: readonly Trade[]): number =>
  trades.reduce((sum, t) => sum + (pnlAmount(t) === null ? 0 : swapAmount(t)), 0),
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
  /** Signed currency amount. On a trade row this is price P&L plus swap — what the balance actually did. */
  amount: number;
  /**
   * R for trade rows; null for cash rows (the UI shows an em-dash).
   * Price R, matching every other R in the app — a trade row's `amount` and
   * `r` therefore differ by its swap rather than by `rValueAtEntry` alone.
   */
  r: number | null;
  /** The `amount` split into its two terms, so a row can caption its swap. Both null on cash rows. */
  pricePnl: number | null;
  swap: number | null;
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
        pricePnl: null,
        swap: null,
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
        pricePnl: source.kind === "trade" ? pricePnlAmount(source.trade) : null,
        swap: source.kind === "trade" ? source.trade.swap : null,
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
