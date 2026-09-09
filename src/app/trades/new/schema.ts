import { z } from "zod";
import { parseNumberInput } from "@/lib/format";
import type { Locale } from "@/lib/i18n/locale";

/**
 * Numeric fields stay strings in the form so the user can type/paste freely
 * ("23,411.00", "$23 411") without being fought mid-keystroke; parsing happens
 * here and again on submit (src/lib/format.ts).
 *
 * Required set = exactly the columns the schema declares NOT NULL and the user
 * must supply: instrument, date, direction, session, htf pairing, range
 * high/low, entry, stop, size. Target, exit, model, result, confirmation, tags
 * and notes are optional — a trade with no exit is simply still open
 * (docs/decisions.md § Phase 4a).
 *
 * Blocking rules stop at what the database itself refuses (stop ≠ entry, range
 * high > low, size > 0); everything softer — target on the wrong side, entry
 * outside the range, off-plan, drawdown proximity, a retired model, a result
 * that disagrees with the exit — is a warning surfaced beside the field, never
 * a block. Warnings live in the form (see `collectWarnings`), not here.
 */
const MESSAGES = {
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
} as const;

export function createNewTradeSchema(locale: Locale = "en") {
  const m = <K extends keyof typeof MESSAGES>(key: K) => MESSAGES[key][locale];
  const requiredNumber = (message: string) => z.string().trim().min(1, message);

  return z
    .object({
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
    })
    .superRefine((values, ctx) => {
      const numeric = (
        field: "rangeHigh" | "rangeLow" | "entry" | "stop" | "size" | "target" | "exit",
      ) => {
        const raw = values[field];
        if (raw === "") {
          return null; // required-ness is handled by min(1) above
        }
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
    });
}

export type NewTradeInput = z.infer<ReturnType<typeof createNewTradeSchema>>;

export const NEW_TRADE_DEFAULTS: NewTradeInput = {
  instrument: "",
  date: "",
  direction: "long",
  session: "asia",
  htfPairing: "w_2d",
  rangeHigh: "",
  rangeLow: "",
  sweepSideOverride: null,
  entry: "",
  stop: "",
  size: "",
  target: "",
  exit: "",
  modelId: null,
  confirmation: "",
  result: null,
  tags: [],
  notes: "",
};
