import { describe, expect, it } from "vitest";
import { isPlausibleFxPrice } from "./instruments";

describe("isPlausibleFxPrice", () => {
  it("accepts ordinary standard-pair prices", () => {
    expect(isPlausibleFxPrice(1.265, "EURUSD")).toBe(true);
    expect(isPlausibleFxPrice(0.65, "NZDUSD")).toBe(true);
  });

  it("rejects an index/futures-scale price on a standard pair", () => {
    expect(isPlausibleFxPrice(23_411, "EURUSD")).toBe(false);
  });

  it("accepts ordinary JPY-pair prices, which sit ~2 orders of magnitude higher", () => {
    expect(isPlausibleFxPrice(156.325, "USDJPY")).toBe(true);
    expect(isPlausibleFxPrice(156.325, "EURUSD")).toBe(false);
  });

  it("rejects a JPY-pair price that's implausible even on that pair's own scale", () => {
    expect(isPlausibleFxPrice(23_411, "USDJPY")).toBe(false);
    expect(isPlausibleFxPrice(0.5, "USDJPY")).toBe(false);
  });
});
