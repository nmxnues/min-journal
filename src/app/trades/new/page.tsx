import { currentRValue, drawdownState } from "@/lib/domain/capital";
import { todayIso } from "@/lib/domain/dates";
import type { Session } from "@/lib/domain/types";
import { DEFAULT_INSTRUMENT } from "@/lib/instruments";
import { DEFAULT_TAG_PRESETS } from "@/lib/labels";
import {
  getAccountLedgerInputs,
  getModels,
  getCurrentAccount,
  getMostRecentTradeDate,
  getSettings,
} from "@/lib/supabase/queries";
import { reconcileDraftAttachments } from "./attachments-actions";
import { getDraft } from "./draft-actions";
import { NewTradeGate } from "./new-trade-gate";
import { localizedTitle } from "@/lib/i18n/server-locale";

export const generateMetadata = localizedTitle({ en: "New trade", ko: "새 거래" });

export default async function NewTradePage() {
  const account = await getCurrentAccount();

  if (account === null) {
    // No account yet — the form can't exist without one, since account_id and
    // r_value_at_entry are both NOT NULL and 1R needs a balance to come from.
    return <NewTradeGate />;
  }

  const [models, settings, ledger, draft, mostRecentDate] = await Promise.all([
    getModels(),
    getSettings(),
    getAccountLedgerInputs(account.id),
    getDraft(),
    getMostRecentTradeDate(account.id),
  ]);

  // Best-effort, once per visit: anything in the draft folder the current
  // draft doesn't reference is left over from an overwritten/abandoned one
  // (docs/decisions.md § Phase 4b) — there's only ever one draft per user, so
  // this is always a safe moment to reconcile.
  void reconcileDraftAttachments(draft?.payload.attachmentPaths ?? []);

  const rValueToday = currentRValue(account, ledger.cashMovements, ledger.trades);
  const drawdown = drawdownState(account, ledger.cashMovements, ledger.trades);

  return (
    <NewTradeGate
      formProps={{
        models,
        rValueToday,
        accountKind: account.kind,
        currency: account.currency,
        accountIsNearDrawdownLimit: drawdown.isNearLimit,
        drawdownPercent: drawdown.drawdownPercent,
        drawdownLimitPercent: drawdown.limitPercent,
        defaultInstrument: settings?.default_instrument ?? DEFAULT_INSTRUMENT,
        defaultSession: (settings?.default_session ?? "asia") as Session,
        defaultDate: mostRecentDate ?? todayIso(),
        draft,
        tagPresets: settings?.tag_presets ?? DEFAULT_TAG_PRESETS.slice(),
        commissionPerLotPerSide: Number(settings?.commission_per_lot_per_side ?? 0),
      }}
    />
  );
}
