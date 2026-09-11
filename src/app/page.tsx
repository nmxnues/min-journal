import type { Metadata } from "next";
import { drawdownState } from "@/lib/domain/capital";
import { currentIsoMonth, isoMonthOf } from "@/lib/domain/dates";
import { parseDashboardPeriod, resolveDashboardPeriod } from "@/lib/domain/dashboard-period";
import {
  getAccountLedgerInputs,
  getAllTrades,
  getModels,
  getCurrentAccount,
  getMostRecentTradeDate,
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

  // Defaults to the most recent trade's month, not always today's — a
  // backtest account (or a live one you haven't logged in a while) would
  // otherwise land on an empty current month even though real data exists
  // (docs/decisions.md § Dashboard's default month). An explicit `?range=`
  // (the period picker's own `‹`/`›`/presets) overrides this default, the
  // same "unset stays out of the URL" convention Trade log's filters use.
  const mostRecentDate = await getMostRecentTradeDate(account.id);
  const defaultMonth = mostRecentDate !== null ? isoMonthOf(mostRecentDate) : currentIsoMonth();

  const period = parseDashboardPeriod(params);
  const resolved = resolveDashboardPeriod(period, defaultMonth);

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
