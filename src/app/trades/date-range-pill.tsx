"use client";

import { cn } from "@/lib/cn";
import { useLocale } from "@/lib/i18n/locale-context";

/**
 * docs/README.md § Trade log: "a date-range pill (ink #191f28 when set)".
 * Two native date inputs rather than a custom calendar popover — this app
 * already leans on native `<input type="date">` for the trade form itself
 * (docs/decisions.md never introduced a date-picker primitive), and a range
 * is just two of them side by side.
 *
 * `lang` is set for semantics/screen readers, but note it does NOT change
 * the empty-state segment placeholder ("연도. 월. 일." vs "yyyy-mm-dd") —
 * verified live in Chrome, that placeholder is drawn from the browser's own
 * configured display language, not the page's `lang` or `t()`/`useLocale()`,
 * and there is no supported way to override it short of replacing the native
 * control entirely. A visitor's own browser will show it in whatever
 * language their browser itself is set to, same as every other site using
 * `<input type="date">` — not a bug in this app's i18n.
 */
export interface DateRangePillProps {
  from: string | null;
  to: string | null;
  onChange: (from: string | null, to: string | null) => void;
}

export function DateRangePill({ from, to, onChange }: DateRangePillProps) {
  const locale = useLocale();
  const isSet = from !== null || to !== null;

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
