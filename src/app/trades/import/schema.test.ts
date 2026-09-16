import { describe, expect, it } from "vitest";
import {
  CSV_FIELD_LABELS,
  CSV_TARGET_FIELDS,
  csvRequiredFields,
  csvRowSchema,
  emptyCsvRow,
  toTradeInsert,
} from "./schema";

/** A row that passes on its own, so each test can vary exactly one cell. */
function validRow(overrides: Partial<Record<string, string>> = {}) {
  return {
    ...emptyCsvRow(),
    date: "2026-09-10",
    instrument: "EURUSD",
    direction: "long",
    session: "london",
    htfPairing: "w_d",
    rangeHigh: "1.1050",
    rangeLow: "1.0950",
    sweepSide: "low",
    entry: "1.0960",
    stop: "1.0940",
    size: "1",
    rValueAtEntry: "200",
    ...overrides,
  };
}

describe("swap as a CSV column", () => {
  const parse = (swap: string) => csvRowSchema("en", "live").safeParse(validRow({ swap }));

  it("is optional for both account kinds", () => {
    expect(csvRequiredFields("live")).not.toContain("swap");
    expect(csvRequiredFields("backtest")).not.toContain("swap");
    expect(parse("").success).toBe(true);
  });

  it("accepts a negative cost, a positive credit, and a recorded zero", () => {
    expect(parse("-12.40").success).toBe(true);
    expect(parse("8").success).toBe(true);
    expect(parse("0").success).toBe(true);
  });

  it("rejects a cell that isn't a number", () => {
    expect(parse("n/a").success).toBe(false);
  });

  it("stores a blank cell as null and a zero as 0", () => {
    const models = new Map<string, string>();
    expect(toTradeInsert(validRow({ swap: "" }), models).swap).toBeNull();
    expect(toTradeInsert(validRow({ swap: "0" }), models).swap).toBe(0);
    expect(toTradeInsert(validRow({ swap: "-12.40" }), models).swap).toBe(-12.4);
  });

  it("reads a swap copied off one of this app's own screens as negative", () => {
    // The app prints U+2212, not a hyphen, so a pasted figure arrives that way.
    const models = new Map<string, string>();
    expect(parse("−12.40").success).toBe(true);
    expect(toTradeInsert(validRow({ swap: "−12.40" }), models).swap).toBe(-12.4);
  });

  it("sits between Exit and Size in the column order, and is labelled in both locales", () => {
    // The export route writes its cells positionally against this list, so a
    // reordering here silently shifts every column of an export.
    const order = [...CSV_TARGET_FIELDS];
    expect(order.slice(order.indexOf("exit"), order.indexOf("size") + 1)).toEqual(["exit", "swap", "size"]);
    expect(CSV_FIELD_LABELS.swap).toEqual({ en: "Swap", ko: "스왑" });
  });
});
