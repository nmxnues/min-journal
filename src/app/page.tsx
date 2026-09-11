import type { Metadata } from "next";
import { drawdownState } from "@/lib/domain/capital";
import { currentIsoMonth, isoMonthOf, monthRange } from "@/lib/domain/dates";
import {
  getAccountLedgerInputs,
  getModels,
  getCurrentAccount,
  getMostRecentTradeDate,
  getTradesInRange,
} from "@/lib/supabase/queries";
import { Dashboard } from "./dashboard";

export const metadata: Metadata = {
  title: "Dashboard · Min Journal",
};

export default async function Home() {
  const account = await getCurrentAccount();

  if (account === null) {
    return <Dashboard month={currentIsoMonth()} trades={[]} models={[]} hasAccount={false} currency="USD" />;
  }

  // Defaults to the most recent trade's month, not always today's — a
  // backtest account (or a live one you haven't logged in a while) would
  // otherwise land on an empty current month even though real data exists
  // (docs/decisions.md § Phase 9 backtest follow-up). Falls back to today
  // for a genuinely empty account, matching the empty-state copy below.
  const mostRecentDate = await getMostRecentTradeDate(account.id);
  const month = mostRecentDate !== null ? isoMonthOf(mostRecentDate) : currentIsoMonth();

  const { from, to } = monthRange(month);
  const [trades, models, ledgerInputs] = await Promise.all([
    getTradesInRange(account.id, from, to),
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
      month={month}
      trades={trades}
      models={models}
      hasAccount
      drawdownAlert={drawdownAlert}
      currency={account.currency}
    />
  );
}
