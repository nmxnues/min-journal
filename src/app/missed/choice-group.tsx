"use client";

import { useRef, type KeyboardEvent } from "react";
import { cn } from "@/lib/cn";
import type { SegmentedTone } from "@/components/ui";

const selectedTones: Record<SegmentedTone, string> = {
  accent: "bg-accent-tint text-accent",
  gain: "bg-gain-tint-1 text-gain",
  loss: "bg-loss-tint text-loss",
};

export interface ChoiceOption<T extends string> {
  value: T;
  label: string;
  tone?: SegmentedTone;
}

/**
 * `Segmented`'s look with the keyboard behaviour of a real radio group, for
 * the Missed trades form's keyboard-only entry: the whole group is ONE Tab
 * stop (the selected option, or the first when nothing is picked), and the
 * arrow keys move and pick. With `Segmented` every option is its own Tab
 * stop, so the five-option reason row alone would cost five presses.
 *
 * `allowClear` lets a click on the selected option unpick it, for the one
 * optional group (session).
 */
export function ChoiceGroup<T extends string>({
  id,
  options,
  value,
  onChange,
  label,
  allowClear = false,
  invalid = false,
  className,
}: {
  id: string;
  options: readonly ChoiceOption<T>[];
  value: T | null;
  onChange: (value: T | null) => void;
  label: string;
  allowClear?: boolean;
  invalid?: boolean;
  className?: string;
}) {
  const refs = useRef<(HTMLButtonElement | null)[]>([]);
  const selectedIndex = options.findIndex((o) => o.value === value);
  const tabStop = selectedIndex === -1 ? 0 : selectedIndex;

  function pick(index: number) {
    const wrapped = (index + options.length) % options.length;
    onChange(options[wrapped].value);
    refs.current[wrapped]?.focus();
  }

  function onKeyDown(event: KeyboardEvent<HTMLButtonElement>, index: number) {
    if (event.key === "ArrowRight" || event.key === "ArrowDown") {
      event.preventDefault();
      pick(selectedIndex === -1 ? index : index + 1);
    } else if (event.key === "ArrowLeft" || event.key === "ArrowUp") {
      event.preventDefault();
      pick(selectedIndex === -1 ? index : index - 1);
    }
  }

  return (
    <div
      id={id}
      role="radiogroup"
      aria-label={label}
      aria-invalid={invalid || undefined}
      className={cn("flex flex-wrap gap-8", className)}
    >
      {options.map((option, index) => {
        const isSelected = option.value === value;
        return (
          <button
            key={option.value}
            ref={(el) => {
              refs.current[index] = el;
            }}
            type="button"
            role="radio"
            aria-checked={isSelected}
            tabIndex={index === tabStop ? 0 : -1}
            onClick={() => onChange(isSelected && allowClear ? null : option.value)}
            onKeyDown={(event) => onKeyDown(event, index)}
            className={cn(
              "flex flex-1 items-center justify-center whitespace-nowrap rounded-12 px-12 py-11 text-14 transition-colors duration-150 ease-out",
              "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent focus-visible:ring-offset-2",
              isSelected
                ? cn("font-bold", selectedTones[option.tone ?? "accent"])
                : cn("bg-divider font-semibold text-muted hover:bg-divider-hover", invalid && "ring-1 ring-loss/40"),
            )}
          >
            {option.label}
          </button>
        );
      })}
    </div>
  );
}
