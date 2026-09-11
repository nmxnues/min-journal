/**
 * Domain types.
 *
 * These are the app-facing shapes. `src/lib/database.types.ts` is the raw,
 * generated schema layer where the CHECK-constrained columns come back as
 * plain `string` (Postgres CHECK constraints can't be narrowed by
 * `supabase gen types` — see docs/decisions.md); this file is where those
 * become real literal unions.
 *
 * Naming is camelCase here and snake_case in the database; the row -> domain
 * mapper lands with the queries in Phase 4.
 */

export type Direction = "long" | "short";
export type Session = "asia" | "london" | "ny_am";
export type SweepSide = "low" | "high" | "both" | "none";
export type TradeResult = "win" | "loss" | "be";
export type HtfPairing = "m_w_2d" | "w_2d" | "d_h1" | "h1_m5";
export type RiskMode = "percent" | "fixed";
export type CashMovementType = "deposit" | "withdrawal";
export type ModelStatus = "active" | "retired";
/** settings.pnl_convention — "kr" (red gain / blue loss) or "west" (green gain / red loss). */
export type PnlConvention = "kr" | "west";

export interface Settings {
  pnlConvention: PnlConvention;
  defaultInstrument: string;
  defaultSession: Session;
  /** Decimal places on a displayed R value, e.g. 1 for "+18.4R". */
  rPrecision: number;
}

/** ISO date, `YYYY-MM-DD` (Postgres `date`). Sorts correctly as a string. */
export type IsoDate = string;

export interface Trade {
  id: string;
  accountId: string;
  date: IsoDate;
  instrument: string;
  direction: Direction;
  session: Session;
  htfPairing: HtfPairing;
  rangeHigh: number;
  rangeLow: number;
  sweepSide: SweepSide;
  entry: number;
  stop: number;
  target: number | null;
  exit: number | null;
  size: number;
  modelId: string | null;
  confirmation: string | null;
  result: TradeResult | null;
  exitReason: string | null;
  holdMinutes: number | null;
  /** Currency value of 1R frozen at log time. Never recomputed. */
  rValueAtEntry: number;
  tags: string[];
  notes: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface TradeModel {
  id: string;
  name: string;
  description: string | null;
  rules: string[];
  status: ModelStatus;
  sortOrder: number;
  referenceImagePath: string | null;
}

/** How 1R is sized. The account carries today's; `RiskChange` carries every past one. */
export interface RiskSetting {
  riskMode: RiskMode;
  /** Percent of balance risked per trade, e.g. 1 for 1%. Null when riskMode is 'fixed'. */
  riskPercent: number | null;
  /** Currency amount risked per trade. Null when riskMode is 'percent'. */
  fixedRiskAmount: number | null;
}

export interface Account extends RiskSetting {
  id: string;
  name: string;
  currency: string;
  startingCapital: number;
  startedAt: IsoDate;
  drawdownLimitPercent: number;
}

/**
 * One value the account's risk setting has had, written by a database trigger
 * whenever it changes (docs/decisions.md § Phase 8). Lets the Capital screen
 * show what 1R was worth at each point in the past rather than re-projecting
 * the whole history under today's setting.
 */
export interface RiskChange extends RiskSetting {
  id: string;
  accountId: string;
  /** ISO timestamp; applies to every balance point dated on or after its UTC date. */
  effectiveAt: string;
  createdAt: string;
}

export interface Attachment {
  id: string;
  tradeId: string;
  storagePath: string;
  width: number | null;
  height: number | null;
  caption: string | null;
  createdAt: string;
}

export interface CashMovement {
  id: string;
  accountId: string;
  date: IsoDate;
  type: CashMovementType;
  amount: number;
  currency: string;
  note: string | null;
  createdAt: string;
}

export interface FocusItem {
  text: string;
  checked: boolean;
}

export interface WeeklyReview {
  id: string;
  isoWeek: string;
  whatWorked: string | null;
  whatDidnt: string | null;
  oneChange: string | null;
  focusItems: FocusItem[];
  createdAt: string;
  updatedAt: string;
}
