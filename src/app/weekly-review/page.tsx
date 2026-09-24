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
import { localizedTitle } from "@/lib/i18n/server-locale";

export const generateMetadata = localizedTitle({ en: "Weekly review", ko: "주간 리뷰" });

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

  const { from, to } = isoWeekRange(week);
  const priorWeeks = [4, 3, 2, 1].map((n) => shiftIsoWeek(week, -n));
  const priorFrom = isoWeekRange(priorWeeks[0]).from;
  const priorTo = isoWeekRange(priorWeeks[priorWeeks.length - 1]).to;

  // One batch: the trade queries only need the account and the week, not the
  // review, so nothing here waits on anything else.
  const [{ review, previous }, models, trades, priorTrades] = await Promise.all([
    getOrCreateWeeklyReview(week),
    getModels(),
    getTradesInRange(account.id, from, to),
    getTradesInRange(account.id, priorFrom, priorTo),
  ]);

  const winCount = trades.filter((t) => t.result === "win").length;
  const lossCount = trades.filter((t) => t.result === "loss").length;
  const beCount = trades.filter((t) => t.result === "be").length;

  const summary = {
    netR: netR(trades),
    tradeCount: trades.length,
    winRate: winRate(trades),
    winCount,
    lossCount,
    beCount,
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
