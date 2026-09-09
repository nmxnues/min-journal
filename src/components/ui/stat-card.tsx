import type { ReactNode } from "react";
import { cn } from "@/lib/cn";

/**
 * docs/README.md § Dashboard > Stat cards: "label 600 13px #8b95a1; value
 * 800 30px, letter-spacing -.03em, 6px above-gap", card radius 20 padding
 * 22/24. The weekly review row uses the same 30px value. The calendar
 * summary row (§ Calendar) uses a smaller 26px value with NO letter-spacing
 * — confirmed from the canvas markup, which omits the property entirely at
 * that size (present at every larger size). Sub-line sits with no extra
 * margin beyond normal line spacing, matching the mock.
 */
const valueVariants = {
  /** Calendar summary row: 26px, no letter-spacing. */
  sm: "text-26 font-extrabold",
  /** Everywhere else (dashboard, weekly review, capital): 30px, -.03em. */
  lg: "text-30 font-extrabold tracking-[-.03em]",
} as const;

const valueTones = {
  ink: "text-ink",
  gain: "text-gain",
  loss: "text-loss",
} as const;

export interface StatCardProps {
  label: ReactNode;
  value: ReactNode;
  sub?: ReactNode;
  tone?: keyof typeof valueTones;
  size?: keyof typeof valueVariants;
  className?: string;
}

export function StatCard({
  label,
  value,
  sub,
  tone = "ink",
  size = "lg",
  className,
}: StatCardProps) {
  return (
    <div className={cn("rounded-20 bg-surface px-24 py-22", className)}>
      <div className="text-13 font-semibold text-muted">{label}</div>
      <div className={cn("mt-6", valueVariants[size], valueTones[tone])}>{value}</div>
      {sub !== undefined && <div className="text-11_5 font-medium text-faint">{sub}</div>}
    </div>
  );
}
