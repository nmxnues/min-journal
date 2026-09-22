"use client";

import { useRouter } from "next/navigation";
import { useEffect, useState, useTransition, type FormEvent, type KeyboardEvent } from "react";
import { Button, Combobox, Field, Input, Textarea } from "@/components/ui";
import { cn } from "@/lib/cn";
import { MAX_TRADE_DATE, MIN_TRADE_DATE, todayIso } from "@/lib/domain/dates";
import {
  MISS_REASON_ORDER,
  missedCommissionR,
  missedGrossR,
  type MissedTrade,
} from "@/lib/domain/missed-trade";
import { parseNumberInput } from "@/lib/format";
import { INSTRUMENT_PRESETS } from "@/lib/instruments";
import { useLocale, useT } from "@/lib/i18n/locale-context";
import { DIRECTION_LABELS, MISS_REASON_LABELS, RESULT_LABELS, SESSION_LABELS, SESSION_ORDER } from "@/lib/labels";
import { useFormatR } from "@/lib/settings/context";
import { createMissedTrade, updateMissedTrade } from "./actions";
import { ChoiceGroup } from "./choice-group";
import { createMissedTradeSchema, MISSED_TRADE_DEFAULTS, type MissedTradeInput } from "./schema";

type Errors = Partial<Record<keyof MissedTradeInput, string>>;

/** Field order = Tab order, used to focus the first invalid field. */
const FIELD_ORDER: readonly (keyof MissedTradeInput)[] = [
  "date",
  "time",
  "session",
  "instrument",
  "direction",
  "entry",
  "stop",
  "target",
  "setupNote",
  "missReason",
  "missReasonNote",
  "result",
  "notes",
];

const fieldId = (name: keyof MissedTradeInput) => `missed-${name}`;

function focusField(name: keyof MissedTradeInput) {
  const el = document.getElementById(fieldId(name));
  // A choice group's id is on its container; focus its one Tab stop.
  const target = el?.getAttribute("role") === "radiogroup" ? el.querySelector<HTMLElement>('[tabindex="0"]') : el;
  target?.focus();
}

/**
 * 24-hour `HH:MM` typed as four digits. A native time input was tried first,
 * but in a Korean browser it opens on an 오전/오후 segment that needs its own
 * keystrokes, which defeats keyboard-only entry.
 */
export function formatTimeInput(raw: string): string {
  const digits = raw.replace(/\D/g, "").slice(0, 4);
  return digits.length <= 2 ? digits : `${digits.slice(0, 2)}:${digits.slice(2)}`;
}

export function toFormValues(m: MissedTrade): MissedTradeInput {
  const num = (n: number | null) => (n === null ? "" : String(n));
  return {
    date: m.date,
    time: m.time ?? "",
    session: m.session,
    instrument: m.instrument,
    direction: m.direction,
    entry: num(m.entry),
    stop: num(m.stop),
    target: num(m.target),
    setupNote: m.setupNote ?? "",
    missReason: m.missReason,
    missReasonNote: m.missReasonNote ?? "",
    result: m.result,
    notes: m.notes ?? "",
  };
}

/**
 * Keyboard-first entry (docs/decisions.md § Missed trades): Tab walks the
 * fields in visual order, each choice row is one Tab stop driven by the arrow
 * keys, Ctrl+Enter (or ⌘+Enter) saves from anywhere in the form, and a plain
 * Enter is a newline in the two memo boxes and does nothing in a one-line
 * field — so a stray Enter never saves a half-filled row.
 */
export function MissedForm({
  editing,
  onDoneEditing,
  defaultInstrument,
  commissionPerLotPerSide,
  className,
}: {
  editing: MissedTrade | null;
  onDoneEditing: () => void;
  defaultInstrument: string;
  commissionPerLotPerSide: number;
  className?: string;
}) {
  const t = useT();
  const locale = useLocale();
  const formatR = useFormatR();
  const router = useRouter();
  const [isPending, startTransition] = useTransition();

  const blank = (): MissedTradeInput => ({ ...MISSED_TRADE_DEFAULTS, date: todayIso(), instrument: defaultInstrument });
  const [values, setValues] = useState<MissedTradeInput>(blank);
  const [errors, setErrors] = useState<Errors>({});
  const [serverError, setServerError] = useState<string | null>(null);
  const [savedNote, setSavedNote] = useState<string | null>(null);

  // Loading a row into the form for editing (or leaving edit mode).
  useEffect(() => {
    setValues(editing === null ? blank() : toFormValues(editing));
    setErrors({});
    setServerError(null);
    if (editing !== null) focusField("date");
    // blank() only reads props that don't change while the page is open.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [editing]);

  function set<K extends keyof MissedTradeInput>(key: K, value: MissedTradeInput[K]) {
    setValues((v) => ({ ...v, [key]: value }));
    setSavedNote(null);
    if (errors[key] !== undefined) setErrors((e) => ({ ...e, [key]: undefined }));
  }

  function submit() {
    if (isPending) return;
    setServerError(null);
    const parsed = createMissedTradeSchema(locale).safeParse(values);
    if (!parsed.success) {
      const next: Errors = {};
      for (const issue of parsed.error.issues) {
        const key = issue.path[0] as keyof MissedTradeInput;
        next[key] ??= issue.message;
      }
      setErrors(next);
      const first = FIELD_ORDER.find((k) => next[k] !== undefined);
      if (first !== undefined) focusField(first);
      return;
    }

    startTransition(async () => {
      const result =
        editing === null
          ? await createMissedTrade(values, locale)
          : await updateMissedTrade(editing.id, values, locale);
      if (!result.ok) {
        setServerError(result.error);
        return;
      }
      // Keep the date and pair for the next entry — several misses on the
      // same day and pair are the common case.
      setValues({ ...MISSED_TRADE_DEFAULTS, date: values.date, instrument: values.instrument });
      setErrors({});
      setSavedNote(editing === null ? t({ en: "Saved.", ko: "저장했어요." }) : t({ en: "Updated.", ko: "수정했어요." }));
      if (editing !== null) onDoneEditing();
      router.refresh();
      focusField("date");
    });
  }

  function onSubmit(event: FormEvent) {
    event.preventDefault();
    submit();
  }

  function onKeyDown(event: KeyboardEvent<HTMLFormElement>) {
    if (event.key === "Enter" && (event.ctrlKey || event.metaKey)) {
      event.preventDefault();
      submit();
      return;
    }
    if (event.key === "Escape" && editing !== null) {
      event.preventDefault();
      onDoneEditing();
      return;
    }
    // A plain Enter in a one-line field would submit the form natively; the
    // combobox has already handled (and prevented) the Enter that picks a pair.
    if (event.key === "Enter" && (event.target as HTMLElement).tagName === "INPUT") {
      event.preventDefault();
    }
  }

  // Live preview of the hypothetical R, the same functions the summary uses.
  const preview = (() => {
    if (values.result === null) return null;
    const row = {
      instrument: values.instrument,
      entry: parseNumberInput(values.entry),
      stop: parseNumberInput(values.stop),
      target: parseNumberInput(values.target),
      result: values.result,
      commissionPerLotPerSide: editing?.commissionPerLotPerSide ?? commissionPerLotPerSide,
    };
    const gross = missedGrossR(row);
    const commission = missedCommissionR(row);
    if (gross === null || commission === null) return null;
    return { net: gross - commission, commission };
  })();

  const shortcut = t({ en: "Ctrl+Enter to save", ko: "Ctrl+Enter로 저장" });

  return (
    <form
      noValidate
      onSubmit={onSubmit}
      onKeyDown={onKeyDown}
      className={cn("flex flex-col gap-18", className)}
    >
      <div className="grid grid-cols-1 gap-12 min-[380px]:grid-cols-[minmax(0,1fr)_minmax(0,140px)]">
        <Field label={t({ en: "Date *", ko: "날짜 *" })} htmlFor={fieldId("date")} error={errors.date}>
          <Input
            id={fieldId("date")}
            type="date"
            className="min-w-0"
            min={MIN_TRADE_DATE}
            max={MAX_TRADE_DATE}
            value={values.date}
            onChange={(e) => set("date", e.target.value)}
          />
        </Field>
        <Field label={t({ en: "Time", ko: "시간" })} htmlFor={fieldId("time")} error={errors.time}>
          <Input
            id={fieldId("time")}
            className="min-w-0"
            inputMode="numeric"
            autoComplete="off"
            placeholder="14:30"
            maxLength={5}
            value={values.time}
            onChange={(e) => set("time", formatTimeInput(e.target.value))}
          />
        </Field>
      </div>

      <Field label={t({ en: "Session", ko: "세션" })} error={errors.session}>
        <ChoiceGroup
          id={fieldId("session")}
          label={t({ en: "Session", ko: "세션" })}
          allowClear
          value={values.session}
          onChange={(v) => set("session", v)}
          options={SESSION_ORDER.map((s) => ({ value: s, label: t(SESSION_LABELS[s]) }))}
        />
      </Field>

      <div className="grid grid-cols-[1fr_1fr] gap-12">
        <Field label={t({ en: "Pair *", ko: "통화쌍 *" })} htmlFor={fieldId("instrument")} error={errors.instrument}>
          <Combobox
            id={fieldId("instrument")}
            value={values.instrument}
            onChange={(v) => set("instrument", v.toUpperCase())}
            options={INSTRUMENT_PRESETS}
          />
        </Field>
        <Field label={t({ en: "Direction *", ko: "방향 *" })} error={errors.direction}>
          <ChoiceGroup
            id={fieldId("direction")}
            label={t({ en: "Direction", ko: "방향" })}
            invalid={errors.direction !== undefined}
            value={values.direction}
            onChange={(v) => v !== null && set("direction", v)}
            options={(["long", "short"] as const).map((d) => ({ value: d, label: t(DIRECTION_LABELS[d]) }))}
          />
        </Field>
      </div>

      <div className="grid grid-cols-3 gap-12">
        {(
          [
            ["entry", { en: "Entry", ko: "가상 진입가" }],
            ["stop", { en: "Stop", ko: "손절가" }],
            ["target", { en: "Target", ko: "목표가" }],
          ] as const
        ).map(([key, label]) => (
          <Field key={key} label={t(label)} htmlFor={fieldId(key)} error={errors[key]}>
            <Input
              id={fieldId(key)}
              inputMode="decimal"
              autoComplete="off"
              value={values[key]}
              onChange={(e) => set(key, e.target.value)}
            />
          </Field>
        ))}
      </div>

      <Field label={t({ en: "Why it was valid", ko: "시스템상 유효했던 근거" })} htmlFor={fieldId("setupNote")}>
        <Textarea
          id={fieldId("setupNote")}
          tone="review"
          className="min-h-[64px]"
          rows={2}
          value={values.setupNote}
          onChange={(e) => set("setupNote", e.target.value)}
        />
      </Field>

      <Field label={t({ en: "Why you didn't enter *", ko: "못 들어간 이유 *" })} error={errors.missReason}>
        <ChoiceGroup
          id={fieldId("missReason")}
          label={t({ en: "Why you didn't enter", ko: "못 들어간 이유" })}
          invalid={errors.missReason !== undefined}
          value={values.missReason}
          onChange={(v) => v !== null && set("missReason", v)}
          options={MISS_REASON_ORDER.map((r) => ({ value: r, label: t(MISS_REASON_LABELS[r]) }))}
        />
        <Input
          id={fieldId("missReasonNote")}
          className="mt-8"
          autoComplete="off"
          placeholder={t({ en: "Note on the reason (optional)", ko: "이유 메모 (선택)" })}
          value={values.missReasonNote}
          onChange={(e) => set("missReasonNote", e.target.value)}
        />
      </Field>

      <Field
        label={t({ en: "Hypothetical result *", ko: "가상 결과 *" })}
        error={errors.result}
        hint={
          values.result === null
            ? undefined
            : preview === null
              ? t({
                  en: "R needs entry and stop (and target for a win).",
                  ko: "R 계산에는 진입가·손절가(익절이면 목표가도)가 필요해요.",
                })
              : `≈ ${formatR(preview.net, 2)} ${t({ en: "after commission", ko: "커미션 차감" })} (${formatR(-preview.commission, 2)})`
        }
      >
        <ChoiceGroup
          id={fieldId("result")}
          label={t({ en: "Hypothetical result", ko: "가상 결과" })}
          invalid={errors.result !== undefined}
          value={values.result}
          onChange={(v) => v !== null && set("result", v)}
          options={[
            { value: "win", label: t(RESULT_LABELS.win), tone: "gain" },
            { value: "loss", label: t(RESULT_LABELS.loss), tone: "loss" },
            { value: "be", label: t(RESULT_LABELS.be) },
          ]}
        />
      </Field>

      <Field label={t({ en: "Notes", ko: "자유 메모" })} htmlFor={fieldId("notes")}>
        <Textarea
          id={fieldId("notes")}
          tone="review"
          className="min-h-[80px]"
          value={values.notes}
          onChange={(e) => set("notes", e.target.value)}
        />
      </Field>

      {serverError !== null && <p className="text-13 font-medium text-loss">{serverError}</p>}

      <div className="flex items-center gap-12">
        {editing !== null && (
          <Button type="button" tone="neutral" size="md" onClick={onDoneEditing}>
            {t({ en: "Cancel", ko: "취소" })}
          </Button>
        )}
        <Button type="submit" size="md" className="flex-1" disabled={isPending}>
          {isPending
            ? t({ en: "Saving…", ko: "저장하는 중…" })
            : editing === null
              ? t({ en: "Save missed trade", ko: "놓친 거래 저장" })
              : t({ en: "Update", ko: "수정 저장" })}
        </Button>
      </div>
      <p className="-mt-8 text-11_5 font-medium text-faint" aria-live="polite">
        {savedNote ?? `${shortcut} · ${t({ en: "arrow keys pick an option", ko: "선택지는 화살표 키로" })}`}
      </p>
    </form>
  );
}
