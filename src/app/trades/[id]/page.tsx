import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { drawdownState } from "@/lib/domain/capital";
import {
  getAccountLedgerInputs,
  getModels,
  getPrimaryAccount,
  getTrade,
  getTradeAttachments,
} from "@/lib/supabase/queries";
import { TradeDetail } from "./trade-detail";

export const metadata: Metadata = {
  title: "Trade detail · Min Journal",
};

export default async function TradeDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;

  const trade = await getTrade(id);
  if (trade === null) notFound();

  const [models, attachments, account] = await Promise.all([
    getModels(),
    getTradeAttachments(trade.id),
    getPrimaryAccount(),
  ]);

  // The account trades come from always exists by the time a trade does
  // (trades.account_id is NOT NULL) — this null case is unreachable in
  // practice, but the drawdown guard just goes quiet rather than crash.
  const drawdown =
    account === null
      ? { isNearLimit: false, drawdownPercent: 0, limitPercent: 0 }
      : await (async () => {
          const ledger = await getAccountLedgerInputs(account.id);
          return drawdownState(account, ledger.cashMovements, ledger.trades);
        })();

  return (
    <TradeDetail
      trade={trade}
      models={models}
      attachments={attachments}
      accountIsNearDrawdownLimit={drawdown.isNearLimit}
      drawdownPercent={drawdown.drawdownPercent}
      drawdownLimitPercent={drawdown.limitPercent}
      currency={account?.currency ?? "USD"}
    />
  );
}
