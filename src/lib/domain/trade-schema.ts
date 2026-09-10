import { z } from "zod";
import { parseNumberInput } from "@/lib/format";
import type { Locale } from "@/lib/i18n/locale";

/**
 * The trade field set and validation rules shared by the New trade form and
 * Trade detail's edit form (docs/decisions.md § Phase 4c) — same CRT-sequence
 * fields, same required set, same "block on what the database refuses, warn
 * on everything softer" split. The two forms diverge only in what surrounds
 * these fields: New trade adds draft autosave and attachment upload; Trade
 * detail's edit form adds `exitReason`/`holdMinutes` (deferred to 4c because
 * they only make sense once a trade exists to look back on) and has no draft.
 */
export const TRADE_SCHEMA_MESSAGES = {
  instrument: { en: "Pick or type an instrument.", ko: "종목을 입력하세요." },
  date: { en: "Enter the trade date.", ko: "매매 날짜를 입력하세요." },
  number: { en: "Enter a number.", ko: "숫자를 입력하세요." },
  rangeOrder: {
    en: "Range high must be above range low.",
    ko: "레인지 상단이 하단보다 높아야 합니다.",
  },
  stopEqualsEntry: {
    en: "Stop can't be the same as entry — there'd be no risk to measure R against.",
    ko: "손절가가 진입가와 같으면 R을 계산할 수 없습니다.",
  },
  sizePositive: { en: "Size must be greater than 0.", ko: "사이즈는 0보다 커야 합니다." },
  holdNonNegative: {
    en: "Hold time can't be negative.",
    ko: "보유 시간은 음수일 수 없습니다.",
  },
} as const;

export function tradeMessage<K extends keyof typeof TRADE_SCHEMA_MESSAGES>(
  locale: Locale,
  key: K,
): string {
  return TRADE_SCHEMA_MESSAGES[key][locale];
}

/** The fields both forms share, as a zod raw shape (spread into each `z.object()`). */
export function tradeFieldsShape(locale: Locale) {
  const m = (key: keyof typeof TRADE_SCHEMA_MESSAGES) => tradeMessage(locale, key);
  const requiredNumber = (message: string) => z.string().trim().min(1, message);

  return {
    instrument: z.string().trim().min(1, m("instrument")),
    date: z.string().trim().min(1, m("date")),
    direction: z.enum(["long", "short"]),
    session: z.enum(["asia", "london", "ny_am"]),
    htfPairing: z.enum(["m_w_2d", "w_2d", "d_h1", "h1_m5"]),

    rangeHigh: requiredNumber(m("number")),
    rangeLow: requiredNumber(m("number")),
    /** null = use the derived value; a value here is the explicit override. */
    sweepSideOverride: z.enum(["low", "high", "both", "none"]).nullable(),

    entry: requiredNumber(m("number")),
    stop: requiredNumber(m("number")),
    size: requiredNumber(m("number")),
    target: z.string().trim(),
    exit: z.string().trim(),

    modelId: z.string().nullable(),
    confirmation: z.string().trim(),
    result: z.enum(["win", "loss", "be"]).nullable(),

    tags: z.array(z.string()),
    notes: z.string(),
  };
}

type TradeNumericField = "rangeHigh" | "rangeLow" | "entry" | "stop" | "size" | "target" | "exit";

interface TradeNumericValues {
  rangeHigh: string;
  rangeLow: string;
  entry: string;
  stop: string;
  size: string;
  target: string;
  exit: string;
}

/**
 * The numeric/ordering rules shared by both schemas' `superRefine` — kept as
 * a plain function (not baked into `tradeFieldsShape`) so each schema can add
 * its own fields to the same `superRefine` pass without a second traversal.
 */
export function refineTradeNumerics(
  values: TradeNumericValues,
  ctx: z.RefinementCtx,
  locale: Locale,
) {
  const m = (key: keyof typeof TRADE_SCHEMA_MESSAGES) => tradeMessage(locale, key);

  const numeric = (field: TradeNumericField) => {
    const raw = values[field];
    if (raw === "") return null; // required-ness is handled by min(1) on the field itself
    const parsed = parseNumberInput(raw);
    if (parsed === null) {
      ctx.addIssue({ code: "custom", path: [field], message: m("number") });
      return null;
    }
    return parsed;
  };

  const rangeHigh = numeric("rangeHigh");
  const rangeLow = numeric("rangeLow");
  const entry = numeric("entry");
  const stop = numeric("stop");
  const size = numeric("size");
  numeric("target");
  numeric("exit");

  if (rangeHigh !== null && rangeLow !== null && rangeHigh <= rangeLow) {
    ctx.addIssue({ code: "custom", path: ["rangeHigh"], message: m("rangeOrder") });
  }

  if (entry !== null && stop !== null && entry === stop) {
    ctx.addIssue({ code: "custom", path: ["stop"], message: m("stopEqualsEntry") });
  }

  if (size !== null && size <= 0) {
    ctx.addIssue({ code: "custom", path: ["size"], message: m("sizePositive") });
  }
}
