/**
 * Instrument presets for the combobox — docs/decisions.md § Phase 1: the 28
 * FX pairs (7 majors + 21 crosses) plus XAUUSD, confirmed with the user. The
 * field still accepts free text, so this list is UI convenience only and is
 * deliberately not a database constraint.
 */
export const MAJOR_PAIRS = [
  "EURUSD", "GBPUSD", "USDJPY", "USDCHF", "USDCAD", "AUDUSD", "NZDUSD",
] as const;

export const CROSS_PAIRS = [
  "EURGBP", "EURAUD", "EURNZD", "EURCAD", "EURCHF", "EURJPY",
  "GBPAUD", "GBPNZD", "GBPCAD", "GBPCHF", "GBPJPY",
  "AUDNZD", "AUDCAD", "AUDCHF", "AUDJPY",
  "NZDCAD", "NZDCHF", "NZDJPY",
  "CADCHF", "CADJPY",
  "CHFJPY",
] as const;

export const INSTRUMENT_PRESETS: readonly string[] = [
  ...MAJOR_PAIRS,
  ...CROSS_PAIRS,
  "XAUUSD",
];

export const DEFAULT_INSTRUMENT = "EURUSD";
