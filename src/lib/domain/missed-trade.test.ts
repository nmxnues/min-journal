import { describe, expect, it } from "vitest";
import { makeTrade } from "./fixtures";
import {
  missedCommissionR,
  missedGrossR,
  missedNetR,
  netRAfterCommission,
  summarizeMissed,
  usdPerPricePerLot,
  type MissedTrade,
} from "./missed-trade";
import { netR } from "./stats";

function makeMissed(overrides: Partial<MissedTrade> = {}): MissedTrade {
  return {
    id: "m1",
    date: "2026-09-22",
    time: null,
    session: "london",
    instrument: "EURUSD",
    direction: "long",
    entry: 1.1,
    stop: 1.099, // 10 pips
    target: 1.103, // 3R
    setupNote: null,
    missReason: "fear",
    missReasonNote: null,
    result: "win",
    commissionPerLotPerSide: 3,
    notes: null,
    createdAt: "2026-09-22T00:00:00Z",
    updatedAt: "2026-09-22T00:00:00Z",
    ...overrides,
  };
}

describe("usdPerPricePerLot", () => {
  it("is exact for XXXUSD and USDXXX", () => {
    expect(usdPerPricePerLot("EURUSD", 1.1)).toBe(100_000);
    expect(usdPerPricePerLot("usdjpy", 150)).toBeCloseTo(100_000 / 150);
  });

  it("approximates crosses from the quote currency", () => {
    expect(usdPerPricePerLot("EURAUD", 1.6)).toBeCloseTo(66_000);
    expect(usdPerPricePerLot("GBPJPY", 200)).toBeCloseTo(680);
  });

  it("is null for anything it can't convert", () => {
    expect(usdPerPricePerLot("NQ", 20000)).toBeNull();
    expect(usdPerPricePerLot("EURXYZ", 1)).toBeNull();
    expect(usdPerPricePerLot("USDJPY", null)).toBeNull();
  });
});

describe("missedCommissionR", () => {
  it("is 2 × rate over the dollar risk of one lot", () => {
    // 10 pips on EURUSD = $100 per lot; $3 each side -> $6 / $100 = 0.06R.
    expect(missedCommissionR(makeMissed())).toBeCloseTo(0.06);
  });

  it("matches lots × rate × 2 ÷ 1R for a trade sized to exactly 1R", () => {
    const oneR = 200;
    const lots = oneR / (0.001 * 100_000); // 2 lots at 10 pips
    expect(missedCommissionR(makeMissed())).toBeCloseTo((lots * 3 * 2) / oneR);
  });

  it("gets bigger as the stop gets tighter", () => {
    expect(missedCommissionR(makeMissed({ stop: 1.0995 }))).toBeCloseTo(0.12);
  });

  it("is 0 with no commission rate, and null without prices", () => {
    expect(missedCommissionR(makeMissed({ commissionPerLotPerSide: 0 }))).toBe(0);
    expect(missedCommissionR(makeMissed({ entry: null }))).toBeNull();
    expect(missedCommissionR(makeMissed({ stop: 1.1 }))).toBeNull();
  });
});

describe("missed R", () => {
  it("win reaches the target, loss is −1, break-even is 0 — before commission", () => {
    expect(missedGrossR(makeMissed())).toBeCloseTo(3);
    expect(missedGrossR(makeMissed({ result: "loss" }))).toBe(-1);
    expect(missedGrossR(makeMissed({ result: "be" }))).toBe(0);
  });

  it("takes commission off every result, break-even included", () => {
    expect(missedNetR(makeMissed())).toBeCloseTo(2.94);
    expect(missedNetR(makeMissed({ result: "loss" }))).toBeCloseTo(-1.06);
    expect(missedNetR(makeMissed({ result: "be" }))).toBeCloseTo(-0.06);
  });

  it("works the same for shorts", () => {
    expect(missedNetR(makeMissed({ direction: "short", entry: 1.1, stop: 1.101, target: 1.098 }))).toBeCloseTo(1.94);
  });

  it("is unknown (null), not zero, when prices are missing", () => {
    expect(missedNetR(makeMissed({ entry: null, stop: null, target: null }))).toBeNull();
    expect(missedNetR(makeMissed({ target: null }))).toBeNull();
    // A loss doesn't need the target.
    expect(missedNetR(makeMissed({ result: "loss", target: null }))).toBeCloseTo(-1.06);
  });
});

describe("summarizeMissed", () => {
  it("counts results and reasons and sums only the known R", () => {
    const summary = summarizeMissed([
      makeMissed({ id: "a" }),
      makeMissed({ id: "b", result: "loss", missReason: "prior_loss" }),
      makeMissed({ id: "c", missReason: "prior_loss", entry: null }),
      makeMissed({ id: "d", result: "be", missReason: "away" }),
    ]);
    expect(summary.count).toBe(4);
    expect([summary.winCount, summary.lossCount, summary.beCount]).toEqual([2, 1, 1]);
    expect(summary.unknownRCount).toBe(1);
    expect(summary.netR).toBeCloseTo(2.94 - 1.06 - 0.06);
    expect(summary.byReason[0]).toEqual({ reason: "prior_loss", count: 2 });
    expect(summary.byReason.map((r) => r.reason)).toEqual(["prior_loss", "fear", "away", "low_conviction", "other"]);
  });

  it("is all zeros for an empty period", () => {
    const summary = summarizeMissed([]);
    expect(summary.count).toBe(0);
    expect(summary.netR).toBe(0);
    expect(summary.byReason.every((r) => r.count === 0)).toBe(true);
  });
});

describe("netRAfterCommission", () => {
  it("takes each real trade's own commission off its R", () => {
    const trades = [
      // +3R, $10 commission on a $100 1R -> 2.9R
      makeTrade({ id: "a", entry: 100, stop: 90, exit: 130, entryCommission: 5, exitCommission: 5 }),
      // −1R, $4 -> −1.04R
      makeTrade({ id: "b", entry: 100, stop: 90, exit: 90, entryCommission: 2, exitCommission: 2 }),
      // open: skipped, like netR
      makeTrade({ id: "c", exit: null, entryCommission: 3 }),
    ];
    expect(netRAfterCommission(trades)).toBeCloseTo(2.9 - 1.04);
  });

  it("leaves the real netR statistic itself untouched", () => {
    const trades = [makeTrade({ entry: 100, stop: 90, exit: 130, entryCommission: 5, exitCommission: 5 })];
    netRAfterCommission(trades);
    expect(netR(trades)).toBeCloseTo(3);
  });
});
