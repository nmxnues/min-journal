import type { Direction, HtfPairing, Session, SweepSide, TradeResult } from "@/lib/domain/types";
import type { LocaleStrings } from "@/lib/i18n/locale";

/**
 * Display strings for the code-valued columns. Stored as codes so a CHECK
 * constraint stays cheap to change and the arrow glyphs stay out of the
 * database (docs/decisions.md § Phase 1).
 */
export const DIRECTION_LABELS: Record<Direction, LocaleStrings> = {
  long: { en: "Long", ko: "롱" },
  short: { en: "Short", ko: "숏" },
};

export const SESSION_LABELS: Record<Session, LocaleStrings> = {
  asia: { en: "Asia", ko: "아시아" },
  london: { en: "London", ko: "런던" },
  ny_am: { en: "New York AM", ko: "뉴욕 오전" },
};

export const SESSION_ORDER: readonly Session[] = ["asia", "london", "ny_am"];

/** The four options and their order are fixed; default is W → 2D. */
export const HTF_PAIRING_LABELS: Record<HtfPairing, LocaleStrings> = {
  m_w_2d: { en: "M → W → 2D", ko: "M → W → 2D" },
  w_2d: { en: "W → 2D", ko: "W → 2D" },
  d_h1: { en: "D → H1", ko: "D → H1" },
  h1_m5: { en: "H1 → M5", ko: "H1 → M5" },
};

export const HTF_PAIRING_ORDER: readonly HtfPairing[] = ["m_w_2d", "w_2d", "d_h1", "h1_m5"];

export const SWEEP_SIDE_LABELS: Record<SweepSide, LocaleStrings> = {
  low: { en: "Low purged", ko: "저점 퍼지" },
  high: { en: "High purged", ko: "고점 퍼지" },
  both: { en: "Both swept", ko: "양방향 퍼지" },
  none: { en: "No sweep", ko: "스윕 없음" },
};

export const SWEEP_SIDE_ORDER: readonly SweepSide[] = ["low", "high", "both", "none"];

/** New trade's Result segmented control has always inlined these at the call site; centralized here now that Trade log's filter and CSV import both need the same mapping. */
export const RESULT_LABELS: Record<TradeResult, LocaleStrings> = {
  win: { en: "Win", ko: "익절" },
  loss: { en: "Loss", ko: "손절" },
  be: { en: "Break-even", ko: "본전" },
};

export const RESULT_ORDER: readonly TradeResult[] = ["win", "loss", "be"];

/** "1 trade" / "2 trades" / "3건" — every trade-count caption on the Dashboard and Calendar goes through this, so English singular isn't a one-off fix. */
export function tradeCountLabel(n: number): LocaleStrings {
  return { en: `${n} ${n === 1 ? "trade" : "trades"}`, ko: `${n}건` };
}

/**
 * "->" reads as "→" for matching purposes — a hand-authored or
 * spreadsheet-exported CSV importing HTF pairing (docs/decisions.md § Phase
 * 6) is far more likely to type the ASCII arrow than paste the actual "→"
 * glyph. Harmless for every other label set this resolves, since none of
 * them contain an arrow to begin with.
 */
function normalizeForLabelMatch(value: string): string {
  return value
    .trim()
    .toLowerCase()
    .replace(/->/g, "→")
    .replace(/\s*→\s*/g, " → ")
    .replace(/\s+/g, " ")
    .trim();
}

/**
 * Resolves a stored code or either locale's display label (case-insensitive)
 * back to the code — CSV import (docs/decisions.md § Phase 6) can't assume a
 * hand-authored file uses internal codes like `w_2d`; it's just as likely to
 * say "W → 2D" or the Korean equivalent, or the raw code itself.
 */
export function resolveLabel<T extends string>(labels: Record<T, LocaleStrings>, raw: string): T | null {
  const needle = normalizeForLabelMatch(raw);
  for (const code of Object.keys(labels) as T[]) {
    if (code.toLowerCase() === needle) return code;
    const pair = labels[code];
    if (normalizeForLabelMatch(pair.en) === needle || normalizeForLabelMatch(pair.ko) === needle) return code;
  }
  return null;
}

/**
 * The behaviour tags offered on the trade form (docs/README.md § New trade).
 * Kept in English for both locales at the user's own request — these four
 * are terms he types/reads in English regardless of viewport, unlike every
 * other label in the app.
 */
export const TAG_PRESETS: readonly LocaleStrings[] = [
  { en: "On plan", ko: "On plan" },
  { en: "Impatient", ko: "Impatient" },
  { en: "Chased entry", ko: "Chased entry" },
  { en: "Early exit", ko: "Early exit" },
];
