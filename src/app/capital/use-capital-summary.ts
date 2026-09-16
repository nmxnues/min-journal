import { useMemo } from "react";
import {
  capitalSeries,
  cashTotals,
  currentBalance,
  currentRValue,
  drawdownState,
  ledger,
  netDeposits,
  timeWeightedReturn,
  tradingPnL,
  tradingSwap,
} from "@/lib/domain/capital";
import { netR, netSwapR } from "@/lib/domain/stats";
import type { Account, CashMovement, IsoDate, RiskChange, Trade, TradeModel } from "@/lib/domain/types";

export interface CapitalData {
  account: Account;
  /** Every account this user has, for the account switcher — includes `account` itself. */
  allAccounts: Account[];
  trades: Trade[];
  cashMovements: CashMovement[];
  riskChanges: RiskChange[];
  models: TradeModel[];
  today: IsoDate;
}

/** Every figure the Capital screen shows, derived once per data load — desktop and mobile read the same object. */
export function useCapitalSummary(data: CapitalData) {
  return useMemo(() => {
    const { account, trades, cashMovements, riskChanges, today } = data;
    const series = capitalSeries(account, cashMovements, trades, riskChanges, today);

    return {
      series,
      /** The "1R history" rows: start, each cash movement, each risk change, today. */
      milestones: series.filter((p) => p.marker !== null),
      entries: ledger(account, cashMovements, trades, riskChanges),
      balance: currentBalance(account, cashMovements, trades),
      rValueToday: currentRValue(account, cashMovements, trades),
      totals: cashTotals(account, cashMovements),
      netDeposits: netDeposits(account, cashMovements),
      tradingPnL: tradingPnL(trades),
      /** The swap already inside `tradingPnL`, broken out so the screen can say where the figure came from. */
      tradingSwap: tradingSwap(trades),
      tradingSwapR: netSwapR(trades),
      lifetimeR: netR(trades),
      timeWeightedReturn: timeWeightedReturn(account, cashMovements, trades),
      drawdown: drawdownState(account, cashMovements, trades),
      modelNameById: new Map(data.models.map((m) => [m.id, m.name])),
    };
  }, [data]);
}

export type CapitalSummary = ReturnType<typeof useCapitalSummary>;

export interface CapitalScreenProps {
  data: CapitalData;
  summary: CapitalSummary;
  onRecordCash: () => void;
}
