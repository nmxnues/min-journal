"use client";

import { createContext, useContext, type ReactNode } from "react";
import { formatR as formatRWithPrecision } from "@/lib/format";

/**
 * User-facing app settings that affect display everywhere, not just on the
 * Settings screen itself. Currently just `r_precision` — `pnl_convention`
 * needs no client-side plumbing, since every gain/loss color already comes
 * from a CSS variable RootLayout re-points server-side via `[data-pnl]` on
 * `<html>` (see globals.css); no component ever branches on the convention
 * name in JS.
 */
export interface AppSettings {
  /** settings.r_precision — decimal places on an R value, e.g. 1 for "+18.4R". */
  rPrecision: number;
}

const SettingsContext = createContext<AppSettings | null>(null);

/**
 * Seeded from a server read (RootLayout's `getSettings()`), the same pattern
 * `LocaleProvider` uses for the viewport-locale cookie — so there is no
 * client-only default to correct after mount, and no hydration mismatch to
 * guard against. A save on the Settings screen calls `router.refresh()`,
 * which re-runs RootLayout and hands this provider the new value.
 */
export function SettingsProvider({ value, children }: { value: AppSettings; children: ReactNode }) {
  return <SettingsContext.Provider value={value}>{children}</SettingsContext.Provider>;
}

export function useSettings(): AppSettings {
  const settings = useContext(SettingsContext);
  if (settings === null) {
    throw new Error("useSettings() must be used within SettingsProvider (mounted in RootLayout).");
  }
  return settings;
}

/**
 * `formatR` bound to `settings.r_precision`, so a call site that doesn't pass
 * its own `precision` follows the user's preference instead of the function's
 * own hardcoded default. A call site with an intentionally fixed precision
 * (e.g. expectancy's own 2 decimals) still overrides it by passing one.
 */
export function useFormatR() {
  const { rPrecision } = useSettings();
  return (value: number, precision: number = rPrecision, unit = true, forceSign = true) =>
    formatRWithPrecision(value, precision, unit, forceSign);
}
