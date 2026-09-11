import type { Account, CashMovement, Trade, TradeModel } from "./types";

/** Test/dev builders. Defaults describe a plain on-plan long. */
export function makeTrade(overrides: Partial<Trade> = {}): Trade {
  return {
    id: "t1",
    accountId: "a1",
    date: "2026-09-09",
    instrument: "NQ",
    direction: "long",
    session: "ny_am",
    htfPairing: "w_2d",
    rangeHigh: 100,
    rangeLow: 0,
    sweepSide: "low",
    entry: 10,
    stop: 5,
    target: 90,
    exit: 40,
    size: 1,
    modelId: "m1",
    confirmation: null,
    result: "win",
    exitReason: null,
    holdMinutes: 38,
    rValueAtEntry: 100,
    tags: [],
    notes: null,
    createdAt: "2026-09-09T12:00:00.000Z",
    updatedAt: "2026-09-09T12:00:00.000Z",
    ...overrides,
  };
}

export function makeAccount(overrides: Partial<Account> = {}): Account {
  return {
    id: "a1",
    name: "Main",
    currency: "USD",
    startingCapital: 10_000,
    startedAt: "2026-03-03",
    riskMode: "percent",
    riskPercent: 1,
    fixedRiskAmount: null,
    drawdownLimitPercent: 10,
    kind: "live",
    ...overrides,
  };
}

export function makeCashMovement(overrides: Partial<CashMovement> = {}): CashMovement {
  return {
    id: "c1",
    accountId: "a1",
    date: "2026-05-01",
    type: "deposit",
    amount: 5_000,
    currency: "USD",
    note: null,
    createdAt: "2026-05-01T09:00:00.000Z",
    ...overrides,
  };
}

export function makeModel(overrides: Partial<TradeModel> = {}): TradeModel {
  return {
    id: "m1",
    name: "C2 sweep to expansion",
    description: null,
    rules: [],
    status: "active",
    sortOrder: 0,
    referenceImagePath: null,
    ...overrides,
  };
}
