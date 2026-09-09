import type { HtfPairing, Session, SweepSide } from "@/lib/domain/types";
import type { LocaleStrings } from "@/lib/i18n/locale";

/**
 * Display strings for the code-valued columns. Stored as codes so a CHECK
 * constraint stays cheap to change and the arrow glyphs stay out of the
 * database (docs/decisions.md § Phase 1).
 */
export const SESSION_LABELS: Record<Session, LocaleStrings> = {
  asia: { en: "Asia", ko: "아시아" },
  london: { en: "London", ko: "런던" },
  ny_am: { en: "New York AM", ko: "뉴욕 오전" },
  ny_pm: { en: "New York PM", ko: "뉴욕 오후" },
};

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

/** The behaviour tags offered on the trade form (docs/README.md § New trade). */
export const TAG_PRESETS: readonly LocaleStrings[] = [
  { en: "On plan", ko: "계획대로" },
  { en: "Impatient", ko: "조급함" },
  { en: "Chased entry", ko: "추격 진입" },
  { en: "Early exit", ko: "조기 청산" },
];
