import { describe, expect, it } from "vitest";
import { makeModel, makeTrade } from "./fixtures";
import {
  buildTradeLogSearchParams,
  EMPTY_TRADE_LOG_FILTERS,
  filterTrades,
  hasActiveFilters,
  paginateTrades,
  parseTradeLogFilters,
  parseTradeLogPage,
  parseTradeLogSort,
  sortTrades,
} from "./trade-log";

describe("filterTrades", () => {
  const trades = [
    makeTrade({ id: "a", date: "2026-09-01", instrument: "EURUSD", session: "asia", modelId: "m1", sweepSide: "low", result: "win" }),
    makeTrade({ id: "b", date: "2026-09-05", instrument: "USDJPY", session: "london", modelId: "m2", sweepSide: "high", result: "loss" }),
    makeTrade({ id: "c", date: "2026-09-09", instrument: "EURUSD", session: "ny_am", modelId: null, sweepSide: "none", result: null }),
  ];

  it("with no filters, returns everything", () => {
    expect(filterTrades(trades, EMPTY_TRADE_LOG_FILTERS)).toHaveLength(3);
  });

  it("filters by inclusive date range", () => {
    const result = filterTrades(trades, { ...EMPTY_TRADE_LOG_FILTERS, from: "2026-09-02", to: "2026-09-09" });
    expect(result.map((t) => t.id)).toEqual(["b", "c"]);
  });

  it("filters by instrument (multi-select, OR within the dimension)", () => {
    const result = filterTrades(trades, { ...EMPTY_TRADE_LOG_FILTERS, instruments: ["EURUSD"] });
    expect(result.map((t) => t.id)).toEqual(["a", "c"]);
  });

  it("filters by session", () => {
    const result = filterTrades(trades, { ...EMPTY_TRADE_LOG_FILTERS, sessions: ["london"] });
    expect(result.map((t) => t.id)).toEqual(["b"]);
  });

  it("filters by model, with null meaning Unassigned", () => {
    expect(filterTrades(trades, { ...EMPTY_TRADE_LOG_FILTERS, modelIds: ["m1"] }).map((t) => t.id)).toEqual(["a"]);
    expect(filterTrades(trades, { ...EMPTY_TRADE_LOG_FILTERS, modelIds: [null] }).map((t) => t.id)).toEqual(["c"]);
  });

  it("filters by sweep side", () => {
    expect(filterTrades(trades, { ...EMPTY_TRADE_LOG_FILTERS, sweepSide: "none" }).map((t) => t.id)).toEqual(["c"]);
  });

  it("filters by result", () => {
    expect(filterTrades(trades, { ...EMPTY_TRADE_LOG_FILTERS, result: "loss" }).map((t) => t.id)).toEqual(["b"]);
  });

  it("filters to off-plan only", () => {
    // trade c has sweepSide 'none' -> offPlan
    expect(filterTrades(trades, { ...EMPTY_TRADE_LOG_FILTERS, offPlanOnly: true }).map((t) => t.id)).toEqual(["c"]);
  });

  it("combines filters with AND", () => {
    const result = filterTrades(trades, { ...EMPTY_TRADE_LOG_FILTERS, instruments: ["EURUSD"], sessions: ["asia"] });
    expect(result.map((t) => t.id)).toEqual(["a"]);
  });
});

describe("hasActiveFilters", () => {
  it("is false for the empty filter set and true once anything is set", () => {
    expect(hasActiveFilters(EMPTY_TRADE_LOG_FILTERS)).toBe(false);
    expect(hasActiveFilters({ ...EMPTY_TRADE_LOG_FILTERS, offPlanOnly: true })).toBe(true);
    expect(hasActiveFilters({ ...EMPTY_TRADE_LOG_FILTERS, from: "2026-09-01" })).toBe(true);
  });
});

describe("sortTrades", () => {
  const models = [makeModel({ id: "m1", name: "Alpha" }), makeModel({ id: "m2", name: "Beta" })];
  const trades = [
    makeTrade({ id: "a", date: "2026-09-01", instrument: "EURUSD", modelId: "m2", session: "ny_am", sweepSide: "none", entry: 100, stop: 90, target: 120, exit: 110 }),
    makeTrade({ id: "b", date: "2026-09-05", instrument: "USDJPY", modelId: "m1", session: "asia", sweepSide: "low", entry: 100, stop: 90, target: null, exit: null }),
    makeTrade({ id: "c", date: "2026-09-03", instrument: "AUDUSD", modelId: null, session: "london", sweepSide: "high", entry: 100, stop: 90, target: 140, exit: 130 }),
  ];

  it("sorts by date, tie-breaking chronologically", () => {
    expect(sortTrades(trades, "date", "asc", models).map((t) => t.id)).toEqual(["a", "c", "b"]);
    expect(sortTrades(trades, "date", "desc", models).map((t) => t.id)).toEqual(["b", "c", "a"]);
  });

  it("sorts by instrument alphabetically", () => {
    expect(sortTrades(trades, "instrument", "asc", models).map((t) => t.id)).toEqual(["c", "a", "b"]);
  });

  it("sorts by resolved model name, with Unassigned as an empty string sorting first", () => {
    // c: Unassigned ("") < b: model m1 "Alpha" < a: model m2 "Beta"
    expect(sortTrades(trades, "model", "asc", models).map((t) => t.id)).toEqual(["c", "b", "a"]);
  });

  it("sorts by session in trading-day order, not alphabetically", () => {
    expect(sortTrades(trades, "session", "asc", models).map((t) => t.id)).toEqual(["b", "c", "a"]);
  });

  it("sorts by sweep side in CRT order (low, high, both, none)", () => {
    expect(sortTrades(trades, "sweep", "asc", models).map((t) => t.id)).toEqual(["b", "c", "a"]);
  });

  it("sorts by planned R, with an unset target sorting first ascending", () => {
    // a: planned = |120-100|/10 = 2; b: no target -> null; c: |140-100|/10 = 4
    expect(sortTrades(trades, "planned", "asc", models).map((t) => t.id)).toEqual(["b", "a", "c"]);
  });

  it("sorts by realized R, with no exit sorting first ascending", () => {
    // a: (110-100)/10=1; b: no exit -> null; c: (130-100)/10=3
    expect(sortTrades(trades, "result", "asc", models).map((t) => t.id)).toEqual(["b", "a", "c"]);
  });

  it("does not mutate the input array", () => {
    const copy = [...trades];
    sortTrades(trades, "date", "asc", models);
    expect(trades).toEqual(copy);
  });
});

describe("paginateTrades", () => {
  const trades = Array.from({ length: 45 }, (_, i) => makeTrade({ id: `t${i}` }));

  it("slices into pages of 20", () => {
    const page1 = paginateTrades(trades, 1);
    expect(page1.pageTrades).toHaveLength(20);
    expect(page1.totalPages).toBe(3);
    expect(page1.totalCount).toBe(45);

    const page3 = paginateTrades(trades, 3);
    expect(page3.pageTrades).toHaveLength(5);
  });

  it("clamps an out-of-range page into bounds", () => {
    expect(paginateTrades(trades, 999).currentPage).toBe(3);
    expect(paginateTrades(trades, 0).currentPage).toBe(1);
  });

  it("is one full (empty) page for an empty list", () => {
    const empty = paginateTrades([], 1);
    expect(empty.totalPages).toBe(1);
    expect(empty.pageTrades).toEqual([]);
  });
});

describe("URL round-trip", () => {
  it("parses what buildTradeLogSearchParams writes, for filters", () => {
    const filters = {
      from: "2026-09-01",
      to: "2026-09-09",
      instruments: ["EURUSD", "USDJPY"],
      sessions: ["asia" as const],
      modelIds: ["m1", null],
      sweepSide: "low" as const,
      result: "win" as const,
      offPlanOnly: true,
    };
    const params = buildTradeLogSearchParams(filters, "instrument", "asc", 2);
    expect(parseTradeLogFilters(params)).toEqual(filters);
    expect(parseTradeLogSort(params)).toEqual({ sort: "instrument", direction: "asc" });
    expect(parseTradeLogPage(params)).toBe(2);
  });

  it("omits params at their default, and parsing an empty string falls back to the default", () => {
    const params = buildTradeLogSearchParams(EMPTY_TRADE_LOG_FILTERS, "date", "desc", 1);
    expect(params.toString()).toBe("");
    expect(parseTradeLogFilters(new URLSearchParams())).toEqual(EMPTY_TRADE_LOG_FILTERS);
    expect(parseTradeLogSort(new URLSearchParams())).toEqual({ sort: "date", direction: "desc" });
    expect(parseTradeLogPage(new URLSearchParams())).toBe(1);
  });

  it("ignores an invalid sort/page value rather than throwing", () => {
    const params = new URLSearchParams("sort=bogus&dir=sideways&page=-3");
    expect(parseTradeLogSort(params)).toEqual({ sort: "date", direction: "desc" });
    expect(parseTradeLogPage(params)).toBe(1);
  });
});
