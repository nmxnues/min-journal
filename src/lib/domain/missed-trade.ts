/**
 * Missed trades — setups the system called valid that weren't taken — and
 * the hypothetical R they would have made (docs/decisions.md § Missed trades).
 *
 * Kept apart from `Trade` on purpose: a missed trade has no account, no size
 * and no frozen 1R, and nothing in stats.ts / capital.ts ever sees one. The
 * only place the two meet is `comparePeriod`, which puts the two totals side
 * by side for the Missed trades screen.
 */

import { isJpyPair } from "@/lib/instruments";
import { commissionR, plannedR, realizedR, risk } from "./trade";
import type { Direction, IsoDate, Session, Trade, TradeResult } from "./types";

export type MissReason = "fear" | "prior_loss" | "low_conviction" | "away" | "other";

export const MISS_REASON_ORDER: readonly MissReason[] = ["fear", "prior_loss", "low_conviction", "away", "other"];

export interface MissedTrade {
  id: string;
  date: IsoDate;
  /** `HH:MM`, or null when not recorded. */
  time: string | null;
  session: Session | null;
  instrument: string;
  direction: Direction;
  entry: number | null;
  stop: number | null;
  target: number | null;
  setupNote: string | null;
  missReason: MissReason;
  missReasonNote: string | null;
  result: TradeResult;
  /** Settings' one-way rate per 1.0 lot, frozen when the row was logged. */
  commissionPerLotPerSide: number;
  notes: string | null;
  createdAt: string;
  updatedAt: string;
}

/** Units of base currency in one standard lot. */
const LOT_UNITS = 100_000;

/**
 * Rough USD value of one unit of each quote currency, used only for crosses
 * (neither side is USD) where the trade's own price can't convert the pip
 * value. The user accepted an approximation here; update these if they drift
 * far enough to matter.
 */
export const APPROX_USD_PER_UNIT: Readonly<Record<string, number>> = {
  USD: 1,
  EUR: 1.17,
  GBP: 1.35,
  AUD: 0.66,
  NZD: 0.59,
  CAD: 0.72,
  CHF: 1.25,
  JPY: 0.0068,
};

function isUsable(n: number | null | undefined): n is number {
  return typeof n === "number" && Number.isFinite(n);
}

/**
 * USD value of a 1.0 price move on one standard lot.
 *
 *   XXXUSD: exact — the quote currency is already USD.
 *   USDXXX: exact — the trade's own price converts the quote currency.
 *   crosses: approximate — `APPROX_USD_PER_UNIT[quote]`.
 *
 * Null when the instrument isn't a six-letter pair or the quote currency
 * isn't in the table.
 */
export function usdPerPricePerLot(instrument: string, price: number | null): number | null {
  const symbol = instrument.trim().toUpperCase();
  if (!/^[A-Z]{6}$/.test(symbol)) return null;
  const base = symbol.slice(0, 3);
  const quote = symbol.slice(3);
  if (quote === "USD") return LOT_UNITS;
  if (base === "USD") return isUsable(price) && price > 0 ? LOT_UNITS / price : null;
  const rate = APPROX_USD_PER_UNIT[quote];
  return rate === undefined ? null : LOT_UNITS * rate;
}

/**
 * Round-trip commission in R, derived from the stop distance instead of a lot
 * size — the trader sizes every trade so the stop costs exactly 1R, so
 *
 *     lots = 1R / (stopDistance * usdPerPricePerLot)
 *     commissionR = lots * rate * 2 / 1R = 2 * rate / (stopDistance * usdPerPricePerLot)
 *
 * and the account balance cancels out. Same per-lot, both-sides rule the real
 * trade form prefills with (`commissionForSize`).
 */
export function missedCommissionR(
  m: Pick<MissedTrade, "instrument" | "entry" | "stop" | "commissionPerLotPerSide">,
): number | null {
  const stopDistance = risk({ entry: m.entry as number, stop: m.stop as number });
  if (stopDistance === null) return null;
  if (!isUsable(m.commissionPerLotPerSide) || m.commissionPerLotPerSide <= 0) return 0;
  const perLot = usdPerPricePerLot(m.instrument, m.entry);
  if (perLot === null) return null;
  return (2 * m.commissionPerLotPerSide) / (stopDistance * perLot);
}

/**
 * Hypothetical R before commission: a win reaches the target, a loss is the
 * full stop, break-even is 0. Null when the prices it needs are missing.
 */
export function missedGrossR(
  m: Pick<MissedTrade, "entry" | "stop" | "target" | "result">,
): number | null {
  const entry = m.entry as number;
  const stop = m.stop as number;
  if (risk({ entry, stop }) === null) return null;
  if (m.result === "loss") return -1;
  if (m.result === "be") return 0;
  return plannedR({ entry, stop, target: m.target });
}

/**
 * Hypothetical R after commission. A break-even still pays both sides, so it
 * lands slightly below 0. Null (unknown, not 0) when entry/stop — or the
 * target, for a win — weren't recorded, the same way an open trade's R is
 * unknown rather than zero.
 */
export function missedNetR(m: MissedTrade): number | null {
  const gross = missedGrossR(m);
  const commission = missedCommissionR(m);
  if (gross === null || commission === null) return null;
  return gross - commission;
}

/**
 * Real trades' R with each trade's own recorded commission taken off — the
 * like-for-like figure to set beside the missed trades' net R. Screen-only:
 * `netR` and every other R statistic stay price-only (docs/decisions.md §
 * Commission). Open trades contribute nothing, as in `netR`.
 */
export function netRAfterCommission(trades: readonly Trade[]): number {
  let sum = 0;
  for (const t of trades) {
    const r = realizedR(t);
    if (r === null) continue;
    sum += r - (commissionR(t) ?? 0);
  }
  return sum;
}

export interface ReasonCount {
  reason: MissReason;
  count: number;
}

export interface MissedSummary {
  count: number;
  winCount: number;
  lossCount: number;
  beCount: number;
  /** Sum of `missedNetR` over the rows where it is known. */
  netR: number;
  /** Rows left out of `netR` because their R is unknown. */
  unknownRCount: number;
  /** Every reason, most frequent first; ties keep MISS_REASON_ORDER. */
  byReason: ReasonCount[];
}

export function summarizeMissed(missed: readonly MissedTrade[]): MissedSummary {
  const counts = new Map<MissReason, number>(MISS_REASON_ORDER.map((r) => [r, 0]));
  let netR = 0;
  let unknownRCount = 0;
  for (const m of missed) {
    counts.set(m.missReason, (counts.get(m.missReason) ?? 0) + 1);
    const r = missedNetR(m);
    if (r === null) unknownRCount += 1;
    else netR += r;
  }
  const byReason = MISS_REASON_ORDER.map((reason) => ({ reason, count: counts.get(reason) ?? 0 })).sort(
    (a, b) => b.count - a.count,
  );
  return {
    count: missed.length,
    winCount: missed.filter((m) => m.result === "win").length,
    lossCount: missed.filter((m) => m.result === "loss").length,
    beCount: missed.filter((m) => m.result === "be").length,
    netR,
    unknownRCount,
    byReason,
  };
}

/** Pip distance label helper for the list — JPY pairs quote pips at 0.01. */
export function stopPips(m: Pick<MissedTrade, "instrument" | "entry" | "stop">): number | null {
  const distance = risk({ entry: m.entry as number, stop: m.stop as number });
  if (distance === null) return null;
  return distance / (isJpyPair(m.instrument) ? 0.01 : 0.0001);
}
