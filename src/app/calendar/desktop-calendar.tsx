"use client";

import { ChevronLeft, ChevronRight } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useMemo, useState } from "react";
import { toNavItems } from "@/components/nav/routes";
import { SignOutButton } from "@/components/nav/sign-out-button";
import { TopBar } from "@/components/nav/top-bar";
import { Button, Card, Chip, EmptyState, Modal, StatCard } from "@/components/ui";
import { cn } from "@/lib/cn";
import { buildMonthGrid, formatMonthLabel, shiftMonth, todayIso, type IsoMonth } from "@/lib/domain/dates";
import { dailyNetR } from "@/lib/domain/stats";
import { offPlan, realizedR } from "@/lib/domain/trade";
import type { IsoDate, Trade, TradeModel } from "@/lib/domain/types";
import { formatTradeDate } from "@/lib/format";
import { useFormatR } from "@/lib/settings/context";
import { useLocale, useT } from "@/lib/i18n/locale-context";
import { DIRECTION_LABELS, SESSION_LABELS, tradeCountLabel } from "@/lib/labels";
import { signOut } from "../actions";
import { heatStyle } from "./heat-scale";

const WEEKDAY_LABELS = { en: ["S", "M", "T", "W", "T", "F", "S"], ko: ["일", "월", "화", "수", "목", "금", "토"] };

export interface DesktopCalendarProps {
  month: IsoMonth;
  trades: Trade[];
  models: TradeModel[];
  hasAccount: boolean;
}

const em = "—";

export function DesktopCalendar({ month, trades, models, hasAccount }: DesktopCalendarProps) {
  const formatR = useFormatR();
  const t = useT();
  const locale = useLocale();
  const router = useRouter();
  const [selectedDate, setSelectedDate] = useState<IsoDate | null>(null);

  const dayMap = useMemo(() => dailyNetR(trades), [trades]);
  const grid = useMemo(() => buildMonthGrid(month), [month]);
  const modelById = new Map(models.map((m) => [m.id, m]));
  const today = todayIso();

  const days = [...dayMap.values()];
  const tradingDays = days.length;
  const greenDays = days.filter((d) => d.netR > 0).length;
  const bestDay = tradingDays === 0 ? null : Math.max(...days.map((d) => d.netR));
  const worstDay = tradingDays === 0 ? null : Math.min(...days.map((d) => d.netR));

  const prevMonth = shiftMonth(month, -1);
  const nextMonth = shiftMonth(month, 1);

  useEffect(() => {
    function onKeyDown(event: KeyboardEvent) {
      if (selectedDate !== null) return; // don't change months while the day modal is open
      const tag = (document.activeElement?.tagName ?? "").toLowerCase();
      if (tag === "input" || tag === "textarea" || tag === "select") return;
      if (event.key === "ArrowLeft") router.push(`/calendar?month=${prevMonth}`);
      else if (event.key === "ArrowRight") router.push(`/calendar?month=${nextMonth}`);
    }
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [prevMonth, nextMonth, router, selectedDate]);

  const selectedDayTrades =
    selectedDate === null ? [] : trades.filter((trade) => trade.date === selectedDate);
  const selectedDayStats = selectedDate === null ? undefined : dayMap.get(selectedDate);

  return (
    <div className="min-h-full bg-page">
      <TopBar
        items={toNavItems(t)}
        activeHref="/calendar"
        right={
          <>
            <Button onClick={() => router.push("/trades/new")}>{t({ en: "New trade", ko: "새 거래" })}</Button>
            <SignOutButton signOutAction={signOut} />
          </>
        }
      />

      <div className="flex items-center justify-between bg-surface px-28 py-20">
        <div className="flex items-center gap-16">
          <Link
            href={`/calendar?month=${prevMonth}`}
            aria-label={t({ en: "Previous month", ko: "이전 달" })}
            className="rounded-6 text-faint transition-colors duration-150 ease-out hover:text-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent focus-visible:ring-offset-2"
          >
            <ChevronLeft aria-hidden size={18} />
          </Link>
          <span className="text-18 font-bold tracking-[-.02em] text-ink">{formatMonthLabel(month, locale)}</span>
          <Link
            href={`/calendar?month=${nextMonth}`}
            aria-label={t({ en: "Next month", ko: "다음 달" })}
            className="rounded-6 text-faint transition-colors duration-150 ease-out hover:text-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent focus-visible:ring-offset-2"
          >
            <ChevronRight aria-hidden size={18} />
          </Link>
        </div>
        <div className="flex gap-8">
          <span aria-disabled="true" className="rounded-10 bg-divider px-14 py-8 text-13 font-semibold text-muted opacity-40">
            {t({ en: "Week", ko: "주간" })}
          </span>
          <span className="rounded-10 bg-ink px-14 py-8 text-13 font-bold text-white">
            {t({ en: "Month", ko: "월간" })}
          </span>
        </div>
      </div>

      {/* Wider than the 900px the mock was authored at — a calendar grid has
          more to gain from extra horizontal room than it loses to a bigger
          cap, so this one screen goes wider than Dashboard's 1200px on purpose
          (docs/decisions.md § Phase 6). */}
      {!hasAccount ? (
        <div className="mx-auto flex max-w-[1600px] items-center justify-center p-28">
          <EmptyState
            title={t({ en: "Log your first trade", ko: "첫 트레이드를 기록하세요" })}
            description={t({
              en: "Once you record a trade, this calendar fills in with your daily results.",
              ko: "트레이드를 기록하면 이 캘린더에 일별 결과가 채워집니다.",
            })}
            action={<Button onClick={() => router.push("/trades/new")}>{t({ en: "New trade", ko: "새 거래" })}</Button>}
            className="w-full max-w-[440px]"
          />
        </div>
      ) : (
      <div className="mx-auto flex max-w-[1600px] flex-col gap-16 p-28">
        <Card className="px-28 py-26">
          <div className="mb-10 grid grid-cols-7 gap-8 text-center text-12 font-semibold text-faint">
            {WEEKDAY_LABELS[locale].map((label, i) => (
              <span key={i}>{label}</span>
            ))}
          </div>
          <div className="grid grid-cols-7 gap-8">
            {grid.map((date, i) => {
              if (date === null) return <div key={i} className="h-78 rounded-14 bg-surface-faint" />;

              const dayStats = dayMap.get(date);
              const style = heatStyle(dayStats);
              const isToday = date === today;
              const isFuture = date > today;
              const isClickable = dayStats !== undefined && dayStats.tradeCount > 0;
              const dayNumber = Number(date.slice(-2));

              return (
                <button
                  key={date}
                  type="button"
                  disabled={!isClickable}
                  onClick={() => setSelectedDate(date)}
                  className={cn(
                    "group relative h-78 rounded-14 px-12 py-10 text-left",
                    style.fill,
                    isClickable ? "cursor-pointer" : "cursor-default",
                    isToday && "ring-2 ring-inset ring-ink",
                    "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent focus-visible:ring-offset-2",
                  )}
                >
                  <div className={cn("text-11_5 font-semibold", isFuture ? "text-disabled" : "text-faint", isToday && "font-bold text-ink")}>
                    {dayNumber}
                  </div>
                  {style.text !== null && dayStats !== undefined && (
                    <>
                      <div className={cn("mt-6 text-16 font-extrabold", style.text)}>{formatR(dayStats.netR)}</div>
                      <div className="mt-1 text-11 font-medium text-faint">
                        {t(tradeCountLabel(dayStats.tradeCount))}
                      </div>
                    </>
                  )}

                  {dayStats !== undefined && dayStats.tradeCount > 0 && (
                    <div
                      role="tooltip"
                      className="pointer-events-none absolute top-full left-1/2 z-10 mt-6 w-max -translate-x-1/2 rounded-12 bg-ink px-12 py-10 text-left text-11_5 font-medium text-white opacity-0 shadow-[0_6px_24px_rgba(0,0,0,.12)] transition-opacity duration-150 ease-out group-hover:opacity-100"
                    >
                      <div className="font-bold">{formatR(dayStats.netR)}</div>
                      <div>{t(tradeCountLabel(dayStats.tradeCount))}</div>
                      {dayStats.bestR !== null && (
                        <div>
                          {t({ en: "Best", ko: "최고" })} {formatR(dayStats.bestR)}
                        </div>
                      )}
                      {dayStats.worstR !== null && (
                        <div>
                          {t({ en: "Worst", ko: "최악" })} {formatR(dayStats.worstR)}
                        </div>
                      )}
                    </div>
                  )}
                </button>
              );
            })}
          </div>

          <div className="mt-18 flex items-center gap-10">
            <span className="text-11_5 font-medium text-faint">{t({ en: "Loss", ko: "손실" })}</span>
            <span className="h-12 w-26 rounded-pill bg-loss" />
            <span className="h-12 w-26 rounded-pill bg-loss-tint" />
            <span className="h-12 w-26 rounded-pill bg-divider" />
            <span className="h-12 w-26 rounded-pill bg-gain-tint-1" />
            <span className="h-12 w-26 rounded-pill bg-gain" />
            <span className="text-11_5 font-medium text-faint">{t({ en: "Gain", ko: "수익" })}</span>
          </div>
        </Card>

        <div className="grid grid-cols-4 gap-16">
          <StatCard label={t({ en: "Trading days", ko: "거래일" })} value={tradingDays} size="sm" />
          <StatCard label={t({ en: "Green days", ko: "수익일" })} value={greenDays} tone="gain" size="sm" />
          <StatCard label={t({ en: "Best day", ko: "최고의 날" })} value={bestDay === null ? em : formatR(bestDay)} size="sm" />
          <StatCard
            label={t({ en: "Worst day", ko: "최악의 날" })}
            value={worstDay === null ? em : formatR(worstDay)}
            size="sm"
          />
        </div>
      </div>
      )}

      <Modal
        open={selectedDate !== null}
        onClose={() => setSelectedDate(null)}
        title={
          selectedDate === null
            ? ""
            : `${formatTradeDate(selectedDate, locale)} · ${t(tradeCountLabel(selectedDayStats?.tradeCount ?? 0))} · ${
                selectedDayStats !== undefined ? formatR(selectedDayStats.netR) : em
              }`
        }
        closeLabel={t({ en: "Close", ko: "닫기" })}
      >
        <div className="flex flex-col pb-8">
          {selectedDayTrades.map((trade, i) => {
            const model = trade.modelId === null ? null : (modelById.get(trade.modelId) ?? null);
            const isOffPlan = offPlan(trade);
            const r = realizedR(trade);
            return (
              <Link
                key={trade.id}
                href={`/trades/${trade.id}`}
                className={cn(
                  "flex items-center justify-between py-14 transition-colors duration-150 ease-out hover:bg-surface-faint",
                  i > 0 && "border-t border-divider",
                )}
              >
                <div>
                  <div className="text-14 font-bold text-ink">
                    {trade.instrument} · {t(DIRECTION_LABELS[trade.direction])}
                  </div>
                  <div className="mt-2 flex items-center gap-8 text-12 font-medium text-muted">
                    <Chip tone={isOffPlan ? "accent" : "neutral"}>
                      {isOffPlan ? t({ en: "Off-plan", ko: "Off-plan" }) : (model?.name ?? t({ en: "Unassigned", ko: "미지정" }))}
                    </Chip>
                    {t(SESSION_LABELS[trade.session])}
                  </div>
                </div>
                <span className={cn("text-16 font-extrabold", r === null ? "text-ink" : r >= 0 ? "text-gain" : "text-loss")}>
                  {r === null ? em : formatR(r)}
                </span>
              </Link>
            );
          })}
        </div>
      </Modal>
    </div>
  );
}
