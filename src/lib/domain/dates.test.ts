import { describe, expect, it } from "vitest";
import {
  buildMonthGrid,
  formatMonthLabel,
  isValidIsoMonth,
  isoMonthOf,
  monthRange,
  shiftMonth,
} from "./dates";

describe("monthRange", () => {
  it("spans the whole month, inclusive", () => {
    expect(monthRange("2026-09")).toEqual({ from: "2026-09-01", to: "2026-09-30" });
  });

  it("handles a leap February", () => {
    expect(monthRange("2028-02")).toEqual({ from: "2028-02-01", to: "2028-02-29" });
  });

  it("handles a non-leap February", () => {
    expect(monthRange("2026-02")).toEqual({ from: "2026-02-01", to: "2026-02-28" });
  });
});

describe("shiftMonth", () => {
  it("moves forward and back within a year", () => {
    expect(shiftMonth("2026-09", 1)).toBe("2026-10");
    expect(shiftMonth("2026-09", -1)).toBe("2026-08");
  });

  it("crosses a year boundary in both directions", () => {
    expect(shiftMonth("2026-12", 1)).toBe("2027-01");
    expect(shiftMonth("2026-01", -1)).toBe("2025-12");
  });
});

describe("isoMonthOf", () => {
  it("takes the YYYY-MM prefix", () => {
    expect(isoMonthOf("2026-09-09")).toBe("2026-09");
  });
});

describe("isValidIsoMonth", () => {
  it("accepts YYYY-MM and rejects everything else", () => {
    expect(isValidIsoMonth("2026-09")).toBe(true);
    expect(isValidIsoMonth("2026-9")).toBe(false);
    expect(isValidIsoMonth("2026-09-01")).toBe(false);
    expect(isValidIsoMonth(undefined)).toBe(false);
    expect(isValidIsoMonth(null)).toBe(false);
  });
});

describe("formatMonthLabel", () => {
  it("matches the desktop mocks", () => {
    expect(formatMonthLabel("2026-09", "en")).toBe("September 2026");
    expect(formatMonthLabel("2026-09", "ko")).toBe("2026년 9월");
  });

  it("drops the year for the mobile home header", () => {
    expect(formatMonthLabel("2026-09", "ko", false)).toBe("9월");
  });
});

describe("buildMonthGrid", () => {
  it("pads September 2026 to start on Sunday and end on a full week", () => {
    // Sep 1 2026 is a Tuesday -> 2 leading blanks; 30 days -> 32 cells so far,
    // padded to 35 (5 full weeks).
    const grid = buildMonthGrid("2026-09");
    expect(grid.length).toBe(35);
    expect(grid.slice(0, 2)).toEqual([null, null]);
    expect(grid[2]).toBe("2026-09-01");
    expect(grid[31]).toBe("2026-09-30");
    expect(grid.slice(32)).toEqual([null, null, null]);
  });

  it("every non-null cell belongs to the requested month", () => {
    const grid = buildMonthGrid("2026-02");
    for (const cell of grid) {
      if (cell !== null) expect(cell.startsWith("2026-02")).toBe(true);
    }
    expect(grid.filter((c) => c !== null)).toHaveLength(28);
  });
});
