/**
 * Dashboard's date-range picker (docs/decisions.md § Dashboard period
 * picker). Mock 1a's hero is fixed to "Month to date"; that stops working
 * once a backtest account holds a year or more of history dated nowhere near
 * the real current month. URL state, same convention as Trade log's own date
 * filter (docs/decisions.md § Phase 6): explicit choices are bookmarkable,
 * the unset/default state stays out of the query string entirely.
 */

import { isoMonthOf, monthRange, shiftMonth, todayIso, type IsoMonth } from "./dates";
import type { IsoDate } from "./types";

/**
 * Two different kinds of "preset": `this-month`/`last-month`/`3m`/`ytd`/`all`
 * are *rolling* — resolved fresh against today every time the URL is read,
 * so a bookmarked "This year" always means this year, not a snapshot frozen
 * to whenever it was first picked. `month` and `custom` are *frozen* —
 * concrete values baked into the URL, exactly like Trade log's `from`/`to`.
 * `‹`/`›` only have a well-defined "one step over" for the rolling-but-still
 * single-month kinds (`this-month`/`last-month`/`month`) and for `month`
 * itself; the others report `stepMonth: null` and the caller disables them.
 */
export type DashboardRangeKind = "this-month" | "last-month" | "month" | "3m" | "ytd" | "all" | "custom";

const RANGE_KINDS: readonly DashboardRangeKind[] = [
  "this-month",
  "last-month",
  "month",
  "3m",
  "ytd",
  "all",
  "custom",
];

function isRangeKind(value: string | undefined): value is DashboardRangeKind {
  return value !== undefined && (RANGE_KINDS as readonly string[]).includes(value);
}

/** The parsed `?range=&month=&from=&to=` — null means "no explicit choice", i.e. the "all" default. */
export interface DashboardPeriod {
  kind: DashboardRangeKind;
  /** Set only for `kind: "month"`. */
  month: IsoMonth | null;
  /** Set only for `kind: "custom"`. */
  from: IsoDate | null;
  to: IsoDate | null;
}

type RawParams = { range?: string; month?: string; from?: string; to?: string };

/** Anything absent or malformed resolves to `null` ("no explicit choice") rather than throwing. */
export function parseDashboardPeriod(params: RawParams): DashboardPeriod | null {
  if (!isRangeKind(params.range)) return null;

  if (params.range === "month") {
    if (!/^\d{4}-\d{2}$/.test(params.month ?? "")) return null;
    return { kind: "month", month: params.month!, from: null, to: null };
  }
  if (params.range === "custom") {
    if (!/^\d{4}-\d{2}-\d{2}$/.test(params.from ?? "") || !/^\d{4}-\d{2}-\d{2}$/.test(params.to ?? "")) {
      return null;
    }
    if (params.from! > params.to!) return null;
    return { kind: "custom", month: null, from: params.from!, to: params.to! };
  }
  return { kind: params.range, month: null, from: null, to: null };
}

export interface ResolvedDashboardPeriod {
  kind: DashboardRangeKind;
  from: IsoDate;
  to: IsoDate;
  /** The month `‹`/`›` step from — null when this range has no single-month meaning (3m/ytd/all/custom). */
  stepMonth: IsoMonth | null;
}

/**
 * `period` from `parseDashboardPeriod` (or `null` for "no explicit choice")
 * into a concrete `[from, to]` plus what `‹`/`›` should step. No explicit
 * choice resolves to "all" (All time). `defaultMonth` is only the fallback
 * for a `month` period that carries no month of its own.
 */
export function resolveDashboardPeriod(
  period: DashboardPeriod | null,
  defaultMonth: IsoMonth,
  today: IsoDate = todayIso(),
): ResolvedDashboardPeriod {
  const kind = period?.kind ?? "all";
  const todaysMonth = isoMonthOf(today);

  if (kind === "this-month") {
    return { kind, ...monthRange(todaysMonth), stepMonth: todaysMonth };
  }
  if (kind === "last-month") {
    const month = shiftMonth(todaysMonth, -1);
    return { kind, ...monthRange(month), stepMonth: month };
  }
  if (kind === "month") {
    const month = period?.month ?? defaultMonth;
    // A specific month that happens to be the real current one reads (and
    // behaves) exactly like "this-month" — when `‹`/`›` lands back on
    // today's month, "Month to date" is simply the accurate label for what's
    // on screen.
    return month === todaysMonth
      ? { kind: "this-month", ...monthRange(month), stepMonth: month }
      : { kind, ...monthRange(month), stepMonth: month };
  }
  if (kind === "3m") {
    const from = monthRange(shiftMonth(isoMonthOf(today), -2)).from;
    return { kind, from, to: today, stepMonth: null };
  }
  if (kind === "ytd") {
    return { kind, from: `${today.slice(0, 4)}-01-01`, to: today, stepMonth: null };
  }
  if (kind === "all") {
    // No real lower bound needed — the caller takes every trade for "all"
    // rather than filtering by this range; `from` here is only ever used for
    // display, so an arbitrarily early sentinel is fine.
    return { kind, from: "1970-01-01", to: today, stepMonth: null };
  }
  // custom
  const from = period?.from ?? today;
  const to = period?.to ?? today;
  return { kind, from, to, stepMonth: null };
}

/** The query string for a period — matches `buildTradeLogSearchParams`'s own convention (no leading `?`). */
export function buildDashboardPeriodSearchParams(period: DashboardPeriod): string {
  const params = new URLSearchParams();
  params.set("range", period.kind);
  if (period.kind === "month" && period.month !== null) params.set("month", period.month);
  if (period.kind === "custom" && period.from !== null && period.to !== null) {
    params.set("from", period.from);
    params.set("to", period.to);
  }
  return params.toString();
}

/** `‹`/`›`'s own href target: always a frozen `month`, one step from `month`. */
export function stepMonthSearchParams(month: IsoMonth, delta: number): string {
  return buildDashboardPeriodSearchParams({ kind: "month", month: shiftMonth(month, delta), from: null, to: null });
}
