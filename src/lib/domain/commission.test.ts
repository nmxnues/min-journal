import { describe, expect, it } from "vitest";
import {
  assignBacktestRValues,
  currentBalance,
  drawdownState,
  ledger,
  timeWeightedReturn,
  tradingCommission,
  tradingPnL,
  tradingSwap,
} from "./capital";
import { makeAccount, makeTrade } from "./fixtures";
import {
  avgLoss,
  avgWin,
  dailyNetR,
  equityCurve,
  expectancy,
  moneyStats,
  netR,
  periodStats,
  ruleAdherence,
  winRate,
} from "./stats";
import { captureRate, commissionAmount, commissionForSize, commissionR, pnlAmount, pricePnlAmount } from "./trade";
import type { Trade } from "./types";

/** makeTrade's 1R is $100, so R and dollars are easy to read side by side. */
function tradeWithR(r: number, overrides: Partial<Trade> = {}): Trade {
  return makeTrade({
    entry: 100,
    stop: 90, // risk 10
    exit: 100 + r * 10,
    result: r > 0 ? "win" : r < 0 ? "loss" : "be",
    ...overrides,
  });
}

describe("per-trade commission", () => {
  it("nets price + swap − entry − exit commission", () => {
    // +2R at $100/R = +$200 price, −$18.40 swap, $7 + $7 commission.
    const t = tradeWithR(2, { swap: -18.4, entryCommission: 7, exitCommission: 7 });
    expect(pricePnlAmount(t)).toBe(200);
    expect(commissionAmount(t)).toBe(14);
    expect(pnlAmount(t)).toBeCloseTo(167.6, 10);
  });

  it("is a no-op at 0, so every pre-commission trade keeps its figure", () => {
    const before = tradeWithR(1.5, { swap: -3 });
    expect(pnlAmount({ ...before, entryCommission: 0, exitCommission: 0 })).toBe(pnlAmount(before));
    expect(pnlAmount(before)).toBe(147);
  });

  it("keeps an open trade's P&L null regardless of commission", () => {
    expect(pnlAmount(tradeWithR(0, { exit: null, entryCommission: 7, exitCommission: 0 }))).toBeNull();
  });

  it("reports commission in R against the trade's own frozen 1R", () => {
    expect(commissionR(tradeWithR(1, { entryCommission: 5, exitCommission: 5 }))).toBeCloseTo(0.1, 10);
  });

  it("never moves captureRate, which stays price-based", () => {
    const t = tradeWithR(2, { target: 130 }); // planned 3R
    const charged: Trade = { ...t, entryCommission: 50, exitCommission: 50 };
    expect(captureRate(charged)).toBe(captureRate(t));
  });
});

describe("commissionForSize — the Settings prefill", () => {
  it("is size × the one-way rate, to the cent", () => {
    expect(commissionForSize(1, 3.5)).toBe(3.5);
    expect(commissionForSize(2.35, 3.5)).toBe(8.23); // 8.225 rounds half up
    expect(commissionForSize(0.01, 3.5)).toBe(0.04); // 0.035
  });

  it("returns null rather than 0 while there's nothing to prefill", () => {
    expect(commissionForSize(null, 3.5)).toBeNull();
    expect(commissionForSize(0, 3.5)).toBeNull();
    expect(commissionForSize(1, 0)).toBeNull();
    expect(commissionForSize(Number.NaN, 3.5)).toBeNull();
  });
});

describe("commission and the R axis", () => {
  /** Same guarantee as swap: charging commission must not move a single R statistic. */
  const prices = [tradeWithR(2), tradeWithR(-1), tradeWithR(3), tradeWithR(0)];
  const charged = prices.map((t, i) => ({ ...t, entryCommission: 3.5 * (i + 1), exitCommission: 3.5 * (i + 1) }));

  it("leaves every R metric identical", () => {
    expect(netR(charged)).toBe(netR(prices));
    expect(expectancy(charged)).toBe(expectancy(prices));
    expect(avgWin(charged)).toBe(avgWin(prices));
    expect(avgLoss(charged)).toBe(avgLoss(prices));
    expect(winRate(charged)).toBe(winRate(prices));
    expect(ruleAdherence(charged)).toBe(ruleAdherence(prices));
    expect(equityCurve(charged)).toEqual(equityCurve(prices));
    expect(dailyNetR(charged)).toEqual(dailyNetR(prices));
    expect(periodStats(charged)).toEqual(periodStats(prices));
  });
});

describe("moneyStats — stats on net P&L", () => {
  it("computes total, win rate and averages on price + swap − commission", () => {
    const trades = [
      tradeWithR(2, { entryCommission: 7, exitCommission: 7 }), //  200 − 14 = 186
      tradeWithR(-1, { entryCommission: 7, exitCommission: 7 }), // −100 − 14 = −114
      // Price break-even that paid commission: a net loss, though `result` says "be".
      tradeWithR(0, { entryCommission: 3.5, exitCommission: 3.5 }), // −7
      tradeWithR(1, { swap: -20, entryCommission: 7, exitCommission: 7 }), // 100 − 20 − 14 = 66
    ];
    const s = moneyStats(trades);
    expect(s.closedCount).toBe(4);
    expect(s.netPnl).toBeCloseTo(131, 10);
    expect(s.totalCommission).toBe(49);
    expect(s.totalSwap).toBe(-20);
    expect(s.netWinRate).toBe(0.5); // 2 net wins, 2 net losses
    expect(s.avgNetPnl).toBeCloseTo(32.75, 10);
    expect(s.avgNetWin).toBeCloseTo(126, 10);
    expect(s.avgNetLoss).toBeCloseTo(-60.5, 10);

    // Price-based win rate (from `result`) still excludes the "be" trade: 2 of 3.
    expect(winRate(trades)).toBeCloseTo(2 / 3, 10);
  });

  it("reconciles exactly with the Capital figures", () => {
    const trades = [
      tradeWithR(2, { swap: -5, entryCommission: 7, exitCommission: 7 }),
      tradeWithR(-1, { entryCommission: 3.5, exitCommission: 3.5 }),
    ];
    const s = moneyStats(trades);
    expect(s.netPnl).toBe(tradingPnL(trades));
    expect(s.totalSwap).toBe(tradingSwap(trades));
    expect(s.totalCommission).toBe(tradingCommission(trades));
  });

  it("skips open trades and leaves a flat net P&L out of the win rate", () => {
    const s = moneyStats([
      tradeWithR(0, { exit: null, result: null, entryCommission: 7 }),
      tradeWithR(0), // flat, no costs
      tradeWithR(1),
    ]);
    expect(s.closedCount).toBe(2);
    expect(s.totalCommission).toBe(0);
    expect(s.netWinRate).toBe(1);
    expect(s.avgNetPnl).toBe(50); // the flat trade still dilutes the average
  });

  it("is all-null on no closed trades", () => {
    const s = moneyStats([]);
    expect(s).toMatchObject({ closedCount: 0, netPnl: 0, netWinRate: null, avgNetPnl: null });
  });
});

describe("commission on the money axis", () => {
  const account = makeAccount({ startingCapital: 10_000, startedAt: "2026-01-01", riskPercent: 1 });

  it("lowers the balance, drawdown and TWR as a trading cost, not a cash flow", () => {
    const flat = tradeWithR(0, { date: "2026-02-01", entryCommission: 50, exitCommission: 50 });
    expect(currentBalance(account, [], [flat])).toBe(9_900);
    expect(tradingCommission([flat])).toBe(100);
    const dd = drawdownState(account, [], [flat]);
    expect(dd.peakBalance).toBe(10_000);
    expect(dd.drawdownAmount).toBe(100);
    expect(timeWeightedReturn(account, [], [flat])).toBeCloseTo(-0.01, 10);
  });

  it("keeps one ledger row per trade with the commission split out", () => {
    const t = tradeWithR(5, { id: "t-c", date: "2026-02-01", swap: -40, entryCommission: 7, exitCommission: 7 });
    const rows = ledger(account, [], [t]);
    expect(rows).toHaveLength(2);
    const row = rows.find((e) => e.id === "t-c")!;
    expect(row.amount).toBeCloseTo(446, 10);
    expect(row.pricePnl).toBe(500);
    expect(row.swap).toBe(-40);
    expect(row.commission).toBe(14);
    expect(row.r).toBeCloseTo(5, 10);
  });

  it("does not move the balance for an open trade", () => {
    const open = tradeWithR(0, { date: "2026-02-01", exit: null, result: null, entryCommission: 7 });
    expect(currentBalance(account, [], [open])).toBe(10_000);
    expect(tradingCommission([open])).toBe(0);
  });

  it("folds CSV-row commission into the backtest balance walk", () => {
    const backtest = makeAccount({ kind: "backtest", startingCapital: 10_000, startedAt: "2026-01-01", riskPercent: 1 });
    const row = (date: string, extra: { entryCommission?: number; exitCommission?: number } = {}) => ({
      date,
      direction: "long" as const,
      entry: 100,
      stop: 90,
      exit: 100, // flat on price
      rValueAtEntry: null,
      swap: null,
      ...extra,
    });
    const [, second] = assignBacktestRValues(backtest, [], [], [], [
      row("2026-02-01", { entryCommission: 500, exitCommission: 500 }),
      row("2026-02-02"),
    ]);
    // The first row's $1,000 commission leaves $9,000, so 1% is $90.
    expect(second).toBeCloseTo(90, 10);
  });
});
