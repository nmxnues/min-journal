"use client";

import { useMemo, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { zodResolver } from "@hookform/resolvers/zod";
import { Controller, useForm, useWatch } from "react-hook-form";
import { X } from "lucide-react";
import {
  Button,
  Card,
  Chip,
  Combobox,
  Dropzone,
  Field,
  Input,
  Panel,
  Segmented,
  Select,
  Textarea,
  ToggleChip,
} from "@/components/ui";
import { RangeDiagram } from "@/components/range-diagram";
import { AttachmentThumbnails } from "@/components/attachment-thumbnails";
import { CommissionFields } from "@/components/commission-fields";
import { NetBreakdown } from "@/components/net-breakdown";
import { cn } from "@/lib/cn";
import {
  formatCurrency,
  formatPips,
  formatPrice,
  formatSignedCurrency,
  formatTime,
  parseNumberInput,
} from "@/lib/format";
import { useFormatR } from "@/lib/settings/context";
import { MAX_ATTACHMENTS_PER_TRADE } from "@/lib/attachments";
import { INSTRUMENT_PRESETS } from "@/lib/instruments";
import {
  HTF_PAIRING_LABELS,
  HTF_PAIRING_ORDER,
  SESSION_LABELS,
  SWEEP_SIDE_LABELS,
  SWEEP_SIDE_ORDER,
} from "@/lib/labels";
import { MAX_TRADE_DATE, MIN_TRADE_DATE } from "@/lib/domain/dates";
import { deriveSweepSide, plannedR, rangeSize, realizedR } from "@/lib/domain/trade";
import type { AccountKind, SweepSide, TradeModel, TradeResult } from "@/lib/domain/types";
import { useLocale, useT } from "@/lib/i18n/locale-context";
import { createTrade } from "./actions";
import type { DraftRecord } from "./draft-actions";
import { createNewTradeSchema, NEW_TRADE_DEFAULTS, type NewTradeInput } from "./schema";
import { useDraftAttachments } from "./use-draft-attachments";
import { useDraftAutosave } from "./use-draft-autosave";
import { collectWarnings, type WarningCode } from "@/lib/domain/warnings";
import { usePasteAttachment } from "@/lib/use-paste-attachment";
import { useCommissionPrefill } from "@/lib/use-commission-prefill";
import { MobileQuickLogWizard, WIZARD_STEP_COUNT, WIZARD_STEP_FIELDS } from "./mobile-quicklog-wizard";

export interface NewTradeFormProps {
  models: TradeModel[];
  /**
   * 1R as it stands right now — a preview, not a promise: for a "live"
   * account this is exactly what the server freezes onto the row on submit.
   * For a "backtest" account the server instead uses the balance as of
   * whatever date ends up in the form (`rValueAsOfDate`, docs/decisions.md §
   * Phase 9 backtest follow-up) — this number stays the *today* figure
   * throughout, so the callout below says so rather than implying it's live.
   */
  rValueToday: number;
  accountKind: AccountKind;
  currency: string;
  accountIsNearDrawdownLimit: boolean;
  drawdownPercent: number;
  drawdownLimitPercent: number;
  defaultInstrument: string;
  defaultSession: NewTradeInput["session"];
  /** The freshly-opened form's starting Date value — the account's most recently logged trade's date, or today with none yet (docs/decisions.md § Phase 6). */
  defaultDate: string;
  draft: DraftRecord | null;
  tagPresets: string[];
  /** settings.commission_per_lot_per_side — prefills both commission fields from the size. 0 = no prefill. */
  commissionPerLotPerSide: number;
}

function SectionCard({
  step,
  title,
  children,
}: {
  step: number;
  title: string;
  children: React.ReactNode;
}) {
  return (
    <Card className="px-32 py-28">
      <div className="flex items-center gap-10">
        <span className="flex h-24 w-24 items-center justify-center rounded-pill bg-ink text-12 font-bold text-white">
          {step}
        </span>
        <h2 className="text-16 font-bold text-ink">{title}</h2>
      </div>
      <div className="mt-20">{children}</div>
    </Card>
  );
}

export function NewTradeForm({
  models,
  rValueToday,
  accountKind,
  currency,
  accountIsNearDrawdownLimit,
  drawdownPercent,
  drawdownLimitPercent,
  defaultInstrument,
  defaultSession,
  defaultDate,
  draft,
  tagPresets,
  commissionPerLotPerSide,
}: NewTradeFormProps) {
  const formatR = useFormatR();
  const t = useT();
  const locale = useLocale();
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [serverError, setServerError] = useState<string | null>(null);
  const [showSweepOverride, setShowSweepOverride] = useState(false);
  /** Once the trader sets Result by hand, the exit never overwrites it again. */
  const [resultTouched, setResultTouched] = useState(draft !== null);
  /** Mobile quicklog wizard step (docs/decisions.md § Phase 4d) — unused on desktop. */
  const [wizardStep, setWizardStep] = useState(1);

  const initialValues: NewTradeInput = {
    ...NEW_TRADE_DEFAULTS,
    instrument: defaultInstrument,
    session: defaultSession,
    date: defaultDate,
    ...draft?.payload.values,
  };

  const {
    control,
    register,
    handleSubmit,
    setValue,
    trigger,
    formState: { errors },
  } = useForm<NewTradeInput>({
    resolver: zodResolver(createNewTradeSchema(locale)),
    mode: "onTouched",
    // The draft still wins every field it carries; the defaults sit *under*
    // it only so a field added to the form after a draft was saved isn't
    // `undefined` on restore. Taking the stored payload wholesale would hand
    // zod an undefined string for that field and block submit with an error
    // pointing at a field the trader never touched.
    defaultValues: initialValues,
  });

  const commissionPrefill = useCommissionPrefill({
    perLotPerSide: commissionPerLotPerSide,
    initial: initialValues,
    setCommission: (side, value) => setValue(side, value, { shouldDirty: true, shouldValidate: true }),
  });

  const values = useWatch({ control }) as NewTradeInput;

  const initialAttachments = useMemo(
    () => (draft?.payload.attachmentPaths ?? []).map((path) => ({ path })),
    // Only meant to seed the hook once, on mount.
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [],
  );
  const attachments = useDraftAttachments(initialAttachments);
  usePasteAttachment(
    (files) => void attachments.addFiles(files),
    attachments.attachments.length < MAX_ATTACHMENTS_PER_TRADE,
  );

  const draftPayload = useMemo(
    () => ({ values, attachmentPaths: attachments.attachments.map((a) => a.path) }),
    [values, attachments.attachments],
  );
  const autosave = useDraftAutosave(draftPayload, draft?.updatedAt ?? null);

  // Every derived number recomputes on each keystroke
  // (docs/README.md § Interactions).
  const derived = useMemo(() => {
    const rangeHigh = parseNumberInput(values.rangeHigh ?? "");
    const rangeLow = parseNumberInput(values.rangeLow ?? "");
    const entry = parseNumberInput(values.entry ?? "");
    const stop = parseNumberInput(values.stop ?? "");
    const target = values.target ? parseNumberInput(values.target) : null;
    const exit = values.exit ? parseNumberInput(values.exit) : null;
    const swap = values.swap ? parseNumberInput(values.swap) : null;
    const commission =
      (parseNumberInput(values.entryCommission ?? "") ?? 0) + (parseNumberInput(values.exitCommission ?? "") ?? 0);

    const rangeReady = rangeHigh !== null && rangeLow !== null && rangeHigh > rangeLow;
    const size = rangeReady ? rangeSize({ rangeHigh: rangeHigh!, rangeLow: rangeLow! }) : null;

    const derivedSweep =
      rangeReady && stop !== null
        ? deriveSweepSide({ stop, rangeHigh: rangeHigh!, rangeLow: rangeLow! })
        : null;
    const sweepSide: SweepSide | null = values.sweepSideOverride ?? derivedSweep;

    const planned =
      entry !== null && stop !== null && target !== null
        ? plannedR({ entry, stop, target })
        : null;
    const realized =
      entry !== null && stop !== null && exit !== null
        ? realizedR({ entry, stop, exit, direction: values.direction })
        : null;

    return {
      rangeHigh,
      rangeLow,
      entry,
      stop,
      target,
      exit,
      swap,
      commission,
      size,
      derivedSweep,
      sweepSide,
      planned,
      realized,
    };
  }, [values]);

  const selectedModel = models.find((m) => m.id === values.modelId) ?? null;

  const warnings = useMemo(
    () =>
      collectWarnings({
        instrument: values.instrument,
        direction: values.direction,
        entry: derived.entry,
        stop: derived.stop,
        target: derived.target,
        exit: derived.exit,
        rangeHigh: derived.rangeHigh,
        rangeLow: derived.rangeLow,
        sweepSide: derived.sweepSide,
        result: values.result,
        modelIsRetired: selectedModel?.status === "retired",
        accountIsNearDrawdownLimit,
      }),
    [values, derived, selectedModel, accountIsNearDrawdownLimit],
  );

  const warningText: Record<WarningCode, string> = {
    target_wrong_side: t({
      en: "Target sits on the same side of entry as the stop.",
      ko: "타겟이 진입가 기준 손절과 같은 쪽에 있습니다.",
    }),
    entry_outside_range: t({
      en: "Entry is outside the range — fine on a sweep wick, worth a second look otherwise.",
      ko: "진입가가 레인지 밖입니다 — 스윕 꼬리라면 정상이지만 한 번 확인해보세요.",
    }),
    off_plan: t({
      en: "This logs as off-plan: no sweep, or the entry sits mid-range.",
      ko: "off-plan으로 기록됩니다: 스윕이 없거나 진입가가 레인지 중앙 구간입니다.",
    }),
    retired_model: t({
      en: "That model is retired. Past trades keep their stats; new ones read as off-plan.",
      ko: "은퇴한 모델입니다. 과거 기록은 그대로지만 새 기록은 off-plan으로 읽힙니다.",
    }),
    result_disagrees_with_exit: t({
      en: "The result doesn't match where the exit priced out.",
      ko: "결과가 청산가로 계산한 손익과 어긋납니다.",
    }),
    drawdown_near_limit: t({
      en: `Drawdown is ${drawdownPercent.toFixed(1)}% against a ${drawdownLimitPercent}% limit.`,
      ko: `현재 드로다운 ${drawdownPercent.toFixed(1)}%, 한도 ${drawdownLimitPercent}%입니다.`,
    }),
    price_implausible_for_instrument: t({
      en: "One of these prices looks off for this instrument — check for a stray digit.",
      ko: "이 종목치고 가격이 이상합니다 — 자릿수가 잘못 들어가지 않았는지 확인하세요.",
    }),
  };

  /** Suggest a result from the exit — but never once the trader has set it. */
  function onExitChange(raw: string) {
    if (resultTouched) return;
    const exit = parseNumberInput(raw);
    if (exit === null || derived.entry === null || derived.stop === null) return;
    const r = realizedR({
      entry: derived.entry,
      stop: derived.stop,
      exit,
      direction: values.direction,
    });
    if (r === null) return;
    const suggestion: TradeResult = r > 0.05 ? "win" : r < -0.05 ? "loss" : "be";
    setValue("result", suggestion, { shouldDirty: true });
  }

  function onSubmit(input: NewTradeInput) {
    setServerError(null);
    startTransition(async () => {
      const result = await createTrade(
        input,
        locale,
        attachments.attachments.map((a) => a.path),
      );
      if (result.ok) {
        router.push(`/trades/${result.id}`);
      } else {
        setServerError(result.error);
      }
    });
  }

  function onSaveDraft() {
    void autosave.flush().then(() => router.push("/"));
  }

  function onResultChange(value: TradeResult) {
    setResultTouched(true);
    setValue("result", value, { shouldDirty: true });
  }

  /** Validates the current wizard step's required fields before advancing. */
  function onWizardNext() {
    void trigger(WIZARD_STEP_FIELDS[wizardStep]).then((valid) => {
      if (valid) setWizardStep((s) => Math.min(s + 1, WIZARD_STEP_COUNT));
    });
  }

  function onWizardBack() {
    setWizardStep((s) => Math.max(s - 1, 1));
  }

  const priceCaptions =
    derived.rangeHigh !== null && derived.rangeLow !== null && derived.size !== null
      ? {
          low: `${t({ en: "Low", ko: "저점" })} ${formatPrice(derived.rangeLow, values.instrument)}`,
          mid: `50% ${formatPrice(derived.rangeLow + derived.size / 2, values.instrument)}`,
          high: `${t({ en: "High", ko: "고점" })} ${formatPrice(derived.rangeHigh, values.instrument)}`,
        }
      : undefined;

  if (locale === "ko") {
    return (
      <form onSubmit={handleSubmit(onSubmit)} noValidate>
        <header className="sticky top-0 z-10 flex flex-col gap-14 bg-page px-20 pt-16 pb-14">
          <div className="flex items-center justify-between">
            <button
              type="button"
              onClick={() => router.push("/")}
              aria-label={t({ en: "Close", ko: "닫기" })}
              className="rounded-8 text-18 font-semibold text-muted transition-colors duration-150 ease-out hover:text-ink focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent focus-visible:ring-offset-2"
            >
              <X aria-hidden size={20} />
            </button>
            <span className="text-13 font-semibold text-faint">
              {wizardStep} / {WIZARD_STEP_COUNT}
            </span>
          </div>
          <div className="h-4 rounded-pill bg-divider">
            <div
              className="h-full rounded-pill bg-accent transition-[width] duration-150 ease-out"
              style={{ width: `${(wizardStep / WIZARD_STEP_COUNT) * 100}%` }}
            />
          </div>
        </header>

        <MobileQuickLogWizard
          step={wizardStep}
          onBack={onWizardBack}
          onNext={onWizardNext}
          control={control}
          register={register}
          errors={errors}
          values={values}
          derived={derived}
          models={models}
          rValueToday={rValueToday}
          accountKind={accountKind}
          currency={currency}
          attachments={attachments}
          onExitChange={onExitChange}
          onSizeChange={commissionPrefill.onSizeChange}
          onResultChange={onResultChange}
          warnings={warnings}
          warningText={warningText}
          serverError={serverError}
          isPending={isPending}
          tagPresets={tagPresets}
        />
      </form>
    );
  }

  return (
    <form onSubmit={handleSubmit(onSubmit)} noValidate>
      <header className="flex items-center gap-16 bg-surface px-32 py-20">
        <button
          type="button"
          onClick={() => router.push("/")}
          aria-label={t({ en: "Close", ko: "닫기" })}
          className="flex h-44 w-44 items-center justify-center rounded-12 text-muted transition-colors duration-150 ease-out hover:bg-divider hover:text-ink focus-visible:ring-2 focus-visible:ring-accent focus-visible:ring-offset-2 focus-visible:outline-none"
        >
          <X aria-hidden size={20} />
        </button>
        <h1 className="text-17 font-bold tracking-[-.02em] text-ink">
          {t({ en: "New trade", ko: "새 기록" })}
        </h1>
        {autosave.savedAt !== null && (
          <span className="text-13 font-medium text-faint">
            {autosave.status === "saving"
              ? t({ en: "Saving…", ko: "저장하는 중…" })
              : autosave.status === "restored"
                ? t({
                    en: `Draft restored · ${formatTime(autosave.savedAt)}`,
                    ko: `임시 저장 복원됨 · ${formatTime(autosave.savedAt)}`,
                  })
                : t({
                    en: `Draft saved · ${formatTime(autosave.savedAt)}`,
                    ko: `임시 저장됨 · ${formatTime(autosave.savedAt)}`,
                  })}
          </span>
        )}
      </header>

      <div className="mx-auto flex max-w-[1000px] flex-col gap-16 p-32">
        {/* 1 — Context */}
        <SectionCard step={1} title={t({ en: "Context", ko: "맥락" })}>
          <div className="grid grid-cols-2 gap-16">
            <Field
              label={t({ en: "Instrument", ko: "종목" })}
              htmlFor="instrument"
              error={errors.instrument?.message}
            >
              <Controller
                control={control}
                name="instrument"
                render={({ field }) => (
                  <Combobox
                    id="instrument"
                    value={field.value}
                    onChange={field.onChange}
                    options={INSTRUMENT_PRESETS}
                    placeholder="EURUSD"
                  />
                )}
              />
            </Field>
            <Field label={t({ en: "Date", ko: "날짜" })} htmlFor="date" error={errors.date?.message}>
              <Input id="date" type="date" min={MIN_TRADE_DATE} max={MAX_TRADE_DATE} {...register("date")} />
            </Field>
          </div>

          <div className="mt-16 grid grid-cols-2 gap-16">
            <Field label={t({ en: "Session", ko: "세션" })}>
              <Controller
                control={control}
                name="session"
                render={({ field }) => (
                  <Segmented
                    name="session"
                    value={field.value}
                    onChange={field.onChange}
                    options={(["asia", "london", "ny_am"] as const).map((value) => ({
                      value,
                      label: t(SESSION_LABELS[value]),
                    }))}
                  />
                )}
              />
            </Field>
            <Field label={t({ en: "HTF bias", ko: "HTF 방향" })}>
              <Controller
                control={control}
                name="direction"
                render={({ field }) => (
                  <Segmented
                    name="direction"
                    value={field.value}
                    onChange={field.onChange}
                    options={[
                      { value: "long", label: t({ en: "Long", ko: "롱" }) },
                      { value: "short", label: t({ en: "Short", ko: "숏" }) },
                    ]}
                  />
                )}
              />
            </Field>
          </div>
        </SectionCard>

        {/* 2 — Range & sweep */}
        <SectionCard step={2} title={t({ en: "Range & sweep", ko: "레인지 · 스윕" })}>
          <div className="grid grid-cols-3 gap-16">
            <Field label={t({ en: "HTF pairing", ko: "HTF 페어링" })} htmlFor="htf-pairing">
              <Select id="htf-pairing" {...register("htfPairing")}>
                {HTF_PAIRING_ORDER.map((value) => (
                  <option key={value} value={value}>
                    {t(HTF_PAIRING_LABELS[value])}
                  </option>
                ))}
              </Select>
            </Field>
            <Field
              label={t({ en: "Range high", ko: "레인지 상단" })}
              htmlFor="range-high"
              error={errors.rangeHigh?.message}
            >
              <Input id="range-high" inputMode="decimal" placeholder="23,486.25" {...register("rangeHigh")} />
            </Field>
            <Field
              label={t({ en: "Range low", ko: "레인지 하단" })}
              htmlFor="range-low"
              error={errors.rangeLow?.message}
            >
              <Input id="range-low" inputMode="decimal" placeholder="23,402.75" {...register("rangeLow")} />
            </Field>
          </div>

          <Panel className="mt-16 grid grid-cols-[1fr_180px] gap-28 rounded-20 px-28 pt-26 pb-20">
            <RangeDiagram
              rangeHigh={derived.rangeHigh ?? 0}
              rangeLow={derived.rangeLow ?? 0}
              sweepSide={derived.sweepSide ?? "none"}
              target={derived.target}
              labels={{
                sweep: t({ en: "Sweep", ko: "스윕" }),
                target: t({ en: "Target", ko: "타겟" }),
              }}
              captions={priceCaptions}
            />
            <div className="flex flex-col gap-18 border-l border-panel pl-28">
              <div>
                <div className="text-13 font-semibold text-muted">
                  {t({ en: "Range size", ko: "레인지 크기" })}
                </div>
                <div className="mt-4 text-22 font-extrabold tracking-[-.03em] text-ink">
                  {derived.size === null
                    ? "—"
                    : t({
                        en: `${formatPips(derived.size, values.instrument)} pips`,
                        ko: `${formatPips(derived.size, values.instrument)}핍`,
                      })}
                </div>
              </div>
              <div>
                <div className="text-13 font-semibold text-muted">
                  {t({ en: "Sweep side", ko: "스윕 사이드" })}
                </div>
                <div className="mt-4 text-18 font-extrabold text-ink">
                  {derived.sweepSide === null ? "—" : t(SWEEP_SIDE_LABELS[derived.sweepSide])}
                </div>
                <Button
                  tone="link"
                  className="mt-6"
                  onClick={() => {
                    if (showSweepOverride) setValue("sweepSideOverride", null);
                    setShowSweepOverride(!showSweepOverride);
                  }}
                >
                  {showSweepOverride
                    ? t({ en: "Use derived", ko: "자동값 사용" })
                    : t({ en: "Override", ko: "직접 지정" })}
                </Button>
              </div>
            </div>
          </Panel>

          {showSweepOverride && (
            <Controller
              control={control}
              name="sweepSideOverride"
              render={({ field }) => (
                <Segmented
                  className="mt-16"
                  name="sweep-side"
                  value={field.value}
                  onChange={field.onChange}
                  options={SWEEP_SIDE_ORDER.map((value) => ({
                    value,
                    label: t(SWEEP_SIDE_LABELS[value]),
                  }))}
                />
              )}
            />
          )}
        </SectionCard>

        {/* 3 — Execution */}
        <SectionCard step={3} title={t({ en: "Execution", ko: "실행" })}>
          <div className="grid grid-cols-4 gap-16">
            <Field label={t({ en: "Entry", ko: "진입가" })} htmlFor="entry" error={errors.entry?.message}>
              <Input id="entry" inputMode="decimal" placeholder="23,411.00" {...register("entry")} />
            </Field>
            <Field label={t({ en: "Stop", ko: "손절가" })} htmlFor="stop" error={errors.stop?.message}>
              <Input id="stop" inputMode="decimal" placeholder="23,396.50" {...register("stop")} />
            </Field>
            <Field label={t({ en: "Target", ko: "타겟" })} htmlFor="target" error={errors.target?.message}>
              <Input id="target" inputMode="decimal" placeholder="23,486.25" {...register("target")} />
            </Field>
            <Field
              label={t({ en: "Size (lots)", ko: "사이즈 (랏)" })}
              htmlFor="size"
              error={errors.size?.message}
            >
              <Input
                id="size"
                inputMode="decimal"
                placeholder="1.0"
                {...register("size", { onChange: (e) => commissionPrefill.onSizeChange(e.target.value) })}
              />
            </Field>
          </div>

          <div className="mt-16 flex items-center justify-between rounded-16 bg-accent-tint px-20 py-16">
            <span className="text-14 font-semibold text-accent-pressed">
              {t({ en: "Auto-calculated R:R", ko: "자동 계산 R:R" })}
            </span>
            <span className="text-20 font-extrabold text-accent-pressed">
              {derived.planned === null ? "—" : `1 : ${derived.planned.toFixed(1)}R`}
            </span>
          </div>

          <p className="mt-8 text-11_5 font-medium text-faint">
            {accountKind === "backtest"
              ? t({
                  en: `1R today · ${formatCurrency(rValueToday, currency)} — this account freezes 1R to the balance as of this trade's own date, not today's.`,
                  ko: `오늘의 1R · ${formatCurrency(rValueToday, currency)} — 이 계좌는 오늘이 아니라 이 트레이드 날짜 시점의 잔고로 1R을 고정합니다.`,
                })
              : t({
                  en: `1R today · ${formatCurrency(rValueToday, currency)} — frozen onto this trade when you log it.`,
                  ko: `오늘의 1R · ${formatCurrency(rValueToday, currency)} — 기록하는 순간 이 값으로 고정됩니다.`,
                })}
          </p>

          <div className="mt-16 grid grid-cols-2 gap-16">
            <Field label={t({ en: "Entry model", ko: "진입 모델" })} htmlFor="model">
              <Controller
                control={control}
                name="modelId"
                render={({ field }) => (
                  <Select
                    id="model"
                    value={field.value ?? ""}
                    onChange={(e) => field.onChange(e.target.value === "" ? null : e.target.value)}
                    disabled={models.length === 0}
                  >
                    <option value="">
                      {models.length === 0
                        ? t({ en: "No models yet — add them in Playbook", ko: "아직 모델 없음 · Playbook에서 추가" })
                        : t({ en: "No model", ko: "모델 없음" })}
                    </option>
                    {models.map((model) => (
                      <option key={model.id} value={model.id}>
                        {model.name}
                      </option>
                    ))}
                  </Select>
                )}
              />
            </Field>
            <Field
              label={t({ en: "Confirmation", ko: "확인 신호" })}
              htmlFor="confirmation"
              hint={t({ en: "e.g. M1 displacement", ko: "예: M1 디스플레이스먼트" })}
            >
              <Input id="confirmation" {...register("confirmation")} />
            </Field>
          </div>

          <div className="mt-16 grid grid-cols-2 gap-16">
            <Field
              label={t({ en: "Exit", ko: "청산가" })}
              htmlFor="exit"
              error={errors.exit?.message}
              hint={t({
                en: "Leave empty while the trade is still open.",
                ko: "아직 청산 전이면 비워두세요.",
              })}
            >
              <Input
                id="exit"
                inputMode="decimal"
                placeholder="23,451.75"
                {...register("exit", { onChange: (e) => onExitChange(e.target.value) })}
              />
            </Field>
            <Field label={t({ en: "Result", ko: "결과" })}>
              <Controller
                control={control}
                name="result"
                render={({ field }) => (
                  <Segmented
                    name="result"
                    value={field.value}
                    onChange={onResultChange}
                    options={[
                      { value: "win", label: t({ en: "Win", ko: "익절" }), tone: "gain" },
                      { value: "loss", label: t({ en: "Loss", ko: "손절" }), tone: "loss" },
                      { value: "be", label: t({ en: "Break-even", ko: "본전" }) },
                    ]}
                  />
                )}
              />
            </Field>
          </div>

          <div className="mt-16 grid grid-cols-3 gap-16">
            <Field
              label={t({ en: "Swap", ko: "스왑" })}
              htmlFor="swap"
              error={errors.swap?.message}
              hint={t({
                en: "Overnight interest from your broker. Negative for a cost. Leave empty on an intraday close.",
                ko: "브로커 명세서의 오버나이트 이자. 비용이면 음수. 당일 청산이면 비워두세요.",
              })}
            >
              <Input id="swap" inputMode="decimal" placeholder="−12.40" {...register("swap")} />
            </Field>
            <CommissionFields
              registerSide={(side) =>
                register(side, { onChange: () => commissionPrefill.markManual(side) })
              }
              errors={errors}
              prefill={commissionPrefill}
              sizeRaw={values.size ?? ""}
              perLotPerSide={commissionPerLotPerSide}
              currency={currency}
            />
          </div>

          {derived.realized !== null && (
            <p className="mt-12 text-13 font-semibold text-secondary">
              {t({ en: "Realized", ko: "실현" })}{" "}
              <span className={cn(derived.realized >= 0 ? "text-gain" : "text-loss")}>
                {formatR(derived.realized)}
              </span>
              {/*
                The money breakdown is the whole point of recording swap and
                commission, so
                it is shown as it is typed. Only on a "live" account, though:
                there `rValueToday` is exactly what the server will freeze, so
                the arithmetic is real. A backtest account freezes 1R to the
                balance as of the trade's own date, which this component
                deliberately doesn't try to predict, so it gets the R figure
                and nothing that would be a guess with a currency sign on it.
              */}
              {accountKind === "live" && (
                <>
                  {" · "}
                  {formatSignedCurrency(derived.realized * rValueToday, currency)}
                  <NetBreakdown
                    price={derived.realized * rValueToday}
                    swap={derived.swap}
                    commission={derived.commission}
                    currency={currency}
                  />
                </>
              )}
            </p>
          )}
        </SectionCard>

        {/* 4 — Chart & notes */}
        <SectionCard step={4} title={t({ en: "Chart & notes", ko: "차트 · 노트" })}>
          <div className="grid grid-cols-2 gap-16">
            <div>
              <Dropzone
                disabled={attachments.attachments.length >= MAX_ATTACHMENTS_PER_TRADE}
                title={t({ en: "Drag chart screenshots here", ko: "차트 스크린샷을 여기로" })}
                hint={t({
                  en: "Two shots recommended: HTF range + entry timeframe · paste with ⌘V",
                  ko: "HTF 레인지 + 진입 타임프레임 2장 권장 · ⌘V로 붙여넣기 가능",
                })}
                buttonLabel={t({ en: "Choose file", ko: "파일 선택" })}
                onFiles={(files) => void attachments.addFiles(files)}
              />
              {attachments.error !== null && (
                <p className="mt-8 text-11_5 font-medium text-loss">{attachments.error}</p>
              )}
              {attachments.uploading > 0 && (
                <p className="mt-8 text-11_5 font-medium text-faint">
                  {t({ en: "Uploading…", ko: "업로드 중…" })}
                </p>
              )}
              <AttachmentThumbnails
                attachments={attachments.attachments}
                onRemove={(path) => void attachments.removeAttachment(path)}
                className="mt-12"
              />
            </div>
            <div>
              <Textarea
                placeholder={t({
                  en: "What did you see? What did you do?",
                  ko: "무엇을 봤고 어떻게 행동했나요?",
                })}
                {...register("notes")}
              />
              <Controller
                control={control}
                name="tags"
                render={({ field }) => (
                  <div className="mt-12 flex flex-wrap gap-8">
                    {tagPresets.map((label) => {
                      const selected = field.value.includes(label);
                      return (
                        <ToggleChip
                          key={label}
                          selected={selected}
                          onToggle={() =>
                            field.onChange(
                              selected
                                ? field.value.filter((tag) => tag !== label)
                                : [...field.value, label],
                            )
                          }
                        >
                          {label}
                        </ToggleChip>
                      );
                    })}
                  </div>
                )}
              />
            </div>
          </div>
        </SectionCard>

        {warnings.length > 0 && (
          <Card className="px-32 py-24">
            <div className="flex flex-col gap-12">
              {warnings.map((code) => (
                <div key={code} className="flex items-start gap-10">
                  <Chip tone="accent" shape="stat" className="mt-2 shrink-0">
                    {t({ en: "Check", ko: "확인" })}
                  </Chip>
                  <p className="text-13_5 leading-[1.6] text-secondary">{warningText[code]}</p>
                </div>
              ))}
            </div>
            <p className="mt-16 text-11_5 font-medium text-faint">
              {t({
                en: "None of these stop you saving — they're worth a second look, not a veto.",
                ko: "저장을 막지는 않습니다 — 한 번 더 확인해보라는 표시입니다.",
              })}
            </p>
          </Card>
        )}

        {serverError !== null && (
          <p className="text-13 font-semibold text-loss">{serverError}</p>
        )}

        <div className="flex gap-12">
          <Button
            type="button"
            tone="neutral"
            size="lg"
            className="flex-1"
            disabled={isPending}
            onClick={onSaveDraft}
          >
            {t({ en: "Save draft", ko: "임시 저장" })}
          </Button>
          <Button type="submit" size="lg" className="flex-2" disabled={isPending}>
            {isPending
              ? t({ en: "Logging…", ko: "기록하는 중…" })
              : t({ en: "Log trade", ko: "기록하기" })}
          </Button>
        </div>
      </div>
    </form>
  );
}
