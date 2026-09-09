"use client";

import { useId, useMemo, useRef, useState } from "react";
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
  const [activeIndex, setActiveIndex] = useState(0);
  const blurTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const matches = useMemo(() => {
    const query = value.trim().toLowerCase();
    const list = query === "" ? options : options.filter((o) => o.toLowerCase().includes(query));
    return list.slice(0, 8);
  }, [options, value]);

  function commit(next: string) {
    onChange(next);
    setIsOpen(false);
  }

  function onKeyDown(event: React.KeyboardEvent<HTMLInputElement>) {
    if (event.key === "ArrowDown" || event.key === "ArrowUp") {
      event.preventDefault();
      if (!isOpen) {
        setIsOpen(true);
        setActiveIndex(0);
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
          setIsOpen(true);
          setActiveIndex(0);
        }}
        onFocus={() => setIsOpen(true)}
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
          id={listId}
          role="listbox"
          className="absolute z-20 mt-6 max-h-[264px] w-full overflow-y-auto rounded-14 bg-surface py-6 shadow-sheet"
        >
          {matches.map((option, index) => (
            <li key={option}>
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
