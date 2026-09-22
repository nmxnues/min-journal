"use client";

import { useState } from "react";
import { commissionForSize } from "@/lib/domain/trade";
import { parseNumberInput } from "@/lib/format";

export type CommissionSide = "entryCommission" | "exitCommission";

const SIDES: readonly CommissionSide[] = ["entryCommission", "exitCommission"];

/** The prefill as the form's own string value, or null when there is nothing to fill yet. */
export function commissionPrefill(sizeRaw: string, perLotPerSide: number): string | null {
  const value = commissionForSize(parseNumberInput(sizeRaw), perLotPerSide);
  return value === null ? null : String(value);
}

/**
 * Whether a side should start out "manual": any value that isn't what the
 * prefill would produce for this size. Blank is never manual — there's
 * nothing of the trader's to protect yet.
 */
export function startsManual(value: string, sizeRaw: string, perLotPerSide: number): boolean {
  return value !== "" && value !== commissionPrefill(sizeRaw, perLotPerSide);
}

/**
 * Size-driven prefill for the two commission fields (docs/decisions.md §
 * Commission). Typing a size writes `size * perLotPerSide` into each side the
 * trader hasn't edited by hand; once a side is edited it is "manual" and a
 * later size change leaves it alone, until `reset` hands it back.
 *
 * A side starts manual whenever its current value isn't what the prefill
 * would produce — a restored draft someone had already corrected, or an
 * existing trade whose stored commission (0 on every pre-commission row)
 * differs from today's rate. So opening an old trade never silently rewrites
 * its commission; the trader applies the rate with `reset` if they want it.
 */
export function useCommissionPrefill({
  perLotPerSide,
  initial,
  setCommission,
}: {
  perLotPerSide: number;
  initial: { size: string; entryCommission: string; exitCommission: string };
  setCommission: (side: CommissionSide, value: string) => void;
}) {
  const [manual, setManual] = useState<Record<CommissionSide, boolean>>(() => ({
    entryCommission: startsManual(initial.entryCommission, initial.size, perLotPerSide),
    exitCommission: startsManual(initial.exitCommission, initial.size, perLotPerSide),
  }));

  return {
    enabled: perLotPerSide > 0,
    isManual: (side: CommissionSide) => manual[side],
    /** Wire to the size input's onChange. */
    onSizeChange(sizeRaw: string) {
      const auto = commissionPrefill(sizeRaw, perLotPerSide);
      if (auto === null) return;
      for (const side of SIDES) if (!manual[side]) setCommission(side, auto);
    },
    /** Wire to each commission input's onChange. */
    markManual(side: CommissionSide) {
      setManual((m) => (m[side] ? m : { ...m, [side]: true }));
    },
    /** Put a side back on the prefill for the given size. */
    reset(side: CommissionSide, sizeRaw: string) {
      const auto = commissionPrefill(sizeRaw, perLotPerSide);
      setManual((m) => ({ ...m, [side]: false }));
      setCommission(side, auto ?? "");
    },
  };
}
