/**
 * Month math for the Dashboard and Calendar. Dates stay `YYYY-MM-DD` strings
 * throughout the domain (docs/decisions.md § Phase 2), so months are their own
 * small `YYYY-MM` string type rather than reaching for a date library — every
 * calculation here only ever needs a year and a month number.
 */

import type { Locale } from "@/lib/i18n/locale";
import type { IsoDate } from "./types";

/** `YYYY-MM`. Sorts correctly as a string, same as `IsoDate`. */
export type IsoMonth = string;

function splitMonth(month: IsoMonth): { year: number; month: number } {
  const [year, m] = month.split("-").map(Number);
  return { year, month: m };
}

export function todayIso(): IsoDate {
  return new Date().toISOString().slice(0, 10);
}

export function currentIsoMonth(): IsoMonth {
  return todayIso().slice(0, 7);
}

export function isoMonthOf(date: IsoDate): IsoMonth {
  return date.slice(0, 7);
}

export function isValidIsoMonth(value: string | undefined | null): value is IsoMonth {
  return value !== undefined && value !== null && /^\d{4}-\d{2}$/.test(value);
}

/** First and last day of the month, inclusive — feeds `filterByDateRange`. */
export function monthRange(month: IsoMonth): { from: IsoDate; to: IsoDate } {
  const { year, month: m } = splitMonth(month);
  // Day 0 of the next month is the last day of this one.
  const lastDay = new Date(Date.UTC(year, m, 0)).getUTCDate();
  return { from: `${month}-01`, to: `${month}-${String(lastDay).padStart(2, "0")}` };
}

export function shiftMonth(month: IsoMonth, delta: number): IsoMonth {
  const { year, month: m } = splitMonth(month);
  const date = new Date(Date.UTC(year, m - 1 + delta, 1));
  return `${date.getUTCFullYear()}-${String(date.getUTCMonth() + 1).padStart(2, "0")}`;
}

/**
 * "September 2026" / "2026년 9월" (docs/README.md § Calendar), or with
 * `withYear: false`, just "9월" for the mobile home header's "9월 기록"
 * (docs/README.md § Mobile: Home) — Korean has no separate month-name form,
 * so `{ month: "long" }` alone already renders as the bare "9월".
 */
export function formatMonthLabel(month: IsoMonth, locale: Locale, withYear = true): string {
  const { year, month: m } = splitMonth(month);
  return new Intl.DateTimeFormat(locale === "ko" ? "ko-KR" : "en-US", {
    ...(withYear ? { year: "numeric" as const } : {}),
    month: "long",
    timeZone: "UTC",
  }).format(new Date(Date.UTC(year, m - 1, 1)));
}

/**
 * A flat, Sunday-first grid of the month's cells, padded with `null` on both
 * ends to complete whole weeks (docs/design-canvas.html's 1a/1c calendars
 * both show leading blank cells before day 1) — a plain `grid-cols-7` wraps
 * every 7 entries into a row, so callers never need the weeks nested.
 */
export function buildMonthGrid(month: IsoMonth): (IsoDate | null)[] {
  const { year, month: m } = splitMonth(month);
  const firstWeekday = new Date(Date.UTC(year, m - 1, 1)).getUTCDay();
  const daysInMonth = new Date(Date.UTC(year, m, 0)).getUTCDate();

  const cells: (IsoDate | null)[] = [];
  for (let i = 0; i < firstWeekday; i++) cells.push(null);
  for (let d = 1; d <= daysInMonth; d++) cells.push(`${month}-${String(d).padStart(2, "0")}`);
  while (cells.length % 7 !== 0) cells.push(null);
  return cells;
}
