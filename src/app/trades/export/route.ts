import { NextResponse, type NextRequest } from "next/server";
import { stringifyCsv } from "@/lib/csv";
import { plannedR, realizedR } from "@/lib/domain/trade";
import { filterTrades, parseTradeLogFilters, parseTradeLogSort, sortTrades } from "@/lib/domain/trade-log";
import type { Trade } from "@/lib/domain/types";
import { todayIso } from "@/lib/domain/dates";
import { getAllTrades, getModels, getCurrentAccount } from "@/lib/supabase/queries";
import {
  DIRECTION_LABELS,
  HTF_PAIRING_LABELS,
  RESULT_LABELS,
  SESSION_LABELS,
  SWEEP_SIDE_LABELS,
} from "@/lib/labels";
import { CSV_FIELD_LABELS, CSV_TARGET_FIELDS } from "../import/schema";

/**
 * Writes exactly the filtered set the table is showing (docs/README.md §
 * Trade log: "CSV export writes the filtered set"), re-deriving it from the
 * same query-string shape the page itself reads — no unpaginated trade list
 * ever has to round-trip through the client just so Export has something to
 * send. Column order matches Import's own field list, and enum-like columns
 * write the English label (Import accepts either the label or the raw code),
 * so a straight export-then-reimport round-trips.
 */
export async function GET(request: NextRequest) {
  const account = await getCurrentAccount();
  if (account === null) {
    return NextResponse.json({ error: "No account." }, { status: 404 });
  }

  const filters = parseTradeLogFilters(request.nextUrl.searchParams);
  const { sort, direction } = parseTradeLogSort(request.nextUrl.searchParams);

  const [allTrades, models] = await Promise.all([getAllTrades(account.id), getModels()]);
  const modelById = new Map(models.map((m) => [m.id, m]));

  const trades = sortTrades(filterTrades(allTrades, filters), sort, direction, models);

  const header = [...CSV_TARGET_FIELDS.map((field) => CSV_FIELD_LABELS[field].en), "Planned R", "Realized R"];
  const rows = trades.map((trade) => toCsvRow(trade, modelById));

  const csv = stringifyCsv([header, ...rows]);
  const filename = `trades-export-${todayIso()}.csv`;

  return new NextResponse(csv, {
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="${filename}"`,
    },
  });
}

function toCsvRow(trade: Trade, modelById: ReadonlyMap<string, { name: string }>): string[] {
  const planned = plannedR(trade);
  const realized = realizedR(trade);
  return [
    trade.date,
    trade.instrument,
    DIRECTION_LABELS[trade.direction].en,
    SESSION_LABELS[trade.session].en,
    HTF_PAIRING_LABELS[trade.htfPairing].en,
    String(trade.rangeHigh),
    String(trade.rangeLow),
    SWEEP_SIDE_LABELS[trade.sweepSide].en,
    String(trade.entry),
    String(trade.stop),
    trade.target === null ? "" : String(trade.target),
    trade.exit === null ? "" : String(trade.exit),
    // Blank for a trade with no swap recorded, "0" for one that recorded
    // zero — the same distinction the column itself carries, so an
    // export-then-reimport doesn't quietly turn "unknown" into "none".
    trade.swap === null ? "" : String(trade.swap),
    String(trade.size),
    String(trade.rValueAtEntry),
    trade.modelId === null ? "" : (modelById.get(trade.modelId)?.name ?? ""),
    trade.confirmation ?? "",
    trade.result === null ? "" : RESULT_LABELS[trade.result].en,
    trade.exitReason ?? "",
    trade.holdMinutes === null ? "" : String(trade.holdMinutes),
    trade.tags.join(";"),
    trade.notes ?? "",
    // Not part of CSV_TARGET_FIELDS (derived, not importable) — appended for
    // a human reading the export, harmless for Import since it only reads
    // the columns its own mapping step points at.
    planned === null ? "" : planned.toFixed(1),
    realized === null ? "" : realized.toFixed(1),
  ];
}
