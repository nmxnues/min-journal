import { describe, expect, it } from "vitest";
import { collectWarnings, type WarningInput } from "./warnings";

// FX-plausible numbers (0.2-5 for a non-JPY pair) standing in for the same
// relative shape the original index-style fixture (entry 10 in a 0-100
// range) used — the price-plausibility warning added later would otherwise
// flag this fixture's own numbers on every test.
const base: WarningInput = {
  instrument: "EURUSD",
  direction: "long",
  entry: 1.3,
  stop: 1.1,
  target: 2.8,
  exit: null,
  rangeHigh: 3.0,
  rangeLow: 1.0,
  sweepSide: "low",
  result: null,
  modelIsRetired: false,
  accountIsNearDrawdownLimit: false,
};

describe("collectWarnings", () => {
  it("is quiet for a clean on-plan trade", () => {
    expect(collectWarnings(base)).toEqual([]);
  });

  it("flags a target on the same side of entry as the stop", () => {
    // Long with the stop below entry, but the target below it too.
    expect(collectWarnings({ ...base, target: 1.0 })).toContain("target_wrong_side");
    // The mirrored short is fine.
    expect(
      collectWarnings({ ...base, direction: "short", entry: 1.3, stop: 1.5, target: 1.0 }),
    ).not.toContain("target_wrong_side");
  });

  it("flags an entry outside the range but does not treat it as an error", () => {
    const warnings = collectWarnings({ ...base, entry: 0.5 });
    expect(warnings).toContain("entry_outside_range");
  });

  it("flags off-plan for no sweep and for a mid-range entry", () => {
    expect(collectWarnings({ ...base, sweepSide: "none" })).toContain("off_plan");
    // Midpoint of this fixture's range [1.0, 3.0].
    expect(collectWarnings({ ...base, entry: 2.0 })).toContain("off_plan");
  });

  it("flags a retired model", () => {
    expect(collectWarnings({ ...base, modelIsRetired: true })).toContain("retired_model");
  });

  it("flags a result that disagrees with the exit, but never for break-even", () => {
    // Long from 1.3, stop 1.1 (risk 0.2), exit 1.0 => negative R, marked a win.
    expect(collectWarnings({ ...base, exit: 1.0, result: "win" })).toContain(
      "result_disagrees_with_exit",
    );
    // The same numbers marked break-even are allowed to be slightly off.
    expect(collectWarnings({ ...base, exit: 1.0, result: "be" })).not.toContain(
      "result_disagrees_with_exit",
    );
    // And a win that priced out positive is fine.
    expect(collectWarnings({ ...base, exit: 2.0, result: "win" })).not.toContain(
      "result_disagrees_with_exit",
    );
  });

  it("passes the drawdown guard through", () => {
    expect(collectWarnings({ ...base, accountIsNearDrawdownLimit: true })).toContain(
      "drawdown_near_limit",
    );
  });

  it("never warns about a future date", () => {
    // No date input at all: dropped deliberately so the real warnings keep weight.
    expect(Object.keys(base)).not.toContain("date");
  });

  it("stays quiet while fields are still empty", () => {
    expect(
      collectWarnings({ ...base, entry: null, stop: null, target: null, sweepSide: null }),
    ).toEqual([]);
  });

  describe("price_implausible_for_instrument", () => {
    it("flags an index-scale price pasted into an FX field", () => {
      // The reported bug: a 23,411-style price left over from a different
      // kind of instrument, entered against a non-JPY FX pair.
      const warnings = collectWarnings({
        ...base,
        rangeHigh: 23_486.25,
        rangeLow: 23_402.75,
        entry: 23_411,
        stop: 23_396.5,
      });
      expect(warnings).toContain("price_implausible_for_instrument");
    });

    it("uses the JPY pair's own plausible range, not the standard-pair one", () => {
      // ~150 is an ordinary USDJPY-style price — implausible for EURUSD,
      // fine for a JPY pair.
      expect(
        collectWarnings({ ...base, instrument: "EURUSD", entry: 150, stop: 148, rangeHigh: 160, rangeLow: 140, target: 165 }),
      ).toContain("price_implausible_for_instrument");
      expect(
        collectWarnings({ ...base, instrument: "USDJPY", entry: 150, stop: 148, rangeHigh: 160, rangeLow: 140, target: 165 }),
      ).not.toContain("price_implausible_for_instrument");
    });

    it("stays quiet for ordinary FX-scale prices", () => {
      expect(collectWarnings(base)).not.toContain("price_implausible_for_instrument");
    });
  });
});
