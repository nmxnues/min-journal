"use client";

import type { IsoMonth } from "@/lib/domain/dates";
import type { Trade, TradeModel } from "@/lib/domain/types";
import { useLocale } from "@/lib/i18n/locale-context";
import { DesktopCalendar } from "./desktop-calendar";
import { MobileCalendar } from "./mobile-calendar";

export interface CalendarViewProps {
  month: IsoMonth;
  trades: Trade[];
  models: TradeModel[];
  hasAccount: boolean;
}

/** Same locale branch as Dashboard/New trade — mock 1c (desktop) and mock
 * 1d's calendar screen (mobile) are two different designs, not one reflowed
 * layout (docs/decisions.md § Phase 5). */
export function CalendarView(props: CalendarViewProps) {
  const locale = useLocale();
  // Keyed by month: navigating months keeps this on the same route (only the
  // `?month=` query changes), so React would otherwise reuse the existing
  // component instance and its local state — MobileCalendar's `selectedDate`
  // defaults to "today" only on mount, and without a remount it kept
  // pointing at the previous month's date after `‹`/`›` (docs/decisions.md §
  // Phase 5). Keying by month forces a clean remount for both views instead
  // of hand-syncing every piece of local state to the new month.
  if (locale === "ko") return <MobileCalendar key={props.month} {...props} />;
  return <DesktopCalendar key={props.month} {...props} />;
}
