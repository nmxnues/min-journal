"use client";

import Link from "next/link";
import { useState } from "react";
import {
  BalanceAndRValueChart,
  type CapitalPoint,
  type PositionedCaption,
} from "@/components/charts/balance-r-value-chart";
import { toNavItems } from "@/components/nav/routes";
import { SignOutButton } from "@/components/nav/sign-out-button";
import { TopBar } from "@/components/nav/top-bar";
import { Button, Card, Chip, StatCard } from "@/components/ui";
import { cn } from "@/lib/cn";
import { filterLedger, type CapitalSeriesPoint, type LedgerEntry, type LedgerFilter } from "@/lib/domain/capital";
import type { IsoDate } from "@/lib/domain/types";
import {
  formatCompactDate,
  formatCurrency,
  formatMonthShort,
  formatSignedCurrency,
  formatSignedPercent,
  formatTradeDate,
} from "@/lib/format";
import { useFormatR } from "@/lib/settings/context";
import type { Locale, LocaleStrings } from "@/lib/i18n/locale";
import { useLocale, useT } from "@/lib/i18n/locale-context";
import { signOut } from "../actions";
import { AccountSwitcher } from "./account-switcher";
import { DeleteCashModal } from "./delete-cash-modal";
import { DrawdownGuardCard } from "./drawdown-guard-card";
import { describeLedgerEntry, LEDGER_FILTER_LABELS, LEDGER_FILTERS, LEDGER_KIND_LABELS } from "./ledger-copy";
import { RiskPerTradeCard } from "./risk-card";
import type { CapitalScreenProps } from "./use-capital-summary";

/** Rows before the ledger card asks to "Show all" — mock 3a's footer reads "Showing 6 of 64". */
const LEDGER_PAGE_SIZE = 12;

/** Captions closer than this share of the chart width would overlap, so the later one is dropped. */
const MIN_CAPTION_GAP = 0.14;

function dayNumber(date: IsoDate): number {
  return Date.UTC(Number(date.slice(0, 4)), Number(date.slice(5, 7)) - 1, Number(date.slice(8, 10))) / 86_400_000;
}

/**
 * Series -> chart props. x is real time (docs/README.md § Capital: "on the
 * same time axis"), so a cash movement's before/after points share an x and
 * draw as a step. Captions are mock 3a's "Mar · May · deposit · Jul ·
 * withdrawal · Sep": the start, every cash movement that fits, the end.
 */
function toChart(series: readonly CapitalSeriesPoint[], locale: Locale, t: (s: LocaleStrings) => string) {
  const days = series.map((p) => dayNumber(p.date));
  const first = days[0] ?? 0;
  const span = (days[days.length - 1] ?? 0) - first;

  const points: CapitalPoint[] = series.map((p, i) => ({
    balance: p.balance,
    rValue: p.rValue,
    isCashEvent: p.marker === "deposit" || p.marker === "withdrawal",
    x: span > 0 ? (days[i]! - first) / span : undefined,
  }));

  if (span <= 0) return { points, captions: undefined };

  const captions: PositionedCaption[] = [];
  const place = (label: string, x: number) => {
    if (captions.every((c) => Math.abs(c.x - x) >= MIN_CAPTION_GAP)) captions.push({ label, x });
  };

  place(formatMonthShort(series[0]!.date, locale), 0);
  place(formatMonthShort(series[series.length - 1]!.date, locale), 1);
  series.forEach((p, i) => {
    if (p.marker !== "deposit" && p.marker !== "withdrawal") return;
    const kind = p.marker === "deposit" ? t({ en: "deposit", ko: "입금" }) : t({ en: "withdrawal", ko: "출금" });
    place(`${formatMonthShort(p.date, locale)} · ${kind}`, points[i]!.x!);
  });

  return { points, captions: captions.sort((a, b) => a.x - b.x) };
}

export function DesktopCapital({ data, summary, onRecordCash }: CapitalScreenProps) {
  const formatR = useFormatR();
  const t = useT();
  const locale = useLocale();
  const { account } = data;
  const currency = account.currency;
  const chart = toChart(summary.series, locale, t);
  const pnlTone = summary.tradingPnL > 0 ? "gain" : summary.tradingPnL < 0 ? "loss" : "ink";
  const twrTone = summary.timeWeightedReturn > 0 ? "gain" : summary.timeWeightedReturn < 0 ? "loss" : "ink";

  return (
    <div className="min-h-full bg-page">
      <TopBar
        items={toNavItems(t)}
        activeHref="/capital"
        right={
          <>
            <AccountSwitcher accounts={data.allAccounts} currentAccountId={account.id} />
            <Button onClick={onRecordCash}>{t({ en: "Deposit / Withdraw", ko: "입출금" })}</Button>
            <SignOutButton signOutAction={signOut} />
          </>
        }
      />

      <div className="mx-auto flex max-w-[1200px] flex-col gap-16 px-32 pt-28 pb-32">
        {/* Hero */}
        <Card className="grid grid-cols-[300px_1fr] items-center gap-40 px-36 py-32">
          <div>
            <div className="text-14 font-semibold text-muted">{t({ en: "Account balance", ko: "계좌 잔고" })}</div>
            <div className="mt-6 text-52 font-extrabold leading-[1.1] tracking-[-.04em] text-ink">
              {formatCurrency(summary.balance, currency)}
            </div>
            <div className="mt-14 flex flex-wrap gap-8">
              <Chip shape="stat">
                {t({ en: "Deposited", ko: "입금" })} {formatCurrency(summary.totals.deposited, currency)}
              </Chip>
              <Chip shape="stat" tone={pnlTone === "ink" ? "neutral" : pnlTone}>
                {formatSignedCurrency(summary.tradingPnL, currency)} {t({ en: "trading", ko: "매매" })}
              </Chip>
              <Chip shape="stat">
                {t({ en: "Withdrawn", ko: "출금" })} {formatCurrency(summary.totals.withdrawn, currency)}
              </Chip>
            </div>
          </div>
          <BalanceAndRValueChart
            title={t({ en: "Balance & 1R value", ko: "잔고 · 1R 값" })}
            legend={{ balance: t({ en: "Balance", ko: "잔고" }), rValue: t({ en: "1R value", ko: "1R 값" }) }}
            points={chart.points}
            captions={chart.captions}
          />
        </Card>

        {/* Stat row */}
        <div className="grid grid-cols-2 gap-16 min-[1200px]:grid-cols-4">
          <StatCard
            label={t({ en: "Starting capital", ko: "시작 자본" })}
            value={formatCurrency(account.startingCapital, currency)}
            sub={formatTradeDate(account.startedAt, locale)}
          />
          <StatCard
            label={t({ en: "Net deposits", ko: "순입금" })}
            value={formatCurrency(summary.netDeposits, currency)}
            sub={t({
              en: `${summary.totals.inCount} in · ${summary.totals.outCount} out`,
              ko: `입금 ${summary.totals.inCount} · 출금 ${summary.totals.outCount}`,
            })}
          />
          <StatCard
            label={t({ en: "Trading P&L", ko: "매매 손익" })}
            value={formatSignedCurrency(summary.tradingPnL, currency)}
            tone={pnlTone}
            // The value is net of swap while the lifetime R beside it is
            // price R, so the two stop reconciling through 1R as soon as any
            // swap is recorded. Naming the swap here is what explains the gap
            // — and on a swing account it is the figure that made the dollar
            // number disagree with the broker in the first place
            // (docs/decisions.md § Swap). With no swap recorded the caption is
            // byte-identical to before.
            sub={
              summary.tradingSwap === 0
                ? t({ en: `${formatR(summary.lifetimeR)} lifetime`, ko: `누적 ${formatR(summary.lifetimeR)}` })
                : t({
                    en: `${formatR(summary.lifetimeR)} lifetime · incl. ${formatSignedCurrency(summary.tradingSwap, currency)} swap`,
                    ko: `누적 ${formatR(summary.lifetimeR)} · 스왑 ${formatSignedCurrency(summary.tradingSwap, currency)} 포함`,
                  })
            }
          />
          <StatCard
            label={t({ en: "Return on capital", ko: "자본 수익률" })}
            value={formatSignedPercent(summary.timeWeightedReturn)}
            tone={twrTone}
            sub={t({ en: "time-weighted", ko: "시간가중" })}
          />
        </div>

        {/* Ledger | risk & guard */}
        <div className="grid grid-cols-1 items-start gap-16 min-[1200px]:grid-cols-[1fr_380px]">
          <LedgerCard data={data} summary={summary} />
          <div className="flex flex-col gap-16">
            <RiskPerTradeCard data={data} summary={summary} />
            <DrawdownGuardCard data={data} summary={summary} />
          </div>
        </div>
      </div>
    </div>
  );
}

function LedgerCard({ data, summary }: Pick<CapitalScreenProps, "data" | "summary">) {
  const formatR = useFormatR();
  const t = useT();
  const [filter, setFilter] = useState<LedgerFilter>("all");
  const [showAll, setShowAll] = useState(false);
  const [deleting, setDeleting] = useState<LedgerEntry | null>(null);

  const rows = filterLedger(summary.entries, filter);
  const visible = showAll ? rows : rows.slice(0, LEDGER_PAGE_SIZE);
  // Desktop has the column width to name a row's swap inside its entry cell;
  // the Amount column stays the net figure either way.
  const formatSwap = (value: number) => formatSignedCurrency(value, data.account.currency);
  const grid = "grid grid-cols-[74px_1fr_116px_104px_108px] items-center gap-14";

  return (
    <Card className="px-28 py-26">
      <div className="flex items-baseline justify-between gap-16">
        <span className="text-16 font-bold tracking-[-.02em] text-ink">{t({ en: "Ledger", ko: "원장" })}</span>
        <div role="radiogroup" aria-label={t({ en: "Ledger filter", ko: "원장 필터" })} className="flex gap-6">
          {LEDGER_FILTERS.map((value) => {
            const isActive = value === filter;
            return (
              <button
                key={value}
                type="button"
                role="radio"
                aria-checked={isActive}
                onClick={() => setFilter(value)}
                className={cn(
                  "rounded-8 px-11 py-7 text-12_5 font-semibold transition-colors duration-150 ease-out",
                  "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent focus-visible:ring-offset-2",
                  isActive ? "bg-divider text-ink" : "text-muted hover:text-secondary",
                )}
              >
                {t(LEDGER_FILTER_LABELS[value])}
              </button>
            );
          })}
        </div>
      </div>

      <div
        className={cn(
          grid,
          "mt-6 border-b border-divider pt-16 pb-12 text-11_5 font-bold tracking-[.02em] text-muted",
        )}
      >
        <span>{t({ en: "DATE", ko: "날짜" })}</span>
        <span>{t({ en: "ENTRY", ko: "내역" })}</span>
        <span className="text-right">{t({ en: "AMOUNT", ko: "금액" })}</span>
        <span className="text-right">R</span>
        <span className="text-right">{t({ en: "BALANCE", ko: "잔고" })}</span>
      </div>

      <div className="flex flex-col">
        {visible.map((entry) => {
          const isTrade = entry.kind === "trade";
          const isDepositLike = entry.kind === "deposit" || entry.kind === "opening";
          const content = (
            <>
              <span className="text-13 font-bold text-muted">{formatCompactDate(entry.date)}</span>
              <span className="flex min-w-0 items-center gap-9">
                <span
                  className={cn(
                    "shrink-0 rounded-8 px-8 py-5 text-11_5",
                    isTrade && "bg-divider font-semibold text-secondary",
                    isDepositLike && "bg-accent-tint font-bold text-accent-pressed",
                    entry.kind === "withdrawal" && "bg-divider font-bold text-secondary",
                  )}
                >
                  {t(LEDGER_KIND_LABELS[entry.kind])}
                </span>
                {/* The mock's column truncates longer notes/model names; the full text stays one hover away. */}
                <span
                  className="truncate text-14 font-semibold text-ink"
                  title={describeLedgerEntry(entry, summary.modelNameById, t, true, formatSwap)}
                >
                  {describeLedgerEntry(entry, summary.modelNameById, t, true, formatSwap)}
                </span>
              </span>
              <span
                className={cn(
                  "text-right text-14_5 font-extrabold",
                  !isTrade ? "text-ink" : entry.amount > 0 ? "text-gain" : entry.amount < 0 ? "text-loss" : "text-ink",
                )}
              >
                {formatSignedCurrency(entry.amount, data.account.currency)}
              </span>
              {entry.r === null ? (
                <span className="text-right text-13 font-semibold text-disabled">—</span>
              ) : (
                <span className="text-right text-13 font-semibold text-muted">{formatR(entry.r)}</span>
              )}
              <span className="text-right text-13 font-semibold text-secondary">
                {formatCurrency(entry.balanceAfter, data.account.currency)}
              </span>
            </>
          );

          const rowBase = cn(grid, "border-b border-divider py-14 transition-colors duration-150 ease-out last:border-b-0");

          if (entry.source.kind === "trade") {
            return (
              <Link key={entry.id} href={`/trades/${entry.id}`} className={cn(rowBase, "hover:bg-surface-faint", "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent focus-visible:ring-offset-2")}>
                {content}
              </Link>
            );
          }
          if (entry.kind === "opening") {
            return (
              <div key={entry.id} className={cn(rowBase, "bg-surface-faint")}>
                {content}
              </div>
            );
          }
          // Cash rows carry the #fbfcfd tint so they read as a different kind of event (mock 3a).
          return (
            <button
              key={entry.id}
              type="button"
              onClick={() => setDeleting(entry)}
              aria-label={t({ en: "Review or delete this entry", ko: "이 내역 확인 또는 삭제" })}
              className={cn(
                rowBase,
                "w-full bg-surface-faint text-left hover:bg-divider",
                "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent",
              )}
            >
              {content}
            </button>
          );
        })}
      </div>

      <div className="flex items-center justify-between gap-16 pt-18 pb-4">
        <span className="text-12_5 font-medium text-faint">
          {t({ en: `Showing ${visible.length} of ${rows.length}`, ko: `${rows.length}건 중 ${visible.length}건` })}
          {rows.length > LEDGER_PAGE_SIZE && (
            <>
              {" · "}
              <button
                type="button"
                onClick={() => setShowAll((v) => !v)}
                className="rounded-6 font-semibold text-accent hover:text-accent-pressed focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent focus-visible:ring-offset-2"
              >
                {showAll ? t({ en: "Show fewer", ko: "접기" }) : t({ en: "Show all", ko: "모두 보기" })}
              </button>
            </>
          )}
        </span>
        <a
          href={`/capital/export?filter=${filter}`}
          className="rounded-6 text-12_5 font-semibold text-accent hover:text-accent-pressed focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent focus-visible:ring-offset-2"
        >
          {t({ en: "Export CSV", ko: "CSV 내보내기" })}
        </a>
      </div>

      {deleting !== null && (
        <DeleteCashModal data={data} summary={summary} entry={deleting} variant="modal" onClose={() => setDeleting(null)} />
      )}
    </Card>
  );
}
