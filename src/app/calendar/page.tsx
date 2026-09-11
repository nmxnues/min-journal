import type { Metadata } from "next";
import { currentIsoMonth, isValidIsoMonth, monthRange } from "@/lib/domain/dates";
import { getModels, getCurrentAccount, getTradesInRange } from "@/lib/supabase/queries";
import { CalendarView } from "./calendar-view";

export const metadata: Metadata = {
  title: "Calendar · Min Journal",
};

export default async function CalendarPage({
  searchParams,
}: {
  searchParams: Promise<{ month?: string }>;
}) {
  const params = await searchParams;
  const month = isValidIsoMonth(params.month) ? params.month : currentIsoMonth();

  const account = await getCurrentAccount();
  if (account === null) {
    return <CalendarView month={month} trades={[]} models={[]} hasAccount={false} />;
  }

  const { from, to } = monthRange(month);
  const [trades, models] = await Promise.all([
    getTradesInRange(account.id, from, to),
    getModels(),
  ]);

  return <CalendarView month={month} trades={trades} models={models} hasAccount />;
}
