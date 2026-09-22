import "server-only";
import { cookies } from "next/headers";
import { cache } from "react";
import { createClient } from "./server";
import { CURRENT_ACCOUNT_COOKIE } from "@/lib/current-account";
import type { Database } from "@/lib/database.types";
import type {
  Account,
  Attachment,
  CashMovement,
  Direction,
  FocusItem,
  HtfPairing,
  RiskChange,
  RiskMode,
  Session,
  Settings,
  SweepSide,
  Trade,
  TradeModel,
  TradeResult,
  WeeklyReview,
} from "@/lib/domain/types";

type Row<T extends keyof Database["public"]["Tables"]> =
  Database["public"]["Tables"][T]["Row"];

/**
 * Row -> domain mappers. The generated types are the loose, raw-schema layer:
 * CHECK-constrained columns arrive as plain `string` because only a real
 * Postgres enum narrows in `supabase gen types` (docs/decisions.md § Phase 1).
 * These casts are where that widening is undone — safe because the database
 * enforces exactly these value sets, so anything else can't be stored.
 */
export function toAccount(row: Row<"accounts">): Account {
  return {
    id: row.id,
    name: row.name,
    currency: row.currency,
    startingCapital: Number(row.starting_capital),
    startedAt: row.started_at,
    riskMode: row.risk_mode as RiskMode,
    riskPercent: row.risk_percent === null ? null : Number(row.risk_percent),
    fixedRiskAmount: row.fixed_risk_amount === null ? null : Number(row.fixed_risk_amount),
    drawdownLimitPercent: Number(row.drawdown_limit_percent),
    kind: row.kind === "backtest" ? "backtest" : "live",
  };
}

export function toTradeModel(row: Row<"models">): TradeModel {
  return {
    id: row.id,
    name: row.name,
    description: row.description,
    rules: Array.isArray(row.rules) ? (row.rules as string[]) : [],
    status: row.status === "retired" ? "retired" : "active",
    sortOrder: row.sort_order,
    referenceImagePath: row.reference_image_path,
  };
}

export function toTrade(row: Row<"trades">): Trade {
  return {
    id: row.id,
    accountId: row.account_id,
    date: row.date,
    instrument: row.instrument,
    direction: row.direction as Direction,
    session: row.session as Session,
    htfPairing: row.htf_pairing as HtfPairing,
    rangeHigh: Number(row.range_high),
    rangeLow: Number(row.range_low),
    sweepSide: row.sweep_side as SweepSide,
    entry: Number(row.entry),
    stop: Number(row.stop),
    target: row.target === null ? null : Number(row.target),
    exit: row.exit === null ? null : Number(row.exit),
    size: Number(row.size),
    modelId: row.model_id,
    confirmation: row.confirmation,
    result: row.result === null ? null : (row.result as TradeResult),
    exitReason: row.exit_reason,
    holdMinutes: row.hold_minutes,
    rValueAtEntry: Number(row.r_value_at_entry),
    swap: row.swap === null ? null : Number(row.swap),
    entryCommission: Number(row.entry_commission),
    exitCommission: Number(row.exit_commission),
    tags: row.tags ?? [],
    notes: row.notes,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

export function toAttachment(row: Row<"attachments">): Attachment {
  return {
    id: row.id,
    tradeId: row.trade_id,
    storagePath: row.storage_path,
    width: row.width,
    height: row.height,
    caption: row.caption,
    createdAt: row.created_at,
  };
}

export function toWeeklyReview(row: Row<"weekly_reviews">): WeeklyReview {
  return {
    id: row.id,
    isoWeek: row.iso_week,
    whatWorked: row.what_worked,
    whatDidnt: row.what_didnt,
    oneChange: row.one_change,
    focusItems: Array.isArray(row.focus_items) ? (row.focus_items as unknown as FocusItem[]) : [],
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

export function toCashMovement(row: Row<"cash_movements">): CashMovement {
  return {
    id: row.id,
    accountId: row.account_id,
    date: row.date,
    type: row.type === "withdrawal" ? "withdrawal" : "deposit",
    amount: Number(row.amount),
    currency: row.currency,
    note: row.note,
    createdAt: row.created_at,
  };
}

export function toRiskChange(row: Row<"account_risk_changes">): RiskChange {
  return {
    id: row.id,
    accountId: row.account_id,
    effectiveAt: row.effective_at,
    riskMode: row.risk_mode as RiskMode,
    riskPercent: row.risk_percent === null ? null : Number(row.risk_percent),
    fixedRiskAmount: row.fixed_risk_amount === null ? null : Number(row.fixed_risk_amount),
    createdAt: row.created_at,
  };
}

/** RLS scopes this to the signed-in user — a wrong id reads back null. */
export async function getAccount(id: string): Promise<Account | null> {
  const supabase = await createClient();
  const { data, error } = await supabase.from("accounts").select("*").eq("id", id).maybeSingle();

  if (error) throw error;
  return data === null ? null : toAccount(data);
}

/**
 * The account this app writes to. Multi-account is reserved in the schema but
 * not designed (docs/README.md § Capital), so "the account" is simply the
 * oldest one — deterministic, and stable if a second is ever added.
 */
export async function getPrimaryAccount(): Promise<Account | null> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("accounts")
    .select("*")
    .order("created_at", { ascending: true })
    .limit(1)
    .maybeSingle();

  if (error) throw error;
  return data === null ? null : toAccount(data);
}

/** Every account for the signed-in user, oldest first — the account switcher's own list. */
export async function getAllAccounts(): Promise<Account[]> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("accounts")
    .select("*")
    .order("created_at", { ascending: true });

  if (error) throw error;
  return (data ?? []).map(toAccount);
}

/**
 * The account every screen actually reads/writes against — Phase 9's first
 * real slice of the multi-account switching README always reserved
 * `accountId` for but left undesigned. Defaults to `getPrimaryAccount`'s
 * original behavior (the oldest account) unless a `current-account-id`
 * cookie names a different one that still exists and is this user's (RLS
 * makes a foreign or since-deleted id simply read back null, not an error —
 * so a stale cookie just falls through to the default rather than breaking).
 */
export async function getCurrentAccount(): Promise<Account | null> {
  const cookieStore = await cookies();
  const selectedId = cookieStore.get(CURRENT_ACCOUNT_COOKIE)?.value;

  if (selectedId !== undefined) {
    const supabase = await createClient();
    const { data, error } = await supabase.from("accounts").select("*").eq("id", selectedId).maybeSingle();
    if (error) throw error;
    if (data !== null) return toAccount(data);
  }

  return getPrimaryAccount();
}

/** RLS scopes this to the signed-in user, so a wrong or someone-else's id just reads back null. */
export async function getTrade(id: string): Promise<Trade | null> {
  const supabase = await createClient();
  const { data, error } = await supabase.from("trades").select("*").eq("id", id).maybeSingle();

  if (error) throw error;
  return data === null ? null : toTrade(data);
}

/** Every trade for the account, most recent first — Trade log's own query (filtering/sorting/paging is all client-side, over this one fetch). */
export async function getAllTrades(accountId: string): Promise<Trade[]> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("trades")
    .select("*")
    .eq("account_id", accountId)
    .order("date", { ascending: false })
    .order("created_at", { ascending: false });

  if (error) throw error;
  return (data ?? []).map(toTrade);
}

export async function getTradeAttachments(tradeId: string): Promise<Attachment[]> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("attachments")
    .select("*")
    .eq("trade_id", tradeId)
    .order("created_at", { ascending: true });

  if (error) throw error;
  return (data ?? []).map(toAttachment);
}

export async function getModels(): Promise<TradeModel[]> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("models")
    .select("*")
    .order("sort_order", { ascending: true });

  if (error) throw error;
  return (data ?? []).map(toTradeModel);
}

/**
 * `cache()`'d because RootLayout reads this on every route (for
 * `data-pnl`/`r_precision`) and at least one page (`/trades/new`, for its
 * default instrument/session) reads it again in the same request — without
 * this they were two separate round trips to the same row on that route.
 * Request-scoped only (React's per-render memoization, not a module-level
 * singleton), so this stays safe with `createClient()`'s own "fresh per
 * request" rule above.
 */
export const getSettings = cache(async () => {
  const supabase = await createClient();
  const { data, error } = await supabase.from("settings").select("*").maybeSingle();
  if (error) throw error;
  return data;
});

/** Row -> domain mapper for the Settings screen, which wants typed fields rather than `getSettings()`'s raw row. */
export function toSettings(row: Row<"settings">): Settings {
  return {
    pnlConvention: row.pnl_convention === "west" ? "west" : "kr",
    defaultInstrument: row.default_instrument,
    defaultSession: row.default_session as Session,
    rPrecision: row.r_precision,
    tagPresets: row.tag_presets,
    commissionPerLotPerSide: Number(row.commission_per_lot_per_side),
  };
}

/** Trades within an inclusive date range, most recent first — the Dashboard and Calendar's own query. */
export async function getTradesInRange(
  accountId: string,
  from: string,
  to: string,
): Promise<Trade[]> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("trades")
    .select("*")
    .eq("account_id", accountId)
    .gte("date", from)
    .lte("date", to)
    .order("date", { ascending: false })
    .order("created_at", { ascending: false });

  if (error) throw error;
  return (data ?? []).map(toTrade);
}

/**
 * The account's single most-recently-dated trade's date, or null with no
 * trades yet — a targeted one-row query rather than fetching every trade
 * just to find a max, since a backtest account can hold a year or more of
 * rows (docs/decisions.md § Phase 9 backtest follow-up: this is what the
 * Dashboard defaults to instead of always "this calendar month").
 */
export async function getMostRecentTradeDate(accountId: string): Promise<string | null> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("trades")
    .select("date")
    .eq("account_id", accountId)
    .order("date", { ascending: false })
    .limit(1)
    .maybeSingle();

  if (error) throw error;
  return data?.date ?? null;
}

/**
 * Everything the money selectors need for one account: `currentRValue`, the
 * drawdown guard, and the Capital screen's balance/1R series and ledger.
 */
export async function getAccountLedgerInputs(accountId: string): Promise<{
  trades: Trade[];
  cashMovements: CashMovement[];
  riskChanges: RiskChange[];
}> {
  const supabase = await createClient();

  const [tradesResult, cashResult, riskResult] = await Promise.all([
    supabase.from("trades").select("*").eq("account_id", accountId),
    supabase.from("cash_movements").select("*").eq("account_id", accountId),
    supabase
      .from("account_risk_changes")
      .select("*")
      .eq("account_id", accountId)
      .order("effective_at", { ascending: true }),
  ]);

  if (tradesResult.error) throw tradesResult.error;
  if (cashResult.error) throw cashResult.error;
  if (riskResult.error) throw riskResult.error;

  return {
    trades: (tradesResult.data ?? []).map(toTrade),
    cashMovements: (cashResult.data ?? []).map(toCashMovement),
    riskChanges: (riskResult.data ?? []).map(toRiskChange),
  };
}

/** RLS + the table's own `unique (user_id, iso_week)` scope this to at most one row. */
export async function getWeeklyReview(isoWeek: string): Promise<WeeklyReview | null> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("weekly_reviews")
    .select("*")
    .eq("iso_week", isoWeek)
    .maybeSingle();

  if (error) throw error;
  return data === null ? null : toWeeklyReview(data);
}
