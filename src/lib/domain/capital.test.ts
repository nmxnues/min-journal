import { describe, expect, it } from "vitest";
import {
  availableBalanceOn,
  balanceAsOfDate,
  balanceSeries,
  capitalSeries,
  cashTotals,
  checkCashMovementDeletion,
  currentBalance,
  currentRValue,
  drawdownState,
  filterLedger,
  ledger,
  netDeposits,
  previewCashMovement,
  riskSettingOn,
  rValueAsOfDate,
  rValueForBalance,
  timeWeightedReturn,
  timeline,
  tradingPnL,
  validateWithdrawal,
} from "./capital";
import { makeAccount, makeCashMovement, makeTrade } from "./fixtures";
import type { RiskChange, Trade } from "./types";

/**
 * A closed trade worth exactly `pnl` in currency: 1R is fixed at $1,000 and
 * the exit is moved to produce the R that multiplies out to `pnl`. Callers
 * must not override `exit`/`rValueAtEntry` or the amount stops matching.
 */
function tradeWorth(pnl: number, overrides: Partial<Trade> = {}): Trade {
  const rValueAtEntry = 1_000;
  const r = pnl / rValueAtEntry;
  return makeTrade({
    entry: 100,
    stop: 90, // risk 10
    exit: 100 + r * 10,
    result: r > 0 ? "win" : r < 0 ? "loss" : "be",
    rValueAtEntry,
    ...overrides,
  });
}

describe("timeline ordering", () => {
  it("puts cash movements before trades on the same date", () => {
    const account = makeAccount();
    const deposit = makeCashMovement({ id: "c", date: "2026-05-01" });
    const trade = tradeWorth(100, { id: "t", date: "2026-05-01" });

    expect(timeline([deposit], [trade]).map((e) => e.source.kind)).toEqual(["deposit", "trade"]);
    expect(balanceSeries(account, [deposit], [trade]).map((p) => p.balance)).toEqual([
      10_000, 15_000, 15_100,
    ]);
  });

  it("skips trades that have no exit yet", () => {
    expect(timeline([], [makeTrade({ exit: null })])).toHaveLength(0);
  });
});

describe("1R follows the balance", () => {
  it("is a percentage of the current balance", () => {
    const account = makeAccount({ riskPercent: 1 });
    expect(rValueForBalance(account, 20_000)).toBe(200);
    expect(rValueForBalance(account, 32_180)).toBeCloseTo(321.8, 10); // mock 3a: "$322 = 1R today"
  });

  it("uses the flat amount in fixed mode", () => {
    const account = makeAccount({ riskMode: "fixed", riskPercent: null, fixedRiskAmount: 250 });
    expect(rValueForBalance(account, 20_000)).toBe(250);
    expect(rValueForBalance(account, 5_000)).toBe(250);
  });

  it("drops after a withdrawal", () => {
    const account = makeAccount({ startingCapital: 20_000, riskPercent: 1 });
    expect(currentRValue(account, [], [])).toBe(200);

    const withdrawal = makeCashMovement({ type: "withdrawal", amount: 5_000, date: "2026-06-01" });
    expect(currentBalance(account, [withdrawal], [])).toBe(15_000);
    expect(currentRValue(account, [withdrawal], [])).toBe(150);
  });
});

describe("frozen rValueAtEntry", () => {
  it("is not rewritten by cash recorded afterwards", () => {
    const account = makeAccount({ startingCapital: 15_000, riskPercent: 1 });
    // Logged in March, when 1R was $150.
    const march = makeTrade({
      id: "march",
      date: "2026-03-10",
      entry: 100,
      stop: 90,
      exit: 110, // +1R
      result: "win",
      rValueAtEntry: 150, // 1% of the March balance, frozen at log time
    });
    const beforeDeposit = balanceSeries(account, [], [march]);
    expect(beforeDeposit[beforeDeposit.length - 1].balance).toBe(15_150);

    // A May deposit lifts the balance — and so today's 1R — but not that trade.
    const deposit = makeCashMovement({ amount: 6_000, date: "2026-05-01" });
    const after = balanceSeries(account, [deposit], [march]);

    expect(march.rValueAtEntry).toBe(150);
    expect(after.find((p) => p.event?.source.kind === "trade")!.balance).toBe(15_150);
    expect(after[after.length - 1].balance).toBe(21_150);
    expect(currentRValue(account, [deposit], [march])).toBeCloseTo(211.5, 10);
  });
});

describe("netDeposits / tradingPnL", () => {
  it("counts starting capital as money put in, matching mock 3a", () => {
    // $15,000 opening + $10,000 deposited - $2,500 withdrawn = $22,500 net,
    // and + $9,680 trading = the $32,180 balance the mock shows.
    const account = makeAccount({ startingCapital: 15_000, startedAt: "2026-03-03" });
    const movements = [
      makeCashMovement({ id: "d1", type: "deposit", amount: 6_000, date: "2026-05-01" }),
      makeCashMovement({ id: "d2", type: "deposit", amount: 4_000, date: "2026-06-01" }),
      makeCashMovement({ id: "w1", type: "withdrawal", amount: 2_500, date: "2026-07-01" }),
    ];
    const trades = [tradeWorth(9_680, { date: "2026-08-01" })];

    expect(netDeposits(account, movements)).toBe(22_500);
    // Currency comes out of float maths, so compare to the cent.
    expect(tradingPnL(trades)).toBeCloseTo(9_680, 2);
    expect(currentBalance(account, movements, trades)).toBeCloseTo(32_180, 2);
  });
});

describe("timeWeightedReturn", () => {
  it("chain-links across a deposit so the deposit does not dilute the return", () => {
    // 10,000 -> +1,000 (10%) -> deposit 10,000 -> +2,100 (10% of 21,000).
    const account = makeAccount({ startingCapital: 10_000, startedAt: "2026-01-01" });
    const deposit = makeCashMovement({ amount: 10_000, date: "2026-02-01" });
    const trades = [
      tradeWorth(1_000, { id: "t1", date: "2026-01-15" }),
      tradeWorth(2_100, { id: "t2", date: "2026-03-01" }),
    ];

    expect(timeWeightedReturn(account, [deposit], trades)).toBeCloseTo(0.21, 10);

    // The naive money-weighted view understates it, which is the whole point.
    const finalBalance = currentBalance(account, [deposit], trades);
    expect(finalBalance).toBe(23_100);
    const naive = (finalBalance - netDeposits(account, [deposit])) / netDeposits(account, [deposit]);
    expect(naive).toBeCloseTo(0.155, 10);
  });

  it("is unaffected by a withdrawal", () => {
    const account = makeAccount({ startingCapital: 10_000, startedAt: "2026-01-01" });
    const withdrawal = makeCashMovement({ type: "withdrawal", amount: 5_000, date: "2026-02-01" });
    const trades = [
      tradeWorth(1_000, { id: "t1", date: "2026-01-15" }), // 10% on 10,000
      tradeWorth(600, { id: "t2", date: "2026-03-01" }), // 10% on 6,000
    ];
    expect(timeWeightedReturn(account, [withdrawal], trades)).toBeCloseTo(0.21, 10);
  });

  it("compounds without any cash movements", () => {
    const account = makeAccount({ startingCapital: 10_000, startedAt: "2026-01-01" });
    const trades = [
      tradeWorth(1_000, { id: "t1", date: "2026-01-15" }),
      tradeWorth(1_100, { id: "t2", date: "2026-02-15" }),
    ];
    // One uninterrupted period: 2,100 on 10,000.
    expect(timeWeightedReturn(account, [], trades)).toBeCloseTo(0.21, 10);
  });

  it("is 0 with no trades, however much cash moved", () => {
    const account = makeAccount({ startingCapital: 10_000 });
    expect(timeWeightedReturn(account, [], [])).toBe(0);
    expect(timeWeightedReturn(account, [makeCashMovement({ amount: 50_000 })], [])).toBe(0);
  });

  it("skips a sub-period that starts at a non-positive balance", () => {
    const account = makeAccount({ startingCapital: 0, startedAt: "2026-01-01" });
    const deposit = makeCashMovement({ amount: 1_000, date: "2026-02-01" });
    const trades = [tradeWorth(100, { id: "t", date: "2026-03-01" })];
    expect(timeWeightedReturn(account, [deposit], trades)).toBeCloseTo(0.1, 10);
  });
});

describe("validateWithdrawal", () => {
  it("blocks a withdrawal larger than the balance", () => {
    expect(validateWithdrawal(5_001, 5_000)).toEqual({
      ok: false,
      reason: "exceeds_balance",
      balanceAfter: 5_000,
    });
  });

  it("allows one that empties the account exactly", () => {
    expect(validateWithdrawal(5_000, 5_000)).toEqual({
      ok: true,
      reason: null,
      balanceAfter: 0,
    });
  });

  it("rejects zero, negative, and non-finite amounts", () => {
    expect(validateWithdrawal(0, 100).reason).toBe("not_positive");
    expect(validateWithdrawal(-10, 100).reason).toBe("not_positive");
    expect(validateWithdrawal(Number.NaN, 100).reason).toBe("not_positive");
  });
});

describe("previewCashMovement", () => {
  it("shows where the balance and 1R land", () => {
    const account = makeAccount({ riskPercent: 1 });
    expect(previewCashMovement(account, 26_600, "deposit", 5_000)).toEqual({
      balanceBefore: 26_600,
      balanceAfter: 31_600,
      rValueBefore: 266,
      rValueAfter: 316,
    });
  });
});

describe("drawdownState", () => {
  const account = makeAccount({ startingCapital: 10_000, drawdownLimitPercent: 10 });

  it("measures the drop from peak balance", () => {
    const trades = [
      tradeWorth(2_000, { id: "up", date: "2026-01-10" }),
      tradeWorth(-1_200, { id: "down", date: "2026-02-10" }),
    ];
    const state = drawdownState(account, [], trades);

    expect(state.peakBalance).toBe(12_000);
    expect(state.currentBalance).toBe(10_800);
    expect(state.drawdownAmount).toBe(1_200);
    expect(state.drawdownPercent).toBeCloseTo(10, 10);
    expect(state.limitAmount).toBe(1_200);
    expect(state.hasReachedLimit).toBe(true);
  });

  it("warns once within 2 percentage points of the limit", () => {
    // 8% down on a 10% limit.
    const trades = [tradeWorth(-800, { date: "2026-02-10" })];
    const state = drawdownState(account, [], trades);

    expect(state.drawdownPercent).toBeCloseTo(8, 10);
    expect(state.isNearLimit).toBe(true);
    expect(state.hasReachedLimit).toBe(false);
    expect(state.limitConsumed).toBeCloseTo(0.8, 10);
  });

  it("stays quiet above the warning margin", () => {
    const trades = [tradeWorth(-500, { date: "2026-02-10" })];
    const state = drawdownState(account, [], trades);
    expect(state.drawdownPercent).toBeCloseTo(5, 10);
    expect(state.isNearLimit).toBe(false);
  });

  it("is flat at a new high", () => {
    const state = drawdownState(account, [], [tradeWorth(500, { date: "2026-01-10" })]);
    expect(state.drawdownAmount).toBe(0);
    expect(state.drawdownPercent).toBe(0);
    expect(state.isNearLimit).toBe(false);
  });

  it("matches the mock's stop-trading amount", () => {
    // Peak $32,180 with a −10% limit -> "Stop trading at −$3,218".
    const mockAccount = makeAccount({ startingCapital: 32_180, drawdownLimitPercent: 10 });
    expect(drawdownState(mockAccount, [], []).limitAmount).toBeCloseTo(3_218, 10);
  });
});

describe("ledger", () => {
  it("merges cash and trades newest-first with a running balance", () => {
    const account = makeAccount({ startingCapital: 10_000, startedAt: "2026-01-01" });
    const deposit = makeCashMovement({ id: "d", amount: 5_000, date: "2026-02-01" });
    const trade = tradeWorth(1_000, { id: "t", date: "2026-03-01" });

    const rows = ledger(account, [deposit], [trade]);

    expect(rows.map((r) => r.id)).toEqual(["t", "d", "opening:a1"]);
    expect(rows[0]).toMatchObject({ kind: "trade", amount: 1_000, r: 1, balanceAfter: 16_000 });
    expect(rows[1]).toMatchObject({ kind: "deposit", amount: 5_000, r: null, balanceAfter: 15_000 });
    // Mock 3a's oldest row: "Deposit · Starting capital", synthesised from the account.
    expect(rows[2]).toMatchObject({ kind: "opening", date: "2026-01-01", amount: 10_000, r: null, balanceAfter: 10_000 });
  });

  it("signs withdrawals negative and leaves their R empty", () => {
    const account = makeAccount({ startingCapital: 10_000 });
    const withdrawal = makeCashMovement({ id: "w", type: "withdrawal", amount: 2_500 });
    const [row] = ledger(account, [withdrawal], []);

    expect(row.amount).toBe(-2_500);
    expect(row.r).toBeNull();
    expect(row.balanceAfter).toBe(7_500);
  });
});

function riskChange(effectiveAt: string, overrides: Partial<RiskChange> = {}): RiskChange {
  return {
    id: `r-${effectiveAt}`,
    accountId: "a1",
    effectiveAt: `${effectiveAt}T00:00:00+00:00`,
    riskMode: "percent",
    riskPercent: 1,
    fixedRiskAmount: null,
    createdAt: `${effectiveAt}T00:00:00+00:00`,
    ...overrides,
  };
}

/**
 * Mock 3a's account, rebuilt so its printed milestones reconcile:
 * "Mar · $15,000 · $150 / R", "May · $21,400 · $214 / R",
 * "Jul · $23,940 · $239 / R", "Sep · $32,180 · $322 / R", and the modal's
 * Sep 1 deposit moving 1R "to $316 from $266".
 */
function mockCapital() {
  const account = makeAccount({ startingCapital: 15_000, startedAt: "2026-03-03", riskPercent: 1 });
  const cash = [
    makeCashMovement({ id: "may", type: "deposit", amount: 5_000, date: "2026-05-01" }),
    makeCashMovement({ id: "jul", type: "withdrawal", amount: 2_500, date: "2026-07-15" }),
    makeCashMovement({ id: "sep", type: "deposit", amount: 5_000, date: "2026-09-01" }),
  ];
  const trades = [
    tradeWorth(1_400, { id: "apr", date: "2026-04-10" }),
    tradeWorth(5_040, { id: "jun", date: "2026-06-10" }),
    tradeWorth(2_661, { id: "aug", date: "2026-08-28" }),
    tradeWorth(579, { id: "sep9", date: "2026-09-09" }),
  ];
  return { account, cash, trades, riskChanges: [riskChange("2026-03-03")] };
}

describe("riskSettingOn", () => {
  const account = makeAccount({ riskPercent: 2 });
  const history = [
    riskChange("2026-03-03", { riskPercent: 1 }),
    riskChange("2026-10-01", { riskPercent: 2 }),
  ];

  it("reads the change in force on the date", () => {
    expect(riskSettingOn(account, history, "2026-05-01").riskPercent).toBe(1);
    expect(riskSettingOn(account, history, "2026-10-01").riskPercent).toBe(2);
    expect(riskSettingOn(account, history, "2026-12-01").riskPercent).toBe(2);
  });

  it("falls back to the opening setting before the first change", () => {
    expect(riskSettingOn(account, history, "2026-01-01").riskPercent).toBe(1);
  });

  it("uses the account's own setting when there is no history", () => {
    expect(riskSettingOn(account, [], "2026-05-01").riskPercent).toBe(2);
  });
});

describe("balanceAsOfDate / rValueAsOfDate — the backtest 1R fix", () => {
  // docs/decisions.md § Phase 9 backtest follow-up: entering a full year of
  // one instrument, then a full year of another, into the same account is
  // not chronological insertion order. `currentBalance` (what a "live"
  // account's rValueAtEntry freezes to) would let the *whole first block*
  // inflate the second block's earliest trades' 1R just because those rows
  // already exist in the table — even though, by date, most of them haven't
  // "happened" yet as of the second block's first trade.
  const account = makeAccount({ startingCapital: 10_000, startedAt: "2025-01-01", riskPercent: 1 });

  it("ignores trades dated after the target date, however many are already stored", () => {
    // A full year of EUR, entered first: +$50 every month, Sep 2025 .. Aug 2026.
    const eurTrades = Array.from({ length: 12 }, (_, i) => {
      const month = ((9 - 1 + i) % 12) + 1;
      const year = 2025 + Math.floor((9 - 1 + i) / 12);
      const date = `${year}-${String(month).padStart(2, "0")}-10`;
      return tradeWorth(50, { id: `eur${i}`, date, rValueAtEntry: 1_000 });
    });

    // The first GBP trade, dated *before* almost all of the EUR block above.
    const target = "2025-09-05";
    expect(balanceAsOfDate(account, [], eurTrades, target)).toBe(10_000); // none of the EUR trades count yet
    expect(rValueAsOfDate(account, [], eurTrades, [], target)).toBeCloseTo(100, 10);

    // currentBalance — what a "live" account uses — is the bug: it sums
    // every stored EUR trade regardless of date, inflating the same figure.
    expect(currentBalance(account, [], eurTrades)).toBe(10_600);
    expect(currentRValue(account, [], eurTrades)).toBeCloseTo(106, 10);
  });

  it("still counts same-day-or-earlier trades and cash, in the usual order", () => {
    const trades = [
      tradeWorth(200, { id: "jan", date: "2025-01-15" }),
      tradeWorth(300, { id: "jun", date: "2025-06-15" }),
      tradeWorth(-100, { id: "dec", date: "2025-12-15" }), // after the target — excluded
    ];
    const deposit = makeCashMovement({ amount: 1_000, date: "2025-06-01" });

    expect(balanceAsOfDate(account, [deposit], trades, "2025-06-15")).toBe(10_000 + 200 + 1_000 + 300);
    expect(balanceAsOfDate(account, [deposit], trades, "2025-01-01")).toBe(10_000);
  });

  it("reads the risk setting in force on the target date, not today's", () => {
    const history = [
      { id: "r0", accountId: "a1", effectiveAt: "2025-01-01T00:00:00Z", riskMode: "percent" as const, riskPercent: 1, fixedRiskAmount: null, createdAt: "2025-01-01T00:00:00Z" },
      { id: "r1", accountId: "a1", effectiveAt: "2025-07-01T00:00:00Z", riskMode: "percent" as const, riskPercent: 2, fixedRiskAmount: null, createdAt: "2025-07-01T00:00:00Z" },
    ];
    const changedToday = { ...account, riskPercent: 2 };
    // Balance is flat at 10,000 throughout — only the risk % differs.
    expect(rValueAsOfDate(changedToday, [], [], history, "2025-03-01")).toBeCloseTo(100, 10); // 1% was in force then
    expect(rValueAsOfDate(changedToday, [], [], history, "2025-08-01")).toBeCloseTo(200, 10); // 2% by then
  });
});

describe("changing the risk setting applies to future trades only", () => {
  it("leaves past 1R points, past trade P&L and rValueAtEntry untouched", () => {
    const { account, cash, trades, riskChanges } = mockCapital();
    const before = ledger(account, cash, trades, riskChanges);

    // October: 1% -> 2%. The account row now carries 2%; history keeps both.
    const changedAccount = { ...account, riskPercent: 2 };
    const changedHistory = [...riskChanges, riskChange("2026-10-01", { riskPercent: 2 })];
    const after = ledger(changedAccount, cash, trades, changedHistory);

    expect(after.map((e) => [e.amount, e.balanceAfter, e.rValueAfter])).toEqual(
      before.map((e) => [e.amount, e.balanceAfter, e.rValueAfter]),
    );
    expect(trades.map((t) => t.rValueAtEntry)).toEqual([1_000, 1_000, 1_000, 1_000]);

    const series = balanceSeries(changedAccount, cash, trades, changedHistory);
    expect(series[0]).toMatchObject({ date: "2026-03-03", balance: 15_000, rValue: 150 });

    // The next trade logged is the one that picks up 2%.
    expect(currentRValue(changedAccount, cash, trades)).toBeCloseTo(643.6, 2);
  });
});

describe("capitalSeries", () => {
  it("reconciles with mock 3a's 1R history", () => {
    const { account, cash, trades, riskChanges } = mockCapital();
    const milestones = capitalSeries(account, cash, trades, riskChanges, "2026-09-11")
      .filter((p) => p.marker !== null)
      .map((p) => [p.marker, p.date, Math.round(p.balance), Math.round(p.rValue)]);

    expect(milestones).toEqual([
      ["start", "2026-03-03", 15_000, 150],
      ["deposit", "2026-05-01", 21_400, 214],
      ["withdrawal", "2026-07-15", 23_940, 239],
      ["deposit", "2026-09-01", 31_601, 316],
      ["today", "2026-09-11", 32_180, 322],
    ]);
  });

  it("doesn't repeat a milestone that already falls on today", () => {
    const { account, cash, trades, riskChanges } = mockCapital();
    const todayDeposit = makeCashMovement({ id: "today", amount: 1_000, date: "2026-09-11" });
    const markers = capitalSeries(account, [...cash, todayDeposit], trades, riskChanges, "2026-09-11")
      .filter((p) => p.date === "2026-09-11" && p.marker !== null)
      .map((p) => p.marker);
    expect(markers).toEqual(["deposit"]);
  });

  it("draws each cash movement as a step: two points on the same date", () => {
    const { account, cash, trades, riskChanges } = mockCapital();
    const may = capitalSeries(account, cash, trades, riskChanges, "2026-09-11").filter(
      (p) => p.date === "2026-05-01",
    );
    expect(may.map((p) => [Math.round(p.balance), p.marker])).toEqual([
      [16_400, null],
      [21_400, "deposit"],
    ]);
  });

  it("steps the 1R line at a risk change without moving the balance", () => {
    const { account, cash, trades } = mockCapital();
    const history = [riskChange("2026-03-03"), riskChange("2026-06-01", { riskPercent: 2 })];
    const june = capitalSeries({ ...account, riskPercent: 2 }, cash, trades, history, "2026-09-11").filter(
      (p) => p.date === "2026-06-01",
    );
    expect(june.map((p) => [p.balance, p.rValue, p.marker])).toEqual([
      [21_400, 214, null],
      [21_400, 428, "risk"],
    ]);
  });
});

describe("drawdownState moves its peak with cash", () => {
  const account = makeAccount({ startingCapital: 10_000, drawdownLimitPercent: 10 });

  it("does not read a withdrawal of profit as a drawdown", () => {
    const trades = [tradeWorth(2_000, { id: "up", date: "2026-01-10" })];
    const withdrawal = makeCashMovement({ type: "withdrawal", amount: 2_000, date: "2026-02-01" });
    const state = drawdownState(account, [withdrawal], trades);

    expect(state.currentBalance).toBe(10_000);
    expect(state.peakBalance).toBe(10_000);
    expect(state.drawdownAmount).toBe(0);
    expect(state.isNearLimit).toBe(false);
  });

  it("keeps a loss already taken when a deposit lands mid-drawdown", () => {
    const trades = [tradeWorth(-900, { id: "down", date: "2026-01-10" })];
    const deposit = makeCashMovement({ amount: 5_000, date: "2026-02-01" });
    const state = drawdownState(account, [deposit], trades);

    expect(state.peakBalance).toBe(15_000);
    expect(state.currentBalance).toBe(14_100);
    expect(state.drawdownAmount).toBe(900);
    expect(state.drawdownPercent).toBeCloseTo(6, 10);
  });

  it("still reaches the limit on trading losses after a withdrawal", () => {
    const withdrawal = makeCashMovement({ type: "withdrawal", amount: 5_000, date: "2026-01-05" });
    const trades = [tradeWorth(-500, { date: "2026-01-10" })];
    const state = drawdownState(account, [withdrawal], trades);

    expect(state.peakBalance).toBe(5_000);
    expect(state.drawdownPercent).toBeCloseTo(10, 10);
    expect(state.hasReachedLimit).toBe(true);
  });
});

describe("availableBalanceOn", () => {
  const account = makeAccount({ startingCapital: 10_000, startedAt: "2026-01-01" });

  it("is today's balance for a withdrawal dated today", () => {
    const trades = [tradeWorth(1_000, { date: "2026-02-01" })];
    expect(availableBalanceOn(account, [], trades, "2026-09-11")).toBe(11_000);
  });

  it("stops a backdated withdrawal from overdrawing a later point", () => {
    // 10,000 -> withdraw 9,000 in March -> 1,000. A 5,000 withdrawal dated
    // February would leave March at −4,000, even though February itself had 10,000.
    const march = makeCashMovement({ id: "m", type: "withdrawal", amount: 9_000, date: "2026-03-01" });
    const available = availableBalanceOn(account, [march], [], "2026-02-01");

    expect(available).toBe(1_000);
    expect(validateWithdrawal(5_000, available).reason).toBe("exceeds_balance");
    expect(validateWithdrawal(1_000, available).ok).toBe(true);
  });

  it("slots before that day's trades, which a same-day withdrawal must also survive", () => {
    const loss = tradeWorth(-4_000, { date: "2026-02-01" });
    expect(availableBalanceOn(account, [], [loss], "2026-02-01")).toBe(6_000);
  });
});

describe("checkCashMovementDeletion", () => {
  const account = makeAccount({ startingCapital: 1_000, startedAt: "2026-01-01" });
  const deposit = makeCashMovement({ id: "d", type: "deposit", amount: 5_000, date: "2026-02-01" });
  const withdrawal = makeCashMovement({ id: "w", type: "withdrawal", amount: 4_000, date: "2026-03-01" });

  it("refuses to delete a deposit a later withdrawal depends on", () => {
    expect(checkCashMovementDeletion(account, [deposit, withdrawal], [], "d")).toEqual({
      ok: false,
      reason: "would_overdraw",
    });
  });

  it("allows deleting a deposit nothing depends on, and any withdrawal", () => {
    const small = makeCashMovement({ id: "w", type: "withdrawal", amount: 500, date: "2026-03-01" });
    expect(checkCashMovementDeletion(account, [deposit, small], [], "d").ok).toBe(true);
    expect(checkCashMovementDeletion(account, [deposit, withdrawal], [], "w").ok).toBe(true);
    expect(checkCashMovementDeletion(account, [deposit], [], "missing").reason).toBe("not_found");
  });
});

describe("ledger 1R shift and filters", () => {
  it("carries the modal's '1R moves to $316 from $266' on the Sep 1 deposit", () => {
    const { account, cash, trades, riskChanges } = mockCapital();
    const row = ledger(account, cash, trades, riskChanges).find((e) => e.id === "sep")!;
    expect(Math.round(row.rValueBefore)).toBe(266);
    expect(Math.round(row.rValueAfter)).toBe(316);
  });

  it("counts the opening balance as cash", () => {
    const { account, cash, trades } = mockCapital();
    const rows = ledger(account, cash, trades);
    expect(filterLedger(rows, "all")).toHaveLength(8);
    expect(filterLedger(rows, "cash").map((e) => e.kind)).toEqual(["deposit", "withdrawal", "deposit", "opening"]);
    expect(filterLedger(rows, "trades")).toHaveLength(4);
  });

  it("totals money in and out the way mock 3a's chips and sub-line read", () => {
    const { account, cash } = mockCapital();
    expect(cashTotals(account, cash)).toEqual({ deposited: 25_000, withdrawn: 2_500, inCount: 3, outCount: 1 });
  });
});
