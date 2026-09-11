"use client";

import type { DrawdownAlertInfo } from "@/components/drawdown-alert";
import type { IsoMonth } from "@/lib/domain/dates";
import type { Trade, TradeModel } from "@/lib/domain/types";
import { useLocale } from "@/lib/i18n/locale-context";
import { DesktopDashboard } from "./desktop-dashboard";
import { MobileHome } from "./mobile-home";

export interface DashboardProps {
  month: IsoMonth;
  trades: Trade[];
  models: TradeModel[];
  hasAccount: boolean;
  /** Set only once the account has crossed its drawdown limit. */
  drawdownAlert?: DrawdownAlertInfo | null;
  /** For the hero's dollar sub-line — docs/README.md's "every surface that shows R also shows money". */
  currency: string;
}

/**
 * Same branch as New trade's wizard (docs/decisions.md § Phase 4d): the
 * mobile home in mock 1d is a genuinely different screen from the desktop
 * dashboard in mock 1a, not a squeezed version of it, so `locale` (this
 * app's own <900px signal) picks the whole component rather than a CSS
 * breakpoint reflowing one shared layout.
 */
export function Dashboard(props: DashboardProps) {
  const locale = useLocale();
  if (locale === "ko") return <MobileHome {...props} />;
  return <DesktopDashboard {...props} />;
}
