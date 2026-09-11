"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useMemo } from "react";
import { DrawdownAlert, type DrawdownAlertInfo } from "@/components/drawdown-alert";
import { Sparkline } from "@/components/charts/equity-curve";
import { BottomTabBar } from "@/components/nav/bottom-tab-bar";
import { toTabItems } from "@/components/nav/routes";
import { Button, Card, EmptyState } from "@/components/ui";
import { cn } from "@/lib/cn";
import { formatMonthLabel, todayIso, type IsoMonth } from "@/lib/domain/dates";
import { byModel, equityCurve, periodStats } from "@/lib/domain/stats";
import { offPlan, realizedR } from "@/lib/domain/trade";
import { buildTradeLogSearchParams, EMPTY_TRADE_LOG_FILTERS } from "@/lib/domain/trade-log";
import type { Trade, TradeModel } from "@/lib/domain/types";
import { formatPercent, formatR } from "@/lib/format";
import { useLocale, useT } from "@/lib/i18n/locale-context";
import { DIRECTION_LABELS, SESSION_LABELS, tradeCountLabel } from "@/lib/labels";
import { signOut } from "./actions";

export interface MobileHomeProps {
  month: IsoMonth;
  trades: Trade[];
  models: TradeModel[];
  hasAccount: boolean;
  drawdownAlert?: DrawdownAlertInfo | null;
}

/**
 * Best two + worst one, matching mock 1d's own three rows exactly (C2 +11.2R,
 * C3 +6.8R, Mid-range entry −2.7R skips "Failed sweep reversal" in between) —
 * a curated highlight reel rather than a truncated version of the desktop
 * list's own Playbook-sortOrder ordering (docs/decisions.md § Phase 5).
 */
function topAndBottomModels<T extends { netR: number }>(rows: readonly T[]): T[] {
  const sorted = [...rows].sort((a, b) => b.netR - a.netR);
  if (sorted.length <= 3) return sorted;
  return [sorted[0], sorted[1], sorted[sorted.length - 1]];
}

export function MobileHome({ month, trades, models, hasAccount, drawdownAlert }: MobileHomeProps) {
  const t = useT();
  const locale = useLocale();
  const router = useRouter();

  const stats = useMemo(() => periodStats(trades), [trades]);
  const equity = useMemo(() => equityCurve(trades), [trades]);
  const modelRows = useMemo(
    () => topAndBottomModels(byModel(trades, models).filter((r) => r.tradeCount > 0)),
    [trades, models],
  );
  const modelById = new Map(models.map((m) => [m.id, m]));
  const today = todayIso();
  const todayTrades = trades.filter((tr) => tr.date === today);
  const maxAbsModelR = Math.max(1e-9, ...modelRows.map((r) => Math.abs(r.netR)));
  const viewTodayHref = `/trades?${buildTradeLogSearchParams({ ...EMPTY_TRADE_LOG_FILTERS, from: today, to: today }, "date", "desc", 1)}`;

  const header = (
    <div className="flex items-center justify-between px-20 pt-16">
      <span className="text-20 font-extrabold tracking-[-.03em] text-ink">
        {formatMonthLabel(month, locale, false)} {t({ en: "log", ko: "기록" })}
      </span>
      <form action={signOut}>
        <button
          type="submit"
          aria-label={t({ en: "Sign out", ko: "로그아웃" })}
          className="h-34 w-34 rounded-pill bg-[#e5e8eb] transition-colors duration-150 ease-out hover:bg-disabled"
        />
      </form>
    </div>
  );

  if (!hasAccount || trades.length === 0) {
    return (
      <div className="flex min-h-full flex-col bg-page">
        {header}
        <div className="flex flex-1 flex-col justify-center gap-14 px-20 py-20">
          {drawdownAlert != null && <DrawdownAlert {...drawdownAlert} compact />}
          <EmptyState
            title={
              hasAccount
                ? t({ en: "No trades logged this month yet", ko: "이번 달 기록이 없습니다" })
                : t({ en: "Log your first trade", ko: "첫 트레이드를 기록하세요" })
            }
            description={t({
              en: "Once you record a trade, this fills in with your stats.",
              ko: "트레이드를 기록하면 여기에 통계가 채워집니다.",
            })}
          />
        </div>
        <div className="px-20 pb-20">
          <Button size="xl" className="w-full" onClick={() => router.push("/trades/new")}>
            {t({ en: "Log trade", ko: "기록하기" })}
          </Button>
        </div>
        <BottomTabBar items={toTabItems(t)} activeHref="/" />
      </div>
    );
  }

  return (
    <div className="flex min-h-full flex-col bg-page">
      {header}

      <div className="flex flex-1 flex-col gap-14 px-20 py-12">
        {drawdownAlert != null && <DrawdownAlert {...drawdownAlert} compact />}
        <Link href="/weekly-review" className="self-start text-12_5 font-semibold text-accent">
          {t({ en: "Weekly review", ko: "주간 리뷰" })} →
        </Link>

        <Card className="p-24">
          <div className="text-13 font-semibold text-muted">{t({ en: "Month to date", ko: "이번 달 누적" })}</div>
          <div
            className={cn(
              "mt-4 text-44 font-extrabold leading-[1.1] tracking-[-.04em]",
              stats.netR >= 0 ? "text-gain" : "text-loss",
            )}
          >
            {formatR(stats.netR)}
          </div>
          <div className="mt-14 flex gap-6">
            <span className="rounded-8 bg-divider px-10 py-6 text-12 font-semibold text-secondary">
              {t(tradeCountLabel(stats.tradeCount))}
            </span>
            <span className="rounded-8 bg-divider px-10 py-6 text-12 font-semibold text-secondary">
              {stats.winRate === null ? "—" : formatPercent(stats.winRate)}{" "}
              {t({ en: "win rate", ko: "승률" })}
            </span>
          </div>
          <Sparkline values={equity.points.map((p) => p.cumulativeR)} className="mt-18" />
        </Card>

        {modelRows.length > 0 && (
          <Card className="px-22 py-20">
            <div className="text-15 font-bold text-ink">{t({ en: "Models at work", ko: "잘 되는 모델" })}</div>
            <div className="mt-14 flex flex-col gap-14">
              {modelRows.map((row) => (
                <div key={row.modelId ?? "unassigned"}>
                  <div className="flex justify-between text-13_5 font-semibold text-body">
                    <span>{row.modelId === null ? t({ en: "Unassigned", ko: "미지정" }) : row.name}</span>
                    <span className={row.netR >= 0 ? "text-gain" : "text-loss"}>{formatR(row.netR)}</span>
                  </div>
                  <div className="mt-7 h-7 overflow-hidden rounded-pill bg-divider">
                    <div
                      className={cn("h-full rounded-pill", row.netR >= 0 ? "bg-gain" : "bg-loss")}
                      style={{ width: `${(Math.abs(row.netR) / maxAbsModelR) * 100}%` }}
                    />
                  </div>
                </div>
              ))}
            </div>
          </Card>
        )}

        <Card className="px-22 py-20">
          <div className="flex items-baseline justify-between">
            <span className="text-15 font-bold text-ink">{t({ en: "Today", ko: "오늘" })}</span>
            <Link href={viewTodayHref} className="text-12_5 font-semibold text-accent">
              {t({ en: "View all", ko: "전체보기" })}
            </Link>
          </div>
          {todayTrades.length === 0 ? (
            <p className="mt-14 text-12_5 font-medium text-faint">
              {t({ en: "No trades yet today.", ko: "오늘은 아직 기록이 없습니다." })}
            </p>
          ) : (
            <div className="mt-6 flex flex-col">
              {todayTrades.map((trade) => {
                const model = trade.modelId === null ? null : (modelById.get(trade.modelId) ?? null);
                const isOffPlan = offPlan(trade);
                const r = realizedR(trade);
                return (
                  <div key={trade.id} className="flex items-center justify-between py-8">
                    <div>
                      <div className="text-14_5 font-bold text-ink">
                        {trade.instrument} · {t(DIRECTION_LABELS[trade.direction])}
                      </div>
                      <div className="mt-2 text-12 font-medium text-muted">
                        {isOffPlan
                          ? t({ en: "Off-plan", ko: "Off-plan" })
                          : (model?.name ?? t({ en: "Unassigned", ko: "미지정" }))}{" "}
                        · {t(SESSION_LABELS[trade.session])}
                      </div>
                    </div>
                    <span className={cn("text-17 font-extrabold", r === null ? "text-ink" : r >= 0 ? "text-gain" : "text-loss")}>
                      {r === null ? "—" : formatR(r)}
                    </span>
                  </div>
                );
              })}
            </div>
          )}
        </Card>

        <Button size="xl" className="w-full" onClick={() => router.push("/trades/new")}>
          {t({ en: "Log trade", ko: "기록하기" })}
        </Button>
      </div>

      <BottomTabBar items={toTabItems(t)} activeHref="/" />
    </div>
  );
}
