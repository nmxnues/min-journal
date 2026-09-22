import { z } from "zod";
import { MISS_REASON_ORDER, type MissReason } from "@/lib/domain/missed-trade";
import type { Direction, Session, TradeResult } from "@/lib/domain/types";
import type { Locale } from "@/lib/i18n/locale";
import { hasValue, parseNumberInput } from "@/lib/format";

/**
 * Required: date, instrument, direction, why it was missed, and the
 * hypothetical result — the user's own minimum. Everything else is optional,
 * prices included: without them the row still counts, its R is just unknown.
 *
 * The only blocking numeric rule is the one the table itself refuses
 * (stop ≠ entry); a malformed price is refused too rather than silently
 * dropped.
 */
export function createMissedTradeSchema(locale: Locale = "en") {
  const msg = (en: string, ko: string) => (locale === "ko" ? ko : en);
  const price = z.string().refine((v) => !hasValue(v) || parseNumberInput(v) !== null, {
    message: msg("Enter a number.", "숫자를 입력하세요."),
  });

  return z
    .object({
      date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, msg("Pick a date.", "날짜를 선택하세요.")),
      time: z
        .string()
        .refine((v) => v === "" || /^([01]\d|2[0-3]):[0-5]\d$/.test(v), msg("Enter a time like 14:30.", "14:30처럼 입력하세요.")),
      session: z.enum(["asia", "london", "ny_am"]).nullable(),
      instrument: z.string().trim().min(1, msg("Enter a pair.", "통화쌍을 입력하세요.")),
      direction: z.enum(["long", "short"], { message: msg("Pick long or short.", "롱/숏을 선택하세요.") }),
      entry: price,
      stop: price,
      target: price,
      setupNote: z.string(),
      missReason: z.enum(MISS_REASON_ORDER as [MissReason, ...MissReason[]], {
        message: msg("Pick why you didn't enter.", "못 들어간 이유를 선택하세요."),
      }),
      missReasonNote: z.string(),
      result: z.enum(["win", "loss", "be"], { message: msg("Pick the result.", "가상 결과를 선택하세요.") }),
      notes: z.string(),
    })
    .superRefine((v, ctx) => {
      const entry = parseNumberInput(v.entry);
      const stop = parseNumberInput(v.stop);
      if (entry !== null && stop !== null && entry === stop) {
        ctx.addIssue({
          code: "custom",
          path: ["stop"],
          message: msg("Stop can't equal entry.", "손절가가 진입가와 같을 수 없어요."),
        });
      }
    });
}

/** The form's own state: the three required choices start unpicked (null). */
export interface MissedTradeInput {
  date: string;
  time: string;
  session: Session | null;
  instrument: string;
  direction: Direction | null;
  entry: string;
  stop: string;
  target: string;
  setupNote: string;
  missReason: MissReason | null;
  missReasonNote: string;
  result: TradeResult | null;
  notes: string;
}

export const MISSED_TRADE_DEFAULTS: MissedTradeInput = {
  date: "",
  time: "",
  session: null,
  instrument: "",
  direction: null,
  entry: "",
  stop: "",
  target: "",
  setupNote: "",
  missReason: null,
  missReasonNote: "",
  result: null,
  notes: "",
};
