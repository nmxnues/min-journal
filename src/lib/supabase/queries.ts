import "server-only";
import { createClient } from "./server";
import type { Database } from "@/lib/database.types";
import type {
  Account,
  Attachment,
  CashMovement,
  Direction,
  FocusItem,
  HtfPairing,
  RiskMode,
  Session,
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

export async function getSettings() {
  const supabase = await createClient();
  const { data, error } = await supabase.from("settings").select("*").maybeSingle();
  if (error) throw error;
  return data;
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

/** Everything `currentRValue` and the drawdown guard need for one account. */
export async function getAccountLedgerInputs(accountId: string): Promise<{
  trades: Trade[];
  cashMovements: CashMovement[];
}> {
  const supabase = await createClient();

  const [tradesResult, cashResult] = await Promise.all([
    supabase.from("trades").select("*").eq("account_id", accountId),
    supabase.from("cash_movements").select("*").eq("account_id", accountId),
  ]);

  if (tradesResult.error) throw tradesResult.error;
  if (cashResult.error) throw cashResult.error;

  return {
    trades: (tradesResult.data ?? []).map(toTrade),
    cashMovements: (cashResult.data ?? []).map(toCashMovement),
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
