/**
 * Filtering, sorting, and pagination for the Trade log (docs/README.md § 5).
 * All pure, over the account's full trade list — same "selectors over the
 * whole list" architecture as stats.ts, not a database query builder, so the
 * summary row and the CSV export can both call the exact same functions the
 * table renders from.
 */

import { offPlan, plannedR, realizedR } from "./trade";
import type { IsoDate, Session, SweepSide, Trade, TradeModel, TradeResult } from "./types";

export interface TradeLogFilters {
  from: IsoDate | null;
  to: IsoDate | null;
  /** Empty = every instrument. */
  instruments: string[];
  sessions: Session[];
  /** `null` in this list means "Unassigned" (no model). Empty = every model. */
  modelIds: (string | null)[];
  sweepSide: SweepSide | null;
  result: TradeResult | null;
  offPlanOnly: boolean;
}

export const EMPTY_TRADE_LOG_FILTERS: TradeLogFilters = {
  from: null,
  to: null,
  instruments: [],
  sessions: [],
  modelIds: [],
  sweepSide: null,
  result: null,
  offPlanOnly: false,
};

export function hasActiveFilters(filters: TradeLogFilters): boolean {
  return (
    filters.from !== null ||
    filters.to !== null ||
    filters.instruments.length > 0 ||
    filters.sessions.length > 0 ||
    filters.modelIds.length > 0 ||
    filters.sweepSide !== null ||
    filters.result !== null ||
    filters.offPlanOnly
  );
}

export function filterTrades(trades: readonly Trade[], filters: TradeLogFilters): Trade[] {
  return trades.filter((t) => {
    if (filters.from !== null && t.date < filters.from) return false;
    if (filters.to !== null && t.date > filters.to) return false;
    if (filters.instruments.length > 0 && !filters.instruments.includes(t.instrument)) return false;
    if (filters.sessions.length > 0 && !filters.sessions.includes(t.session)) return false;
    if (filters.modelIds.length > 0 && !filters.modelIds.includes(t.modelId)) return false;
    if (filters.sweepSide !== null && t.sweepSide !== filters.sweepSide) return false;
    if (filters.result !== null && t.result !== filters.result) return false;
    if (filters.offPlanOnly && !offPlan(t)) return false;
    return true;
  });
}

export const SORT_COLUMNS = [
  "date",
  "instrument",
  "model",
  "session",
  "sweep",
  "planned",
  "result",
] as const;
export type SortColumn = (typeof SORT_COLUMNS[number]);
export type SortDirection = "asc" | "desc";

export const DEFAULT_SORT_COLUMN: SortColumn = "date";
export const DEFAULT_SORT_DIRECTION: SortDirection = "desc";

export function isSortColumn(value: string | null | undefined): value is SortColumn {
  return SORT_COLUMNS.includes(value as SortColumn);
}

const SESSION_RANK: Record<Session, number> = { asia: 0, london: 1, ny_am: 2 };
const SWEEP_RANK: Record<SweepSide, number> = { low: 0, high: 1, both: 2, none: 3 };

function modelName(trade: Trade, modelById: ReadonlyMap<string, TradeModel>): string {
  if (trade.modelId === null) return "";
  return modelById.get(trade.modelId)?.name ?? "";
}

/** Ascending comparator per column; `sortTrades` flips it for "desc". Nulls sort first, ascending. */
function compare(a: Trade, b: Trade, column: SortColumn, modelById: ReadonlyMap<string, TradeModel>): number {
  switch (column) {
    case "date":
      return a.date === b.date ? a.createdAt.localeCompare(b.createdAt) : a.date.localeCompare(b.date);
    case "instrument":
      return a.instrument.localeCompare(b.instrument);
    case "model":
      return modelName(a, modelById).localeCompare(modelName(b, modelById));
    case "session":
      return SESSION_RANK[a.session] - SESSION_RANK[b.session];
    case "sweep":
      return SWEEP_RANK[a.sweepSide] - SWEEP_RANK[b.sweepSide];
    case "planned": {
      const av = plannedR(a);
      const bv = plannedR(b);
      if (av === null && bv === null) return 0;
      if (av === null) return -1;
      if (bv === null) return 1;
      return av - bv;
    }
    case "result": {
      const av = realizedR(a);
      const bv = realizedR(b);
      if (av === null && bv === null) return 0;
      if (av === null) return -1;
      if (bv === null) return 1;
      return av - bv;
    }
  }
}

export function sortTrades(
  trades: readonly Trade[],
  column: SortColumn,
  direction: SortDirection,
  models: readonly TradeModel[],
): Trade[] {
  const modelById = new Map(models.map((m) => [m.id, m]));
  const factor = direction === "asc" ? 1 : -1;
  return [...trades].sort((a, b) => factor * compare(a, b, column, modelById));
}

export const TRADE_LOG_PAGE_SIZE = 20;

export interface PaginatedTrades {
  pageTrades: Trade[];
  currentPage: number;
  totalPages: number;
  totalCount: number;
}

export function paginateTrades(trades: readonly Trade[], page: number): PaginatedTrades {
  const totalCount = trades.length;
  const totalPages = Math.max(1, Math.ceil(totalCount / TRADE_LOG_PAGE_SIZE));
  const currentPage = Math.min(Math.max(1, page), totalPages);
  const start = (currentPage - 1) * TRADE_LOG_PAGE_SIZE;
  return { pageTrades: trades.slice(start, start + TRADE_LOG_PAGE_SIZE), currentPage, totalPages, totalCount };
}

function splitCsvParam(value: string | null): string[] {
  return value === null || value === "" ? [] : value.split(",").filter((v) => v !== "");
}

const SESSIONS: readonly Session[] = ["asia", "london", "ny_am"];
const SWEEP_SIDES: readonly SweepSide[] = ["low", "high", "both", "none"];
const RESULTS: readonly TradeResult[] = ["win", "loss", "be"];

/** Reads filter state from `?from=&to=&instrument=&session=&model=&sweep=&result=&offPlan=`. */
export function parseTradeLogFilters(params: URLSearchParams): TradeLogFilters {
  const sweepRaw = params.get("sweep");
  const resultRaw = params.get("result");
  return {
    from: params.get("from") || null,
    to: params.get("to") || null,
    instruments: splitCsvParam(params.get("instrument")),
    sessions: splitCsvParam(params.get("session")).filter((v): v is Session =>
      SESSIONS.includes(v as Session),
    ),
    modelIds: splitCsvParam(params.get("model")).map((v) => (v === "unassigned" ? null : v)),
    sweepSide: SWEEP_SIDES.includes(sweepRaw as SweepSide) ? (sweepRaw as SweepSide) : null,
    result: RESULTS.includes(resultRaw as TradeResult) ? (resultRaw as TradeResult) : null,
    offPlanOnly: params.get("offPlan") === "1",
  };
}

export function parseTradeLogSort(params: URLSearchParams): { sort: SortColumn; direction: SortDirection } {
  const sortRaw = params.get("sort");
  const dirRaw = params.get("dir");
  return {
    sort: isSortColumn(sortRaw) ? sortRaw : DEFAULT_SORT_COLUMN,
    direction: dirRaw === "asc" || dirRaw === "desc" ? dirRaw : DEFAULT_SORT_DIRECTION,
  };
}

export function parseTradeLogPage(params: URLSearchParams): number {
  const raw = Number(params.get("page"));
  return Number.isInteger(raw) && raw > 0 ? raw : 1;
}

/**
 * The inverse of the three parsers above — builds the query string for a
 * link/navigation that changes one thing and keeps the rest, so every filter
 * pill, sort header, and pager control shares one source of truth for what
 * the URL looks like (docs/README.md: "filter state lives in the URL").
 */
export function buildTradeLogSearchParams(
  filters: TradeLogFilters,
  sort: SortColumn,
  direction: SortDirection,
  page: number,
): URLSearchParams {
  const params = new URLSearchParams();
  if (filters.from !== null) params.set("from", filters.from);
  if (filters.to !== null) params.set("to", filters.to);
  if (filters.instruments.length > 0) params.set("instrument", filters.instruments.join(","));
  if (filters.sessions.length > 0) params.set("session", filters.sessions.join(","));
  if (filters.modelIds.length > 0) {
    params.set("model", filters.modelIds.map((id) => id ?? "unassigned").join(","));
  }
  if (filters.sweepSide !== null) params.set("sweep", filters.sweepSide);
  if (filters.result !== null) params.set("result", filters.result);
  if (filters.offPlanOnly) params.set("offPlan", "1");
  if (sort !== DEFAULT_SORT_COLUMN) params.set("sort", sort);
  if (direction !== DEFAULT_SORT_DIRECTION) params.set("dir", direction);
  if (page !== 1) params.set("page", String(page));
  return params;
}
