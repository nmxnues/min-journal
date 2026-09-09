import { describe, expect, it } from "vitest";
import { makeTrade } from "./fixtures";
import {
  captureRate,
  entryIsMidRange,
  offPlan,
  plannedR,
  pnlAmount,
  rangePosition,
  rangeSize,
  realizedR,
  risk,
} from "./trade";

/**
 * The mock 2b trade from docs/design-canvas.html, used as a real-numbers
 * anchor: NQ long, range 23,402.75-23,486.25, entry 23,411.00, stop
 * 23,396.50, exit 23,451.75. The mock captions it "+2.8R", "exit at 59%",
 * and chips it "On plan".
 */
const mock2b = makeTrade({
  rangeLow: 23_402.75,
  rangeHigh: 23_486.25,
  entry: 23_411.0,
  stop: 23_396.5,
  exit: 23_451.75,
  target: 23_454.5, // gives a planned 3.0R, as captioned
  direction: "long",
  sweepSide: "low",
});

describe("rangeSize", () => {
  it("is high - low", () => {
    expect(rangeSize(mock2b)).toBeCloseTo(83.5, 10);
  });

  it("is null for an invalid range (still being typed)", () => {
    expect(rangeSize(makeTrade({ rangeHigh: 5, rangeLow: 5 }))).toBeNull();
    expect(rangeSize(makeTrade({ rangeHigh: 1, rangeLow: 10 }))).toBeNull();
    expect(rangeSize(makeTrade({ rangeHigh: Number.NaN }))).toBeNull();
  });
});

describe("rangePosition", () => {
  it("matches the mock's 'exit at 59%'", () => {
    expect(rangePosition(mock2b.exit, mock2b)).toBeCloseTo(0.5868, 4);
    expect(Math.round(rangePosition(mock2b.exit, mock2b)! * 100)).toBe(59);
  });

  it("places the mock's on-plan entry just above the swept low", () => {
    expect(rangePosition(mock2b.entry, mock2b)).toBeCloseTo(0.0988, 4);
  });

  it("goes outside 0..1 for prices beyond the range", () => {
    const t = makeTrade({ rangeLow: 0, rangeHigh: 100 });
    expect(rangePosition(-10, t)).toBeCloseTo(-0.1, 10);
    expect(rangePosition(110, t)).toBeCloseTo(1.1, 10);
  });
});

describe("risk", () => {
  it("is |entry - stop|", () => {
    expect(risk(mock2b)).toBeCloseTo(14.5, 10);
    expect(risk(makeTrade({ entry: 5, stop: 10 }))).toBe(5);
  });

  it("is null when stop equals entry (no risk to divide by)", () => {
    expect(risk(makeTrade({ entry: 10, stop: 10 }))).toBeNull();
  });
});

describe("plannedR", () => {
  it("is |target - entry| / risk, direction-independent", () => {
    expect(plannedR(mock2b)).toBeCloseTo(3.0, 10);
    // Same geometry mirrored for a short.
    expect(plannedR(makeTrade({ entry: 100, stop: 105, target: 85 }))).toBeCloseTo(3.0, 10);
  });

  it("is null without a target", () => {
    expect(plannedR(makeTrade({ target: null }))).toBeNull();
  });
});

describe("realizedR", () => {
  it("matches the mock's +2.8R", () => {
    expect(realizedR(mock2b)).toBeCloseTo(2.8103, 4);
  });

  it("flips sign for shorts", () => {
    // Short from 100, stop 105 (risk 5), exit 95 -> a 1R winner.
    expect(realizedR(makeTrade({ direction: "short", entry: 100, stop: 105, exit: 95 }))).toBe(1);
    // Same prices long would be a 1R loser.
    expect(realizedR(makeTrade({ direction: "long", entry: 100, stop: 105, exit: 95 }))).toBe(-1);
  });

  it("is negative for a losing trade", () => {
    expect(realizedR(makeTrade({ entry: 100, stop: 95, exit: 92.5 }))).toBe(-1.5);
    expect(realizedR(makeTrade({ direction: "short", entry: 100, stop: 105, exit: 107.5 }))).toBe(-1.5);
  });

  it("is 0 for a break-even trade that exited exactly at entry", () => {
    expect(realizedR(makeTrade({ result: "be", entry: 100, stop: 95, exit: 100 }))).toBe(0);
  });

  it("does NOT force break-even to exactly 0 — result is a label, not an input", () => {
    // Scratched a few ticks off entry: the R (and so the money) stays honest.
    const scratched = makeTrade({ result: "be", entry: 100, stop: 95, exit: 100.25 });
    expect(realizedR(scratched)).toBeCloseTo(0.05, 10);
  });

  it("is null (not 0) when the trade has no exit", () => {
    expect(realizedR(makeTrade({ exit: null }))).toBeNull();
  });

  it("is null while entry and stop are still equal", () => {
    expect(realizedR(makeTrade({ entry: 10, stop: 10 }))).toBeNull();
  });
});

describe("captureRate", () => {
  it("is realized / planned", () => {
    // The mock's "93% captured" comes from its own rounded 2.8/3.0; computed
    // from raw values the same trade is 93.7%.
    expect(captureRate(mock2b)).toBeCloseTo(0.9368, 4);
  });

  it("is null without a target or an exit", () => {
    expect(captureRate(makeTrade({ target: null }))).toBeNull();
    expect(captureRate(makeTrade({ exit: null }))).toBeNull();
  });
});

describe("entryIsMidRange", () => {
  const inRange = (entry: number) =>
    entryIsMidRange(makeTrade({ rangeLow: 0, rangeHigh: 100, entry }));

  it("covers 40%-60% inclusive", () => {
    expect(inRange(40)).toBe(true);
    expect(inRange(50)).toBe(true);
    expect(inRange(60)).toBe(true);
  });

  it("excludes just outside the band", () => {
    expect(inRange(39.9)).toBe(false);
    expect(inRange(60.1)).toBe(false);
  });

  it("excludes entries near either extreme", () => {
    expect(inRange(5)).toBe(false);
    expect(inRange(95)).toBe(false);
    expect(entryIsMidRange(mock2b)).toBe(false); // the mock's on-plan entry, at 9.9%
  });

  it("is false when the range is unusable", () => {
    expect(entryIsMidRange(makeTrade({ rangeHigh: 0, rangeLow: 0, entry: 0 }))).toBe(false);
  });
});

describe("offPlan", () => {
  it("is false for the mock's on-plan trade", () => {
    expect(offPlan(mock2b)).toBe(false);
  });

  it("is true when no side was swept", () => {
    expect(offPlan(makeTrade({ sweepSide: "none" }))).toBe(true);
  });

  it("is true for a mid-range entry even after a clean sweep", () => {
    expect(offPlan(makeTrade({ rangeLow: 0, rangeHigh: 100, entry: 50, sweepSide: "low" }))).toBe(true);
  });

  it("stays false for a swept, non-mid-range entry regardless of model", () => {
    // offPlan is trade-local by design: retiring a model must never
    // retroactively flip already-logged trades (docs/decisions.md).
    const t = makeTrade({ modelId: "retired-model", sweepSide: "high", entry: 90 });
    expect(offPlan(t)).toBe(false);
  });
});

describe("pnlAmount", () => {
  it("uses the 1R value frozen at log time", () => {
    const t = makeTrade({ entry: 100, stop: 95, exit: 110, rValueAtEntry: 150 });
    expect(realizedR(t)).toBe(2);
    expect(pnlAmount(t)).toBe(300);
  });

  it("is null when there is no realized R", () => {
    expect(pnlAmount(makeTrade({ exit: null }))).toBeNull();
  });
});
