import { describe, expect, it } from "vitest";
import { CSV_FIELD_LABELS, CSV_TARGET_FIELDS, csvRequiredFields, csvRowSchema, emptyCsvRow, toTradeInsert } from "@/app/trades/import/schema";
import { createEditTradeSchema, tradeToEditInput } from "@/app/trades/[id]/schema";
import { createNewTradeSchema, NEW_TRADE_DEFAULTS } from "@/app/trades/new/schema";
import { makeTrade } from "@/lib/domain/fixtures";
import { commissionPrefill, startsManual } from "@/lib/use-commission-prefill";

const newTrade = (overrides: Record<string, string> = {}) => ({
  ...NEW_TRADE_DEFAULTS,
  instrument: "EURUSD",
  date: "2026-09-22",
  rangeHigh: "1.1050",
  rangeLow: "1.0950",
  entry: "1.0960",
  stop: "1.0940",
  size: "1",
  ...overrides,
});

describe("commission fields on the trade forms", () => {
  const schema = createNewTradeSchema("en");

  it("accepts blank, zero and positive values", () => {
    for (const value of ["", "0", "3.5", "7.00"]) {
      expect(schema.safeParse(newTrade({ entryCommission: value, exitCommission: value })).success).toBe(true);
    }
  });

  it("rejects a negative or non-numeric commission on either side", () => {
    for (const [field, value] of [
      ["entryCommission", "-3.5"],
      ["exitCommission", "−3.5"], // U+2212, as copied off the app's own screens
      ["entryCommission", "abc"],
    ] as const) {
      const result = schema.safeParse(newTrade({ [field]: value }));
      expect(result.success).toBe(false);
      expect(result.error!.issues[0]!.path).toEqual([field]);
    }
  });

  it("seeds the edit form from the stored values, 0 included", () => {
    expect(tradeToEditInput(makeTrade({ entryCommission: 3.5, exitCommission: 7 }))).toMatchObject({
      entryCommission: "3.5",
      exitCommission: "7",
    });
    expect(tradeToEditInput(makeTrade()).entryCommission).toBe("0");
    expect(createEditTradeSchema("en").safeParse(tradeToEditInput(makeTrade())).success).toBe(true);
  });
});

describe("the size-driven prefill", () => {
  it("formats size × rate as the form's string value", () => {
    expect(commissionPrefill("1", 3.5)).toBe("3.5");
    expect(commissionPrefill("2", 3.5)).toBe("7");
    expect(commissionPrefill("", 3.5)).toBeNull();
    expect(commissionPrefill("1", 0)).toBeNull();
  });

  it("starts a side manual only when it holds something other than the prefill", () => {
    expect(startsManual("", "1", 3.5)).toBe(false); // fresh form
    expect(startsManual("3.5", "1", 3.5)).toBe(false); // a draft still on the prefill
    expect(startsManual("4", "1", 3.5)).toBe(true); // corrected by hand
    // A pre-commission trade (stored 0) opened in the edit form is protected:
    // a size change there won't overwrite its 0 with today's rate.
    expect(startsManual("0", "1", 3.5)).toBe(true);
  });
});

describe("commission as CSV columns", () => {
  const validRow = (overrides: Record<string, string> = {}) => ({
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
  });

  it("is optional, sits after size, and stores blank as 0", () => {
    expect(csvRequiredFields("live")).not.toContain("entryCommission");
    const order = [...CSV_TARGET_FIELDS];
    expect(order.slice(order.indexOf("size"), order.indexOf("size") + 3)).toEqual([
      "size",
      "entryCommission",
      "exitCommission",
    ]);
    expect(CSV_FIELD_LABELS.entryCommission.ko).toBe("진입 커미션");

    const insert = toTradeInsert(validRow({ entryCommission: "3.5", exitCommission: "" }), new Map());
    expect(insert.entry_commission).toBe(3.5);
    expect(insert.exit_commission).toBe(0);
  });

  it("rejects a negative commission cell", () => {
    expect(csvRowSchema("en", "live").safeParse(validRow({ exitCommission: "-7" })).success).toBe(false);
  });
});
