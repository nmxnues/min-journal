import { z } from "zod";
import type { Locale } from "@/lib/i18n/locale";
import { parseNumberInput } from "@/lib/format";
import {
  refineTradeNumerics,
  tradeFieldsShape,
  tradeMessage,
} from "@/lib/domain/trade-schema";
import { deriveSweepSide } from "@/lib/domain/trade";
import type { Trade } from "@/lib/domain/types";

/**
 * Trade detail's edit form (docs/decisions.md § Phase 4c) reuses every field
 * and rule from the New trade schema and adds the two columns 4a deferred
 * here: `exitReason` and `holdMinutes`. `rValueAtEntry` is deliberately absent
 * from this schema — it is never part of the form, never sent by the client,
 * and the update action never writes it, so there is no path by which editing
 * a trade can touch the frozen 1R value.
 */
export function createEditTradeSchema(locale: Locale = "en") {
  return z
    .object({
      ...tradeFieldsShape(locale),
      exitReason: z.string().trim(),
      holdMinutes: z.string().trim(),
    })
    .superRefine((values, ctx) => {
      refineTradeNumerics(values, ctx, locale);

      if (values.holdMinutes !== "") {
        const parsed = parseNumberInput(values.holdMinutes);
        if (parsed === null || !Number.isInteger(parsed)) {
          ctx.addIssue({
            code: "custom",
            path: ["holdMinutes"],
            message: tradeMessage(locale, "number"),
          });
        } else if (parsed < 0) {
          ctx.addIssue({
            code: "custom",
            path: ["holdMinutes"],
            message: tradeMessage(locale, "holdNonNegative"),
          });
        }
      }
    });
}

export type EditTradeInput = z.infer<ReturnType<typeof createEditTradeSchema>>;

/** Seeds the edit form from an existing trade's domain values. */
export function tradeToEditInput(trade: Trade): EditTradeInput {
  // Only carry the stored sweep side forward as an explicit override when it
  // disagrees with what the stored range/stop would derive on their own
  // (i.e. it really was an override, since "both" is unreachable by
  // inference) — otherwise leave it null so editing the range or stop keeps
  // live-deriving the sweep side, the same as on the New trade form.
  const derived = deriveSweepSide(trade);
  const sweepSideOverride = derived === trade.sweepSide ? null : trade.sweepSide;

  return {
    instrument: trade.instrument,
    date: trade.date,
    direction: trade.direction,
    session: trade.session,
    htfPairing: trade.htfPairing,
    rangeHigh: String(trade.rangeHigh),
    rangeLow: String(trade.rangeLow),
    sweepSideOverride,
    entry: String(trade.entry),
    stop: String(trade.stop),
    size: String(trade.size),
    target: trade.target === null ? "" : String(trade.target),
    exit: trade.exit === null ? "" : String(trade.exit),
    swap: trade.swap === null ? "" : String(trade.swap),
    modelId: trade.modelId,
    confirmation: trade.confirmation ?? "",
    result: trade.result,
    tags: trade.tags,
    notes: trade.notes ?? "",
    exitReason: trade.exitReason ?? "",
    holdMinutes: trade.holdMinutes === null ? "" : String(trade.holdMinutes),
  };
}
