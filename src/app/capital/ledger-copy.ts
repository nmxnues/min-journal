import type { LedgerEntry, LedgerFilter } from "@/lib/domain/capital";
import type { LocaleStrings } from "@/lib/i18n/locale";
import { DIRECTION_LABELS } from "@/lib/labels";

/**
 * Ledger copy shared by the screen and its CSV export, so a row reads the same
 * in both. Plain module (no "use client"/"use server") — the Route Handler
 * calls these directly.
 */

/** The row tag. The opening balance is drawn as a deposit, like mock 3a's "Deposit · Starting capital". */
export const LEDGER_KIND_LABELS: Record<LedgerEntry["kind"], LocaleStrings> = {
  opening: { en: "Deposit", ko: "입금" },
  deposit: { en: "Deposit", ko: "입금" },
  withdrawal: { en: "Withdrawal", ko: "출금" },
  trade: { en: "Trade", ko: "트레이드" },
};

export const LEDGER_FILTERS: readonly LedgerFilter[] = ["all", "cash", "trades"];

export const LEDGER_FILTER_LABELS: Record<LedgerFilter, LocaleStrings> = {
  all: { en: "All", ko: "전체" },
  cash: { en: "Cash only", ko: "입출금" },
  trades: { en: "Trades only", ko: "트레이드" },
};

export function parseLedgerFilter(raw: string | null | undefined): LedgerFilter {
  return raw === "cash" || raw === "trades" ? raw : "all";
}

/**
 * "NQ · Long · C2 expansion" for a trade (mock 3a), the note for a cash
 * movement ("Monthly top-up · bank transfer"), falling back to its type.
 * `withModel: false` is mobile's shorter "NQ · 롱" (mock 3b).
 *
 * A trade that recorded a swap says so here rather than getting a ledger row
 * of its own: the row's Amount is already net of it, and splitting one trade
 * across two rows would leave "Trades only" and the running balance arguing
 * about which row the trade is (docs/decisions.md § Swap).
 */
export function describeLedgerEntry(
  entry: LedgerEntry,
  modelNameById: ReadonlyMap<string, string>,
  t: (strings: LocaleStrings) => string,
  withModel = true,
  formatAmount?: (value: number) => string,
): string {
  const source = entry.source;

  if (source.kind === "opening") return t({ en: "Starting capital", ko: "시작 자본" });

  if (source.kind === "trade") {
    const { trade } = source;
    const parts = [trade.instrument, t(DIRECTION_LABELS[trade.direction])];
    const modelName = trade.modelId === null ? undefined : modelNameById.get(trade.modelId);
    if (withModel && modelName !== undefined) parts.push(modelName);
    // Mobile passes no formatter and stays on its two-part "NQ · 롱".
    if (formatAmount !== undefined && entry.swap !== null && entry.swap !== 0) {
      parts.push(`${t({ en: "swap", ko: "스왑" })} ${formatAmount(entry.swap)}`);
    }
    if (formatAmount !== undefined && entry.commission !== null && entry.commission !== 0) {
      parts.push(`${t({ en: "commission", ko: "커미션" })} ${formatAmount(-entry.commission)}`);
    }
    return parts.join(" · ");
  }

  const note = source.movement.note?.trim();
  return note !== undefined && note !== "" ? note : t(LEDGER_KIND_LABELS[entry.kind]);
}
