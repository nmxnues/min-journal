import type { Metadata } from "next";
import { todayIso } from "@/lib/domain/dates";
import { getAccountLedgerInputs, getModels, getPrimaryAccount } from "@/lib/supabase/queries";
import { CapitalView } from "./capital-view";

export const metadata: Metadata = {
  title: "Capital · Min Journal",
};

export default async function CapitalPage() {
  const account = await getPrimaryAccount();
  if (account === null) return <CapitalView data={null} />;

  const [{ trades, cashMovements, riskChanges }, models] = await Promise.all([
    getAccountLedgerInputs(account.id),
    getModels(),
  ]);

  return (
    <CapitalView
      data={{
        account,
        trades,
        cashMovements,
        riskChanges,
        models,
        // Server's date, so the series' "today" point can't disagree between
        // the server render and hydration.
        today: todayIso(),
      }}
    />
  );
}
