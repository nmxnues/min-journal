import { byModel } from "@/lib/domain/stats";
import { getAllTrades, getModels, getCurrentAccount } from "@/lib/supabase/queries";
import { PlaybookView } from "./playbook-view";
import { localizedTitle } from "@/lib/i18n/server-locale";

export const generateMetadata = localizedTitle({ en: "Playbook", ko: "플레이북" });

export default async function PlaybookPage() {
  const account = await getCurrentAccount();
  if (account === null) {
    return <PlaybookView models={[]} stats={[]} hasAccount={false} />;
  }

  const [models, trades] = await Promise.all([getModels(), getAllTrades(account.id)]);
  const stats = byModel(trades, models);

  return <PlaybookView models={models} stats={stats} hasAccount />;
}
