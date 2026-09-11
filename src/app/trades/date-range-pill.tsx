"use client";

import { useRef, useState } from "react";
import { ChevronDown } from "lucide-react";
import { cn } from "@/lib/cn";
import { formatTradeDate } from "@/lib/format";
import { useLocale, useT } from "@/lib/i18n/locale-context";

export interface DateRangePillProps {
  from: string | null;
  to: string | null;
  onChange: (from: string | null, to: string | null) => void;
}

/**
 * docs/README.md § Trade log: "a date-range pill (ink #191f28 when set)",
 * shown in the mock as one summary string ("Sep 1 — Sep 9") plus a "▾" —
 * not two visible date fields. A plain pair of native `<input type="date">`
 * always renders its own text (the empty-state placeholder, and — once a
 * value exists — the value itself) from the *browser's* configured display
 * language, not this app's `t()`/`useLocale()`. On the desktop (English)
 * screen with a Korean-language browser, that showed up as "연도. 월. 일."
 * where the mock has an English summary — wrong locale on an always-visible
 * control, not just a one-off cosmetic gap.
 *
 * Fix: render the mock's own summary text ourselves (always English here,
 * since this component only reaches the desktop branch at ≥900px) as a
 * closed pill, and keep the native date inputs only inside a popover that's
 * open for the moment of actually picking a date — real, correct-locale text
 * the rest of the time, with the calendar-picker convenience preserved
 * exactly where it's needed. `<900px` keeps the plain inline pair below: two
 * native inputs read fine there since that screen is Korean-only by
 * construction, matching the browser locale of a Korean-first user, and a
 * popover adds a tap for no benefit on a screen already this compact.
 */
export function DateRangePill({ from, to, onChange }: DateRangePillProps) {
  const locale = useLocale();
  const t = useT();
  const isMobile = locale === "ko";
  const isSet = from !== null || to !== null;

  const [isOpen, setIsOpen] = useState(false);
  const blurTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  function onBlur() {
    blurTimer.current = setTimeout(() => setIsOpen(false), 120);
  }
  function onFocus() {
    if (blurTimer.current) clearTimeout(blurTimer.current);
  }

  if (isMobile) {
    return (
      <div
        className={cn(
          "flex items-center gap-8 rounded-12 bg-divider px-14 py-9 text-13_5 font-semibold",
          isSet ? "text-ink" : "text-muted",
        )}
      >
        <input
          type="date"
          lang={locale}
          value={from ?? ""}
          onChange={(event) => onChange(event.target.value === "" ? null : event.target.value, to)}
          className="w-[124px] bg-transparent outline-none [color-scheme:light]"
        />
        <span className="text-faint">—</span>
        <input
          type="date"
          lang={locale}
          value={to ?? ""}
          onChange={(event) => onChange(from, event.target.value === "" ? null : event.target.value)}
          className="w-[124px] bg-transparent outline-none [color-scheme:light]"
        />
      </div>
    );
  }

  const summary =
    from !== null && to !== null
      ? `${formatTradeDate(from, "en", true)} – ${formatTradeDate(to, "en", true)}`
      : from !== null
        ? `From ${formatTradeDate(from, "en", true)}`
        : to !== null
          ? `Until ${formatTradeDate(to, "en", true)}`
          : "All dates";

  return (
    <div className="relative" onBlur={onBlur} onFocus={onFocus}>
      <button
        type="button"
        onClick={() => setIsOpen((v) => !v)}
        className={cn(
          "flex items-center gap-10 rounded-12 px-14 py-11 text-13_5 font-semibold transition-colors duration-150 ease-out",
          isSet ? "bg-divider text-ink" : "bg-divider text-muted hover:bg-divider-hover",
          "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent focus-visible:ring-offset-2",
        )}
      >
        {summary}
        <ChevronDown aria-hidden size={14} className="text-faint" />
      </button>

      {isOpen && (
        <div className="absolute z-20 mt-6 flex flex-col gap-14 rounded-14 bg-surface p-16 shadow-sheet">
          <div className="flex flex-col gap-6">
            <label htmlFor="trade-log-date-from" className="text-11_5 font-semibold text-muted">
              {t({ en: "From", ko: "시작일" })}
            </label>
            <input
              id="trade-log-date-from"
              type="date"
              lang="en"
              value={from ?? ""}
              onChange={(event) => onChange(event.target.value === "" ? null : event.target.value, to)}
              className="rounded-10 bg-divider px-12 py-8 text-13_5 font-semibold text-ink outline-none [color-scheme:light]"
            />
          </div>
          <div className="flex flex-col gap-6">
            <label htmlFor="trade-log-date-to" className="text-11_5 font-semibold text-muted">
              {t({ en: "To", ko: "종료일" })}
            </label>
            <input
              id="trade-log-date-to"
              type="date"
              lang="en"
              value={to ?? ""}
              onChange={(event) => onChange(from, event.target.value === "" ? null : event.target.value)}
              className="rounded-10 bg-divider px-12 py-8 text-13_5 font-semibold text-ink outline-none [color-scheme:light]"
            />
          </div>
        </div>
      )}
    </div>
  );
}
