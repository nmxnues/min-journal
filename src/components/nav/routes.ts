import { BarChart3, CalendarDays, LineChart, NotebookPen, Wallet } from "lucide-react";
import type { ComponentType } from "react";
import type { LocaleStrings } from "@/lib/i18n/locale";

/**
 * The app's five top-level destinations, in one place so TopBar (desktop) and
 * BottomTabBar (mobile) can never drift on labels, icons, or order. `enabled`
 * tracks which routes actually exist yet — Dashboard and Calendar as of
 * Phase 5, Trades/Playbook/Capital not built. Korean sides are natural
 * equivalents, not literal translations (docs/README.md §9's own example
 * pairs "Month to date" with "이번 달 누적"): "홈" for the dashboard/home tab,
 * and "자산" for Capital is lifted directly from the 3b-mobile mock's own
 * header for that screen.
 */
export interface NavRoute {
  href: string;
  strings: LocaleStrings;
  icon: ComponentType<{ size?: number; className?: string; "aria-hidden"?: boolean }>;
  enabled: boolean;
}

export const NAV_ROUTES: readonly NavRoute[] = [
  { href: "/", strings: { en: "Dashboard", ko: "홈" }, icon: BarChart3, enabled: true },
  { href: "/trades", strings: { en: "Trades", ko: "기록" }, icon: NotebookPen, enabled: false },
  { href: "/calendar", strings: { en: "Calendar", ko: "캘린더" }, icon: CalendarDays, enabled: true },
  { href: "/playbook", strings: { en: "Playbook", ko: "플레이북" }, icon: LineChart, enabled: false },
  { href: "/capital", strings: { en: "Capital", ko: "자산" }, icon: Wallet, enabled: false },
];

/** `NavRoute[]` -> `TopBar`'s item shape, resolving copy through the caller's own `useT()`. */
export function toNavItems(t: (strings: LocaleStrings) => string) {
  return NAV_ROUTES.map((route) => ({ href: route.href, label: t(route.strings), disabled: !route.enabled }));
}

/** `NavRoute[]` -> `BottomTabBar`'s item shape. */
export function toTabItems(t: (strings: LocaleStrings) => string) {
  return NAV_ROUTES.map((route) => ({
    href: route.href,
    label: t(route.strings),
    icon: route.icon,
    disabled: !route.enabled,
  }));
}
