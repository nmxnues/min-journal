"use client";

import { ChevronDown, ChevronLeft, ChevronRight } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useRef, useState } from "react";
import { cn } from "@/lib/cn";
import {
  buildDashboardPeriodSearchParams,
  stepMonthSearchParams,
  type ResolvedDashboardPeriod,
} from "@/lib/domain/dashboard-period";
import { formatMonthLabel } from "@/lib/domain/dates";
import { formatTradeDate } from "@/lib/format";
import { useLocale, useT } from "@/lib/i18n/locale-context";
import { DASHBOARD_RANGE_LABELS, DASHBOARD_RANGE_PRESETS } from "./dashboard-period-copy";

const RING = "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent focus-visible:ring-offset-2";

/**
 * Dashboard's date-range control (docs/decisions.md § Dashboard period
 * picker): `‹`/`›` step a single month — the one thing the user reported was
 * entirely missing — plus a dropdown of rolling presets and a custom range,
 * the same URL-bookmarkable convention Trade log's own date filter already
 * uses. Sits in the exact slot the old static month label occupied (desktop:
 * TopBar's right side; mobile: its own row under the header), so the rest of
 * the hero/layout is untouched.
 */
export function PeriodPicker({
  resolved,
  compact = false,
}: {
  resolved: ResolvedDashboardPeriod;
  compact?: boolean;
}) {
  const t = useT();
  const locale = useLocale();
  const router = useRouter();
  const [isOpen, setIsOpen] = useState(false);
  const [customMode, setCustomMode] = useState(false);
  const [customFrom, setCustomFrom] = useState(resolved.kind === "custom" ? resolved.from : resolved.to);
  const [customTo, setCustomTo] = useState(resolved.to);
  const blurTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  function onBlur() {
    blurTimer.current = setTimeout(() => {
      setIsOpen(false);
      setCustomMode(false);
    }, 120);
  }
  function onFocus() {
    if (blurTimer.current) clearTimeout(blurTimer.current);
  }

  function go(qs: string) {
    setIsOpen(false);
    setCustomMode(false);
    router.push(`/?${qs}`);
  }

  const triggerLabel =
    resolved.stepMonth !== null
      ? formatMonthLabel(resolved.stepMonth, locale)
      : resolved.kind === "custom"
        ? `${formatTradeDate(resolved.from, locale, true)} – ${formatTradeDate(resolved.to, locale, true)}`
        : t(DASHBOARD_RANGE_LABELS[resolved.kind]);

  const canStep = resolved.stepMonth !== null;

  return (
    <div className="flex items-center gap-4" onBlur={onBlur} onFocus={onFocus}>
      <Link
        href={canStep ? `/?${stepMonthSearchParams(resolved.stepMonth!, -1)}` : "#"}
        aria-disabled={!canStep}
        aria-label={t({ en: "Previous month", ko: "이전 달" })}
        tabIndex={canStep ? undefined : -1}
        className={cn(
          "rounded-6 text-faint transition-colors duration-150 ease-out",
          canStep ? cn("hover:text-muted", RING) : "pointer-events-none opacity-30",
        )}
      >
        <ChevronLeft aria-hidden size={compact ? 16 : 18} />
      </Link>

      <div className="relative">
        <button
          type="button"
          onClick={() => setIsOpen((v) => !v)}
          className={cn(
            "flex items-center gap-6 rounded-10 font-semibold text-secondary transition-colors duration-150 ease-out hover:bg-divider",
            RING,
            compact ? "px-8 py-6 text-13" : "px-10 py-8 text-13_5",
          )}
        >
          {triggerLabel}
          <ChevronDown aria-hidden size={14} className="text-faint" />
        </button>

        {isOpen && (
          <ul className="absolute right-0 z-20 mt-6 min-w-[200px] overflow-hidden rounded-14 bg-surface py-6 shadow-sheet">
            {!customMode ? (
              <>
                {DASHBOARD_RANGE_PRESETS.map((kind) => (
                  <li key={kind}>
                    <button
                      type="button"
                      onMouseDown={(event) => {
                        event.preventDefault();
                        if (blurTimer.current) clearTimeout(blurTimer.current);
                        if (kind === "custom") {
                          setCustomMode(true);
                          return;
                        }
                        go(buildDashboardPeriodSearchParams({ kind, month: null, from: null, to: null }));
                      }}
                      className={cn(
                        "flex w-full items-center px-16 py-10 text-left text-14 font-semibold whitespace-nowrap text-body",
                        resolved.kind === kind && "bg-divider",
                        "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-accent",
                      )}
                    >
                      {t(DASHBOARD_RANGE_LABELS[kind])}
                    </button>
                  </li>
                ))}
              </>
            ) : (
              <li className="flex flex-col gap-10 px-16 py-12">
                <div className="flex flex-col gap-6">
                  <label className="text-11_5 font-semibold text-muted" htmlFor="dashboard-period-from">
                    {t({ en: "From", ko: "시작일" })}
                  </label>
                  <input
                    id="dashboard-period-from"
                    type="date"
                    lang={locale}
                    value={customFrom}
                    max={customTo}
                    onChange={(event) => setCustomFrom(event.target.value)}
                    className="rounded-10 bg-divider px-12 py-8 text-13_5 font-semibold text-ink outline-none [color-scheme:light]"
                  />
                </div>
                <div className="flex flex-col gap-6">
                  <label className="text-11_5 font-semibold text-muted" htmlFor="dashboard-period-to">
                    {t({ en: "To", ko: "종료일" })}
                  </label>
                  <input
                    id="dashboard-period-to"
                    type="date"
                    lang={locale}
                    value={customTo}
                    min={customFrom}
                    onChange={(event) => setCustomTo(event.target.value)}
                    className="rounded-10 bg-divider px-12 py-8 text-13_5 font-semibold text-ink outline-none [color-scheme:light]"
                  />
                </div>
                <button
                  type="button"
                  onMouseDown={(event) => {
                    event.preventDefault();
                    if (blurTimer.current) clearTimeout(blurTimer.current);
                    go(
                      buildDashboardPeriodSearchParams({
                        kind: "custom",
                        month: null,
                        from: customFrom,
                        to: customTo,
                      }),
                    );
                  }}
                  className={cn(
                    "mt-4 rounded-10 bg-accent px-14 py-9 text-13_5 font-bold text-white hover:bg-accent-pressed",
                    RING,
                  )}
                >
                  {t({ en: "Apply", ko: "적용" })}
                </button>
              </li>
            )}
          </ul>
        )}
      </div>

      <Link
        href={canStep ? `/?${stepMonthSearchParams(resolved.stepMonth!, 1)}` : "#"}
        aria-disabled={!canStep}
        aria-label={t({ en: "Next month", ko: "다음 달" })}
        tabIndex={canStep ? undefined : -1}
        className={cn(
          "rounded-6 text-faint transition-colors duration-150 ease-out",
          canStep ? cn("hover:text-muted", RING) : "pointer-events-none opacity-30",
        )}
      >
        <ChevronRight aria-hidden size={compact ? 16 : 18} />
      </Link>
    </div>
  );
}
