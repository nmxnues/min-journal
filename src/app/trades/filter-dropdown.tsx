"use client";

import { useRef, useState } from "react";
import { Check, ChevronDown, X } from "lucide-react";
import { cn } from "@/lib/cn";

/**
 * One shared control for every "dropdown pill" filter (docs/README.md §
 * Trade log): Instrument/Session/Model are multi-select, Sweep side/Result
 * are single-select — same visual pill either way, just whether picking a
 * second option adds to the selection or replaces it. Closes on blur with a
 * short timeout rather than a document click-outside listener, matching the
 * existing `Combobox` primitive's own convention (docs/decisions.md § Phase
 * 1/3) — one fewer event-listener pattern in the codebase to keep in sync.
 */
export interface FilterDropdownOption<T extends string> {
  value: T;
  label: string;
}

export interface FilterDropdownProps<T extends string> {
  label: string;
  placeholder: string;
  options: readonly FilterDropdownOption<T>[];
  selected: readonly T[];
  multiple?: boolean;
  onChange: (next: T[]) => void;
  className?: string;
}

export function FilterDropdown<T extends string>({
  label,
  placeholder,
  options,
  selected,
  multiple = false,
  onChange,
  className,
}: FilterDropdownProps<T>) {
  const [isOpen, setIsOpen] = useState(false);
  const blurTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const isApplied = selected.length > 0;
  const summary =
    selected.length === 0
      ? null
      : selected.length === 1
        ? (options.find((o) => o.value === selected[0])?.label ?? selected[0])
        : `${selected.length} selected`;

  function toggle(value: T) {
    if (multiple) {
      onChange(selected.includes(value) ? selected.filter((v) => v !== value) : [...selected, value]);
    } else {
      onChange([value]);
      setIsOpen(false);
    }
  }

  function onBlur() {
    blurTimer.current = setTimeout(() => setIsOpen(false), 120);
  }

  function onFocus() {
    if (blurTimer.current) clearTimeout(blurTimer.current);
  }

  return (
    <div className={cn("relative", className)} onBlur={onBlur} onFocus={onFocus}>
      <button
        type="button"
        onClick={() => setIsOpen((v) => !v)}
        className={cn(
          "flex items-center gap-10 rounded-12 px-14 py-11 text-13_5 font-semibold transition-colors duration-150 ease-out",
          isApplied ? "bg-accent-tint text-accent-pressed" : "bg-divider text-muted hover:bg-divider-hover",
        )}
      >
        {isApplied ? `${label} · ${summary}` : placeholder}
        {isApplied ? (
          <span
            role="button"
            tabIndex={0}
            aria-label={`Clear ${label}`}
            onMouseDown={(event) => {
              event.preventDefault();
              event.stopPropagation();
              onChange([]);
            }}
          >
            <X aria-hidden size={14} />
          </span>
        ) : (
          <ChevronDown aria-hidden size={14} className="text-faint" />
        )}
      </button>

      {isOpen && (
        <ul className="absolute z-20 mt-6 max-h-[280px] min-w-full overflow-y-auto rounded-14 bg-surface py-6 shadow-sheet">
          {options.map((option) => {
            const isSelected = selected.includes(option.value);
            return (
              <li key={option.value}>
                <button
                  type="button"
                  onMouseDown={(event) => {
                    event.preventDefault();
                    if (blurTimer.current) clearTimeout(blurTimer.current);
                    toggle(option.value);
                  }}
                  className={cn(
                    "flex w-full items-center gap-10 px-16 py-10 text-left text-14 font-semibold whitespace-nowrap text-body",
                    isSelected && "bg-divider",
                  )}
                >
                  {multiple && (
                    <span
                      className={cn(
                        "flex h-16 w-16 shrink-0 items-center justify-center rounded-8",
                        isSelected ? "bg-accent text-white" : "bg-divider",
                      )}
                    >
                      {isSelected && <Check aria-hidden size={11} />}
                    </span>
                  )}
                  {option.label}
                </button>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
