import { currentIsoMonth, isValidIsoMonth, monthRange } from "@/lib/domain/dates";
import { summarizeMissed, netRAfterCommission } from "@/lib/domain/missed-trade";
import { isoWeekRange, isValidIsoWeek, todayIsoWeek } from "@/lib/domain/weekly-review";
import { DEFAULT_INSTRUMENT } from "@/lib/instruments";
import {
  getCurrentAccount,
  getMissedTradesInRange,
  getSettings,
  getTradesInRange,
} from "@/lib/supabase/queries";
import { MissedView, type MissedPeriod } from "./missed-view";
import { localizedTitle } from "@/lib/i18n/server-locale";

export const generateMetadata = localizedTitle({ en: "Missed trades", ko: "놓친 거래" });

/** `?month=YYYY-MM` shows a month; anything else (default) shows an ISO week. */
function resolvePeriod(params: { week?: string; month?: string }): MissedPeriod {
  if (isValidIsoMonth(params.month)) {
    return { kind: "month", key: params.month, ...monthRange(params.month) };
  }
  const week = isValidIsoWeek(params.week) ? params.week : todayIsoWeek();
  return { kind: "week", key: week, ...isoWeekRange(week) };
}

export default async function MissedPage({
  searchParams,
}: {
  searchParams: Promise<{ week?: string; month?: string }>;
}) {
  const period = resolvePeriod(await searchParams);

  const [account, missed, settings] = await Promise.all([
    getCurrentAccount(),
    getMissedTradesInRange(period.from, period.to),
    getSettings(),
  ]);
  // Real trades are read only to put their total beside the missed one; the
  // missed rows are never passed into any real-trade statistic.
  const realTrades = account === null ? [] : await getTradesInRange(account.id, period.from, period.to);

  return (
    <MissedView
      period={period}
      currentMonth={currentIsoMonth()}
      currentWeek={todayIsoWeek()}
      accountName={account?.name ?? null}
      accountKind={account?.kind ?? null}
      realNetR={netRAfterCommission(realTrades)}
      realTradeCount={realTrades.filter((t) => t.exit !== null).length}
      missed={missed}
      summary={summarizeMissed(missed)}
      defaultInstrument={settings?.default_instrument ?? DEFAULT_INSTRUMENT}
      commissionPerLotPerSide={Number(settings?.commission_per_lot_per_side ?? 0)}
    />
  );
}
