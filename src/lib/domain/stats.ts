/**
 * Aggregate selectors over a trade list. All pure, all memoised on argument
 * identity (docs/build-prompt.md §5).
 *
 * Ratios are returned raw (0..1), never pre-rounded — formatting is the UI's
 * job, so the same selector can feed both a "87%" stat card and a chart.
 *
 * Every R figure below is *price* R and none of them see `trade.swap`
 * (docs/decisions.md § Swap). That is what lets `byModel`, `bySession`,
 * `expectancy` and `avgWin`/`avgLoss` compare setups rather than holding
 * periods, and what stops a swap typed in months after the fact from moving
 * an already-settled win rate. The currency effect of swap lives on the money
 * axis in capital.ts (`tradingPnL`/`tradingSwap`); the only two swap
 * selectors here, `netSwap` and `netSwapR`, are for reporting it beside those
 * figures and are not folded into `periodStats` or any group breakdown.
 *
 * Commission follows the same split (docs/decisions.md § Commission). The
 * trader's "stats on net P&L" live in `moneyStats` at the bottom of this file:
 * a separate, currency-denominated set — net total, net win rate, average net
 * P&L — beside the R statistics rather than in place of them.
 */

import { memoize } from "./memoize";
import { commissionAmount, offPlan, pnlAmount, realizedR, swapAmount } from "./trade";
import type { IsoDate, Session, SweepSide, Trade, TradeModel } from "./types";

/** Chronological order, `createdAt` breaking ties within a day. */
export function sortChronologically<T extends Pick<Trade, "date" | "createdAt">>(
  trades: readonly T[],
): T[] {
  return [...trades].sort((a, b) =>
    a.date === b.date ? a.createdAt.localeCompare(b.createdAt) : a.date.localeCompare(b.date),
  );
}

/** Inclusive on both ends; either bound may be omitted. */
export function filterByDateRange(
  trades: readonly Trade[],
  from?: IsoDate,
  to?: IsoDate,
): Trade[] {
  return trades.filter((t) => (from === undefined || t.date >= from) && (to === undefined || t.date <= to));
}

function mean(values: readonly number[]): number | null {
  if (values.length === 0) return null;
  return values.reduce((sum, v) => sum + v, 0) / values.length;
}

function realizedRs(trades: readonly Trade[]): number[] {
  return trades.map(realizedR).filter((r): r is number => r !== null);
}

/** Sum of realized R. Trades with no exit contribute nothing (their R is unknown, not zero). */
export const netR = memoize((trades: readonly Trade[]): number =>
  realizedRs(trades).reduce((sum, r) => sum + r, 0),
);

/**
 * Total swap in currency over these trades, and the same figure divided
 * through each trade's own frozen 1R.
 *
 * `netSwapR` is a reporting number — "financing cost me 0.7R this month" — and
 * is never added to `netR`. Each trade is divided by *its own* `rValueAtEntry`
 * rather than the total by one 1R, since 1R moves as the account grows.
 *
 * Both skip open trades, the same way `netR` skips them and for the same
 * reason: swap is only confirmed at the close, so counting an open position's
 * financing here would not reconcile with `tradingPnL`.
 */
export const netSwap = memoize((trades: readonly Trade[]): number =>
  trades.reduce((sum, t) => sum + (pnlAmount(t) === null ? 0 : swapAmount(t)), 0),
);

export const netSwapR = memoize((trades: readonly Trade[]): number =>
  trades.reduce((sum, t) => {
    if (pnlAmount(t) === null || !Number.isFinite(t.rValueAtEntry) || t.rValueAtEntry === 0) return sum;
    return sum + swapAmount(t) / t.rValueAtEntry;
  }, 0),
);

/**
 * wins / (wins + losses). Break-even trades are excluded from both the
 * numerator and denominator — see docs/decisions.md § Phase 5, which
 * reverses the original Phase 2 call (BE in the denominator only, matching
 * mock 2c's "67%" / "6 / 9"). A BE-heavy period no longer drags this number
 * down for a reason that has nothing to do with actual win/loss skill;
 * `periodStats`/weekly-review separately report a BE count alongside it.
 */
export const winRate = memoize((trades: readonly Trade[]): number | null => {
  const decisive = trades.filter((t) => t.result === "win" || t.result === "loss");
  if (decisive.length === 0) return null;
  return decisive.filter((t) => t.result === "win").length / decisive.length;
});

/** Mean R per trade, break-even included — a scratch genuinely dilutes expectancy. */
export const expectancy = memoize((trades: readonly Trade[]): number | null =>
  mean(realizedRs(trades)),
);

/** Mean R of winners only. */
export const avgWin = memoize((trades: readonly Trade[]): number | null =>
  mean(realizedRs(trades.filter((t) => t.result === "win"))),
);

/** Mean R of losers only; stays negative (mock 1a shows "−0.9R"). */
export const avgLoss = memoize((trades: readonly Trade[]): number | null =>
  mean(realizedRs(trades.filter((t) => t.result === "loss"))),
);

/**
 * Mean hold time in minutes, over trades that recorded one. No longer shown
 * on the Trade log summary row (docs/decisions.md § Phase 5 — dropped as
 * unused; the per-trade Hold field/column stays) but kept as a selector in
 * case a future screen wants it.
 */
export const avgHoldMinutes = memoize((trades: readonly Trade[]): number | null =>
  mean(trades.map((t) => t.holdMinutes).filter((m): m is number => m !== null)),
);

export interface WinStreaks {
  longest: number;
  current: number;
}

/**
 * Break-even is neutral: it neither extends nor breaks a streak, it is skipped.
 * A trade with no result yet is skipped for the same reason. Only a loss resets.
 */
export const winStreaks = memoize((trades: readonly Trade[]): WinStreaks => {
  let current = 0;
  let longest = 0;

  for (const trade of sortChronologically(trades)) {
    if (trade.result === "win") {
      current += 1;
      longest = Math.max(longest, current);
    } else if (trade.result === "loss") {
      current = 0;
    }
    // 'be' and an unset result are skipped.
  }

  return { longest, current };
});

/**
 * (trades - off-plan trades) / trades, over every trade in the period.
 *
 * Reverse-engineered from two independent mocks and confirmed with the design
 * owner: 2c shows 89% with "1 off-plan" over a 9-trade week ((9-1)/9 = 88.9%),
 * and 1a shows 87% over 61 trades of which the 8 "Mid-range entry" ones are
 * flagged off-plan ((61-8)/61 = 86.9%). It reads the derived offPlan flag; the
 * manual "On plan" tag is a separate self-assessment and does not feed it.
 */
export const ruleAdherence = memoize((trades: readonly Trade[]): number | null => {
  if (trades.length === 0) return null;
  return (trades.length - trades.filter(offPlan).length) / trades.length;
});

export interface GroupStats {
  netR: number;
  tradeCount: number;
  winRate: number | null;
  avgR: number | null;
  offPlanCount: number;
}

function groupStats(trades: readonly Trade[]): GroupStats {
  const rs = realizedRs(trades);
  const net = rs.reduce((sum, r) => sum + r, 0);
  return {
    netR: net,
    tradeCount: trades.length,
    winRate: winRate(trades),
    // Mock 2d cross-check: C2 has +11.2R over 24 trades and shows "Avg R 0.47".
    avgR: trades.length === 0 ? null : net / trades.length,
    offPlanCount: trades.filter(offPlan).length,
  };
}

export interface ModelStats extends GroupStats {
  modelId: string | null;
  name: string;
  isRetired: boolean;
}

/**
 * Per-model breakdown, ordered by the Playbook's own `sortOrder`
 * (docs/README.md § Playbook: "the dashboard's model breakdown reads its order
 * from here"). Trades with no model land in a trailing "unassigned" group.
 */
export const byModel = memoize(
  (trades: readonly Trade[], models: readonly TradeModel[]): ModelStats[] => {
    const ordered = [...models].sort((a, b) => a.sortOrder - b.sortOrder);

    const rows: ModelStats[] = ordered.map((model) => ({
      modelId: model.id,
      name: model.name,
      isRetired: model.status === "retired",
      ...groupStats(trades.filter((t) => t.modelId === model.id)),
    }));

    const unassigned = trades.filter((t) => t.modelId === null);
    if (unassigned.length > 0) {
      rows.push({
        modelId: null,
        name: "Unassigned",
        isRetired: false,
        ...groupStats(unassigned),
      });
    }

    return rows;
  },
);

const SESSIONS: readonly Session[] = ["asia", "london", "ny_am"];
const SWEEP_SIDES: readonly SweepSide[] = ["low", "high", "both", "none"];

export interface SessionStats extends GroupStats {
  session: Session;
}

export const bySession = memoize((trades: readonly Trade[]): SessionStats[] =>
  SESSIONS.map((session) => ({
    session,
    ...groupStats(trades.filter((t) => t.session === session)),
  })),
);

export interface SweepSideStats extends GroupStats {
  sweepSide: SweepSide;
}

export const bySweepSide = memoize((trades: readonly Trade[]): SweepSideStats[] =>
  SWEEP_SIDES.map((sweepSide) => ({
    sweepSide,
    ...groupStats(trades.filter((t) => t.sweepSide === sweepSide)),
  })),
);

export interface DayStats {
  date: IsoDate;
  netR: number;
  tradeCount: number;
  /** Best and worst single trade of the day, for the calendar's hover tooltip. */
  bestR: number | null;
  worstR: number | null;
}

/** Day -> stats, for the calendar heatmap and its per-day tooltip. */
export const dailyNetR = memoize((trades: readonly Trade[]): Map<IsoDate, DayStats> => {
  const byDate = new Map<IsoDate, Trade[]>();
  for (const trade of trades) {
    const bucket = byDate.get(trade.date);
    if (bucket) bucket.push(trade);
    else byDate.set(trade.date, [trade]);
  }

  const out = new Map<IsoDate, DayStats>();
  for (const [date, dayTrades] of byDate) {
    const rs = realizedRs(dayTrades);
    out.set(date, {
      date,
      netR: rs.reduce((sum, r) => sum + r, 0),
      tradeCount: dayTrades.length,
      bestR: rs.length === 0 ? null : Math.max(...rs),
      worstR: rs.length === 0 ? null : Math.min(...rs),
    });
  }
  return out;
});

export interface EquityPoint {
  date: IsoDate;
  cumulativeR: number;
}

export interface EquityCurve {
  points: EquityPoint[];
  /** Largest peak-to-trough decline of the curve, as a positive R number. */
  maxDrawdownR: number;
  maxDrawdownDate: IsoDate | null;
}

/**
 * Cumulative R over time. The dashboard hero captions this with period start,
 * max drawdown, and period end (docs/README.md § Dashboard).
 */
export const equityCurve = memoize((trades: readonly Trade[]): EquityCurve => {
  const points: EquityPoint[] = [];
  let cumulative = 0;
  let peak = 0;
  let maxDrawdownR = 0;
  let maxDrawdownDate: IsoDate | null = null;

  for (const trade of sortChronologically(trades)) {
    const r = realizedR(trade);
    if (r === null) continue;

    cumulative += r;
    points.push({ date: trade.date, cumulativeR: cumulative });

    peak = Math.max(peak, cumulative);
    const drawdown = peak - cumulative;
    if (drawdown > maxDrawdownR) {
      maxDrawdownR = drawdown;
      maxDrawdownDate = trade.date;
    }
  }

  return { points, maxDrawdownR, maxDrawdownDate };
});

export type SweepAlignmentKey = "long_after_low" | "short_after_high" | "no_sweep";

export interface SweepAlignmentStats {
  key: SweepAlignmentKey;
  winRate: number | null;
  tradeCount: number;
}

const SWEEP_ALIGNMENT_FILTERS: Record<SweepAlignmentKey, (t: Trade) => boolean> = {
  long_after_low: (t) => t.direction === "long" && t.sweepSide === "low",
  short_after_high: (t) => t.direction === "short" && t.sweepSide === "high",
  no_sweep: (t) => t.sweepSide === "none",
};

/**
 * Win rate for the three CRT-alignment rows on "Session · sweep side"
 * (docs/README.md § Dashboard: "Long after low purge" / "Short after high
 * purge" / "Entry without a sweep"). Distinct from `bySweepSide` — these
 * cross sweep side with direction, since a long entry after a *high* purge
 * isn't the textbook setup even though it shares a `sweepSide` bucket with a
 * short entry that is.
 */
export const sweepAlignment = memoize((trades: readonly Trade[]): SweepAlignmentStats[] =>
  (Object.keys(SWEEP_ALIGNMENT_FILTERS) as SweepAlignmentKey[]).map((key) => {
    const matching = trades.filter(SWEEP_ALIGNMENT_FILTERS[key]);
    return { key, winRate: winRate(matching), tradeCount: matching.length };
  }),
);

export interface PeriodStats {
  tradeCount: number;
  netR: number;
  winRate: number | null;
  expectancy: number | null;
  avgWin: number | null;
  avgLoss: number | null;
  ruleAdherence: number | null;
  winStreaks: WinStreaks;
}

/** Everything the dashboard's hero + stat row needs, in one pass-through. */
export const periodStats = memoize((trades: readonly Trade[]): PeriodStats => ({
  tradeCount: trades.length,
  netR: netR(trades),
  winRate: winRate(trades),
  expectancy: expectancy(trades),
  avgWin: avgWin(trades),
  avgLoss: avgLoss(trades),
  ruleAdherence: ruleAdherence(trades),
  winStreaks: winStreaks(trades),
}));

/**
 * A net P&L within half a cent of zero counts as flat — the same scratch
 * tolerance `result`'s break-even label gives price, applied to currency so
 * float noise from `realizedR * rValueAtEntry` can't turn a flat trade into a
 * one-in-a-billion "win".
 */
const FLAT_PNL_EPSILON = 0.005;

export interface MoneyStats {
  /** Trades with an exit — the only ones that have a net P&L at all. */
  closedCount: number;
  /** Sum of `pnlAmount`: price + swap − commission. Equals capital.ts `tradingPnL`. */
  netPnl: number;
  /** Entry + exit commission over the closed trades, as a positive cost. */
  totalCommission: number;
  /** Swap over the closed trades, signed (negative = cost). */
  totalSwap: number;
  /**
   * Share of closed trades whose *net* P&L is positive, among those that
   * were net positive or net negative. Flat trades are left out of both
   * sides, mirroring `winRate`'s treatment of break-even.
   *
   * Deliberately independent of `result`: that label is price-based and
   * chosen by the trader, while this is what the account actually kept — a
   * +0.05R scratch that paid $7 commission is a price "be" and a net loss.
   */
  netWinRate: number | null;
  /** Mean net P&L per closed trade, flat ones included (they dilute it, as in `expectancy`). */
  avgNetPnl: number | null;
  /** Mean net P&L of net-positive trades. */
  avgNetWin: number | null;
  /** Mean net P&L of net-negative trades; stays negative. */
  avgNetLoss: number | null;
}

/**
 * The currency-denominated counterpart to `periodStats`, over net P&L
 * (docs/decisions.md § Commission). Open trades are skipped throughout —
 * their P&L, swap and commission aren't confirmed until the close — so
 * `netPnl`, `totalSwap` and `totalCommission` reconcile exactly with
 * `tradingPnL`/`tradingSwap`/`tradingCommission`.
 */
export const moneyStats = memoize((trades: readonly Trade[]): MoneyStats => {
  const pnls: number[] = [];
  let totalCommission = 0;
  let totalSwap = 0;

  for (const trade of trades) {
    const pnl = pnlAmount(trade);
    if (pnl === null) continue;
    pnls.push(pnl);
    totalCommission += commissionAmount(trade);
    totalSwap += swapAmount(trade);
  }

  const wins = pnls.filter((p) => p > FLAT_PNL_EPSILON);
  const losses = pnls.filter((p) => p < -FLAT_PNL_EPSILON);
  const decisive = wins.length + losses.length;

  return {
    closedCount: pnls.length,
    netPnl: pnls.reduce((sum, p) => sum + p, 0),
    totalCommission,
    totalSwap,
    netWinRate: decisive === 0 ? null : wins.length / decisive,
    avgNetPnl: mean(pnls),
    avgNetWin: mean(wins),
    avgNetLoss: mean(losses),
  };
});
