import { describe, expect, it } from "vitest";
import {
  buildDashboardPeriodSearchParams,
  parseDashboardPeriod,
  resolveDashboardPeriod,
  stepMonthSearchParams,
} from "./dashboard-period";

describe("parseDashboardPeriod", () => {
  it("is null (the smart default) for no params, garbage, or a missing companion field", () => {
    expect(parseDashboardPeriod({})).toBeNull();
    expect(parseDashboardPeriod({ range: "yesterday" })).toBeNull();
    expect(parseDashboardPeriod({ range: "month" })).toBeNull(); // no month=
    expect(parseDashboardPeriod({ range: "month", month: "not-a-month" })).toBeNull(); // wrong shape
    expect(parseDashboardPeriod({ range: "custom", from: "2026-09-01" })).toBeNull(); // no to=
    expect(parseDashboardPeriod({ range: "custom", from: "2026-09-10", to: "2026-09-01" })).toBeNull(); // from > to
  });

  it("parses month and custom with their companion fields", () => {
    expect(parseDashboardPeriod({ range: "month", month: "2026-08" })).toEqual({
      kind: "month",
      month: "2026-08",
      from: null,
      to: null,
    });
    expect(parseDashboardPeriod({ range: "custom", from: "2026-01-01", to: "2026-03-31" })).toEqual({
      kind: "custom",
      month: null,
      from: "2026-01-01",
      to: "2026-03-31",
    });
  });

  it("parses the rolling kinds with no companion fields needed", () => {
    for (const kind of ["this-month", "last-month", "3m", "ytd", "all"] as const) {
      expect(parseDashboardPeriod({ range: kind })).toEqual({ kind, month: null, from: null, to: null });
    }
  });
});

describe("resolveDashboardPeriod", () => {
  const today = "2026-09-11";

  it("defaults to all time when no period is given, ignoring the default month", () => {
    const resolved = resolveDashboardPeriod(null, "2026-02", today);
    expect(resolved).toEqual({ kind: "all", from: "1970-01-01", to: today, stepMonth: null });
  });

  it("this-month and last-month resolve against today, ignoring the default month", () => {
    const thisMonth = resolveDashboardPeriod({ kind: "this-month", month: null, from: null, to: null }, "2020-01", today);
    expect(thisMonth).toEqual({ kind: "this-month", from: "2026-09-01", to: "2026-09-30", stepMonth: "2026-09" });

    const lastMonth = resolveDashboardPeriod({ kind: "last-month", month: null, from: null, to: null }, "2020-01", today);
    expect(lastMonth).toEqual({ kind: "last-month", from: "2026-08-01", to: "2026-08-31", stepMonth: "2026-08" });
  });

  it("month uses its own explicit month, not the default", () => {
    const resolved = resolveDashboardPeriod({ kind: "month", month: "2025-09", from: null, to: null }, "2026-02", today);
    expect(resolved).toEqual({ kind: "month", from: "2025-09-01", to: "2025-09-30", stepMonth: "2025-09" });
  });

  it("relabels month as this-month once it lands back on today's real month", () => {
    const viaStep = resolveDashboardPeriod({ kind: "month", month: "2026-09", from: null, to: null }, "2020-01", today);
    expect(viaStep.kind).toBe("this-month");
  });

  it("3m is the current month plus the two before it", () => {
    const resolved = resolveDashboardPeriod({ kind: "3m", month: null, from: null, to: null }, "2020-01", today);
    expect(resolved).toEqual({ kind: "3m", from: "2026-07-01", to: today, stepMonth: null });
  });

  it("3m crosses a year boundary correctly", () => {
    const resolved = resolveDashboardPeriod({ kind: "3m", month: null, from: null, to: null }, "2020-01", "2026-01-15");
    expect(resolved.from).toBe("2025-11-01");
  });

  it("ytd runs from Jan 1 of today's year through today", () => {
    const resolved = resolveDashboardPeriod({ kind: "ytd", month: null, from: null, to: null }, "2020-01", today);
    expect(resolved).toEqual({ kind: "ytd", from: "2026-01-01", to: today, stepMonth: null });
  });

  it("all has no navigable month", () => {
    const resolved = resolveDashboardPeriod({ kind: "all", month: null, from: null, to: null }, "2020-01", today);
    expect(resolved.stepMonth).toBeNull();
    expect(resolved.to).toBe(today);
  });

  it("custom uses its own from/to verbatim, with no step month", () => {
    const resolved = resolveDashboardPeriod(
      { kind: "custom", month: null, from: "2025-06-01", to: "2025-08-31" },
      "2020-01",
      today,
    );
    expect(resolved).toEqual({ kind: "custom", from: "2025-06-01", to: "2025-08-31", stepMonth: null });
  });
});

describe("buildDashboardPeriodSearchParams / stepMonthSearchParams", () => {
  it("round-trips a month period", () => {
    const period = { kind: "month" as const, month: "2026-08", from: null, to: null };
    const qs = buildDashboardPeriodSearchParams(period);
    expect(qs).toBe("range=month&month=2026-08");
    expect(parseDashboardPeriod(Object.fromEntries(new URLSearchParams(qs)))).toEqual(period);
  });

  it("round-trips a custom period", () => {
    const period = { kind: "custom" as const, month: null, from: "2026-01-01", to: "2026-03-31" };
    const qs = buildDashboardPeriodSearchParams(period);
    expect(parseDashboardPeriod(Object.fromEntries(new URLSearchParams(qs)))).toEqual(period);
  });

  it("a rolling kind needs no companion fields", () => {
    expect(buildDashboardPeriodSearchParams({ kind: "ytd", month: null, from: null, to: null })).toBe("range=ytd");
  });

  it("stepMonthSearchParams always lands on a frozen month, one step over", () => {
    expect(stepMonthSearchParams("2026-08", 1)).toBe("range=month&month=2026-09");
    expect(stepMonthSearchParams("2026-01", -1)).toBe("range=month&month=2025-12");
  });
});
