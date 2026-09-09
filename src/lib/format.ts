/**
 * Number input helpers for the trade form.
 *
 * docs/README.md § Validation: "numeric fields accept thousands separators
 * and paste from a broker" — so a field's raw value is kept as the string the
 * user typed and parsed on demand, rather than being coerced on every
 * keystroke (which would fight the user mid-typing, e.g. eating a trailing ".").
 */

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

/** Plain price/level formatting with thousands separators, e.g. "23,411.00". */
export function formatPrice(value: number): string {
  return new Intl.NumberFormat("en-US", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(value);
}

export function formatCurrency(value: number, currency = "USD"): string {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency,
    maximumFractionDigits: 0,
  }).format(value);
}
