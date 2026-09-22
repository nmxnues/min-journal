import { todayIso } from "@/lib/domain/dates";
import { getAccountLedgerInputs, getAllAccounts, getModels, getCurrentAccount } from "@/lib/supabase/queries";
import { CapitalView } from "./capital-view";
import { localizedTitle } from "@/lib/i18n/server-locale";

export const generateMetadata = localizedTitle({ en: "Capital", ko: "자산" });

export default async function CapitalPage() {
  const [account, allAccounts] = await Promise.all([getCurrentAccount(), getAllAccounts()]);
  if (account === null) return <CapitalView data={null} />;

  const [{ trades, cashMovements, riskChanges }, models] = await Promise.all([
    getAccountLedgerInputs(account.id),
    getModels(),
  ]);

  return (
    <CapitalView
      data={{
        account,
        allAccounts,
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
