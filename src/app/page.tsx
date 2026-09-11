import type { Metadata } from "next";
import { drawdownState } from "@/lib/domain/capital";
import { currentIsoMonth, monthRange } from "@/lib/domain/dates";
import { getAccountLedgerInputs, getModels, getPrimaryAccount, getTradesInRange } from "@/lib/supabase/queries";
import { Dashboard } from "./dashboard";

export const metadata: Metadata = {
  title: "Dashboard · Min Journal",
};

export default async function Home() {
  const account = await getPrimaryAccount();
  const month = currentIsoMonth();

  if (account === null) {
    return <Dashboard month={month} trades={[]} models={[]} hasAccount={false} />;
  }

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
    <Dashboard month={month} trades={trades} models={models} hasAccount drawdownAlert={drawdownAlert} />
  );
}
