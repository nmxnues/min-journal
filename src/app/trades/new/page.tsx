import type { Metadata } from "next";
import { currentRValue, drawdownState } from "@/lib/domain/capital";
import type { Session } from "@/lib/domain/types";
import { DEFAULT_INSTRUMENT } from "@/lib/instruments";
import {
  getAccountLedgerInputs,
  getModels,
  getPrimaryAccount,
  getSettings,
} from "@/lib/supabase/queries";
import { reconcileDraftAttachments } from "./attachments-actions";
import { getDraft } from "./draft-actions";
import { NewTradeGate } from "./new-trade-gate";

export const metadata: Metadata = {
  title: "New trade · Min Journal",
};

export default async function NewTradePage() {
  const account = await getPrimaryAccount();

  if (account === null) {
    // No account yet — the form can't exist without one, since account_id and
    // r_value_at_entry are both NOT NULL and 1R needs a balance to come from.
    return <NewTradeGate />;
  }

  const [models, settings, ledger, draft] = await Promise.all([
    getModels(),
    getSettings(),
    getAccountLedgerInputs(account.id),
    getDraft(),
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
        currency: account.currency,
        accountIsNearDrawdownLimit: drawdown.isNearLimit,
        drawdownPercent: drawdown.drawdownPercent,
        drawdownLimitPercent: drawdown.limitPercent,
        defaultInstrument: settings?.default_instrument ?? DEFAULT_INSTRUMENT,
        defaultSession: (settings?.default_session ?? "asia") as Session,
        today: new Date().toISOString().slice(0, 10),
        draft,
      }}
    />
  );
}
