"use client";

import type { DrawdownAlertInfo } from "@/components/drawdown-alert";
import type { ResolvedDashboardPeriod } from "@/lib/domain/dashboard-period";
import type { Trade, TradeModel } from "@/lib/domain/types";
import { useIsMobile } from "@/lib/i18n/locale-context";
import { DesktopDashboard } from "./desktop-dashboard";
import { MobileHome } from "./mobile-home";

export interface DashboardProps {
  period: ResolvedDashboardPeriod;
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
 * dashboard in mock 1a, not a squeezed version of it, so `useIsMobile` (this
 * app's own <900px signal, independent of the display language) picks the whole component rather than a CSS
 * breakpoint reflowing one shared layout.
 */
export function Dashboard(props: DashboardProps) {
  const isMobile = useIsMobile();
  if (isMobile) return <MobileHome {...props} />;
  return <DesktopDashboard {...props} />;
}
