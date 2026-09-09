import type { ReactNode } from "react";
import { cn } from "@/lib/cn";

/**
 * docs/README.md § Dashboard > Stat cards: "label 600 13px #8b95a1; value
 * 800 30px, letter-spacing -.03em, 6px above-gap", card radius 20 padding
 * 22/24. The weekly review and capital rows use the same card with a
 * 500 11.5px #b0b8c1 sub-line, and the calendar summary uses 26px values.
 */
const valueTones = {
  ink: "text-ink",
  gain: "text-gain",
  loss: "text-loss",
} as const;

const valueSizes = {
  md: "text-26",
  lg: "text-30",
} as const;

export interface StatCardProps {
  label: ReactNode;
  value: ReactNode;
  sub?: ReactNode;
  tone?: keyof typeof valueTones;
  size?: keyof typeof valueSizes;
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
      <div
        className={cn(
          "mt-6 font-extrabold tracking-[-.03em]",
          valueSizes[size],
          valueTones[tone],
        )}
      >
        {value}
      </div>
      {sub !== undefined && <div className="text-11_5 font-medium text-faint">{sub}</div>}
    </div>
  );
}
