import type { Metadata } from "next";
import { moneyStats, netR, winRate } from "@/lib/domain/stats";
import {
  filterTrades,
  paginateTrades,
  parseTradeLogFilters,
  parseTradeLogPage,
  parseTradeLogSort,
  sortTrades,
} from "@/lib/domain/trade-log";
import { getAllTrades, getModels, getCurrentAccount } from "@/lib/supabase/queries";
import { TradeLogView } from "./trade-log-view";

export const metadata: Metadata = {
  title: "Trades · Min Journal",
};

export default async function TradeLogPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const rawParams = await searchParams;
  const params = new URLSearchParams();
  for (const [key, value] of Object.entries(rawParams)) {
    if (typeof value === "string") params.set(key, value);
  }

  const filters = parseTradeLogFilters(params);
  const { sort, direction } = parseTradeLogSort(params);
  const page = parseTradeLogPage(params);

  const account = await getCurrentAccount();
  if (account === null) {
    return (
      <TradeLogView hasAccount={false} accountKind={null} currency="USD" models={[]} matching={[]} summary={null} pagination={null} />
    );
  }

  const [allTrades, models] = await Promise.all([getAllTrades(account.id), getModels()]);

  const filtered = filterTrades(allTrades, filters);
  const sorted = sortTrades(filtered, sort, direction, models);
  const pagination = paginateTrades(sorted, page);

  return (
    <TradeLogView
      hasAccount
      accountKind={account.kind}
      currency={account.currency}
      models={models}
      matching={pagination.pageTrades}
      summary={{
        tradeCount: filtered.length,
        netR: netR(filtered),
        winRate: winRate(filtered),
        netPnl: moneyStats(filtered).netPnl,
        netWinRate: moneyStats(filtered).netWinRate,
        totalCommission: moneyStats(filtered).totalCommission,
      }}
      pagination={{
        currentPage: pagination.currentPage,
        totalPages: pagination.totalPages,
        totalCount: pagination.totalCount,
      }}
    />
  );
}
