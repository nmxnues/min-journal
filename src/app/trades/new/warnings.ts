import { offPlan, realizedR } from "@/lib/domain/trade";
import type { Direction, SweepSide, TradeResult } from "@/lib/domain/types";

/**
 * Everything that is worth saying but not worth blocking on
 * (docs/decisions.md § Phase 4a). Blocking is reserved for what the database
 * itself refuses; these are judgement calls the trader is allowed to overrule,
 * so they render beside the field and never stop a save.
 *
 * Deliberately NOT included: a future-set date. It's a rare slip, and a form
 * that cries wolf gets every warning ignored.
 */
export type WarningCode =
  | "target_wrong_side"
  | "entry_outside_range"
  | "off_plan"
  | "retired_model"
  | "result_disagrees_with_exit"
  | "drawdown_near_limit";

export interface WarningInput {
  direction: Direction;
  entry: number | null;
  stop: number | null;
  target: number | null;
  exit: number | null;
  rangeHigh: number | null;
  rangeLow: number | null;
  sweepSide: SweepSide | null;
  result: TradeResult | null;
  modelIsRetired: boolean;
  accountIsNearDrawdownLimit: boolean;
}

export function collectWarnings(input: WarningInput): WarningCode[] {
  const warnings: WarningCode[] = [];
  const { entry, stop, target, exit, rangeHigh, rangeLow } = input;

  // docs/README.md § Validation: "target on the opposite side of entry from
  // stop (warn, don't block)".
  if (entry !== null && stop !== null && target !== null && stop !== entry) {
    const stopIsBelow = stop < entry;
    const targetIsAbove = target > entry;
    if (stopIsBelow !== targetIsAbove) warnings.push("target_wrong_side");
  }

  // An entry on the sweep wick outside the range is legitimate, just unusual.
  if (entry !== null && rangeHigh !== null && rangeLow !== null) {
    if (entry < rangeLow || entry > rangeHigh) warnings.push("entry_outside_range");
  }

  if (
    input.sweepSide !== null &&
    entry !== null &&
    rangeHigh !== null &&
    rangeLow !== null &&
    offPlan({ sweepSide: input.sweepSide, entry, rangeHigh, rangeLow })
  ) {
    warnings.push("off_plan");
  }

  // Phase 2 decided model retirement never rewrites history; it surfaces here,
  // at log time, instead.
  if (input.modelIsRetired) warnings.push("retired_model");

  // A "win" that priced out negative is usually a typo — but a scratch that
  // landed a few ticks off is exactly what 'be' is for, so 'be' never warns.
  if (
    input.result !== null &&
    input.result !== "be" &&
    entry !== null &&
    stop !== null &&
    exit !== null
  ) {
    const r = realizedR({ entry, stop, exit, direction: input.direction });
    if (r !== null) {
      if (input.result === "win" && r < 0) warnings.push("result_disagrees_with_exit");
      if (input.result === "loss" && r > 0) warnings.push("result_disagrees_with_exit");
    }
  }

  // docs/README.md § Capital: the guard "warns in the trade form when the
  // account is within 2% of the limit".
  if (input.accountIsNearDrawdownLimit) warnings.push("drawdown_near_limit");

  return warnings;
}
