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
      {/*
        Two sibling buttons, not one button with a `<span role="button">`
        clear icon nested inside it: a real <button> can't contain another
        interactive element (invalid HTML, and the inner span never actually
        picked up a keyboard handler — Enter/Space silently did nothing).
        The pill's fill/radius/padding now lives on this wrapping div so the
        two buttons still read as one visual pill.
      */}
      <div
        className={cn(
          "flex items-center rounded-12 text-13_5 font-semibold transition-colors duration-150 ease-out",
          isApplied ? "bg-accent-tint text-accent-pressed" : "bg-divider text-muted hover:bg-divider-hover",
        )}
      >
        <button
          type="button"
          onClick={() => setIsOpen((v) => !v)}
          className={cn(
            "flex items-center gap-10 rounded-l-12 py-11 pl-14 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent focus-visible:ring-offset-2",
            isApplied ? "pr-6" : "pr-14",
          )}
        >
          {isApplied ? `${label} · ${summary}` : placeholder}
          {!isApplied && <ChevronDown aria-hidden size={14} className="text-faint" />}
        </button>
        {isApplied && (
          <button
            type="button"
            aria-label={`Clear ${label}`}
            onClick={() => onChange([])}
            className="flex items-center rounded-r-12 py-11 pr-14 pl-2 hover:opacity-70 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent focus-visible:ring-offset-2"
          >
            <X aria-hidden size={14} />
          </button>
        )}
      </div>

      {isOpen && (
        <ul className="absolute z-20 mt-6 max-h-[280px] min-w-full overflow-y-auto rounded-14 bg-surface py-6 shadow-sheet">
          {options.map((option) => {
            const isSelected = selected.includes(option.value);
            return (
              <li key={option.value}>
                <button
                  type="button"
                  // Mouse path: preventDefault on mousedown (not click) keeps
                  // focus on whatever's already focused so the container's
                  // onBlur-close timer never races this selection.
                  onMouseDown={(event) => {
                    event.preventDefault();
                    if (blurTimer.current) clearTimeout(blurTimer.current);
                    toggle(option.value);
                  }}
                  // Keyboard path: a button with only onMouseDown never
                  // actually responds to Enter/Space (there's no onClick for
                  // the browser's own key-to-click synthesis to invoke), so
                  // arrowing/tabbing here and pressing a key did nothing.
                  onKeyDown={(event) => {
                    if (event.key !== "Enter" && event.key !== " ") return;
                    event.preventDefault();
                    toggle(option.value);
                  }}
                  className={cn(
                    "flex w-full items-center gap-10 px-16 py-10 text-left text-14 font-semibold whitespace-nowrap text-body",
                    isSelected && "bg-divider",
                    // ring-inset, not the usual ring-offset-2: a full-width
                    // row inside a scrollable dropdown would clip an
                    // outward-pushed ring against the list's own overflow.
                    "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-accent",
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
