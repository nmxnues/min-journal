"use client";

import { Check } from "lucide-react";
import { cn } from "@/lib/cn";

/**
 * docs/README.md § New trade > Field styling: "equal flex, radius 12, 12px
 * vertical padding, 8px gap; unselected #f2f4f6 with 600 14px #8b95a1,
 * selected #e8f3ff with 700 14px #3182f6."
 *
 * `tone` per option covers the Result control, whose selected Win state is
 * the gain colour (#f04452 on #fdeced) rather than the accent.
 */
export type SegmentedTone = "accent" | "gain" | "loss";

const selectedTones: Record<SegmentedTone, string> = {
  accent: "bg-accent-tint text-accent",
  gain: "bg-gain-tint-1 text-gain",
  loss: "bg-loss-tint text-loss",
};

export interface SegmentedOption<T extends string> {
  value: T;
  label: string;
  tone?: SegmentedTone;
}

export interface SegmentedProps<T extends string> {
  options: readonly SegmentedOption<T>[];
  value: T | null;
  onChange: (value: T) => void;
  /** Renders a trailing check on the selected option (mobile option rows). */
  showCheck?: boolean;
  name?: string;
  className?: string;
}

export function Segmented<T extends string>({
  options,
  value,
  onChange,
  showCheck = false,
  name,
  className,
}: SegmentedProps<T>) {
  return (
    <div role="radiogroup" aria-label={name} className={cn("flex gap-8", className)}>
      {options.map((option) => {
        const isSelected = option.value === value;
        return (
          <button
            key={option.value}
            type="button"
            role="radio"
            aria-checked={isSelected}
            onClick={() => onChange(option.value)}
            className={cn(
              "flex flex-1 items-center justify-center gap-6 rounded-12 py-12 text-14 transition-colors duration-150 ease-out",
              "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent focus-visible:ring-offset-2",
              isSelected
                ? cn("font-bold", selectedTones[option.tone ?? "accent"])
                : "bg-divider font-semibold text-muted hover:bg-divider-hover",
            )}
          >
            {option.label}
            {showCheck && isSelected && <Check aria-hidden size={16} />}
          </button>
        );
      })}
    </div>
  );
}
