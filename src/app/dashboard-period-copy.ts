import type { DashboardRangeKind } from "@/lib/domain/dashboard-period";
import type { LocaleStrings } from "@/lib/i18n/locale";

/** The preset list shown in the picker's popover, in display order. "month" isn't offered directly — it's only ever reached via `‹`/`›` or the smart default. */
export const DASHBOARD_RANGE_PRESETS: readonly DashboardRangeKind[] = [
  "this-month",
  "last-month",
  "3m",
  "ytd",
  "all",
  "custom",
];

export const DASHBOARD_RANGE_LABELS: Record<DashboardRangeKind, LocaleStrings> = {
  "this-month": { en: "This month", ko: "이번 달" },
  "last-month": { en: "Last month", ko: "지난 달" },
  month: { en: "Month", ko: "월" }, // never shown as a preset row; falls back to a month name everywhere it's displayed
  "3m": { en: "Last 3 months", ko: "최근 3개월" },
  ytd: { en: "This year", ko: "올해" },
  all: { en: "All time", ko: "전체" },
  custom: { en: "Custom range", ko: "직접 지정" },
};

/**
 * The hero's own label (docs/decisions.md § Dashboard period picker) — mock
 * 1a's fixed "Month to date" only reads correctly for `this-month`, where
 * the month is still genuinely in progress; every other kind gets its own
 * wording rather than the misleading "to date".
 */
export const DASHBOARD_HERO_LABELS: Record<DashboardRangeKind, LocaleStrings> = {
  "this-month": { en: "Month to date", ko: "이번 달 누적" },
  "last-month": { en: "Last month", ko: "지난 달" },
  month: { en: "Net R", ko: "순 R" },
  "3m": { en: "Last 3 months", ko: "최근 3개월" },
  ytd: { en: "This year", ko: "올해" },
  all: { en: "All time", ko: "전체" },
  custom: { en: "Selected period", ko: "선택한 기간" },
};
