import type { ReactNode } from "react";
import { cn } from "@/lib/cn";

/**
 * The progress row used by "Performance by model", session/sweep win-rate
 * bars, and weekly tag frequency. Two distinct specs read from the canvas,
 * not one shared guess:
 *
 * - 8px track (model rows, win-rate bars): label 600 14px, bar margin-top 8px.
 * - 7px track (weekly tag frequency): label 600 13.5px, bar margin-top 7px.
 *
 * A caption line below the bar (only the model rows have one) sits at
 * margin-top 6px, not 8 — confirmed from the canvas markup, which sets the
 * bar's own margin-top equal to its height but the caption's separately.
 */
const fillTones = {
  gain: "bg-gain",
  loss: "bg-loss",
  /** Neutral emphasis, e.g. session win-rate bars. */
  ink: "bg-ink",
  /** A weak row — the mock drops these to #d1d6db. */
  weak: "bg-disabled",
} as const;

const heightVariants = {
  8: { track: "h-8", barMarginTop: "mt-8", label: "text-14" },
  7: { track: "h-7", barMarginTop: "mt-7", label: "text-13_5" },
} as const;

export interface BarRowProps {
  label: ReactNode;
  value?: ReactNode;
  /** 0..1 share of the row's track. */
  share: number;
  tone?: keyof typeof fillTones;
  caption?: ReactNode;
  /** Track height: 8px (model rows, win-rate bars) or 7px (tag frequency). */
  height?: 7 | 8;
  className?: string;
}

export function BarRow({
  label,
  value,
  share,
  tone = "ink",
  caption,
  height = 8,
  className,
}: BarRowProps) {
  const width = `${Math.max(0, Math.min(1, share)) * 100}%`;
  const variant = heightVariants[height];

  return (
    <div className={className}>
      <div
        className={cn(
          "flex items-baseline justify-between gap-12 font-semibold text-body",
          variant.label,
        )}
      >
        <span className="truncate">{label}</span>
        {value !== undefined && <span className="shrink-0">{value}</span>}
      </div>
      <div className={cn("overflow-hidden rounded-pill bg-divider", variant.track, variant.barMarginTop)}>
        <div className={cn("h-full rounded-pill", fillTones[tone])} style={{ width }} />
      </div>
      {caption !== undefined && (
        <div className="mt-6 text-11_5 font-medium text-faint">{caption}</div>
      )}
    </div>
  );
}
