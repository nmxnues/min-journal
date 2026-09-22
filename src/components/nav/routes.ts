import { BarChart3, CalendarDays, EyeOff, LineChart, NotebookPen, Wallet } from "lucide-react";
import type { ComponentType } from "react";
import type { LocaleStrings } from "@/lib/i18n/locale";

/**
 * The app's five top-level destinations, in one place so TopBar (desktop) and
 * BottomTabBar (mobile) can never drift on labels, icons, or order. `enabled`
 * tracks which routes actually exist yet — all five as of Phase 8. Korean sides are natural
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
  /**
   * Top bar only. Missed trades is a desk-side review screen, and a sixth
   * tab would crowd the phone's bottom bar (its page still works there).
   */
  desktopOnly?: boolean;
}

export const NAV_ROUTES: readonly NavRoute[] = [
  { href: "/", strings: { en: "Dashboard", ko: "홈" }, icon: BarChart3, enabled: true },
  { href: "/trades", strings: { en: "Trades", ko: "기록" }, icon: NotebookPen, enabled: true },
  { href: "/calendar", strings: { en: "Calendar", ko: "캘린더" }, icon: CalendarDays, enabled: true },
  { href: "/playbook", strings: { en: "Playbook", ko: "플레이북" }, icon: LineChart, enabled: true },
  { href: "/capital", strings: { en: "Capital", ko: "자산" }, icon: Wallet, enabled: true },
  { href: "/missed", strings: { en: "Missed", ko: "놓친 거래" }, icon: EyeOff, enabled: true, desktopOnly: true },
];

/** `NavRoute[]` -> `TopBar`'s item shape, resolving copy through the caller's own `useT()`. */
export function toNavItems(t: (strings: LocaleStrings) => string) {
  return NAV_ROUTES.map((route) => ({ href: route.href, label: t(route.strings), disabled: !route.enabled }));
}

/** `NavRoute[]` -> `BottomTabBar`'s item shape. */
export function toTabItems(t: (strings: LocaleStrings) => string) {
  return NAV_ROUTES.filter((route) => !route.desktopOnly).map((route) => ({
    href: route.href,
    label: t(route.strings),
    icon: route.icon,
    disabled: !route.enabled,
  }));
}
