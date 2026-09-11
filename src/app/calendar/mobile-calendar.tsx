"use client";

import { ChevronLeft, ChevronRight } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useMemo, useState } from "react";
import { BottomTabBar } from "@/components/nav/bottom-tab-bar";
import { toTabItems } from "@/components/nav/routes";
import { Button, Card, EmptyState } from "@/components/ui";
import { cn } from "@/lib/cn";
import {
  buildMonthGrid,
  formatMonthLabel,
  isoMonthOf,
  shiftMonth,
  todayIso,
  type IsoMonth,
} from "@/lib/domain/dates";
import { dailyNetR } from "@/lib/domain/stats";
import { offPlan, realizedR } from "@/lib/domain/trade";
import type { IsoDate, Trade, TradeModel } from "@/lib/domain/types";
import { formatTradeDate } from "@/lib/format";
import { useFormatR } from "@/lib/settings/context";
import { useT } from "@/lib/i18n/locale-context";
import { DIRECTION_LABELS, tradeCountLabel } from "@/lib/labels";
import { heatStyle } from "./heat-scale";

export interface MobileCalendarProps {
  month: IsoMonth;
  trades: Trade[];
  models: TradeModel[];
  hasAccount: boolean;
}

export function MobileCalendar({ month, trades, models, hasAccount }: MobileCalendarProps) {
  const formatR = useFormatR();
  const t = useT();
  const router = useRouter();
  const today = todayIso();

  const [selectedDate, setSelectedDate] = useState<IsoDate | null>(
    isoMonthOf(today) === month ? today : null,
  );

  const dayMap = useMemo(() => dailyNetR(trades), [trades]);
  const grid = useMemo(() => buildMonthGrid(month), [month]);
  const modelById = new Map(models.map((m) => [m.id, m]));

  const prevMonth = shiftMonth(month, -1);
  const nextMonth = shiftMonth(month, 1);

  useEffect(() => {
    function onKeyDown(event: KeyboardEvent) {
      const tag = (document.activeElement?.tagName ?? "").toLowerCase();
      if (tag === "input" || tag === "textarea" || tag === "select") return;
      if (event.key === "ArrowLeft") router.push(`/calendar?month=${prevMonth}`);
      else if (event.key === "ArrowRight") router.push(`/calendar?month=${nextMonth}`);
    }
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [prevMonth, nextMonth, router]);

  const selectedDayStats = selectedDate === null ? undefined : dayMap.get(selectedDate);
  const selectedDayTrades =
    selectedDate === null ? [] : trades.filter((trade) => trade.date === selectedDate);

  return (
    <div className="flex min-h-full flex-col bg-page">
      <div className="flex items-center justify-between px-20 pt-16">
        <div className="flex items-center gap-10">
          <Link
            href={`/calendar?month=${prevMonth}`}
            aria-label={t({ en: "Previous month", ko: "이전 달" })}
            className="rounded-6 text-faint focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent focus-visible:ring-offset-2"
          >
            <ChevronLeft aria-hidden size={18} />
          </Link>
          <span className="text-20 font-extrabold tracking-[-.03em] text-ink">{formatMonthLabel(month, "ko")}</span>
          <Link
            href={`/calendar?month=${nextMonth}`}
            aria-label={t({ en: "Next month", ko: "다음 달" })}
            className="rounded-6 text-faint focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent focus-visible:ring-offset-2"
          >
            <ChevronRight aria-hidden size={18} />
          </Link>
        </div>
        <span aria-disabled="true" className="text-13 font-semibold text-accent opacity-40">
          {t({ en: "Week", ko: "주간" })}
        </span>
      </div>

      {!hasAccount ? (
        <div className="flex flex-1 flex-col justify-center px-20 py-20">
          <EmptyState
            title={t({ en: "Log your first trade", ko: "첫 트레이드를 기록하세요" })}
            description={t({
              en: "Once you record a trade, this calendar fills in with your daily results.",
              ko: "트레이드를 기록하면 이 캘린더에 일별 결과가 채워집니다.",
            })}
            action={<Button onClick={() => router.push("/trades/new")}>{t({ en: "Log trade", ko: "기록하기" })}</Button>}
          />
        </div>
      ) : (
      <div className="flex flex-1 flex-col gap-14 px-20 py-12">
        <Card className="px-18 py-20">
          <div className="mb-8 grid grid-cols-7 gap-6 text-center text-11 font-semibold text-faint">
            {["일", "월", "화", "수", "목", "금", "토"].map((label, i) => (
              <span key={i}>{label}</span>
            ))}
          </div>
          <div className="grid grid-cols-7 gap-6 text-center">
            {grid.map((date, i) => {
              if (date === null) return <div key={i} className="h-42 rounded-12 bg-surface-faint" />;

              const dayStats = dayMap.get(date);
              const style = heatStyle(dayStats);
              const isSelected = date === selectedDate;
              const hasValue = style.text !== null && dayStats !== undefined;
              const dayNumber = Number(date.slice(-2));

              return (
                <button
                  key={date}
                  type="button"
                  onClick={() => setSelectedDate(date)}
                  className={cn(
                    "flex h-42 flex-col items-center justify-center gap-1 rounded-12",
                    style.fill,
                    isSelected && "ring-2 ring-inset ring-ink",
                    "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent focus-visible:ring-offset-2",
                  )}
                >
                  <span className={cn("text-11 font-semibold", hasValue ? style.text : "text-faint")}>
                    {dayNumber}
                  </span>
                  {hasValue && (
                    <span className={cn("text-11 font-bold leading-none", style.text)}>
                      {formatR(dayStats.netR, 1, false)}
                    </span>
                  )}
                </button>
              );
            })}
          </div>
        </Card>

        <Card className="px-22 py-20">
          {selectedDate === null ? (
            <p className="text-12_5 font-medium text-faint">
              {t({ en: "Tap a day to see its trades.", ko: "날짜를 탭하면 그날 기록을 볼 수 있습니다." })}
            </p>
          ) : (
            <>
              <div className="text-15 font-bold text-ink">
                {formatTradeDate(selectedDate, "ko", true)} ·{" "}
                {t(tradeCountLabel(selectedDayStats?.tradeCount ?? 0))}{" "}
                {selectedDayStats !== undefined && (
                  <span className={selectedDayStats.netR >= 0 ? "text-gain" : "text-loss"}>
                    {formatR(selectedDayStats.netR)}
                  </span>
                )}
              </div>
              {selectedDayTrades.length === 0 ? (
                <p className="mt-14 text-12_5 font-medium text-faint">
                  {t({ en: "No trades that day.", ko: "그날은 기록이 없습니다." })}
                </p>
              ) : (
                <div className="mt-14 flex flex-col gap-12">
                  {selectedDayTrades.map((trade, i) => {
                    const model = trade.modelId === null ? null : (modelById.get(trade.modelId) ?? null);
                    const isOffPlan = offPlan(trade);
                    const r = realizedR(trade);
                    return (
                      <div key={trade.id}>
                        {i > 0 && <div className="mb-12 h-1 bg-divider" />}
                        <div className="flex items-center justify-between">
                          <div>
                            <div className="text-14 font-bold text-ink">
                              {trade.instrument} · {t(DIRECTION_LABELS[trade.direction])}
                            </div>
                            <div className="mt-2 text-12 font-medium text-muted">
                              {isOffPlan
                                ? t({ en: "Off-plan", ko: "Off-plan" })
                                : (model?.name ?? t({ en: "Unassigned", ko: "미지정" }))}
                            </div>
                          </div>
                          <span className={cn("text-16 font-extrabold", r === null ? "text-ink" : r >= 0 ? "text-gain" : "text-loss")}>
                            {r === null ? "—" : formatR(r)}
                          </span>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </>
          )}
        </Card>
      </div>
      )}

      <BottomTabBar items={toTabItems(t)} activeHref="/calendar" />
    </div>
  );
}
