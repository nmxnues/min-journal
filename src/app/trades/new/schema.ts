import { z } from "zod";
import type { Locale } from "@/lib/i18n/locale";
import { refineTradeNumerics, tradeFieldsShape } from "@/lib/domain/trade-schema";

/**
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
 *
 * The shared field set and numeric rules live in `@/lib/domain/trade-schema`,
 * reused by Trade detail's edit form (docs/decisions.md § Phase 4c).
 */
export function createNewTradeSchema(locale: Locale = "en") {
  return z
    .object(tradeFieldsShape(locale))
    .superRefine((values, ctx) => refineTradeNumerics(values, ctx, locale));
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
