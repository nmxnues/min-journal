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

  const [models, settings, ledger] = await Promise.all([
    getModels(),
    getSettings(),
    getAccountLedgerInputs(account.id),
  ]);

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
      }}
    />
  );
}
