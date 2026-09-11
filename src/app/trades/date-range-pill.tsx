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
 * language, not this app's `t()`/`useLocale()`, and an *unset* native date
 * input's own placeholder segments render close to invisible at this pill's
 * size — on the <900px screen that showed up as apparently blank but for a
 * lone "—" separator, no "전체 기간"/"All dates" anywhere (found on a real
 * phone, not just reasoned about).
 *
 * Fix: render the mock's own summary text ourselves, in the current locale,
 * as a closed pill matching every sibling `FilterDropdown` pill on this same
 * row — real, correct-locale text at rest, same width regardless of screen,
 * with the calendar-picker native inputs only inside a popover that's open
 * for the moment of actually picking a date.
 */
export function DateRangePill({ from, to, onChange }: DateRangePillProps) {
  const locale = useLocale();
  const t = useT();
  const isSet = from !== null || to !== null;

  const [isOpen, setIsOpen] = useState(false);
  const blurTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  function onBlur() {
    blurTimer.current = setTimeout(() => setIsOpen(false), 120);
  }
  function onFocus() {
    if (blurTimer.current) clearTimeout(blurTimer.current);
  }

  const summary =
    from !== null && to !== null
      ? `${formatTradeDate(from, locale, true)} – ${formatTradeDate(to, locale, true)}`
      : from !== null
        ? t({ en: `From ${formatTradeDate(from, locale, true)}`, ko: `${formatTradeDate(from, locale, true)}부터` })
        : to !== null
          ? t({ en: `Until ${formatTradeDate(to, locale, true)}`, ko: `${formatTradeDate(to, locale, true)}까지` })
          : t({ en: "All dates", ko: "전체 기간" });

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
              lang={locale}
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
              lang={locale}
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
