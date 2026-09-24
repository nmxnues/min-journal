import { drawdownState } from "@/lib/domain/capital";
import { currentIsoMonth } from "@/lib/domain/dates";
import { parseDashboardPeriod, resolveDashboardPeriod } from "@/lib/domain/dashboard-period";
import { EMPTY_TRADE_LOG_FILTERS, filterTrades, sortTrades } from "@/lib/domain/trade-log";
import { getAccountLedgerInputs, getModels, getCurrentAccount } from "@/lib/supabase/queries";
import { Dashboard } from "./dashboard";
import { localizedTitle } from "@/lib/i18n/server-locale";

export const generateMetadata = localizedTitle({ en: "Dashboard", ko: "홈" });

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

  const [ledgerInputs, models] = await Promise.all([getAccountLedgerInputs(account.id), getModels()]);

  // The drawdown guard below already needs every trade on the account, so the
  // period's trades are cut from that same fetch rather than queried a second
  // time — on the default All time that second query was the whole table
  // again. Same order the query gave: latest date first, then latest entered.
  const trades = sortTrades(
    resolved.kind === "all"
      ? ledgerInputs.trades
      : filterTrades(ledgerInputs.trades, { ...EMPTY_TRADE_LOG_FILTERS, from: resolved.from, to: resolved.to }),
    "date",
    "desc",
    models,
  );

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
