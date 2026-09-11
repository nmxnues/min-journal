"use client";

import { Check, ChevronDown, ChevronLeft, ChevronRight, ChevronUp } from "lucide-react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { useState } from "react";
import { BottomTabBar } from "@/components/nav/bottom-tab-bar";
import { toNavItems, toTabItems } from "@/components/nav/routes";
import { SignOutButton } from "@/components/nav/sign-out-button";
import { TopBar } from "@/components/nav/top-bar";
import { Button, Card, Chip, EmptyState } from "@/components/ui";
import { cn } from "@/lib/cn";
import { offPlan, plannedR, realizedR } from "@/lib/domain/trade";
import {
  buildTradeLogSearchParams,
  EMPTY_TRADE_LOG_FILTERS,
  hasActiveFilters,
  parseTradeLogFilters,
  parseTradeLogSort,
  SORT_COLUMNS,
  TRADE_LOG_PAGE_SIZE,
  type SortColumn,
  type SortDirection,
  type TradeLogFilters,
} from "@/lib/domain/trade-log";
import type { AccountKind, Trade, TradeModel } from "@/lib/domain/types";
import { formatCompactDate, formatHoldMinutes, formatPercent } from "@/lib/format";
import { useFormatR } from "@/lib/settings/context";
import { useLocale, useT } from "@/lib/i18n/locale-context";
import { INSTRUMENT_PRESETS } from "@/lib/instruments";
import {
  DIRECTION_LABELS,
  HTF_PAIRING_LABELS,
  RESULT_LABELS,
  RESULT_ORDER,
  SESSION_LABELS,
  SESSION_ORDER,
  SWEEP_SIDE_LABELS,
  SWEEP_SIDE_ORDER,
  tradeCountLabel,
} from "@/lib/labels";
import { signOut } from "../actions";
import { DateRangePill } from "./date-range-pill";
import { FilterDropdown } from "./filter-dropdown";
import { ImportModal } from "./import/import-modal";

const em = "—";

/** Text columns default to ascending on a fresh click; numeric/date columns default to descending. */
const TEXT_COLUMNS: readonly SortColumn[] = ["instrument", "model", "session", "sweep"];

const HEADER_LABELS: Record<SortColumn, { en: string; ko: string }> = {
  date: { en: "Date", ko: "날짜" },
  instrument: { en: "Instrument", ko: "종목" },
  model: { en: "Model", ko: "모델" },
  session: { en: "Session", ko: "세션" },
  sweep: { en: "Sweep", ko: "스윕" },
  planned: { en: "Planned", ko: "계획" },
  result: { en: "Result", ko: "결과" },
};

export interface TradeLogSummary {
  tradeCount: number;
  netR: number;
  winRate: number | null;
  avgHoldMinutes: number | null;
}

export interface TradeLogPagination {
  currentPage: number;
  totalPages: number;
  totalCount: number;
}

export interface TradeLogViewProps {
  hasAccount: boolean;
  /** Only meaningful when `hasAccount` — Import needs it to know whether `rValueAtEntry` can be left blank. */
  accountKind: AccountKind | null;
  models: TradeModel[];
  /** The current page's trades only — summary/export reflect the full filtered set server-side. */
  matching: Trade[];
  summary: TradeLogSummary | null;
  pagination: TradeLogPagination | null;
}

export function TradeLogView({ hasAccount, accountKind, models, matching, summary, pagination }: TradeLogViewProps) {
  const formatR = useFormatR();
  const t = useT();
  const locale = useLocale();
  const isMobile = locale === "ko";
  const router = useRouter();
  const searchParams = useSearchParams();
  const [importOpen, setImportOpen] = useState(false);

  const filters = parseTradeLogFilters(searchParams);
  const { sort, direction } = parseTradeLogSort(searchParams);
  const modelById = new Map(models.map((m) => [m.id, m]));

  function navigate(nextFilters: TradeLogFilters, nextSort: SortColumn, nextDirection: SortDirection, page: number) {
    const params = buildTradeLogSearchParams(nextFilters, nextSort, nextDirection, page);
    const qs = params.toString();
    router.push(qs ? `/trades?${qs}` : "/trades");
  }

  function updateFilters(patch: Partial<TradeLogFilters>) {
    navigate({ ...filters, ...patch }, sort, direction, 1);
  }

  function toggleSort(column: SortColumn) {
    const nextDirection: SortDirection =
      column === sort ? (direction === "asc" ? "desc" : "asc") : TEXT_COLUMNS.includes(column) ? "asc" : "desc";
    navigate(filters, column, nextDirection, 1);
  }

  function goToPage(page: number) {
    navigate(filters, sort, direction, page);
  }

  function resetFilters() {
    navigate(EMPTY_TRADE_LOG_FILTERS, sort, direction, 1);
  }

  const exportHref = `/trades/export?${buildTradeLogSearchParams(filters, sort, direction, 1).toString()}`;

  const topBar = (
    <TopBar
      items={toNavItems(t)}
      activeHref="/trades"
      right={
        <>
          <Button onClick={() => router.push("/trades/new")}>{t({ en: "New trade", ko: "New trade" })}</Button>
          <SignOutButton signOutAction={signOut} />
        </>
      }
    />
  );

  if (!hasAccount) {
    return (
      <div className={cn("flex min-h-full flex-col bg-page")}>
        {isMobile ? (
          <div className="flex items-center justify-between px-20 pt-16 pb-8">
            <span className="text-20 font-extrabold tracking-[-.03em] text-ink">{t({ en: "Trades", ko: "기록" })}</span>
          </div>
        ) : (
          topBar
        )}
        <div className="flex flex-1 items-center justify-center p-32">
          <EmptyState
            title={t({ en: "Log your first trade", ko: "첫 트레이드를 기록하세요" })}
            description={t({
              en: "Once you record a trade, it shows up here.",
              ko: "트레이드를 기록하면 이곳에 표시됩니다.",
            })}
            action={<Button onClick={() => router.push("/trades/new")}>{t({ en: "New trade", ko: "New trade" })}</Button>}
            className="w-full max-w-[440px]"
          />
        </div>
        {isMobile && <BottomTabBar items={toTabItems(t)} activeHref="/trades" />}
      </div>
    );
  }

  const modelOptions = [
    ...models.map((m) => ({ value: m.id, label: m.name })),
    { value: "unassigned", label: t({ en: "Unassigned", ko: "미지정" }) },
  ];

  return (
    <div className="flex min-h-full flex-col bg-page">
      {isMobile ? (
        <div className="flex items-center justify-between px-20 pt-16 pb-8">
          <span className="text-20 font-extrabold tracking-[-.03em] text-ink">{t({ en: "Trades", ko: "기록" })}</span>
          <Button size="sm" onClick={() => router.push("/trades/new")}>
            {t({ en: "New", ko: "기록하기" })}
          </Button>
        </div>
      ) : (
        topBar
      )}

      <div className={cn("mx-auto flex w-full max-w-[1200px] flex-1 flex-col gap-16", isMobile ? "p-20" : "p-32")}>
        {/* Filter card */}
        <Card className={cn(isMobile ? "px-20 py-20" : "px-28 py-22")}>
          <div className="flex flex-wrap items-center gap-10">
            <DateRangePill from={filters.from} to={filters.to} onChange={(from, to) => updateFilters({ from, to })} />
            <FilterDropdown
              label={t({ en: "Instrument", ko: "종목" })}
              placeholder={t({ en: "All instruments", ko: "전체 종목" })}
              options={INSTRUMENT_PRESETS.map((i) => ({ value: i, label: i }))}
              selected={filters.instruments}
              multiple
              onChange={(v) => updateFilters({ instruments: v })}
            />
            <FilterDropdown
              label={t({ en: "Session", ko: "세션" })}
              placeholder={t({ en: "All sessions", ko: "전체 세션" })}
              options={SESSION_ORDER.map((s) => ({ value: s, label: t(SESSION_LABELS[s]) }))}
              selected={filters.sessions}
              multiple
              onChange={(v) => updateFilters({ sessions: v })}
            />
            <FilterDropdown
              label={t({ en: "Model", ko: "모델" })}
              placeholder={t({ en: "All models", ko: "전체 모델" })}
              options={modelOptions}
              selected={filters.modelIds.map((id) => id ?? "unassigned")}
              multiple
              onChange={(v) => updateFilters({ modelIds: v.map((id) => (id === "unassigned" ? null : id)) })}
            />
            <FilterDropdown
              label={t({ en: "Sweep side", ko: "스윕 사이드" })}
              placeholder={t({ en: "Sweep side", ko: "스윕 사이드" })}
              options={SWEEP_SIDE_ORDER.map((s) => ({ value: s, label: t(SWEEP_SIDE_LABELS[s]) }))}
              selected={filters.sweepSide !== null ? [filters.sweepSide] : []}
              onChange={(v) => updateFilters({ sweepSide: v[0] ?? null })}
            />
            <FilterDropdown
              label={t({ en: "Result", ko: "결과" })}
              placeholder={t({ en: "Result", ko: "결과" })}
              options={RESULT_ORDER.map((r) => ({ value: r, label: t(RESULT_LABELS[r]) }))}
              selected={filters.result !== null ? [filters.result] : []}
              onChange={(v) => updateFilters({ result: v[0] ?? null })}
            />
            <button
              type="button"
              onClick={() => updateFilters({ offPlanOnly: !filters.offPlanOnly })}
              className="flex items-center gap-9 rounded-12 bg-divider px-14 py-11 text-13_5 font-semibold text-secondary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent focus-visible:ring-offset-2"
            >
              <span
                className={cn(
                  "flex h-16 w-16 items-center justify-center rounded-8",
                  filters.offPlanOnly ? "bg-accent text-white" : "bg-surface",
                )}
              >
                {filters.offPlanOnly && <Check aria-hidden size={11} />}
              </span>
              {t({ en: "Off-plan only", ko: "Off-plan만" })}
            </button>

            {hasActiveFilters(filters) && (
              <button type="button" onClick={resetFilters} className="ml-4 rounded-8 text-13 font-semibold text-accent hover:text-accent-pressed focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent focus-visible:ring-offset-2">
                {t({ en: "Reset", ko: "초기화" })}
              </button>
            )}

            {!isMobile && (
              <>
                <div className="flex-1" />
                <a
                  href={exportHref}
                  className="rounded-10 bg-divider px-14 py-9 text-13 font-semibold text-secondary transition-colors duration-150 ease-out hover:bg-divider-hover focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent focus-visible:ring-offset-2"
                >
                  {t({ en: "Export CSV", ko: "CSV 내보내기" })}
                </a>
                <button
                  type="button"
                  onClick={() => setImportOpen(true)}
                  className="rounded-10 bg-divider px-14 py-9 text-13 font-semibold text-secondary transition-colors duration-150 ease-out hover:bg-divider-hover focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent focus-visible:ring-offset-2"
                >
                  {t({ en: "Import", ko: "가져오기" })}
                </button>
              </>
            )}
          </div>

          {isMobile && (
            <div className="mt-10 flex gap-8">
              <a
                href={exportHref}
                className="flex-1 rounded-10 bg-divider px-14 py-9 text-center text-13 font-semibold text-secondary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent focus-visible:ring-offset-2"
              >
                {t({ en: "Export CSV", ko: "CSV 내보내기" })}
              </a>
              <button
                type="button"
                onClick={() => setImportOpen(true)}
                className="flex-1 rounded-10 bg-divider px-14 py-9 text-13 font-semibold text-secondary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent focus-visible:ring-offset-2"
              >
                {t({ en: "Import", ko: "가져오기" })}
              </button>
            </div>
          )}

          {summary !== null && (
            <div
              className={cn(
                "flex flex-wrap items-center border-t border-divider",
                isMobile ? "mt-14 gap-16 pt-14" : "mt-18 gap-22 pt-18",
              )}
            >
              <SummaryStat label={t({ en: "Matching", ko: "일치" })} value={t(tradeCountLabel(summary.tradeCount))} />
              <SummaryStat
                label={t({ en: "Net", ko: "순 R" })}
                value={formatR(summary.netR)}
                tone={summary.netR >= 0 ? "gain" : "loss"}
              />
              <SummaryStat
                label={t({ en: "Win rate", ko: "승률" })}
                value={summary.winRate === null ? em : formatPercent(summary.winRate)}
              />
              <SummaryStat
                label={t({ en: "Avg hold", ko: "평균 보유" })}
                value={summary.avgHoldMinutes === null ? em : formatHoldMinutes(Math.round(summary.avgHoldMinutes))}
              />
            </div>
          )}
        </Card>

        {/* Table / mobile list */}
        <Card className={cn(isMobile ? "px-20 py-16" : "px-28 pt-8 pb-16")}>
          {matching.length === 0 ? (
            <EmptyState
              className="py-40"
              title={t({ en: "No trades match these filters", ko: "조건에 맞는 기록이 없습니다" })}
              description={t({
                en: "Try widening the date range or clearing a filter.",
                ko: "기간을 넓히거나 필터를 지워보세요.",
              })}
              action={
                hasActiveFilters(filters) ? (
                  <Button tone="neutral" onClick={resetFilters}>
                    {t({ en: "Reset filters", ko: "필터 초기화" })}
                  </Button>
                ) : undefined
              }
            />
          ) : isMobile ? (
            <div className="flex flex-col">
              {matching.map((trade, i) => (
                <MobileTradeRow key={trade.id} trade={trade} model={trade.modelId === null ? null : (modelById.get(trade.modelId) ?? null)} bordered={i > 0} />
              ))}
            </div>
          ) : (
            <>
              <TableHeader sort={sort} direction={direction} onSort={toggleSort} />
              {matching.map((trade) => (
                <DesktopTradeRow
                  key={trade.id}
                  trade={trade}
                  model={trade.modelId === null ? null : (modelById.get(trade.modelId) ?? null)}
                />
              ))}
            </>
          )}

          {pagination !== null && pagination.totalCount > 0 && (
            <div className={cn("flex items-center justify-between", isMobile ? "pt-16" : "pt-18 pb-6")}>
              <span className="text-12_5 font-medium text-faint">
                {t({
                  en: `Showing ${pageRangeStart(pagination)}–${pageRangeEnd(pagination)} of ${pagination.totalCount}`,
                  ko: `${pagination.totalCount}건 중 ${pageRangeStart(pagination)}–${pageRangeEnd(pagination)}`,
                })}
              </span>
              <Pager currentPage={pagination.currentPage} totalPages={pagination.totalPages} onGo={goToPage} />
            </div>
          )}
        </Card>
      </div>

      {isMobile && <BottomTabBar items={toTabItems(t)} activeHref="/trades" />}

      <ImportModal
        open={importOpen}
        // Safe past this point — the `!hasAccount` branch above already returned.
        accountKind={accountKind!}
        onClose={() => setImportOpen(false)}
        onImported={() => {
          setImportOpen(false);
          router.refresh();
        }}
      />
    </div>
  );
}

function pageRangeStart(p: TradeLogPagination): number {
  return p.totalCount === 0 ? 0 : (p.currentPage - 1) * TRADE_LOG_PAGE_SIZE + 1;
}
function pageRangeEnd(p: TradeLogPagination): number {
  return Math.min(p.currentPage * TRADE_LOG_PAGE_SIZE, p.totalCount);
}

function SummaryStat({ label, value, tone }: { label: string; value: string; tone?: "gain" | "loss" }) {
  return (
    <div>
      <span className="text-12_5 font-semibold text-muted">{label}</span>
      <span
        className={cn(
          "ml-8 text-15 font-extrabold",
          tone === "gain" ? "text-gain" : tone === "loss" ? "text-loss" : "text-ink",
        )}
      >
        {value}
      </span>
    </div>
  );
}

function TableHeader({
  sort,
  direction,
  onSort,
}: {
  sort: SortColumn;
  direction: SortDirection;
  onSort: (column: SortColumn) => void;
}) {
  const t = useT();
  return (
    <div className="grid grid-cols-[76px_1fr_150px_118px_120px_96px_96px_40px] items-center gap-16 border-b border-divider pt-16 pb-12">
      {SORT_COLUMNS.map((column) => {
        const isActive = column === sort;
        const Icon = direction === "desc" ? ChevronDown : ChevronUp;
        return (
          <button
            key={column}
            type="button"
            onClick={() => onSort(column)}
            className={cn(
              "flex items-center gap-4 rounded-6 text-left text-11_5 font-bold tracking-[.02em]",
              isActive ? "text-ink" : "text-muted",
              "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent focus-visible:ring-offset-2",
            )}
          >
            {t(HEADER_LABELS[column]).toUpperCase()}
            {isActive && <Icon aria-hidden size={12} />}
          </button>
        );
      })}
      <span />
    </div>
  );
}

function DesktopTradeRow({ trade, model }: { trade: Trade; model: TradeModel | null }) {
  const formatR = useFormatR();
  const t = useT();
  const isOffPlan = offPlan(trade);
  const r = realizedR(trade);
  const planned = plannedR(trade);

  return (
    <Link
      href={`/trades/${trade.id}`}
      className="group grid grid-cols-[76px_1fr_150px_118px_120px_96px_96px_40px] items-center gap-16 border-b border-divider py-15 transition-colors duration-150 ease-out last:border-b-0 hover:bg-surface-faint"
    >
      <span className="text-13 font-bold text-muted">{formatCompactDate(trade.date)}</span>
      <div className="min-w-0">
        <div className="truncate text-15 font-bold text-ink">
          {trade.instrument} · {t(DIRECTION_LABELS[trade.direction])}
        </div>
        <div className="mt-2 truncate text-12 font-medium text-muted">
          {t(HTF_PAIRING_LABELS[trade.htfPairing])} ·{" "}
          {t({ en: `${trade.size} ${trade.size === 1 ? "lot" : "lots"}`, ko: `${trade.size}랏` })}
        </div>
      </div>
      <Chip tone={isOffPlan ? "accent" : "neutral"} className="justify-self-start">
        {isOffPlan ? t({ en: "Off-plan", ko: "Off-plan" }) : (model?.name ?? t({ en: "Unassigned", ko: "미지정" }))}
      </Chip>
      <span className="text-13 font-medium text-muted">{t(SESSION_LABELS[trade.session])}</span>
      <span className="text-13 font-medium text-muted">{t(SWEEP_SIDE_LABELS[trade.sweepSide])}</span>
      <span className="text-13 font-medium text-muted">{planned === null ? em : `${planned.toFixed(1)}R`}</span>
      <span className={cn("text-right text-17 font-extrabold", r === null ? "text-ink" : r >= 0 ? "text-gain" : "text-loss")}>
        {r === null ? em : formatR(r)}
      </span>
      <ChevronRight aria-hidden size={16} className="justify-self-end text-disabled transition-colors duration-150 ease-out group-hover:text-muted" />
    </Link>
  );
}

function MobileTradeRow({ trade, model, bordered }: { trade: Trade; model: TradeModel | null; bordered: boolean }) {
  const formatR = useFormatR();
  const t = useT();
  const isOffPlan = offPlan(trade);
  const r = realizedR(trade);

  return (
    <Link
      href={`/trades/${trade.id}`}
      className={cn("flex items-center justify-between gap-12 py-12", bordered && "border-t border-divider")}
    >
      <div className="min-w-0">
        <div className="truncate text-14_5 font-bold text-ink">
          {trade.instrument} · {t(DIRECTION_LABELS[trade.direction])}
        </div>
        <div className="mt-2 truncate text-12 font-medium text-muted">
          {isOffPlan ? t({ en: "Off-plan", ko: "Off-plan" }) : (model?.name ?? t({ en: "Unassigned", ko: "미지정" }))} ·{" "}
          {t(SESSION_LABELS[trade.session])} · {formatCompactDate(trade.date)}
        </div>
      </div>
      <span className={cn("shrink-0 text-17 font-extrabold", r === null ? "text-ink" : r >= 0 ? "text-gain" : "text-loss")}>
        {r === null ? em : formatR(r)}
      </span>
    </Link>
  );
}

function pageWindow(current: number, total: number): (number | "ellipsis")[] {
  if (total <= 7) return Array.from({ length: total }, (_, i) => i + 1);
  const keep = new Set([1, total, current, current - 1, current + 1].filter((p) => p >= 1 && p <= total));
  const sorted = [...keep].sort((a, b) => a - b);
  const result: (number | "ellipsis")[] = [];
  let prev = 0;
  for (const p of sorted) {
    if (prev !== 0 && p - prev > 1) result.push("ellipsis");
    result.push(p);
    prev = p;
  }
  return result;
}

function Pager({ currentPage, totalPages, onGo }: { currentPage: number; totalPages: number; onGo: (page: number) => void }) {
  const t = useT();
  if (totalPages <= 1) return null;

  return (
    <div className="flex items-center gap-6">
      <button
        type="button"
        disabled={currentPage <= 1}
        onClick={() => onGo(currentPage - 1)}
        aria-label={t({ en: "Previous page", ko: "이전 페이지" })}
        className="rounded-8 bg-divider px-12 py-8 text-13 font-semibold text-muted disabled:opacity-40 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent focus-visible:ring-offset-2"
      >
        <ChevronLeft aria-hidden size={14} />
      </button>
      {pageWindow(currentPage, totalPages).map((p, i) =>
        p === "ellipsis" ? (
          <span key={`e${i}`} className="px-4 text-13 font-semibold text-faint">
            …
          </span>
        ) : (
          <button
            key={p}
            type="button"
            onClick={() => onGo(p)}
            aria-current={p === currentPage ? "page" : undefined}
            className={cn(
              "rounded-8 px-12 py-8 text-13 font-semibold",
              p === currentPage ? "bg-ink text-white" : "bg-divider text-secondary",
              "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent focus-visible:ring-offset-2",
            )}
          >
            {p}
          </button>
        ),
      )}
      <button
        type="button"
        disabled={currentPage >= totalPages}
        onClick={() => onGo(currentPage + 1)}
        aria-label={t({ en: "Next page", ko: "다음 페이지" })}
        className="rounded-8 bg-divider px-12 py-8 text-13 font-semibold text-muted disabled:opacity-40 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent focus-visible:ring-offset-2"
      >
        <ChevronRight aria-hidden size={14} />
      </button>
    </div>
  );
}
