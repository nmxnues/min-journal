import { describe, expect, it } from "vitest";
import { makeTrade } from "./fixtures";
import {
  averageWeeklyNetR,
  bestWorstTrade,
  carryOverFocusItems,
  dayByDayBars,
  formatWeekLabel,
  isoWeekOf,
  isoWeekRange,
  isValidIsoWeek,
  shiftIsoWeek,
  tagFrequency,
} from "./weekly-review";

describe("isoWeekOf / isoWeekRange", () => {
  it("matches the mock's own example: Sep 9 2026 is Week 37, Sep 7 - Sep 13", () => {
    expect(isoWeekOf("2026-09-09")).toBe("2026-W37");
    expect(isoWeekRange("2026-W37")).toEqual({ from: "2026-09-07", to: "2026-09-13" });
  });

  it("agrees for every day within the same week", () => {
    expect(isoWeekOf("2026-09-07")).toBe("2026-W37");
    expect(isoWeekOf("2026-09-13")).toBe("2026-W37");
  });

  it("handles a year boundary correctly (week 1 can start in the previous December)", () => {
    expect(isoWeekOf("2026-01-01")).toBe("2026-W01");
    expect(isoWeekOf("2026-12-31")).toBe("2026-W53");
  });
});

describe("shiftIsoWeek", () => {
  it("moves forward and back a week at a time", () => {
    expect(shiftIsoWeek("2026-W37", 1)).toBe("2026-W38");
    expect(shiftIsoWeek("2026-W37", -1)).toBe("2026-W36");
  });

  it("crosses a year boundary", () => {
    // 2025 has 52 ISO weeks (53 only happens some years, per the standard).
    expect(shiftIsoWeek("2026-W01", -1)).toBe("2025-W52");
  });
});

describe("isValidIsoWeek", () => {
  it("accepts YYYY-Www and rejects everything else", () => {
    expect(isValidIsoWeek("2026-W37")).toBe(true);
    expect(isValidIsoWeek("2026-37")).toBe(false);
    expect(isValidIsoWeek("2026-W7")).toBe(false);
    expect(isValidIsoWeek(undefined)).toBe(false);
  });
});

describe("formatWeekLabel", () => {
  it("matches the mock in English", () => {
    expect(formatWeekLabel("2026-W37", "en")).toBe("Week 37 · Sep 7 – Sep 13");
  });

  it("reads naturally in Korean", () => {
    expect(formatWeekLabel("2026-W37", "ko")).toBe("37주차 · 9월 7일 – 9월 13일");
  });
});

describe("dayByDayBars", () => {
  it("returns 7 days starting from weekFrom, zero-filled where there's no trade", () => {
    const trades = [
      makeTrade({ id: "a", date: "2026-09-07", entry: 100, stop: 90, exit: 110, result: "win" }),
      makeTrade({ id: "b", date: "2026-09-09", entry: 100, stop: 90, exit: 80, result: "loss" }),
    ];
    const bars = dayByDayBars(trades, "2026-09-07");
    expect(bars).toHaveLength(7);
    expect(bars[0]).toEqual({ date: "2026-09-07", netR: 1, tradeCount: 1 });
    expect(bars[1]).toEqual({ date: "2026-09-08", netR: 0, tradeCount: 0 });
    expect(bars[2]).toEqual({ date: "2026-09-09", netR: -2, tradeCount: 1 });
    expect(bars[6].date).toBe("2026-09-13");
  });
});

describe("tagFrequency", () => {
  it("counts tags across trades, most frequent first", () => {
    const trades = [
      makeTrade({ id: "a", tags: ["On plan", "Impatient"] }),
      makeTrade({ id: "b", tags: ["On plan"] }),
      makeTrade({ id: "c", tags: ["Impatient"] }),
      makeTrade({ id: "d", tags: ["On plan"] }),
    ];
    expect(tagFrequency(trades)).toEqual([
      { tag: "On plan", count: 3 },
      { tag: "Impatient", count: 2 },
    ]);
  });

  it("is empty when nothing has tags", () => {
    expect(tagFrequency([makeTrade({ tags: [] })])).toEqual([]);
  });
});

describe("bestWorstTrade", () => {
  it("picks the highest and lowest realized R, skipping trades with no exit", () => {
    const best = makeTrade({ id: "best", entry: 100, stop: 90, exit: 150 });
    const worst = makeTrade({ id: "worst", entry: 100, stop: 90, exit: 50 });
    const open = makeTrade({ id: "open", entry: 100, stop: 90, exit: null, result: null });
    const result = bestWorstTrade([open, best, worst]);
    expect(result.best?.id).toBe("best");
    expect(result.worst?.id).toBe("worst");
  });

  it("is null/null for an empty or all-open list", () => {
    expect(bestWorstTrade([])).toEqual({ best: null, worst: null });
  });
});

describe("averageWeeklyNetR", () => {
  it("averages net R per week, treating an empty week as 0", () => {
    const trades = [
      makeTrade({ id: "a", date: "2026-08-10", entry: 100, stop: 90, exit: 130, result: "win" }), // W33, +3R
      makeTrade({ id: "b", date: "2026-08-19", entry: 100, stop: 90, exit: 110, result: "win" }), // W34, +1R
      // W35 and W36 have no trades at all.
    ];
    const weeks = ["2026-W33", "2026-W34", "2026-W35", "2026-W36"];
    expect(averageWeeklyNetR(trades, weeks)).toBeCloseTo((3 + 1 + 0 + 0) / 4, 10);
  });

  it("is 0 for an empty week list or no matching trades", () => {
    expect(averageWeeklyNetR([], [])).toBe(0);
    expect(averageWeeklyNetR([makeTrade({ date: "2020-01-01" })], ["2026-W33"])).toBe(0);
  });
});

describe("carryOverFocusItems", () => {
  it("keeps only unchecked items, as fresh copies", () => {
    const previous = [
      { text: "Wait for confirmation", checked: false },
      { text: "Stop chasing entries", checked: true },
    ];
    const carried = carryOverFocusItems(previous);
    expect(carried).toEqual([{ text: "Wait for confirmation", checked: false }]);
    carried[0].text = "mutated";
    expect(previous[0].text).toBe("Wait for confirmation");
  });

  it("is empty when everything was checked off", () => {
    expect(carryOverFocusItems([{ text: "Done", checked: true }])).toEqual([]);
  });
});
