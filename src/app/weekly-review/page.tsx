import type { Metadata } from "next";
import { netR, ruleAdherence, winRate } from "@/lib/domain/stats";
import { offPlan } from "@/lib/domain/trade";
import {
  averageWeeklyNetR,
  isoWeekRange,
  isValidIsoWeek,
  shiftIsoWeek,
  todayIsoWeek,
} from "@/lib/domain/weekly-review";
import { getModels, getCurrentAccount, getTradesInRange } from "@/lib/supabase/queries";
import { getOrCreateWeeklyReview } from "./get-or-create";
import { WeeklyReviewView } from "./weekly-review-view";

export const metadata: Metadata = {
  title: "Weekly review · Min Journal",
};

export default async function WeeklyReviewPage({
  searchParams,
}: {
  searchParams: Promise<{ week?: string }>;
}) {
  const params = await searchParams;
  const week = isValidIsoWeek(params.week) ? params.week : todayIsoWeek();

  const account = await getCurrentAccount();
  if (account === null) {
    return <WeeklyReviewView week={week} hasAccount={false} />;
  }

  const [{ review, previous }, models] = await Promise.all([getOrCreateWeeklyReview(week), getModels()]);

  const { from, to } = isoWeekRange(week);
  const priorWeeks = [4, 3, 2, 1].map((n) => shiftIsoWeek(week, -n));
  const priorFrom = isoWeekRange(priorWeeks[0]).from;
  const priorTo = isoWeekRange(priorWeeks[priorWeeks.length - 1]).to;

  const [trades, priorTrades] = await Promise.all([
    getTradesInRange(account.id, from, to),
    getTradesInRange(account.id, priorFrom, priorTo),
  ]);

  const summary = {
    netR: netR(trades),
    tradeCount: trades.length,
    winRate: winRate(trades),
    decidedCount: trades.filter((t) => t.result !== null).length,
    winCount: trades.filter((t) => t.result === "win").length,
    ruleAdherence: ruleAdherence(trades),
    offPlanCount: trades.filter(offPlan).length,
    avgOfPriorWeeks: averageWeeklyNetR(priorTrades, priorWeeks),
  };

  return (
    <WeeklyReviewView
      week={week}
      hasAccount
      review={review}
      previous={previous}
      trades={trades}
      models={models}
      summary={summary}
    />
  );
}
