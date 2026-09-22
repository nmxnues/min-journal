"use client";

import Link from "next/link";
import { useState } from "react";
import { Sparkline } from "@/components/charts/equity-curve";
import { BottomTabBar } from "@/components/nav/bottom-tab-bar";
import { toTabItems } from "@/components/nav/routes";
import { Card, Chip, Segmented } from "@/components/ui";
import { cn } from "@/lib/cn";
import { filterLedger, type LedgerEntry, type LedgerFilter } from "@/lib/domain/capital";
import {
  formatCompactDate,
  formatCurrency,
  formatMonthShort,
  formatSignedCurrency,
  formatSignedPercent,
} from "@/lib/format";
import { useFormatR } from "@/lib/settings/context";
import { useLocale, useT } from "@/lib/i18n/locale-context";
import { AccountSwitcher } from "./account-switcher";
import { DeleteCashModal } from "./delete-cash-modal";
import { DrawdownGuardCard } from "./drawdown-guard-card";
import { describeLedgerEntry, LEDGER_FILTER_LABELS, LEDGER_FILTERS, LEDGER_KIND_LABELS } from "./ledger-copy";
import { RiskPerTradeCard } from "./risk-card";
import type { CapitalScreenProps } from "./use-capital-summary";

const RECENT_ROWS = 5;

/**
 * Mock 3b-mobile ("자산"): balance hero with a sparkline, the 1R card, and
 * recent activity. The mock stops there; the risk setting and drawdown guard
 * have no mobile drawing, so they follow as the desktop cards in the same
 * card vocabulary — both are safety controls a phone-only session still needs.
 */
export function MobileCapital({ data, summary, onRecordCash }: CapitalScreenProps) {
  const t = useT();
  const formatR = useFormatR();
  const locale = useLocale();
  const { account } = data;
  const currency = account.currency;

  const [expanded, setExpanded] = useState(false);
  const [filter, setFilter] = useState<LedgerFilter>("all");
  const [deleting, setDeleting] = useState<LedgerEntry | null>(null);

  const rows = expanded ? filterLedger(summary.entries, filter) : summary.entries.slice(0, RECENT_ROWS);

  // "잔고의 1% · 3월 $150에서 시작" and the two-tone bar: grey is where 1R started, accent is what it has grown by.
  const startRValue = summary.series[0]?.rValue ?? 0;
  const nowRValue = summary.rValueToday;
  const barTotal = Math.max(startRValue, nowRValue);
  const baseShare = barTotal > 0 ? Math.min(startRValue, nowRValue) / barTotal : 0;
  const growthShare = barTotal > 0 && nowRValue > startRValue ? (nowRValue - startRValue) / barTotal : 0;
  const startMonth = formatMonthShort(account.startedAt, locale);
  const rule =
    account.riskMode === "fixed"
      ? t({
          en: `Fixed ${formatCurrency(account.fixedRiskAmount ?? 0, currency)}`,
          ko: `고정 ${formatCurrency(account.fixedRiskAmount ?? 0, currency)}`,
        })
      : t({ en: `${account.riskPercent}% of balance`, ko: `잔고의 ${account.riskPercent}%` });

  return (
    <div className="flex min-h-full flex-col bg-page">
      <div className="flex items-center justify-between px-20 pt-16">
        <span className="text-20 font-extrabold tracking-[-.03em] text-ink">{t({ en: "Capital", ko: "자산" })}</span>
        <button
          type="button"
          onClick={onRecordCash}
          className="-mr-10 min-h-44 rounded-10 px-10 text-13 font-semibold text-accent transition-colors duration-150 ease-out hover:text-accent-pressed focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent"
        >
          {t({ en: "Deposit / Withdraw", ko: "입출금" })}
        </button>
      </div>
      <div className="px-20 pt-10">
        <AccountSwitcher accounts={data.allAccounts} currentAccountId={account.id} compact />
      </div>

      <div className="flex flex-1 flex-col gap-14 px-20 pt-12 pb-20">
        {/* Balance hero */}
        <Card className="rounded-22 p-24">
          <div className="text-13 font-semibold text-muted">{t({ en: "Account balance", ko: "계좌 잔고" })}</div>
          <div className="mt-4 text-40 font-extrabold leading-[1.1] tracking-[-.04em] text-ink">
            {formatCurrency(summary.balance, currency)}
          </div>
          <div className="mt-12 flex flex-wrap gap-6">
            <Chip shape="stat">
              {t({ en: "Principal", ko: "원금" })} {formatCurrency(summary.netDeposits, currency)}
            </Chip>
            <Chip
              shape="stat"
              tone={summary.tradingPnL > 0 ? "gain" : summary.tradingPnL < 0 ? "loss" : "neutral"}
            >
              {formatSignedCurrency(summary.tradingPnL, currency)}
            </Chip>
          </div>
          {/*
            The P&L chip above is net of swap. A phone has no room to break
            that out inside the chip, so it gets its own line here — and only
            when there is a swap to name, keeping the card unchanged for a
            purely intraday account (docs/decisions.md § Swap).
          */}
          {summary.tradingSwap !== 0 && (
            <div className="mt-8 text-12 font-medium text-faint">
              {t({ en: "incl. swap", ko: "스왑 포함" })}{" "}
              {formatSignedCurrency(summary.tradingSwap, currency)}
              {" · "}
              {formatR(summary.tradingSwapR)}
            </div>
          )}
          {summary.tradingCommission !== 0 && (
            <div className="mt-4 text-12 font-medium text-faint">
              {t({ en: "incl. commission", ko: "커미션 포함" })}{" "}
              {formatSignedCurrency(-summary.tradingCommission, currency, 2)}
            </div>
          )}
          <Sparkline tone="ink" label={t({ en: "Balance over time", ko: "잔고 추이" })} values={summary.series.map((p) => p.balance)} className="mt-16" />
        </Card>

        {/* 1R card */}
        <Card className="rounded-22 px-22 py-20">
          <div className="flex items-baseline justify-between">
            <span className="text-15 font-bold text-ink">{t({ en: "1R value", ko: "1R 값" })}</span>
            <span className="text-20 font-extrabold text-ink">{formatCurrency(nowRValue, currency)}</span>
          </div>
          <div className="mt-4 text-12 font-medium text-faint">
            {rule} ·{" "}
            {t({
              en: `started at ${formatCurrency(startRValue, currency)} in ${startMonth}`,
              ko: `${startMonth} ${formatCurrency(startRValue, currency)}에서 시작`,
            })}
          </div>
          <div className="mt-14 flex h-8 overflow-hidden rounded-pill bg-divider">
            <div className="h-full bg-disabled" style={{ width: `${baseShare * 100}%` }} />
            <div className="h-full bg-accent" style={{ width: `${growthShare * 100}%` }} />
          </div>
          <div className="mt-7 flex justify-between text-11_5 font-medium text-faint">
            <span>{formatCurrency(startRValue, currency)}</span>
            <span>{startRValue > 0 ? formatSignedPercent(nowRValue / startRValue - 1, 0) : "—"}</span>
            <span>{formatCurrency(nowRValue, currency)}</span>
          </div>
        </Card>

        {/* Recent activity */}
        <Card className="rounded-22 px-22 py-20">
          <div className="flex items-baseline justify-between">
            <span className="text-15 font-bold text-ink">{t({ en: "Recent activity", ko: "최근 내역" })}</span>
            {summary.entries.length > RECENT_ROWS && (
              <button
                type="button"
                onClick={() => setExpanded((v) => !v)}
                className="-my-12 -mr-8 min-h-44 rounded-8 px-8 text-12_5 font-semibold text-accent focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent focus-visible:ring-offset-2"
              >
                {expanded ? t({ en: "Show less", ko: "접기" }) : t({ en: "View all", ko: "전체보기" })}
              </button>
            )}
          </div>

          {expanded && (
            <Segmented
              name={t({ en: "Ledger filter", ko: "원장 필터" })}
              className="mt-14"
              value={filter}
              onChange={setFilter}
              options={LEDGER_FILTERS.map((value) => ({ value, label: t(LEDGER_FILTER_LABELS[value]) }))}
            />
          )}

          <div className="mt-14 flex flex-col">
            {rows.map((entry, i) => (
              <div key={entry.id}>
                {i > 0 && <div className="h-1 bg-divider" />}
                <ActivityRow entry={entry} data={data} summary={summary} onCashClick={() => setDeleting(entry)} />
              </div>
            ))}
          </div>

          {expanded && (
            <div className="mt-14 flex items-center justify-between text-12_5">
              <span className="font-medium text-faint">{t({ en: `${rows.length} ${rows.length === 1 ? "entry" : "entries"}`, ko: `${rows.length}건` })}</span>
              <a
                href={`/capital/export?filter=${filter}`}
                className="rounded-6 font-semibold text-accent focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent focus-visible:ring-offset-2"
              >
                {t({ en: "Export CSV", ko: "CSV 내보내기" })}
              </a>
            </div>
          )}
        </Card>

        <RiskPerTradeCard data={data} summary={summary} compact />
        <DrawdownGuardCard data={data} summary={summary} compact />
      </div>

      <BottomTabBar items={toTabItems(t)} activeHref="/capital" />

      {deleting !== null && (
        <DeleteCashModal data={data} summary={summary} entry={deleting} variant="sheet" onClose={() => setDeleting(null)} />
      )}
    </div>
  );
}

/**
 * One activity row: title + "09.09 · 트레이드" left; the amount right, over
 * either the trade's R or, for cash, the 1R shift it caused ("1R $266→$316").
 */
function ActivityRow({
  entry,
  data,
  summary,
  onCashClick,
}: Pick<CapitalScreenProps, "data" | "summary"> & { entry: LedgerEntry; onCashClick: () => void }) {
  const formatR = useFormatR();
  const t = useT();
  const currency = data.account.currency;
  const isTrade = entry.kind === "trade";

  const detail = isTrade
    ? entry.r === null
      ? "—"
      : formatR(entry.r)
    : entry.kind === "opening"
      ? `1R ${formatCurrency(entry.rValueAfter, currency)}`
      : `1R ${formatCurrency(entry.rValueBefore, currency)}→${formatCurrency(entry.rValueAfter, currency)}`;

  const content = (
    <>
      <div className="min-w-0">
        <div className="truncate text-14 font-bold text-ink">
          {describeLedgerEntry(entry, summary.modelNameById, t, false)}
        </div>
        <div className="mt-2 text-12 font-medium text-muted">
          {formatCompactDate(entry.date)} · {t(LEDGER_KIND_LABELS[entry.kind])}
        </div>
      </div>
      <div className="shrink-0 text-right">
        <div
          className={cn(
            "text-15 font-extrabold",
            !isTrade ? "text-ink" : entry.amount > 0 ? "text-gain" : entry.amount < 0 ? "text-loss" : "text-ink",
          )}
        >
          {formatSignedCurrency(entry.amount, currency)}
        </div>
        <div className="text-11_5 font-medium text-faint">{detail}</div>
      </div>
    </>
  );

  const rowClass = "flex min-h-44 w-full items-center justify-between gap-12 rounded-8 py-6 text-left focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent focus-visible:ring-offset-2";

  if (entry.source.kind === "trade") {
    return (
      <Link href={`/trades/${entry.id}`} className={rowClass}>
        {content}
      </Link>
    );
  }
  if (entry.kind === "opening") return <div className={rowClass}>{content}</div>;
  return (
    <button type="button" onClick={onCashClick} className={rowClass}>
      {content}
    </button>
  );
}
