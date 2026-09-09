import type { ReactNode } from "react";
import { cn } from "@/lib/cn";

/**
 * The progress row used by "Performance by model", the session win-rate bars,
 * and weekly tag frequency: a 7-8px #f2f4f6 track at radius 99 with a coloured
 * fill sized to the row's share, a name/value line above, and an optional
 * 500 11.5px #b0b8c1 caption below.
 */
const fillTones = {
  gain: "bg-gain",
  loss: "bg-loss",
  /** Neutral emphasis, e.g. session win-rate bars. */
  ink: "bg-ink",
  /** A weak row — the mock drops these to #d1d6db. */
  weak: "bg-disabled",
} as const;

export interface BarRowProps {
  label: ReactNode;
  value?: ReactNode;
  /** 0..1 share of the row's track. */
  share: number;
  tone?: keyof typeof fillTones;
  caption?: ReactNode;
  /** Track height: 8px on the dashboard, 7px for tag frequency. */
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

  return (
    <div className={className}>
      <div className="flex items-baseline justify-between gap-12 text-14 font-semibold text-body">
        <span className="truncate">{label}</span>
        {value !== undefined && <span className="shrink-0">{value}</span>}
      </div>
      <div
        className={cn("mt-8 overflow-hidden rounded-pill bg-divider", height === 7 ? "h-7" : "h-8")}
      >
        <div className={cn("h-full rounded-pill", fillTones[tone])} style={{ width }} />
      </div>
      {caption !== undefined && (
        <div className="mt-8 text-11_5 font-medium text-faint">{caption}</div>
      )}
    </div>
  );
}
