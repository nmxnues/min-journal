import { describe, expect, it } from "vitest";
import { makeModel, makeTrade } from "./fixtures";
import {
  avgHoldMinutes,
  avgLoss,
  avgWin,
  byModel,
  bySession,
  bySweepSide,
  dailyNetR,
  equityCurve,
  expectancy,
  filterByDateRange,
  netR,
  netSwap,
  netSwapR,
  periodStats,
  ruleAdherence,
  sortChronologically,
  sweepAlignment,
  winRate,
  winStreaks,
} from "./stats";
import type { Trade } from "./types";

/** A trade with a given realized R, built from clean round numbers. */
function tradeWithR(r: number, overrides: Partial<Trade> = {}): Trade {
  return makeTrade({
    entry: 100,
    stop: 90, // risk 10
    exit: 100 + r * 10,
    result: r > 0 ? "win" : r < 0 ? "loss" : "be",
    ...overrides,
  });
}

describe("netR", () => {
  it("sums realized R", () => {
    expect(netR([tradeWithR(2), tradeWithR(-1), tradeWithR(0.5)])).toBeCloseTo(1.5, 10);
  });

  it("ignores trades with no exit rather than counting them as zero", () => {
    expect(netR([tradeWithR(2), makeTrade({ exit: null })])).toBeCloseTo(2, 10);
  });

  it("is 0 for an empty list", () => {
    expect(netR([])).toBe(0);
  });
});

describe("winRate", () => {
  it("excludes break-even from both the numerator and the denominator", () => {
    // docs/decisions.md § Phase 5: BE trades sit outside win rate entirely —
    // 6 wins, 2 losses, 1 BE is 6/8, not 6/9.
    const trades = [
      ...Array.from({ length: 6 }, () => tradeWithR(1)),
      tradeWithR(-1),
      tradeWithR(-1),
      tradeWithR(0),
    ];
    expect(trades).toHaveLength(9);
    expect(winRate(trades)).toBeCloseTo(6 / 8, 10);
    expect(Math.round(winRate(trades)! * 100)).toBe(75);
  });

  it("ignores trades with no result yet", () => {
    expect(winRate([tradeWithR(1), makeTrade({ result: null })])).toBe(1);
  });

  it("is null with nothing decided", () => {
    expect(winRate([])).toBeNull();
  });

  it("is null when every decided trade is a break-even", () => {
    expect(winRate([tradeWithR(0), tradeWithR(0)])).toBeNull();
  });
});

describe("expectancy / avgWin / avgLoss", () => {
  const trades = [tradeWithR(3), tradeWithR(1), tradeWithR(-1), tradeWithR(0)];

  it("expectancy is the mean R across every trade, break-even included", () => {
    expect(expectancy(trades)).toBeCloseTo(3 / 4, 10);
  });

  it("avgWin covers winners only", () => {
    expect(avgWin(trades)).toBeCloseTo(2, 10);
  });

  it("avgLoss covers losers only and stays negative", () => {
    expect(avgLoss(trades)).toBeCloseTo(-1, 10);
  });

  it("are null when the group is empty", () => {
    expect(avgWin([tradeWithR(-1)])).toBeNull();
    expect(avgLoss([tradeWithR(1)])).toBeNull();
    expect(expectancy([])).toBeNull();
  });
});

describe("avgHoldMinutes", () => {
  it("means over trades that recorded a hold time, skipping the ones that didn't", () => {
    const trades = [
      makeTrade({ id: "a", holdMinutes: 30 }),
      makeTrade({ id: "b", holdMinutes: 90 }),
      makeTrade({ id: "c", holdMinutes: null }),
    ];
    expect(avgHoldMinutes(trades)).toBeCloseTo(60, 10);
  });

  it("is null when nothing recorded a hold time", () => {
    expect(avgHoldMinutes([makeTrade({ holdMinutes: null })])).toBeNull();
  });
});

describe("winStreaks", () => {
  const seq = (results: ("win" | "loss" | "be")[]) =>
    results.map((result, i) =>
      tradeWithR(result === "win" ? 1 : result === "loss" ? -1 : 0, {
        id: `t${i}`,
        result,
        date: `2026-09-${String(i + 1).padStart(2, "0")}`,
      }),
    );

  it("treats break-even as neutral — it neither breaks nor extends", () => {
    expect(winStreaks(seq(["win", "be", "win"]))).toEqual({ longest: 2, current: 2 });
  });

  it("resets on a loss", () => {
    expect(winStreaks(seq(["win", "win", "loss", "win"]))).toEqual({ longest: 2, current: 1 });
  });

  it("reports the longest run and the live one separately", () => {
    expect(winStreaks(seq(["win", "win", "win", "win", "loss"]))).toEqual({
      longest: 4,
      current: 0,
    });
  });

  it("skips trades with no result", () => {
    const trades = [
      tradeWithR(1, { id: "a", date: "2026-09-01" }),
      makeTrade({ id: "b", date: "2026-09-02", result: null, exit: null }),
      tradeWithR(1, { id: "c", date: "2026-09-03" }),
    ];
    expect(winStreaks(trades)).toEqual({ longest: 2, current: 2 });
  });

  it("is zero for an empty list", () => {
    expect(winStreaks([])).toEqual({ longest: 0, current: 0 });
  });
});

describe("ruleAdherence", () => {
  const onPlan = (id: string) => makeTrade({ id, sweepSide: "low", entry: 10 });
  const offPlanTrade = (id: string) => makeTrade({ id, sweepSide: "none" });

  it("reproduces the weekly mock: 89% from 1 off-plan in 9 trades", () => {
    const trades = [
      ...Array.from({ length: 8 }, (_, i) => onPlan(`on${i}`)),
      offPlanTrade("off"),
    ];
    expect(ruleAdherence(trades)).toBeCloseTo(8 / 9, 10);
    expect(Math.round(ruleAdherence(trades)! * 100)).toBe(89);
  });

  it("reproduces the dashboard mock: 87% from 8 off-plan in 61 trades", () => {
    const trades = [
      ...Array.from({ length: 53 }, (_, i) => onPlan(`on${i}`)),
      ...Array.from({ length: 8 }, (_, i) => offPlanTrade(`off${i}`)),
    ];
    expect(ruleAdherence(trades)).toBeCloseTo(53 / 61, 10);
    expect(Math.round(ruleAdherence(trades)! * 100)).toBe(87);
  });

  it("counts break-even trades in the denominator", () => {
    const trades = [onPlan("a"), makeTrade({ id: "b", result: "be", sweepSide: "none" })];
    expect(ruleAdherence(trades)).toBe(0.5);
  });

  it("is null with no trades", () => {
    expect(ruleAdherence([])).toBeNull();
  });
});

describe("byModel", () => {
  it("follows the Playbook's sort order and computes avg R per trade", () => {
    const models = [
      makeModel({ id: "m2", name: "C3 continuation", sortOrder: 1 }),
      makeModel({ id: "m1", name: "C2", sortOrder: 0 }),
    ];
    // Mock 2d cross-check: +11.2R over 24 trades shows "Avg R 0.47".
    const trades = [
      ...Array.from({ length: 23 }, (_, i) => tradeWithR(0.4, { id: `a${i}`, modelId: "m1" })),
      tradeWithR(2.0, { id: "a23", modelId: "m1" }),
      tradeWithR(1, { id: "b", modelId: "m2" }),
    ];

    const rows = byModel(trades, models);
    expect(rows.map((r) => r.name)).toEqual(["C2", "C3 continuation"]);
    expect(rows[0].tradeCount).toBe(24);
    expect(rows[0].netR).toBeCloseTo(11.2, 10);
    expect(rows[0].avgR).toBeCloseTo(0.4667, 4);
    expect(Number(rows[0].avgR!.toFixed(2))).toBe(0.47);
  });

  it("marks retired models and groups unassigned trades last", () => {
    const models = [makeModel({ id: "m1", status: "retired", sortOrder: 0 })];
    const rows = byModel([tradeWithR(1, { modelId: null })], models);
    expect(rows[0].isRetired).toBe(true);
    expect(rows[1].modelId).toBeNull();
    expect(rows[1].tradeCount).toBe(1);
  });
});

describe("bySession / bySweepSide", () => {
  it("returns every bucket, including empty ones", () => {
    const rows = bySession([tradeWithR(2, { session: "london" })]);
    expect(rows.map((r) => r.session)).toEqual(["asia", "london", "ny_am"]);
    expect(rows.find((r) => r.session === "london")!.netR).toBeCloseTo(2, 10);
    expect(rows.find((r) => r.session === "asia")!.tradeCount).toBe(0);
  });

  it("splits win rate by sweep side", () => {
    const rows = bySweepSide([
      tradeWithR(1, { id: "a", sweepSide: "low" }),
      tradeWithR(-1, { id: "b", sweepSide: "low" }),
      tradeWithR(1, { id: "c", sweepSide: "high" }),
    ]);
    expect(rows.find((r) => r.sweepSide === "low")!.winRate).toBe(0.5);
    expect(rows.find((r) => r.sweepSide === "high")!.winRate).toBe(1);
    expect(rows.find((r) => r.sweepSide === "both")!.winRate).toBeNull();
  });
});

describe("sweepAlignment", () => {
  it("keys long-after-low-purge separately from short-after-high-purge", () => {
    const rows = sweepAlignment([
      makeTrade({ id: "a", direction: "long", sweepSide: "low", entry: 10, stop: 5, exit: 20, result: "win" }),
      makeTrade({ id: "b", direction: "long", sweepSide: "low", entry: 10, stop: 5, exit: 0, result: "loss" }),
      makeTrade({ id: "c", direction: "short", sweepSide: "high", entry: 10, stop: 15, exit: 0, result: "win" }),
      // A long entry after a HIGH purge doesn't count toward either aligned row.
      makeTrade({ id: "d", direction: "long", sweepSide: "high", entry: 10, stop: 5, exit: 20, result: "win" }),
    ]);

    const longAfterLow = rows.find((r) => r.key === "long_after_low")!;
    expect(longAfterLow.tradeCount).toBe(2);
    expect(longAfterLow.winRate).toBe(0.5);

    const shortAfterHigh = rows.find((r) => r.key === "short_after_high")!;
    expect(shortAfterHigh.tradeCount).toBe(1);
    expect(shortAfterHigh.winRate).toBe(1);
  });

  it("groups every no-sweep entry regardless of direction", () => {
    const rows = sweepAlignment([
      makeTrade({ id: "a", direction: "long", sweepSide: "none", result: "loss" }),
      makeTrade({ id: "b", direction: "short", sweepSide: "none", result: "loss" }),
    ]);
    const noSweep = rows.find((r) => r.key === "no_sweep")!;
    expect(noSweep.tradeCount).toBe(2);
    expect(noSweep.winRate).toBe(0);
  });

  it("is null, not zero, for a row with no matching trades", () => {
    const rows = sweepAlignment([]);
    expect(rows.every((r) => r.winRate === null && r.tradeCount === 0)).toBe(true);
  });
});

describe("dailyNetR", () => {
  it("keys by day with net R, count, and the day's best/worst trade", () => {
    const map = dailyNetR([
      tradeWithR(2, { id: "a", date: "2026-09-09" }),
      tradeWithR(-0.5, { id: "b", date: "2026-09-09" }),
      tradeWithR(1, { id: "c", date: "2026-09-10" }),
    ]);

    expect(map.get("2026-09-09")).toEqual({
      date: "2026-09-09",
      netR: 1.5,
      tradeCount: 2,
      bestR: 2,
      worstR: -0.5,
    });
    expect(map.get("2026-09-10")!.netR).toBeCloseTo(1, 10);
    expect(map.has("2026-09-11")).toBe(false);
  });
});

describe("equityCurve", () => {
  it("accumulates R in date order and reports the worst peak-to-trough drop", () => {
    const curve = equityCurve([
      tradeWithR(2, { id: "a", date: "2026-09-03" }),
      tradeWithR(-3, { id: "b", date: "2026-09-04" }),
      tradeWithR(1, { id: "c", date: "2026-09-05" }),
      tradeWithR(-1, { id: "d", date: "2026-09-01" }),
    ]);

    expect(curve.points.map((p) => p.date)).toEqual([
      "2026-09-01",
      "2026-09-03",
      "2026-09-04",
      "2026-09-05",
    ]);
    expect(curve.points.map((p) => p.cumulativeR)).toEqual([-1, 1, -2, -1]);
    expect(curve.maxDrawdownR).toBeCloseTo(3, 10);
    expect(curve.maxDrawdownDate).toBe("2026-09-04");
  });

  it("is empty when nothing has been closed", () => {
    const curve = equityCurve([makeTrade({ exit: null })]);
    expect(curve.points).toEqual([]);
    expect(curve.maxDrawdownR).toBe(0);
  });
});

describe("sorting and filtering", () => {
  it("sorts by date, then createdAt within the day", () => {
    const a = makeTrade({ id: "a", date: "2026-09-09", createdAt: "2026-09-09T15:00:00Z" });
    const b = makeTrade({ id: "b", date: "2026-09-09", createdAt: "2026-09-09T09:00:00Z" });
    const c = makeTrade({ id: "c", date: "2026-09-08", createdAt: "2026-09-08T23:00:00Z" });
    expect(sortChronologically([a, b, c]).map((t) => t.id)).toEqual(["c", "b", "a"]);
  });

  it("filters inclusively on both ends", () => {
    const trades = ["2026-09-01", "2026-09-15", "2026-09-30"].map((date, i) =>
      makeTrade({ id: `t${i}`, date }),
    );
    expect(filterByDateRange(trades, "2026-09-01", "2026-09-15")).toHaveLength(2);
    expect(filterByDateRange(trades, "2026-09-16")).toHaveLength(1);
    expect(filterByDateRange(trades)).toHaveLength(3);
  });
});

describe("memoisation", () => {
  it("returns the identical result object for the same input reference", () => {
    const trades = [tradeWithR(1)];
    expect(dailyNetR(trades)).toBe(dailyNetR(trades));
    expect(equityCurve(trades)).toBe(equityCurve(trades));
  });

  it("recomputes when the input changes", () => {
    const first = dailyNetR([tradeWithR(1)]);
    const second = dailyNetR([tradeWithR(2)]);
    expect(first).not.toBe(second);
  });
});

describe("swap and the R axis", () => {
  /**
   * The load-bearing guarantee of the whole design: recording swap must not
   * move a single R statistic. Same trades, same prices, same everything —
   * one set held overnight and charged for it.
   */
  const prices = [tradeWithR(2), tradeWithR(-1), tradeWithR(3), tradeWithR(0)];
  const charged = prices.map((t, i) => ({ ...t, swap: -5 * (i + 1) }));

  it("leaves every R metric identical", () => {
    expect(netR(charged)).toBe(netR(prices));
    expect(expectancy(charged)).toBe(expectancy(prices));
    expect(avgWin(charged)).toBe(avgWin(prices));
    expect(avgLoss(charged)).toBe(avgLoss(prices));
    expect(winRate(charged)).toBe(winRate(prices));
    expect(ruleAdherence(charged)).toBe(ruleAdherence(prices));
    expect(equityCurve(charged)).toEqual(equityCurve(prices));
    expect(dailyNetR(charged)).toEqual(dailyNetR(prices));
    expect(periodStats(charged)).toEqual(periodStats(prices));
  });

  it("reports swap separately, in currency and in R", () => {
    // -5, -10, -15, -20 against a $100 1R from the fixture.
    expect(netSwap(charged)).toBe(-50);
    expect(netSwapR(charged)).toBeCloseTo(-0.5, 10);
  });

  it("counts nothing for trades with no swap recorded", () => {
    expect(netSwap(prices)).toBe(0);
    expect(netSwapR(prices)).toBe(0);
  });

  it("skips open trades, matching netR and tradingPnL", () => {
    const open = [{ ...tradeWithR(0), exit: null, result: null, swap: -30 }];
    expect(netSwap(open)).toBe(0);
    expect(netSwapR(open)).toBe(0);
  });
});
