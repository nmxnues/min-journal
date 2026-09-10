/**
 * Week math and the pure derived data Weekly review needs (docs/README.md §
 * 7). Weeks are ISO 8601 (`YYYY-Www`, Monday-start, week 1 = the week
 * containing the year's first Thursday) — the standard the mock's own
 * "Week 37 · Sep 7 — Sep 13" example matches exactly for 2026-09-09.
 */

import { dailyNetR } from "./stats";
import { realizedR } from "./trade";
import type { Locale } from "@/lib/i18n/locale";
import { formatTradeDate } from "@/lib/format";
import type { FocusItem, IsoDate, Trade } from "./types";

export type IsoWeek = string;

function pad2(n: number): string {
  return String(n).padStart(2, "0");
}

function fmtDate(d: Date): IsoDate {
  return `${d.getUTCFullYear()}-${pad2(d.getUTCMonth() + 1)}-${pad2(d.getUTCDate())}`;
}

export function todayIsoWeek(): IsoWeek {
  return isoWeekOf(new Date().toISOString().slice(0, 10));
}

export function isoWeekOf(date: IsoDate): IsoWeek {
  const [y, m, d] = date.split("-").map(Number);
  const dt = new Date(Date.UTC(y, m - 1, d));
  const dayNum = (dt.getUTCDay() + 6) % 7; // Mon=0..Sun=6
  dt.setUTCDate(dt.getUTCDate() - dayNum + 3); // nearest Thursday

  const firstThursday = new Date(Date.UTC(dt.getUTCFullYear(), 0, 4));
  const firstDayNum = (firstThursday.getUTCDay() + 6) % 7;
  firstThursday.setUTCDate(firstThursday.getUTCDate() - firstDayNum + 3);

  const week = 1 + Math.round((dt.getTime() - firstThursday.getTime()) / (7 * 86_400_000));
  return `${dt.getUTCFullYear()}-W${pad2(week)}`;
}

/** Monday through Sunday, inclusive. */
export function isoWeekRange(isoWeek: IsoWeek): { from: IsoDate; to: IsoDate } {
  const [yearStr, weekStr] = isoWeek.split("-W");
  const year = Number(yearStr);
  const week = Number(weekStr);

  const jan4 = new Date(Date.UTC(year, 0, 4));
  const jan4DayNum = (jan4.getUTCDay() + 6) % 7;
  const week1Monday = new Date(jan4);
  week1Monday.setUTCDate(jan4.getUTCDate() - jan4DayNum);

  const monday = new Date(week1Monday);
  monday.setUTCDate(week1Monday.getUTCDate() + (week - 1) * 7);
  const sunday = new Date(monday);
  sunday.setUTCDate(monday.getUTCDate() + 6);

  return { from: fmtDate(monday), to: fmtDate(sunday) };
}

export function shiftIsoWeek(isoWeek: IsoWeek, delta: number): IsoWeek {
  const { from } = isoWeekRange(isoWeek);
  const [y, m, d] = from.split("-").map(Number);
  const dt = new Date(Date.UTC(y, m - 1, d + delta * 7));
  return isoWeekOf(fmtDate(dt));
}

export function isValidIsoWeek(value: string | undefined | null): value is IsoWeek {
  return value !== undefined && value !== null && /^\d{4}-W\d{2}$/.test(value);
}

/** "Week 37 · Sep 7 – Sep 13" / "37주차 · 9월 7일 – 9월 13일". */
export function formatWeekLabel(isoWeek: IsoWeek, locale: Locale): string {
  const week = Number(isoWeek.split("-W")[1]);
  const { from, to } = isoWeekRange(isoWeek);
  const fromLabel = formatTradeDate(from, locale, true);
  const toLabel = formatTradeDate(to, locale, true);
  return locale === "ko" ? `${week}주차 · ${fromLabel} – ${toLabel}` : `Week ${week} · ${fromLabel} – ${toLabel}`;
}

export interface DayBar {
  date: IsoDate;
  netR: number;
  tradeCount: number;
}

/** One entry per day of the week, Monday first, even for a day with no trades. */
export function dayByDayBars(trades: readonly Trade[], weekFrom: IsoDate): DayBar[] {
  const map = dailyNetR(trades);
  const [y, m, d] = weekFrom.split("-").map(Number);
  const days: DayBar[] = [];
  for (let i = 0; i < 7; i++) {
    const date = fmtDate(new Date(Date.UTC(y, m - 1, d + i)));
    const stat = map.get(date);
    days.push({ date, netR: stat?.netR ?? 0, tradeCount: stat?.tradeCount ?? 0 });
  }
  return days;
}

export interface TagFrequency {
  tag: string;
  count: number;
}

/** Counts every tag across the given trades, most frequent first. */
export function tagFrequency(trades: readonly Trade[]): TagFrequency[] {
  const counts = new Map<string, number>();
  for (const trade of trades) {
    for (const tag of trade.tags) counts.set(tag, (counts.get(tag) ?? 0) + 1);
  }
  return [...counts.entries()].map(([tag, count]) => ({ tag, count })).sort((a, b) => b.count - a.count);
}

/** The single best and worst realized trade of the period, by R. Ties keep the first one seen. */
export function bestWorstTrade(trades: readonly Trade[]): { best: Trade | null; worst: Trade | null } {
  let best: Trade | null = null;
  let worst: Trade | null = null;
  let bestR = -Infinity;
  let worstR = Infinity;

  for (const trade of trades) {
    const r = realizedR(trade);
    if (r === null) continue;
    if (r > bestR) {
      bestR = r;
      best = trade;
    }
    if (r < worstR) {
      worstR = r;
      worst = trade;
    }
  }

  return { best, worst };
}

/**
 * The "Vs. 4-week avg" stat card — mean net R per calendar week over the 4
 * ISO weeks immediately preceding `weeks`' own reference point, treating a
 * week with no realized trades as 0 rather than skipping it (an average
 * "per week you were trading" would overstate a habit of skipping weeks).
 */
export function averageWeeklyNetR(trades: readonly Trade[], weeks: readonly IsoWeek[]): number {
  if (weeks.length === 0) return 0;
  const sums = new Map<IsoWeek, number>(weeks.map((w) => [w, 0]));
  for (const trade of trades) {
    const r = realizedR(trade);
    if (r === null) continue;
    const week = isoWeekOf(trade.date);
    const current = sums.get(week);
    if (current !== undefined) sums.set(week, current + r);
  }
  return [...sums.values()].reduce((sum, v) => sum + v, 0) / weeks.length;
}

/**
 * docs/README.md § Weekly review: "Items carry over to the next week's
 * review until unchecked" — an item that's still unchecked at week's end
 * moves to the new week; a checked one is done and drops off.
 */
export function carryOverFocusItems(previous: readonly FocusItem[]): FocusItem[] {
  return previous.filter((item) => !item.checked).map((item) => ({ ...item }));
}
