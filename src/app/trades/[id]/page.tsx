import { notFound } from "next/navigation";
import { drawdownState } from "@/lib/domain/capital";
import { DEFAULT_TAG_PRESETS } from "@/lib/labels";
import {
  getAccount,
  getAccountLedgerInputs,
  getModels,
  getSettings,
  getTrade,
  getTradeAttachments,
} from "@/lib/supabase/queries";
import { TradeDetail } from "./trade-detail";
import { localizedTitle } from "@/lib/i18n/server-locale";

export const generateMetadata = localizedTitle({ en: "Trade detail", ko: "거래 상세" });

export default async function TradeDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;

  const trade = await getTrade(id);
  if (trade === null) notFound();

  // Deliberately the trade's *own* account (`trade.accountId`), not whichever
  // one is currently selected elsewhere in the app (docs/decisions.md § Phase
  // 9 multi-account follow-up) — a trade detail page has to reflect the
  // account it actually belongs to even when you're browsing it from a
  // different account's trade log or a shared link. The ledger only needs
  // that id too, so it's fetched alongside the account, not after it.
  const [models, attachments, account, settings, ledger] = await Promise.all([
    getModels(),
    getTradeAttachments(trade.id),
    getAccount(trade.accountId),
    getSettings(),
    getAccountLedgerInputs(trade.accountId),
  ]);

  // The account trades come from always exists by the time a trade does
  // (trades.account_id is NOT NULL) — this null case is unreachable in
  // practice, but the drawdown guard just goes quiet rather than crash.
  const drawdown =
    account === null
      ? { isNearLimit: false, drawdownPercent: 0, limitPercent: 0 }
      : drawdownState(account, ledger.cashMovements, ledger.trades);

  return (
    <TradeDetail
      trade={trade}
      models={models}
      attachments={attachments}
      accountIsNearDrawdownLimit={drawdown.isNearLimit}
      drawdownPercent={drawdown.drawdownPercent}
      drawdownLimitPercent={drawdown.limitPercent}
      currency={account?.currency ?? "USD"}
      tagPresets={settings?.tag_presets ?? DEFAULT_TAG_PRESETS.slice()}
      commissionPerLotPerSide={Number(settings?.commission_per_lot_per_side ?? 0)}
    />
  );
}
