"use client";

import { useEffect, useId, useMemo, useRef, useState } from "react";
import { ChevronDown } from "lucide-react";
import { cn } from "@/lib/cn";
import { controlBase } from "./field";

/**
 * Free text plus a filtered preset list — the Instrument field
 * (docs/decisions.md: 28 FX pairs + XAUUSD as presets, but any symbol may be
 * typed). Not in the build prompt's original primitive list; added when the
 * instrument field was specified.
 */
export interface ComboboxProps {
  value: string;
  onChange: (value: string) => void;
  options: readonly string[];
  id?: string;
  placeholder?: string;
  disabled?: boolean;
  className?: string;
}

export function Combobox({
  value,
  onChange,
  options,
  id,
  placeholder,
  disabled = false,
  className,
}: ComboboxProps) {
  const generatedId = useId();
  const inputId = id ?? generatedId;
  const listId = `${inputId}-listbox`;

  const [isOpen, setIsOpen] = useState(false);
  /**
   * Opening the list (focus, click, arrow key) always shows every option,
   * scrolled to the current value — the ordinary combobox convention, and
   * what a fixed 28-item preset list needs: with the old "always filter by
   * the current field value" behavior, a value that already matched a preset
   * (e.g. the field already reads "EURUSD") filtered the list down to that
   * one entry, so switching pairs meant deleting the text first. Filtering
   * only turns on once the user actually types a character.
   */
  const [isFiltering, setIsFiltering] = useState(false);
  const [activeIndex, setActiveIndex] = useState(0);
  const blurTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const listRef = useRef<HTMLUListElement>(null);

  const matches = useMemo(() => {
    if (!isFiltering) return options;
    const query = value.trim().toLowerCase();
    if (query === "") return options;
    return options.filter((o) => o.toLowerCase().includes(query));
  }, [options, value, isFiltering]);

  // Scrolls the active option into view — both the initial jump to the
  // current value on open, and normal keyboard-navigation tracking.
  useEffect(() => {
    if (!isOpen) return;
    const el = listRef.current?.querySelector<HTMLElement>(`[data-index="${activeIndex}"]`);
    el?.scrollIntoView({ block: "nearest" });
  }, [isOpen, activeIndex]);

  function open() {
    setIsFiltering(false);
    setIsOpen(true);
    const currentIndex = options.findIndex((o) => o === value);
    setActiveIndex(currentIndex === -1 ? 0 : currentIndex);
  }

  function commit(next: string) {
    onChange(next);
    setIsOpen(false);
  }

  function onKeyDown(event: React.KeyboardEvent<HTMLInputElement>) {
    if (event.key === "ArrowDown" || event.key === "ArrowUp") {
      event.preventDefault();
      if (!isOpen) {
        open();
        return;
      }
      const delta = event.key === "ArrowDown" ? 1 : -1;
      setActiveIndex((i) => (matches.length === 0 ? 0 : (i + delta + matches.length) % matches.length));
      return;
    }
    if (event.key === "Enter" && isOpen && matches[activeIndex] !== undefined) {
      event.preventDefault();
      commit(matches[activeIndex]);
      return;
    }
    if (event.key === "Escape") setIsOpen(false);
  }

  return (
    <div className={cn("relative", className)}>
      <input
        id={inputId}
        role="combobox"
        aria-expanded={isOpen}
        aria-controls={listId}
        aria-autocomplete="list"
        autoComplete="off"
        value={value}
        disabled={disabled}
        placeholder={placeholder}
        className={cn(controlBase, "pr-40")}
        onChange={(event) => {
          onChange(event.target.value);
          setIsFiltering(true);
          setIsOpen(true);
          setActiveIndex(0);
        }}
        onFocus={open}
        onKeyDown={onKeyDown}
        onBlur={() => {
          blurTimer.current = setTimeout(() => setIsOpen(false), 120);
        }}
      />
      <ChevronDown
        aria-hidden
        size={16}
        className="pointer-events-none absolute top-1/2 right-16 -translate-y-1/2 text-faint"
      />

      {isOpen && matches.length > 0 && (
        <ul
          ref={listRef}
          id={listId}
          role="listbox"
          className="absolute z-20 mt-6 max-h-[264px] w-full overflow-y-auto rounded-14 bg-surface py-6 shadow-sheet"
        >
          {matches.map((option, index) => (
            <li key={option} data-index={index}>
              <button
                type="button"
                role="option"
                aria-selected={option === value}
                onMouseEnter={() => setActiveIndex(index)}
                onMouseDown={(event) => {
                  event.preventDefault();
                  if (blurTimer.current) clearTimeout(blurTimer.current);
                  commit(option);
                }}
                className={cn(
                  "flex w-full items-center px-16 py-10 text-left text-14 font-semibold text-body",
                  index === activeIndex && "bg-divider",
                )}
              >
                {option}
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
