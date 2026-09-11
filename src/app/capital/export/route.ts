import { NextResponse, type NextRequest } from "next/server";
import { stringifyCsv } from "@/lib/csv";
import { filterLedger, ledger } from "@/lib/domain/capital";
import { todayIso } from "@/lib/domain/dates";
import { getAccountLedgerInputs, getModels, getPrimaryAccount } from "@/lib/supabase/queries";
import { describeLedgerEntry, LEDGER_KIND_LABELS, parseLedgerFilter } from "../ledger-copy";

/**
 * The ledger card's "Export CSV" (mock 3a) — the same rows the card shows under
 * its current All / Cash only / Trades only filter, newest first. Re-derived
 * from the ledger selector here, never read from a stored table, since there
 * isn't one (docs/README.md § Capital).
 */
export async function GET(request: NextRequest) {
  const account = await getPrimaryAccount();
  if (account === null) {
    return NextResponse.json({ error: "No account." }, { status: 404 });
  }

  const filter = parseLedgerFilter(request.nextUrl.searchParams.get("filter"));
  const [{ trades, cashMovements, riskChanges }, models] = await Promise.all([
    getAccountLedgerInputs(account.id),
    getModels(),
  ]);
  const modelNameById = new Map(models.map((m) => [m.id, m.name]));
  const en = (strings: { en: string }) => strings.en;

  const entries = filterLedger(ledger(account, cashMovements, trades, riskChanges), filter);

  const header = ["Date", "Type", "Description", "Amount", "R", "Balance", "Currency"];
  const rows = entries.map((entry) => [
    entry.date,
    LEDGER_KIND_LABELS[entry.kind].en,
    describeLedgerEntry(entry, modelNameById, en),
    entry.amount.toFixed(2),
    entry.r === null ? "" : entry.r.toFixed(2),
    entry.balanceAfter.toFixed(2),
    account.currency,
  ]);

  return new NextResponse(stringifyCsv([header, ...rows]), {
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="ledger-export-${todayIso()}.csv"`,
    },
  });
}
