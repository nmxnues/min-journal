import { describe, expect, it } from "vitest";
import { makeTrade } from "@/lib/domain/fixtures";
import { createEditTradeSchema, tradeToEditInput } from "./schema";

describe("tradeToEditInput", () => {
  it("leaves sweepSideOverride null when the stored side matches what the range/stop derive", () => {
    // stop 5, below range low 10, derives "low" — matches the stored side.
    const input = tradeToEditInput(makeTrade({ sweepSide: "low", stop: 5, rangeHigh: 100, rangeLow: 10 }));
    expect(input.sweepSideOverride).toBeNull();
  });

  it("carries the stored side forward as an explicit override when it disagrees with derivation", () => {
    // stop 50 (inside the range) derives "none", but the trade was logged as "both".
    const input = tradeToEditInput(makeTrade({ sweepSide: "both", stop: 50, rangeHigh: 100, rangeLow: 0 }));
    expect(input.sweepSideOverride).toBe("both");
  });

  it("seeds swap from the trade, and an unrecorded swap as an empty field", () => {
    expect(tradeToEditInput(makeTrade({ swap: -12.4 })).swap).toBe("-12.4");
    // A recorded 0 must survive the round trip as "0" — blanking it would
    // turn "closed same day, paid nothing" into "never recorded".
    expect(tradeToEditInput(makeTrade({ swap: 0 })).swap).toBe("0");
    expect(tradeToEditInput(makeTrade({ swap: null })).swap).toBe("");
  });

  it("seeds exitReason and holdMinutes from the trade, defaulting to empty strings", () => {
    const withValues = tradeToEditInput(makeTrade({ exitReason: "Partial into 50%", holdMinutes: 38 }));
    expect(withValues.exitReason).toBe("Partial into 50%");
    expect(withValues.holdMinutes).toBe("38");

    const withoutValues = tradeToEditInput(makeTrade({ exitReason: null, holdMinutes: null }));
    expect(withoutValues.exitReason).toBe("");
    expect(withoutValues.holdMinutes).toBe("");
  });
});

describe("createEditTradeSchema", () => {
  const valid = tradeToEditInput(makeTrade());

  it("accepts a trade round-tripped straight back through the schema", () => {
    expect(createEditTradeSchema("en").safeParse(valid).success).toBe(true);
  });

  it("rejects a negative hold time", () => {
    const result = createEditTradeSchema("en").safeParse({ ...valid, holdMinutes: "-5" });
    expect(result.success).toBe(false);
  });

  it("rejects a non-integer hold time", () => {
    const result = createEditTradeSchema("en").safeParse({ ...valid, holdMinutes: "12.5" });
    expect(result.success).toBe(false);
  });

  it("allows an empty hold time — the field is optional", () => {
    expect(createEditTradeSchema("en").safeParse({ ...valid, holdMinutes: "" }).success).toBe(true);
  });

  it("accepts a negative, zero, or empty swap and rejects a non-number", () => {
    const parse = (swap: string) => createEditTradeSchema("en").safeParse({ ...valid, swap });
    // Negative is the common case, not an error: a cost lowers the balance.
    expect(parse("-12.40").success).toBe(true);
    expect(parse("8").success).toBe(true);
    expect(parse("0").success).toBe(true);
    expect(parse("").success).toBe(true);
    expect(parse("abc").success).toBe(false);
  });
});
