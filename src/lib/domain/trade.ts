/**
 * Per-trade derived values.
 *
 * Nothing here is stored — docs/build-prompt.md §4: derived values are never
 * columns. The single frozen exception is `rValueAtEntry`, which is written
 * once at log time and read (never recomputed) by `pnlAmount`.
 *
 * Every function is tolerant of incomplete input and returns `null` rather
 * than NaN/Infinity, because the New Trade form recomputes these on every
 * keystroke (docs/README.md § Interactions: "derived fields recompute on
 * every keystroke") while fields are still half-typed.
 */

import { MID_RANGE_HALF_BAND } from "./constants";
import type { SweepSide, Trade } from "./types";

function isUsable(n: number | null | undefined): n is number {
  return typeof n === "number" && Number.isFinite(n);
}

/** rangeSize = rangeHigh - rangeLow. Null unless the range is valid (high > low). */
export function rangeSize(t: Pick<Trade, "rangeHigh" | "rangeLow">): number | null {
  if (!isUsable(t.rangeHigh) || !isUsable(t.rangeLow)) return null;
  const size = t.rangeHigh - t.rangeLow;
  return size > 0 ? size : null;
}

/**
 * Where a price sits inside the range, as a fraction: 0 = range low,
 * 1 = range high. Can fall outside 0..1 for prices beyond the range
 * (a sweep wick, or an expansion target past the opposite extreme).
 *
 * Verified against docs/design-canvas.html mock 2b: exit 23,451.75 in the
 * range 23,402.75-23,486.25 is 0.587, labelled "Expansion · exit at 59%".
 */
export function rangePosition(
  price: number | null | undefined,
  t: Pick<Trade, "rangeHigh" | "rangeLow">,
): number | null {
  const size = rangeSize(t);
  if (size === null || !isUsable(price)) return null;
  return (price - t.rangeLow) / size;
}

/** risk = |entry - stop|, in price terms. Null when the two are equal (no risk to divide by). */
export function risk(t: Pick<Trade, "entry" | "stop">): number | null {
  if (!isUsable(t.entry) || !isUsable(t.stop)) return null;
  const r = Math.abs(t.entry - t.stop);
  return r > 0 ? r : null;
}

/** plannedR = |target - entry| / risk. Direction-independent (docs/README.md § Interactions). */
export function plannedR(t: Pick<Trade, "entry" | "stop" | "target">): number | null {
  const r = risk(t);
  if (r === null || !isUsable(t.target)) return null;
  return Math.abs(t.target - t.entry) / r;
}

/**
 * realizedR = (exit - entry) / risk, sign-flipped for shorts.
 *
 * `result` is a label and never an input here: a trade marked 'be' gets its R
 * from its actual exit like any other, so it lands at ~0.0R on its own. That
 * keeps `pnlAmount` reconcilable with the real account balance when a "break
 * even" exit was actually a few ticks off (docs/decisions.md).
 *
 * Null (not 0) when there is no exit — an unclosed trade has an unknown R,
 * and counting it as zero would quietly drag net R and expectancy toward 0.
 */
export function realizedR(
  t: Pick<Trade, "entry" | "stop" | "exit" | "direction">,
): number | null {
  const r = risk(t);
  if (r === null || !isUsable(t.exit)) return null;
  const raw = (t.exit - t.entry) / r;
  return t.direction === "short" ? -raw : raw;
}

/** Share of the planned move actually captured — mock 2b's "Planned 3.0R · 93% captured". */
export function captureRate(
  t: Pick<Trade, "entry" | "stop" | "target" | "exit" | "direction">,
): number | null {
  const planned = plannedR(t);
  const realized = realizedR(t);
  if (planned === null || realized === null || planned === 0) return null;
  return realized / planned;
}

/**
 * Entry sitting in the middle of the range, i.e. neither extreme was the
 * reference for the entry. Band is MID_RANGE_HALF_BAND either side of the 50%
 * equilibrium line (default 40%-60%).
 */
export function entryIsMidRange(
  t: Pick<Trade, "entry" | "rangeHigh" | "rangeLow">,
): boolean {
  const position = rangePosition(t.entry, t);
  if (position === null) return false;
  return Math.abs(position - 0.5) <= MID_RANGE_HALF_BAND;
}

/**
 * Which extreme was purged, inferred from where the stop sits.
 *
 * docs/README.md § Interactions has sweep side "inferred from which extreme
 * was purged (or explicitly chosen in the mobile wizard)" but never says from
 * what. The Playbook's own C2 rule 4 does: "Stop beyond the sweep wick" — so a
 * stop below the range low means the low was swept, above the high means the
 * high was, and a stop inside the range means neither.
 *
 * Verified against mock 1b: stop 23,396.50 against a 23,402.75 low derives
 * "low", which is exactly the "Low purged" the mock prints in that panel.
 *
 * `both` is unreachable by inference and needs the explicit override the form
 * offers (and the mobile wizard asks for outright).
 */
export function deriveSweepSide(
  t: Pick<Trade, "stop" | "rangeHigh" | "rangeLow">,
): SweepSide | null {
  if (rangeSize(t) === null || !isUsable(t.stop)) return null;
  if (t.stop < t.rangeLow) return "low";
  if (t.stop > t.rangeHigh) return "high";
  return "none";
}

/**
 * docs/README.md § Interactions: "Show 'Off-plan' automatically when sweep
 * side = none or entry sits mid-range."
 *
 * Deliberately trade-local: a model being retired does NOT feed into this.
 * offPlan is recomputed on read, so including model status would retroactively
 * flip already-logged trades to off-plan every time a model is retired, which
 * would rewrite history and silently move past adherence numbers. README's
 * "retiring ... marks future matches off-plan" is honoured at log time, as a
 * warning in the trade form, instead (docs/decisions.md).
 */
export function offPlan(
  t: Pick<Trade, "sweepSide" | "entry" | "rangeHigh" | "rangeLow">,
): boolean {
  return t.sweepSide === "none" || entryIsMidRange(t);
}

/** Currency P&L, using the 1R value frozen when the trade was logged. */
export function pnlAmount(
  t: Pick<Trade, "entry" | "stop" | "exit" | "direction" | "rValueAtEntry">,
): number | null {
  const realized = realizedR(t);
  if (realized === null || !isUsable(t.rValueAtEntry)) return null;
  return realized * t.rValueAtEntry;
}
