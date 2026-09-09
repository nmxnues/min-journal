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
