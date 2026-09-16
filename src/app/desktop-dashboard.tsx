"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useMemo } from "react";
import { DrawdownAlert, type DrawdownAlertInfo } from "@/components/drawdown-alert";
import { EquityCurve } from "@/components/charts/equity-curve";
import { toNavItems } from "@/components/nav/routes";
import { SignOutButton } from "@/components/nav/sign-out-button";
import { TopBar } from "@/components/nav/top-bar";
import { BarRow, Button, Card, CardHeader, Chip, EmptyState, Panel, StatCard } from "@/components/ui";
import { cn } from "@/lib/cn";
import { tradingPnL, tradingSwap } from "@/lib/domain/capital";
import type { ResolvedDashboardPeriod } from "@/lib/domain/dashboard-period";
import { byModel, bySession, equityCurve, periodStats, sweepAlignment } from "@/lib/domain/stats";
import { buildTradeLogSearchParams, EMPTY_TRADE_LOG_FILTERS } from "@/lib/domain/trade-log";
import { offPlan, plannedR, realizedR } from "@/lib/domain/trade";
import type { Trade, TradeModel } from "@/lib/domain/types";
import { formatCompactDate, formatPercent, formatSignedCurrency, formatTradeDate } from "@/lib/format";
import { useFormatR } from "@/lib/settings/context";
import { useLocale, useT } from "@/lib/i18n/locale-context";
import { DIRECTION_LABELS, HTF_PAIRING_LABELS, SESSION_LABELS, SWEEP_SIDE_LABELS, tradeCountLabel } from "@/lib/labels";
import { signOut } from "./actions";
import { DASHBOARD_HERO_LABELS } from "./dashboard-period-copy";
import { PeriodPicker } from "./period-picker";

const SWEEP_ALIGNMENT_LABELS = {
  long_after_low: { en: "Long after low purge", ko: "저점 퍼지 후 롱" },
  short_after_high: { en: "Short after high purge", ko: "고점 퍼지 후 숏" },
  no_sweep: { en: "Entry without a sweep", ko: "스윕 없는 진입" },
} as const;

export interface DesktopDashboardProps {
  period: ResolvedDashboardPeriod;
  trades: Trade[];
  models: TradeModel[];
  hasAccount: boolean;
  drawdownAlert?: DrawdownAlertInfo | null;
  currency: string;
}

const em = "—";

export function DesktopDashboard({
  period,
  trades,
  models,
  hasAccount,
  drawdownAlert,
  currency,
}: DesktopDashboardProps) {
  const formatR = useFormatR();
  const t = useT();
  const locale = useLocale();
  const router = useRouter();

  const stats = useMemo(() => periodStats(trades), [trades]);
  const equity = useMemo(() => equityCurve(trades), [trades]);
  // docs/README.md § Capital: "every surface that shows money also shows R,
  // and vice versa" — R stays the primary figure here (this screen's whole
  // vocabulary is R-first), so the dollar total rides underneath as a small
  // caption rather than displacing it.
  const periodPnl = useMemo(() => tradingPnL(trades), [trades]);
  const periodSwap = useMemo(() => tradingSwap(trades), [trades]);
  const modelRows = useMemo(
    () => byModel(trades, models).filter((r) => r.tradeCount > 0),
    [trades, models],
  );
  const sessionRows = useMemo(() => bySession(trades), [trades]);
  const alignmentRows = useMemo(() => sweepAlignment(trades), [trades]);
  const recentTrades = trades.slice(0, 5);
  const modelById = new Map(models.map((m) => [m.id, m]));

  // "View all" links into the exact same range the hero/analysis are
  // reading, not always the calendar month it used to be fixed to
  // (docs/decisions.md § Dashboard period picker).
  const viewAllHref = `/trades?${buildTradeLogSearchParams({ ...EMPTY_TRADE_LOG_FILTERS, from: period.from, to: period.to }, "date", "desc", 1)}`;

  const maxAbsModelR = Math.max(1e-9, ...modelRows.map((r) => Math.abs(r.netR)));

  const topBar = (
    <TopBar
      items={toNavItems(t)}
      activeHref="/"
      right={
        <>
          <PeriodPicker resolved={period} />
          <Link href="/weekly-review" className="rounded-6 text-13 font-semibold text-accent hover:text-accent-pressed focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent focus-visible:ring-offset-2">
            {t({ en: "Weekly review", ko: "주간 리뷰" })}
          </Link>
          <Link href="/settings" className="rounded-6 text-13 font-semibold text-accent hover:text-accent-pressed focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent focus-visible:ring-offset-2">
            {t({ en: "Settings", ko: "설정" })}
          </Link>
          <Button onClick={() => router.push("/trades/new")}>{t({ en: "New trade", ko: "New trade" })}</Button>
          <SignOutButton signOutAction={signOut} />
        </>
      }
    />
  );

  if (!hasAccount || trades.length === 0) {
    return (
      <div className="flex min-h-full flex-col bg-page">
        {topBar}
        <div className="mx-auto flex w-full max-w-[1200px] flex-1 flex-col items-center justify-center gap-16 p-32">
          {drawdownAlert != null && <DrawdownAlert {...drawdownAlert} />}
          <EmptyState
            title={
              hasAccount
                ? period.stepMonth !== null
                  ? t({ en: "No trades logged this month yet", ko: "이번 달 기록이 없습니다" })
                  : t({ en: "No trades in this period", ko: "이 기간에는 기록이 없습니다" })
                : t({ en: "Log your first trade", ko: "첫 트레이드를 기록하세요" })
            }
            description={t({
              en: "Once you record a trade, this dashboard fills in with your stats.",
              ko: "트레이드를 기록하면 이 대시보드에 통계가 채워집니다.",
            })}
            action={<Button onClick={() => router.push("/trades/new")}>{t({ en: "New trade", ko: "New trade" })}</Button>}
            className="w-full max-w-[440px]"
          />
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-full bg-page">
      {topBar}

      <div className="mx-auto flex max-w-[1200px] flex-col gap-16 p-32">
        {drawdownAlert != null && <DrawdownAlert {...drawdownAlert} />}

        {/* Hero */}
        <Card className="grid grid-cols-[340px_1fr] items-center gap-40 px-36 py-32">
          <div>
            <div className="text-14 font-semibold text-muted">{t(DASHBOARD_HERO_LABELS[period.kind])}</div>
            <div
              className={cn(
                "mt-6 text-56 font-extrabold leading-[1.1] tracking-[-.04em]",
                stats.netR >= 0 ? "text-gain" : "text-loss",
              )}
            >
              {formatR(stats.netR)}
            </div>
            {stats.tradeCount > 0 && (
              <div className="mt-4 text-15 font-bold text-muted">{formatSignedCurrency(periodPnl, currency)}</div>
            )}
            {/*
              The big number is price R and the line above is net of swap, so on a
              swing account the two only reconcile once the financing is named
              (docs/decisions.md § Swap). Hidden entirely when no trade in the
              period recorded one, which is every intraday period.
            */}
            {periodSwap !== 0 && (
              <div className="mt-4 text-12_5 font-medium text-faint">
                {t({ en: "incl. swap", ko: "스왑 포함" })}{" "}
                {formatSignedCurrency(periodSwap, currency)}
              </div>
            )}
            <div className="mt-14 flex gap-8">
              <Chip shape="stat">{t(tradeCountLabel(stats.tradeCount))}</Chip>
              <Chip shape="stat">
                {stats.winRate === null ? em : formatPercent(stats.winRate)}{" "}
                {t({ en: "win rate", ko: "승률" })}
              </Chip>
              <Chip shape="stat">
                {stats.expectancy === null ? em : formatR(stats.expectancy, 2, true, false)}{" "}
                {t({ en: "expectancy", ko: "기대값" })}
              </Chip>
            </div>
          </div>
          <div>
            <EquityCurve
              values={equity.points.map((p) => p.cumulativeR)}
              captions={
                equity.points.length > 0
                  ? {
                      start: formatTradeDate(equity.points[0].date, locale, true),
                      middle: `${t({ en: "Max drawdown", ko: "최대 낙폭" })} ${formatR(-equity.maxDrawdownR)}`,
                      end: formatTradeDate(equity.points[equity.points.length - 1].date, locale, true),
                    }
                  : undefined
              }
            />
          </div>
        </Card>

        {/* Stat row */}
        <div className="grid grid-cols-2 gap-16 min-[1200px]:grid-cols-4">
          <StatCard
            label={t({ en: "Avg win", ko: "평균 익절" })}
            value={stats.avgWin === null ? em : formatR(stats.avgWin, 1, true, false)}
          />
          <StatCard
            label={t({ en: "Avg loss", ko: "평균 손절" })}
            value={stats.avgLoss === null ? em : formatR(stats.avgLoss)}
            tone={stats.avgLoss !== null && stats.avgLoss < 0 ? "loss" : "ink"}
          />
          <StatCard
            label={t({ en: "Win streak", ko: "연승" })}
            value={t({
              en: `${stats.winStreaks.current} ${stats.winStreaks.current === 1 ? "trade" : "trades"}`,
              ko: `${stats.winStreaks.current}트레이드`,
            })}
          />
          <StatCard
            label={t({ en: "Rule adherence", ko: "규칙 준수율" })}
            value={stats.ruleAdherence === null ? em : formatPercent(stats.ruleAdherence)}
          />
        </div>

        {/* Two-up analysis row */}
        <div className="grid grid-cols-1 gap-16 min-[1200px]:grid-cols-2">
          <Card className="px-28 py-26">
            <CardHeader title={t({ en: "Performance by model", ko: "모델별 성과" })} />
            <div className="mt-20 flex flex-col gap-18">
              {modelRows.map((row) => (
                <div key={row.modelId ?? "unassigned"}>
                  <div className="flex justify-between text-14 font-semibold text-body">
                    <span>{row.modelId === null ? t({ en: "Unassigned", ko: "미지정" }) : row.name}</span>
                    <span className={row.netR >= 0 ? "text-gain" : "text-loss"}>{formatR(row.netR)}</span>
                  </div>
                  <div className="mt-8 h-8 overflow-hidden rounded-pill bg-divider">
                    <div
                      className={cn("h-full rounded-pill", row.netR >= 0 ? "bg-gain" : "bg-loss")}
                      style={{ width: `${(Math.abs(row.netR) / maxAbsModelR) * 100}%` }}
                    />
                  </div>
                  <div className="mt-6 text-11_5 font-medium text-faint">
                    {t(tradeCountLabel(row.tradeCount))}
                    {row.winRate !== null && ` · ${formatPercent(row.winRate)} ${t({ en: "win rate", ko: "승률" })}`}
                    {row.offPlanCount === row.tradeCount && ` · ${t({ en: "off-plan entries", ko: "off-plan 기록" })}`}
                  </div>
                </div>
              ))}
            </div>
          </Card>

          <Card className="px-28 py-26">
            <CardHeader title={t({ en: "Session · sweep side", ko: "세션 · 스윕 사이드" })} />
            <div className="mt-20 grid grid-cols-3 gap-12">
              {sessionRows.map((row) => (
                <Panel key={row.session} className="rounded-16 px-18 py-18">
                  <div className="text-12 font-semibold text-muted">{t(SESSION_LABELS[row.session])}</div>
                  <div className={cn("mt-4 text-22 font-extrabold", row.netR >= 0 ? "text-gain" : "text-loss")}>
                    {row.tradeCount === 0 ? em : formatR(row.netR)}
                  </div>
                  <div className="mt-2 text-11 font-medium text-faint">
                    {t(tradeCountLabel(row.tradeCount))}
                  </div>
                </Panel>
              ))}
            </div>
            <div className="my-24 h-1 bg-divider" />
            <div className="flex flex-col gap-14">
              {alignmentRows.map((row) => (
                <BarRow
                  key={row.key}
                  label={t(SWEEP_ALIGNMENT_LABELS[row.key])}
                  value={row.winRate === null ? em : formatPercent(row.winRate)}
                  share={row.winRate ?? 0}
                  tone={row.key === "no_sweep" ? "weak" : "ink"}
                />
              ))}
            </div>
          </Card>
        </div>

        {/* Recent trades */}
        <Card className="px-28 pt-26 pb-12">
          <div className="flex items-baseline justify-between">
            <span className="text-16 font-bold tracking-[-.02em] text-ink">
              {t({ en: "Recent trades", ko: "최근 기록" })}
            </span>
            <Link href={viewAllHref} className="rounded-6 text-13 font-semibold text-accent hover:text-accent-pressed focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent focus-visible:ring-offset-2">
              {t({ en: `View all ${trades.length}`, ko: `전체보기 ${trades.length}` })}
            </Link>
          </div>
          <div className="mt-8 flex flex-col">
            {recentTrades.map((trade) => {
              const model = trade.modelId === null ? null : (modelById.get(trade.modelId) ?? null);
              const isOffPlan = offPlan(trade);
              const r = realizedR(trade);
              const planned = plannedR(trade);
              return (
                <Link
                  key={trade.id}
                  href={`/trades/${trade.id}`}
                  className="grid grid-cols-[64px_1fr_150px_130px_90px] items-center gap-16 border-b border-divider py-16 transition-colors duration-150 ease-out last:border-b-0 hover:bg-surface-faint min-[1200px]:grid-cols-[64px_1fr_150px_130px_110px_90px] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent focus-visible:ring-offset-2"
                >
                  <span className="text-13 font-bold text-muted">{formatCompactDate(trade.date)}</span>
                  <div>
                    <div className="text-15 font-bold text-ink">
                      {trade.instrument} · {t(DIRECTION_LABELS[trade.direction])}
                    </div>
                    <div className="mt-2 text-12 font-medium text-muted">
                      {t(HTF_PAIRING_LABELS[trade.htfPairing])} · {t(SWEEP_SIDE_LABELS[trade.sweepSide])}
                    </div>
                  </div>
                  <Chip tone={isOffPlan ? "accent" : "neutral"} className="justify-self-start">
                    {isOffPlan ? t({ en: "Off-plan", ko: "Off-plan" }) : (model?.name ?? t({ en: "Unassigned", ko: "미지정" }))}
                  </Chip>
                  <span className="text-13 font-medium text-muted">{t(SESSION_LABELS[trade.session])}</span>
                  <span className="hidden text-13 font-medium text-muted min-[1200px]:inline">
                    {planned === null ? em : t({ en: `Plan ${planned.toFixed(1)}R`, ko: `계획 ${planned.toFixed(1)}R` })}
                  </span>
                  <span
                    className={cn(
                      "text-right text-17 font-extrabold",
                      r === null ? "text-ink" : r >= 0 ? "text-gain" : "text-loss",
                    )}
                  >
                    {r === null ? em : formatR(r)}
                  </span>
                </Link>
              );
            })}
          </div>
        </Card>
      </div>
    </div>
  );
}
