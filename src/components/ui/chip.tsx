import type { ReactNode } from "react";
import { cn } from "@/lib/cn";

/**
 * Two shapes from the mocks: `tag` is the radius-8 model tag (600 13px
 * #4e5968 on #f2f4f6, padding 6/10) and `pill` is the radius-99 CRT-sequence
 * / emotion chip (600 12.5px, padding 8/14).
 */
const tones = {
  neutral: "bg-divider text-secondary",
  accent: "bg-accent-tint text-accent-pressed",
  gain: "bg-gain-tint-1 text-gain",
  loss: "bg-loss-tint text-loss",
  /** Retired / de-emphasised. */
  muted: "bg-divider text-faint",
} as const;

const shapes = {
  tag: "rounded-8 px-10 py-6 text-13 font-semibold",
  pill: "rounded-pill px-14 py-8 text-12_5 font-semibold",
  /** The hero's small stat chips: radius 8, 6/10, 12px. */
  stat: "rounded-8 px-10 py-6 text-12 font-semibold",
} as const;

export interface ChipProps {
  children: ReactNode;
  tone?: keyof typeof tones;
  shape?: keyof typeof shapes;
  className?: string;
}

export function Chip({ children, tone = "neutral", shape = "tag", className }: ChipProps) {
  return (
    <span className={cn("inline-flex items-center gap-6", tones[tone], shapes[shape], className)}>
      {children}
    </span>
  );
}

export interface ToggleChipProps extends Omit<ChipProps, "tone"> {
  selected: boolean;
  onToggle: () => void;
}

/** Multi-select behaviour for the trade form's emotion/behaviour tags. */
export function ToggleChip({
  children,
  selected,
  onToggle,
  shape = "pill",
  className,
}: ToggleChipProps) {
  return (
    <button
      type="button"
      aria-pressed={selected}
      onClick={onToggle}
      className={cn(
        "inline-flex items-center gap-6 transition-colors duration-150 ease-out",
        "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent focus-visible:ring-offset-2",
        shapes[shape],
        selected ? tones.accent : cn(tones.neutral, "hover:bg-divider-hover"),
        className,
      )}
    >
      {children}
    </button>
  );
}
