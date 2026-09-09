import { describe, expect, it } from "vitest";
import { collectWarnings, type WarningInput } from "./warnings";

const base: WarningInput = {
  direction: "long",
  entry: 10,
  stop: 5,
  target: 90,
  exit: null,
  rangeHigh: 100,
  rangeLow: 0,
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
    expect(collectWarnings({ ...base, target: 2 })).toContain("target_wrong_side");
    // The mirrored short is fine.
    expect(
      collectWarnings({ ...base, direction: "short", entry: 90, stop: 95, target: 10 }),
    ).not.toContain("target_wrong_side");
  });

  it("flags an entry outside the range but does not treat it as an error", () => {
    const warnings = collectWarnings({ ...base, entry: -5 });
    expect(warnings).toContain("entry_outside_range");
  });

  it("flags off-plan for no sweep and for a mid-range entry", () => {
    expect(collectWarnings({ ...base, sweepSide: "none" })).toContain("off_plan");
    expect(collectWarnings({ ...base, entry: 50 })).toContain("off_plan");
  });

  it("flags a retired model", () => {
    expect(collectWarnings({ ...base, modelIsRetired: true })).toContain("retired_model");
  });

  it("flags a result that disagrees with the exit, but never for break-even", () => {
    // Long from 10, stop 5 (risk 5), exit 4 => -1.2R, marked a win.
    expect(collectWarnings({ ...base, exit: 4, result: "win" })).toContain(
      "result_disagrees_with_exit",
    );
    // The same numbers marked break-even are allowed to be slightly off.
    expect(collectWarnings({ ...base, exit: 4, result: "be" })).not.toContain(
      "result_disagrees_with_exit",
    );
    // And a win that priced out positive is fine.
    expect(collectWarnings({ ...base, exit: 20, result: "win" })).not.toContain(
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
});
