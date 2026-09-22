"use client";

import { useState, useTransition } from "react";
import { Button, Field, Modal, Select } from "@/components/ui";
import { parseCsv } from "@/lib/csv";
import type { AccountKind } from "@/lib/domain/types";
import { useLocale, useT } from "@/lib/i18n/locale-context";
import { importTrades } from "./actions";
import {
  CSV_FIELD_LABELS,
  CSV_TARGET_FIELDS,
  csvRequiredFields,
  csvRowSchema,
  emptyCsvRow,
  type CsvTargetField,
  type RawCsvRow,
} from "./schema";

export interface ImportModalProps {
  open: boolean;
  accountKind: AccountKind;
  onClose: () => void;
  onImported: () => void;
}

type Step = "pick" | "map" | "preview";
type Mapping = Record<CsvTargetField, number | null>;

function emptyMapping(): Mapping {
  return Object.fromEntries(CSV_TARGET_FIELDS.map((f) => [f, null])) as Mapping;
}

/** Best-effort guess: match a CSV header cell to a target field by its key or either locale's label, case-insensitively. */
function guessMapping(header: string[]): Mapping {
  const mapping = emptyMapping();
  header.forEach((cell, index) => {
    const needle = cell.trim().toLowerCase();
    for (const field of CSV_TARGET_FIELDS) {
      const labels = CSV_FIELD_LABELS[field];
      if (
        mapping[field] === null &&
        (field.toLowerCase() === needle || labels.en.toLowerCase() === needle || labels.ko.toLowerCase() === needle)
      ) {
        mapping[field] = index;
      }
    }
  });
  return mapping;
}

function applyMapping(row: string[], mapping: Mapping): RawCsvRow {
  const out = emptyCsvRow();
  for (const field of CSV_TARGET_FIELDS) {
    const index = mapping[field];
    if (index !== null) out[field] = (row[index] ?? "").trim();
  }
  return out;
}

export function ImportModal({ open, accountKind, onClose, onImported }: ImportModalProps) {
  const t = useT();
  const locale = useLocale();
  const [isPending, startTransition] = useTransition();
  const requiredFields = csvRequiredFields(accountKind);

  const [step, setStep] = useState<Step>("pick");
  const [header, setHeader] = useState<string[]>([]);
  const [dataRows, setDataRows] = useState<string[][]>([]);
  const [mapping, setMapping] = useState<Mapping>(emptyMapping());
  const [fileError, setFileError] = useState<string | null>(null);
  const [mappingError, setMappingError] = useState<string | null>(null);
  const [serverError, setServerError] = useState<string | null>(null);

  function reset() {
    setStep("pick");
    setHeader([]);
    setDataRows([]);
    setMapping(emptyMapping());
    setFileError(null);
    setMappingError(null);
    setServerError(null);
  }

  function close() {
    reset();
    onClose();
  }

  async function onFile(file: File) {
    setFileError(null);
    const text = await file.text();
    const rows = parseCsv(text);
    if (rows.length < 2) {
      setFileError(
        t({ en: "This file has no data rows below the header.", ko: "헤더 아래에 데이터 행이 없습니다." }),
      );
      return;
    }
    setHeader(rows[0]);
    setDataRows(rows.slice(1));
    setMapping(guessMapping(rows[0]));
    setStep("map");
  }

  function confirmMapping() {
    const missing = requiredFields.filter((f) => mapping[f] === null);
    if (missing.length > 0) {
      setMappingError(
        t({
          en: `Map every required field first (still missing: ${missing.map((f) => CSV_FIELD_LABELS[f].en).join(", ")}).`,
          ko: `필수 항목을 모두 매핑하세요 (누락: ${missing.map((f) => CSV_FIELD_LABELS[f].ko).join(", ")}).`,
        }),
      );
      return;
    }
    setMappingError(null);
    setStep("preview");
  }

  const mappedRows = dataRows.map((row) => applyMapping(row, mapping));
  const schema = csvRowSchema(locale, accountKind);
  const results = mappedRows.map((row, i) => ({ index: i, row, parsed: schema.safeParse(row) }));
  const validRows = results.filter((r) => r.parsed.success).map((r) => r.row);
  const rejectedRows = results.filter((r) => !r.parsed.success);

  function confirmImport() {
    setServerError(null);
    startTransition(async () => {
      const result = await importTrades(validRows, locale);
      if (result.ok) {
        reset();
        onImported();
      } else {
        setServerError(result.error);
      }
    });
  }

  return (
    <Modal
      open={open}
      onClose={close}
      title={t({ en: "Import trades", ko: "트레이드 가져오기" })}
      closeLabel={t({ en: "Close", ko: "닫기" })}
      footer={
        step === "map" ? (
          <div className="flex gap-12">
            <Button tone="neutral" size="lg" className="flex-1" onClick={() => setStep("pick")}>
              {t({ en: "Back", ko: "뒤로" })}
            </Button>
            <Button size="lg" className="flex-2" onClick={confirmMapping}>
              {t({ en: "Continue", ko: "계속" })}
            </Button>
          </div>
        ) : step === "preview" ? (
          <div className="flex gap-12">
            <Button tone="neutral" size="lg" className="flex-1" onClick={() => setStep("map")} disabled={isPending}>
              {t({ en: "Back", ko: "뒤로" })}
            </Button>
            <Button size="lg" className="flex-2" onClick={confirmImport} disabled={isPending || validRows.length === 0}>
              {isPending
                ? t({ en: "Importing…", ko: "가져오는 중…" })
                : t({ en: `Import ${validRows.length}`, ko: `${validRows.length}건 가져오기` })}
            </Button>
          </div>
        ) : undefined
      }
    >
      <div className="flex flex-col gap-16 pb-8">
        {step === "pick" && (
          <>
            <p className="text-13_5 leading-[1.6] text-secondary">
              {t({
                en: "Pick a CSV file. The next step maps its columns onto trade fields, so any header names work.",
                ko: "CSV 파일을 선택하세요. 다음 단계에서 컬럼을 트레이드 필드에 매핑하므로 헤더 이름은 자유롭게 써도 됩니다.",
              })}
            </p>
            <input
              type="file"
              accept=".csv,text/csv"
              onChange={(event) => {
                const file = event.target.files?.[0];
                if (file) void onFile(file);
                event.target.value = "";
              }}
              className="text-13_5 text-body"
            />
            {fileError !== null && <p className="text-13 font-semibold text-loss">{fileError}</p>}
          </>
        )}

        {step === "map" && (
          <>
            <p className="text-13_5 leading-[1.6] text-secondary">
              {t({
                en: `${dataRows.length} data ${dataRows.length === 1 ? "row" : "rows"} found. Map each field below to a column, or leave optional ones unmapped.`,
                ko: `데이터 ${dataRows.length}행을 찾았습니다. 아래에서 각 필드를 컬럼에 매핑하세요 (선택 항목은 비워둘 수 있습니다).`,
              })}
            </p>
            {accountKind === "backtest" && (
              <p className="rounded-8 bg-accent-tint px-12 py-10 text-12_5 leading-[1.6] text-accent">
                {t({
                  en: "This is a backtest account — 1R value is optional. Leave it unmapped (or blank on a row) and it's computed from the balance as of that trade's own date.",
                  ko: "백테스트 계좌입니다 — 1R 금액은 선택 항목입니다. 매핑하지 않거나 행별로 비워두면 그 트레이드 날짜 시점 잔고 기준으로 자동 계산됩니다.",
                })}
              </p>
            )}
            <div className="grid grid-cols-2 gap-14">
              {CSV_TARGET_FIELDS.map((field) => {
                const required = requiredFields.includes(field);
                const label = `${t(CSV_FIELD_LABELS[field])}${required ? " *" : ""}`;
                return (
                  <Field key={field} label={label} htmlFor={`map-${field}`}>
                    <Select
                      id={`map-${field}`}
                      value={mapping[field] === null ? "" : String(mapping[field])}
                      onChange={(event) =>
                        setMapping((m) => ({
                          ...m,
                          [field]: event.target.value === "" ? null : Number(event.target.value),
                        }))
                      }
                    >
                      <option value="">{t({ en: "Not mapped", ko: "매핑 안 함" })}</option>
                      {header.map((cell, index) => (
                        <option key={index} value={index}>
                          {cell}
                        </option>
                      ))}
                    </Select>
                  </Field>
                );
              })}
            </div>
            {mappingError !== null && <p className="text-13 font-semibold text-loss">{mappingError}</p>}
          </>
        )}

        {step === "preview" && (
          <>
            <div className="flex gap-16">
              <p className="text-13_5 font-semibold text-gain">
                {t({ en: `${validRows.length} ready to import`, ko: `${validRows.length}건 가져올 준비 완료` })}
              </p>
              {rejectedRows.length > 0 && (
                <p className="text-13_5 font-semibold text-loss">
                  {t({ en: `${rejectedRows.length} rejected`, ko: `${rejectedRows.length}건 거부됨` })}
                </p>
              )}
            </div>

            {rejectedRows.length > 0 && (
              <div className="max-h-[240px] overflow-y-auto rounded-16 bg-surface-subtle p-14">
                <div className="flex flex-col gap-8">
                  {rejectedRows.map(({ index, parsed }) => (
                    <p key={index} className="text-12_5 leading-[1.5] text-secondary">
                      <span className="font-bold text-ink">
                        {t({ en: `Row ${index + 2}`, ko: `${index + 2}행` })}:
                      </span>{" "}
                      {!parsed.success && parsed.error.issues[0]?.message}
                    </p>
                  ))}
                </div>
              </div>
            )}

            {serverError !== null && <p className="text-13 font-semibold text-loss">{serverError}</p>}
          </>
        )}
      </div>
    </Modal>
  );
}
