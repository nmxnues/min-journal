import { describe, expect, it } from "vitest";
import {
  formatCurrency,
  formatHoldMinutes,
  formatLoggedAt,
  formatPips,
  formatPrice,
  formatR,
  formatTime,
  formatTradeDate,
  hasValue,
  parseNumberInput,
} from "./format";

describe("parseNumberInput", () => {
  it("accepts thousands separators and broker paste noise", () => {
    expect(parseNumberInput("23,411.00")).toBe(23_411);
    expect(parseNumberInput("$23 411.00")).toBe(23_411);
    expect(parseNumberInput(" 23411.00 ")).toBe(23_411);
    expect(parseNumberInput("1,234,567.25")).toBe(1_234_567.25);
  });

  it("keeps a leading minus and drops stray ones", () => {
    expect(parseNumberInput("-1.5")).toBe(-1.5);
    expect(parseNumberInput("1-5")).toBe(15);
  });

  it("is null while the field is still mid-typing", () => {
    expect(parseNumberInput("")).toBeNull();
    expect(parseNumberInput("-")).toBeNull();
    expect(parseNumberInput(".")).toBeNull();
    expect(parseNumberInput("abc")).toBeNull();
  });

  it("keeps a trailing dot usable rather than throwing it away", () => {
    // "23411." parses as 23411 — the user is still typing the decimals.
    expect(parseNumberInput("23411.")).toBe(23_411);
  });
});

describe("hasValue", () => {
  it("ignores whitespace-only input", () => {
    expect(hasValue("  ")).toBe(false);
    expect(hasValue("")).toBe(false);
    expect(hasValue(undefined)).toBe(false);
    expect(hasValue("0")).toBe(true);
  });
});

describe("formatR", () => {
  it("always carries an explicit sign, as the mocks do", () => {
    expect(formatR(2.81)).toBe("+2.8R");
    expect(formatR(-1)).toBe("−1.0R");
    expect(formatR(0)).toBe("0.0R");
  });
});

describe("formatPrice", () => {
  it("uses 5 decimals for standard FX pairs", () => {
    expect(formatPrice(1.265, "EURUSD")).toBe("1.26500");
    expect(formatPrice(1.265, "eurusd")).toBe("1.26500");
  });

  it("uses 3 decimals for JPY pairs", () => {
    expect(formatPrice(156.325, "USDJPY")).toBe("156.325");
    expect(formatPrice(156.325, "EURJPY")).toBe("156.325");
  });

  it("groups thousands", () => {
    expect(formatPrice(23_411, "EURUSD")).toBe("23,411.00000");
  });
});

describe("formatPips", () => {
  it("converts a standard FX pair's price difference to pips", () => {
    expect(formatPips(0.005, "EURUSD")).toBe("50.0");
    expect(formatPips(0.00005, "GBPUSD")).toBe("0.5");
  });

  it("converts a JPY pair's price difference to pips", () => {
    expect(formatPips(0.05, "USDJPY")).toBe("5.0");
  });
});

describe("formatCurrency", () => {
  it("groups thousands", () => {
    expect(formatCurrency(32_180)).toBe("$32,180");
  });
});

describe("formatTime", () => {
  it("is HH:mm, 24-hour, matching the mock's \"Draft saved · 12:41\"", () => {
    expect(formatTime(new Date("2026-09-09T12:41:00"))).toBe("12:41");
    expect(formatTime(new Date("2026-09-09T09:05:00"))).toBe("09:05");
    expect(formatTime(new Date("2026-09-09T00:00:00"))).toBe("00:00");
  });
});

describe("formatHoldMinutes", () => {
  it("matches the mock's \"38m\" under an hour", () => {
    expect(formatHoldMinutes(38)).toBe("38m");
    expect(formatHoldMinutes(0)).toBe("0m");
  });

  it("switches to hours once past 60 minutes", () => {
    expect(formatHoldMinutes(75)).toBe("1h 15m");
    expect(formatHoldMinutes(120)).toBe("2h");
  });
});

describe("formatTradeDate", () => {
  it("matches the mock's \"Sep 9, 2026\" header date, in UTC regardless of local timezone", () => {
    expect(formatTradeDate("2026-09-09", "en")).toBe("Sep 9, 2026");
  });
});

describe("formatLoggedAt", () => {
  it("prints a short month, day, and 24-hour time", () => {
    // Constructed in local time (not a Z-suffixed UTC instant) so the
    // expectation holds regardless of the test runner's timezone.
    expect(formatLoggedAt(new Date(2026, 8, 9, 10, 24), "en")).toBe("Sep 9, 10:24");
  });
});
