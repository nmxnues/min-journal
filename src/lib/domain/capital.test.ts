import { describe, expect, it } from "vitest";
import {
  balanceSeries,
  currentBalance,
  currentRValue,
  drawdownState,
  ledger,
  netDeposits,
  previewCashMovement,
  rValueForBalance,
  timeWeightedReturn,
  timeline,
  tradingPnL,
  validateWithdrawal,
} from "./capital";
import { makeAccount, makeCashMovement, makeTrade } from "./fixtures";
import type { Trade } from "./types";

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

    expect(rows.map((r) => r.id)).toEqual(["t", "d"]);
    expect(rows[0]).toMatchObject({ kind: "trade", amount: 1_000, r: 1, balanceAfter: 16_000 });
    expect(rows[1]).toMatchObject({ kind: "deposit", amount: 5_000, r: null, balanceAfter: 15_000 });
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
