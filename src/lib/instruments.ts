/**
 * Instrument presets for the combobox, in the order the user fixed them:
 * the 7 USD majors first, then the crosses grouped by the currency that leads
 * them. No broker prefixes or suffixes — plain symbols.
 *
 * The field still accepts free text, so this list is convenience only and
 * deliberately isn't a database constraint: anything not here can just be
 * typed. Metals (XAUUSD and friends) are off the list for now — the focus is
 * the majors, EURUSD above all.
 */
export const INSTRUMENT_PRESETS: readonly string[] = [
  // Majors
  "EURUSD",
  "GBPUSD",
  "USDJPY",
  "USDCHF",
  "USDCAD",
  "AUDUSD",
  "NZDUSD",
  // Crosses
  "EURGBP",
  "EURJPY",
  "GBPJPY",
  "EURAUD",
  "EURCAD",
  "EURCHF",
  "EURNZD",
  "AUDJPY",
  "CADJPY",
  "CHFJPY",
  "NZDJPY",
  "GBPAUD",
  "GBPCAD",
  "GBPCHF",
  "GBPNZD",
  "AUDCAD",
  "AUDCHF",
  "AUDNZD",
  "CADCHF",
  "NZDCAD",
  "NZDCHF",
];

export const DEFAULT_INSTRUMENT = "EURUSD";

/**
 * Every instrument in this app is an FX pair (docs/decisions.md § Phase 4
 * formatPrice fix) — metals and indices are explicitly out of scope, so there
 * is no third "unknown instrument" bucket to design for. Standard pairs quote
 * to 5 decimals (4 whole + 1 fractional pip); JPY-quoted pairs quote to 3 (2
 * whole + 1 fractional pip) because JPY sits ~2 orders of magnitude off the
 * other majors. Free-typed pairs outside the 28 presets still follow this
 * rule correctly as long as they end in "JPY".
 */
export function isJpyPair(instrument: string): boolean {
  return instrument.trim().toUpperCase().endsWith("JPY");
}

/** Decimal places for an absolute price in this instrument. */
export function priceDecimals(instrument: string): number {
  return isJpyPair(instrument) ? 3 : 5;
}

/** Size of one pip in this instrument's price units. */
export function pipSize(instrument: string): number {
  return isJpyPair(instrument) ? 0.01 : 0.0001;
}

/**
 * A coarse "is this even the right order of magnitude" sanity range, not a
 * real historical high/low per pair — modern-era FX majors and crosses trade
 * within roughly these bounds regardless of which of the 28 presets it is
 * (docs/decisions.md § Phase 4c price-plausibility warning). The point isn't
 * to catch a price that's merely unusual, only a price that's obviously a
 * different kind of instrument entirely — e.g. pasting an index quote like
 * 23,411 into an EURUSD field, which is off by four orders of magnitude and
 * turns every pip/range figure on the screen meaningless.
 */
const NON_JPY_PLAUSIBLE_RANGE = { min: 0.2, max: 5 } as const;
const JPY_PLAUSIBLE_RANGE = { min: 20, max: 500 } as const;

export function isPlausibleFxPrice(price: number, instrument: string): boolean {
  const { min, max } = isJpyPair(instrument) ? JPY_PLAUSIBLE_RANGE : NON_JPY_PLAUSIBLE_RANGE;
  return price >= min && price <= max;
}
