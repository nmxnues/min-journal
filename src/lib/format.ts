/**
 * Number input helpers for the trade form.
 *
 * docs/README.md § Validation: "numeric fields accept thousands separators
 * and paste from a broker" — so a field's raw value is kept as the string the
 * user typed and parsed on demand, rather than being coerced on every
 * keystroke (which would fight the user mid-typing, e.g. eating a trailing ".").
 */

import { pipSize, priceDecimals } from "./instruments";

/**
 * Parse a typed/pasted number. Strips anything that isn't a digit, a dot, or a
 * leading minus, so "23,411.00", "$23 411.00" and "23411.00 " all land on the
 * same value. Returns null for anything that isn't a finite number yet.
 *
 * Assumes the US/UK convention (comma groups, dot decimal), which is what the
 * mocks and the instrument set use; a "1.234,56" style paste would misparse.
 */
export function parseNumberInput(raw: string): number | null {
  const cleaned = raw.replace(/[^0-9.-]/g, "").replace(/(?!^)-/g, "");
  if (cleaned === "" || cleaned === "-" || cleaned === "." || cleaned === "-.") return null;
  const value = Number(cleaned);
  return Number.isFinite(value) ? value : null;
}

/** True when the field holds something, even if it isn't parseable yet. */
export function hasValue(raw: string | undefined | null): raw is string {
  return typeof raw === "string" && raw.trim() !== "";
}

const R_FORMAT = new Intl.NumberFormat("en-US", {
  minimumFractionDigits: 1,
  maximumFractionDigits: 1,
});

/** "+2.8R" / "−1.0R" — the mocks always carry an explicit sign on R values. */
export function formatR(value: number, precision = 1): string {
  const rounded = precision === 1 ? R_FORMAT.format(Math.abs(value)) : Math.abs(value).toFixed(precision);
  const sign = value > 0 ? "+" : value < 0 ? "−" : "";
  return `${sign}${rounded}R`;
}

/**
 * Absolute price formatting, e.g. "1.26500" or "156.325". Decimal precision
 * depends on the instrument (docs/decisions.md § formatPrice fix) — this app
 * is FX-only, so every instrument is either a JPY pair (3 decimals) or a
 * standard pair (5 decimals). This is display-only: the domain layer keeps
 * full float precision and never rounds.
 */
export function formatPrice(value: number, instrument: string): string {
  const decimals = priceDecimals(instrument);
  return new Intl.NumberFormat("en-US", {
    minimumFractionDigits: decimals,
    maximumFractionDigits: decimals,
  }).format(value);
}

/**
 * A price *difference* (e.g. range size) in pips, formatted as "5.0". Reads
 * far more clearly than the raw decimal difference (0.0050) for FX pairs,
 * where the value itself carries no information at that many leading zeros.
 * Callers attach the locale-specific "pips"/"핍" label themselves, the same
 * way every other label in this app goes through useT.
 */
export function formatPips(value: number, instrument: string): string {
  return (value / pipSize(instrument)).toFixed(1);
}

export function formatCurrency(value: number, currency = "USD"): string {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency,
    maximumFractionDigits: 0,
  }).format(value);
}

/** "HH:mm", 24-hour, matching the mock's "Draft saved · 12:41" exactly. */
export function formatTime(date: Date): string {
  return new Intl.DateTimeFormat("en-GB", { hour: "2-digit", minute: "2-digit", hourCycle: "h23" }).format(
    date,
  );
}
