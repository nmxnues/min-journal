import type { DayStats } from "@/lib/domain/stats";

export interface HeatStyle {
  /** Cell background class. */
  fill: string;
  /** Value-text class, or `null` when the cell shows no value at all. */
  text: string | null;
}

/**
 * docs/README.md § Calendar > Heat scale — bucketed on the day's net R:
 *   >= +4R    #f7c5c9 / #d63a48   (gain-tint-3 / gain-deep-2)
 *   +2..+4R   #fbd5d8 / #e03e4c   (gain-tint-2 / gain-deep-1)
 *   >0..+2R   #fdeced / #f04452   (gain-tint-1 / gain)
 *   0 or none #fafbfc / —         (surface-faint, no value rendered)
 *   < 0       #e8f3ff / #3182f6   (loss-tint / loss)
 *
 * A day that traded to exactly breakeven (netR === 0) reads identically to a
 * day with no trades at all — the table's own "0 / no trades" row groups
 * them, and there's nothing meaningful to color or caption either way.
 */
export function heatStyle(day: DayStats | undefined): HeatStyle {
  if (day === undefined || day.tradeCount === 0 || day.netR === 0) {
    return { fill: "bg-surface-faint", text: null };
  }
  if (day.netR < 0) return { fill: "bg-loss-tint", text: "text-loss" };
  if (day.netR >= 4) return { fill: "bg-gain-tint-3", text: "text-gain-deep-2" };
  if (day.netR >= 2) return { fill: "bg-gain-tint-2", text: "text-gain-deep-1" };
  return { fill: "bg-gain-tint-1", text: "text-gain" };
}
