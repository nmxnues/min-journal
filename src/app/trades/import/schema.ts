import { z } from "zod";
import { refineTradeNumerics, tradeMessage } from "@/lib/domain/trade-schema";
import type { AccountKind, Direction, HtfPairing, Session, SweepSide, TradeResult } from "@/lib/domain/types";
import { parseNumberInput } from "@/lib/format";
import type { Locale } from "@/lib/i18n/locale";
import {
  DIRECTION_LABELS,
  HTF_PAIRING_LABELS,
  RESULT_LABELS,
  resolveLabel,
  SESSION_LABELS,
  SWEEP_SIDE_LABELS,
} from "@/lib/labels";

/**
 * The columns a CSV row can supply. `rValueAtEntry` is required for a `live`
 * account — unlike the New trade form, which recomputes it from the
 * account's *current* balance, a historical import can't do that: today's
 * balance says nothing about what 1R was worth on a trade logged months ago
 * (docs/decisions.md § Phase 4a, flagged there for exactly this phase). A
 * `backtest` account doesn't have that problem — it freezes 1R to the
 * balance *as of the trade's own date* (`rValueAsOfDate`), which an import
 * can compute the same as `createTrade` does — so for those accounts the
 * column is optional: leave a row's cell blank and it's computed instead of
 * rejected (docs/decisions.md § CSV import backtest 1R).
 */
export const CSV_TARGET_FIELDS = [
  "date",
  "instrument",
  "direction",
  "session",
  "htfPairing",
  "rangeHigh",
  "rangeLow",
  "sweepSide",
  "entry",
  "stop",
  "target",
  "exit",
  "swap",
  "size",
  "rValueAtEntry",
  "model",
  "confirmation",
  "result",
  "exitReason",
  "holdMinutes",
  "tags",
  "notes",
] as const;
export type CsvTargetField = (typeof CSV_TARGET_FIELDS)[number];

const CSV_REQUIRED_FIELDS_BASE: readonly CsvTargetField[] = [
  "date",
  "instrument",
  "direction",
  "session",
  "htfPairing",
  "rangeHigh",
  "rangeLow",
  "sweepSide",
  "entry",
  "stop",
  "size",
];

/** A `live` account still must map/fill `rValueAtEntry`; a `backtest` account may leave it blank (computed on import). */
export function csvRequiredFields(accountKind: AccountKind): readonly CsvTargetField[] {
  return accountKind === "backtest" ? CSV_REQUIRED_FIELDS_BASE : [...CSV_REQUIRED_FIELDS_BASE, "rValueAtEntry"];
}

export const CSV_FIELD_LABELS: Record<CsvTargetField, { en: string; ko: string }> = {
  date: { en: "Date", ko: "날짜" },
  instrument: { en: "Instrument", ko: "종목" },
  direction: { en: "Direction", ko: "방향" },
  session: { en: "Session", ko: "세션" },
  htfPairing: { en: "HTF pairing", ko: "HTF 페어링" },
  rangeHigh: { en: "Range high", ko: "레인지 상단" },
  rangeLow: { en: "Range low", ko: "레인지 하단" },
  sweepSide: { en: "Sweep side", ko: "스윕 사이드" },
  entry: { en: "Entry", ko: "진입가" },
  stop: { en: "Stop", ko: "손절가" },
  target: { en: "Target", ko: "타겟" },
  exit: { en: "Exit", ko: "청산가" },
  swap: { en: "Swap", ko: "스왑" },
  size: { en: "Size", ko: "사이즈" },
  rValueAtEntry: { en: "1R value ($)", ko: "1R 금액" },
  model: { en: "Model", ko: "모델" },
  confirmation: { en: "Confirmation", ko: "확인 신호" },
  result: { en: "Result", ko: "결과" },
  exitReason: { en: "Exit reason", ko: "청산 사유" },
  holdMinutes: { en: "Hold (minutes)", ko: "보유 시간(분)" },
  tags: { en: "Tags", ko: "태그" },
  notes: { en: "Notes", ko: "노트" },
};

/** One CSV data row, already re-shaped from raw cells to target fields via the column mapping — every value is still a raw string. */
export type RawCsvRow = Record<CsvTargetField, string>;

export function emptyCsvRow(): RawCsvRow {
  return Object.fromEntries(CSV_TARGET_FIELDS.map((f) => [f, ""])) as RawCsvRow;
}

/**
 * Shares `refineTradeNumerics` with the New trade / edit forms for the
 * range/entry/stop/size/target/exit rules — same numbers, same rules,
 * regardless of where they came from (docs/decisions.md § Phase 4c split).
 * Enum-like fields accept either the stored code or either locale's display
 * label (`resolveLabel`), since a hand-authored CSV is as likely to say
 * "Long" as `long`.
 */
export function csvRowSchema(locale: Locale, accountKind: AccountKind) {
  return z
    .object({
      date: z.string().trim().min(1, tradeMessage(locale, "date")),
      instrument: z.string().trim().min(1, tradeMessage(locale, "instrument")),
      direction: z.string().trim().min(1),
      session: z.string().trim().min(1),
      htfPairing: z.string().trim().min(1),
      rangeHigh: z.string().trim().min(1),
      rangeLow: z.string().trim().min(1),
      sweepSide: z.string().trim().min(1),
      entry: z.string().trim().min(1),
      stop: z.string().trim().min(1),
      target: z.string().trim(),
      exit: z.string().trim(),
      // Optional for every account kind, and never required: a blank cell (or
      // an unmapped column) stores null, which is "not recorded" rather than
      // a claim that the trade paid no financing.
      swap: z.string().trim(),
      size: z.string().trim().min(1),
      // Required only for a `live` account — see csvRequiredFields above.
      rValueAtEntry: z.string().trim(),
      model: z.string().trim(),
      confirmation: z.string().trim(),
      result: z.string().trim(),
      exitReason: z.string().trim(),
      holdMinutes: z.string().trim(),
      tags: z.string().trim(),
      notes: z.string().trim(),
    })
    .superRefine((v, ctx) => {
      refineTradeNumerics(v, ctx, locale);

      const enumIssue = (path: string, message: string) => ctx.addIssue({ code: "custom", path: [path], message });

      if (resolveLabel(DIRECTION_LABELS, v.direction) === null) {
        enumIssue("direction", locale === "ko" ? "방향은 long/short여야 합니다." : "Direction must be long or short.");
      }
      if (resolveLabel(SESSION_LABELS, v.session) === null) {
        enumIssue("session", locale === "ko" ? "알 수 없는 세션입니다." : "Unrecognized session.");
      }
      if (resolveLabel(HTF_PAIRING_LABELS, v.htfPairing) === null) {
        enumIssue("htfPairing", locale === "ko" ? "알 수 없는 HTF 페어링입니다." : "Unrecognized HTF pairing.");
      }
      if (resolveLabel(SWEEP_SIDE_LABELS, v.sweepSide) === null) {
        enumIssue("sweepSide", locale === "ko" ? "알 수 없는 스윕 사이드입니다." : "Unrecognized sweep side.");
      }
      if (v.result !== "" && resolveLabel(RESULT_LABELS, v.result) === null) {
        enumIssue("result", locale === "ko" ? "결과는 win/loss/be 중 하나여야 합니다." : "Result must be win, loss, or be.");
      }

      // A `backtest` account may leave this blank (computed from the balance
      // as of the row's own date on import) — but if a value is given at
      // all, live or backtest, it still has to be a real positive number.
      if (accountKind === "live" && v.rValueAtEntry === "") {
        enumIssue(
          "rValueAtEntry",
          locale === "ko" ? "1R 금액을 입력하세요." : "Enter a 1R value.",
        );
      } else if (v.rValueAtEntry !== "") {
        const rValue = parseNumberInput(v.rValueAtEntry);
        if (rValue === null || rValue <= 0) {
          enumIssue(
            "rValueAtEntry",
            locale === "ko" ? "1R 금액은 0보다 큰 숫자여야 합니다." : "1R value must be a positive number.",
          );
        }
      }

      if (v.holdMinutes !== "") {
        const hold = parseNumberInput(v.holdMinutes);
        if (hold === null || hold < 0 || !Number.isInteger(hold)) {
          enumIssue(
            "holdMinutes",
            locale === "ko" ? "보유 시간은 0 이상의 정수여야 합니다." : "Hold time must be a non-negative whole number.",
          );
        }
      }
    });
}

export interface TradeInsertFromCsv {
  date: string;
  instrument: string;
  direction: Direction;
  session: Session;
  htf_pairing: HtfPairing;
  range_high: number;
  range_low: number;
  sweep_side: SweepSide;
  entry: number;
  stop: number;
  target: number | null;
  exit: number | null;
  /** Account-currency swap; `null` when the column was blank or unmapped. Negative for a cost. */
  swap: number | null;
  size: number;
  model_id: string | null;
  confirmation: string | null;
  result: TradeResult | null;
  exit_reason: string | null;
  hold_minutes: number | null;
  /** `null` means the CSV left it blank — only ever valid for a `backtest` account, resolved before insert (see `importTrades`). */
  r_value_at_entry: number | null;
  tags: string[];
  notes: string | null;
}

/** Only call this on a row that already passed `csvRowSchema` — every `!` below is backed by that. */
export function toTradeInsert(row: RawCsvRow, modelIdByName: ReadonlyMap<string, string>): TradeInsertFromCsv {
  return {
    date: row.date,
    instrument: row.instrument,
    direction: resolveLabel(DIRECTION_LABELS, row.direction)!,
    session: resolveLabel(SESSION_LABELS, row.session)!,
    htf_pairing: resolveLabel(HTF_PAIRING_LABELS, row.htfPairing)!,
    range_high: parseNumberInput(row.rangeHigh)!,
    range_low: parseNumberInput(row.rangeLow)!,
    sweep_side: resolveLabel(SWEEP_SIDE_LABELS, row.sweepSide)!,
    entry: parseNumberInput(row.entry)!,
    stop: parseNumberInput(row.stop)!,
    target: row.target === "" ? null : parseNumberInput(row.target),
    exit: row.exit === "" ? null : parseNumberInput(row.exit),
    swap: row.swap === "" ? null : parseNumberInput(row.swap),
    size: parseNumberInput(row.size)!,
    // No match by name is treated as Unassigned rather than a rejection — a
    // typo'd model name shouldn't sink an otherwise-valid historical row.
    model_id: row.model === "" ? null : (modelIdByName.get(row.model.trim().toLowerCase()) ?? null),
    confirmation: row.confirmation === "" ? null : row.confirmation,
    result: row.result === "" ? null : resolveLabel(RESULT_LABELS, row.result),
    exit_reason: row.exitReason === "" ? null : row.exitReason,
    hold_minutes: row.holdMinutes === "" ? null : parseNumberInput(row.holdMinutes),
    r_value_at_entry: row.rValueAtEntry === "" ? null : parseNumberInput(row.rValueAtEntry)!,
    // Semicolon-separated within the one CSV cell — a comma is already the
    // file's own column delimiter, so reusing it inside a field just for tags
    // would force every tag list to be quoted for no real benefit.
    tags: row.tags === "" ? [] : row.tags.split(";").map((tag) => tag.trim()).filter((tag) => tag !== ""),
    notes: row.notes === "" ? null : row.notes,
  };
}
