import type { Metadata } from "next";
import { currentIsoMonth, monthRange } from "@/lib/domain/dates";
import { getModels, getPrimaryAccount, getTradesInRange } from "@/lib/supabase/queries";
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
  const [trades, models] = await Promise.all([
    getTradesInRange(account.id, from, to),
    getModels(),
  ]);

  return <Dashboard month={month} trades={trades} models={models} hasAccount />;
}
