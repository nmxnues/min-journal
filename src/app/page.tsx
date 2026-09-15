import type { Metadata } from "next";
import { drawdownState } from "@/lib/domain/capital";
import { currentIsoMonth } from "@/lib/domain/dates";
import { parseDashboardPeriod, resolveDashboardPeriod } from "@/lib/domain/dashboard-period";
import {
  getAccountLedgerInputs,
  getAllTrades,
  getModels,
  getCurrentAccount,
  getTradesInRange,
} from "@/lib/supabase/queries";
import { Dashboard } from "./dashboard";

export const metadata: Metadata = {
  title: "Dashboard · Min Journal",
};

export default async function Home({
  searchParams,
}: {
  searchParams: Promise<{ range?: string; month?: string; from?: string; to?: string }>;
}) {
  const account = await getCurrentAccount();
  const params = await searchParams;

  if (account === null) {
    const resolved = resolveDashboardPeriod(null, currentIsoMonth());
    return <Dashboard period={resolved} trades={[]} models={[]} hasAccount={false} currency="USD" />;
  }

  // Defaults to All time. An explicit `?range=` (the period picker's own
  // `‹`/`›`/presets) overrides this default, the same "unset stays out of
  // the URL" convention Trade log's filters use.
  const period = parseDashboardPeriod(params);
  const resolved = resolveDashboardPeriod(period, currentIsoMonth());

  const [trades, models, ledgerInputs] = await Promise.all([
    resolved.kind === "all" ? getAllTrades(account.id) : getTradesInRange(account.id, resolved.from, resolved.to),
    getModels(),
    getAccountLedgerInputs(account.id),
  ]);

  // docs/README.md § Capital: crossing the drawdown limit "should surface a
  // warning on the dashboard" (the trade form already warns from 2 points out).
  const drawdown = drawdownState(account, ledgerInputs.cashMovements, ledgerInputs.trades);
  const drawdownAlert = drawdown.hasReachedLimit
    ? { drawdownPercent: drawdown.drawdownPercent, limitPercent: drawdown.limitPercent }
    : null;

  return (
    <Dashboard
      period={resolved}
      trades={trades}
      models={models}
      hasAccount
      drawdownAlert={drawdownAlert}
      currency={account.currency}
    />
  );
}
