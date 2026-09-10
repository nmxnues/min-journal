"use client";

import { useMemo, useState, useTransition } from "react";
import { zodResolver } from "@hookform/resolvers/zod";
import { Controller, useForm, useWatch } from "react-hook-form";
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
import { cn } from "@/lib/cn";
import { formatPips, formatPrice, formatR, parseNumberInput } from "@/lib/format";
import { MAX_ATTACHMENTS_PER_TRADE } from "@/lib/attachments";
import { INSTRUMENT_PRESETS } from "@/lib/instruments";
import {
  HTF_PAIRING_LABELS,
  HTF_PAIRING_ORDER,
  SESSION_LABELS,
  SWEEP_SIDE_LABELS,
  SWEEP_SIDE_ORDER,
  TAG_PRESETS,
} from "@/lib/labels";
import { deriveSweepSide, plannedR, rangeSize, realizedR } from "@/lib/domain/trade";
import { collectWarnings, type WarningCode } from "@/lib/domain/warnings";
import type { SweepSide, Trade, TradeModel, TradeResult } from "@/lib/domain/types";
import { useLocale, useT } from "@/lib/i18n/locale-context";
import { usePasteAttachment } from "@/lib/use-paste-attachment";
import { updateTrade } from "./actions";
import { createEditTradeSchema, tradeToEditInput, type EditTradeInput } from "./schema";
import { useTradeAttachments } from "./use-trade-attachments";

export interface TradeEditFormProps {
  trade: Trade;
  models: TradeModel[];
  attachments: readonly { path: string }[];
  accountIsNearDrawdownLimit: boolean;
  drawdownPercent: number;
  drawdownLimitPercent: number;
  onCancel: () => void;
  onSaved: () => void;
}

function SectionCard({
  step,
  title,
  compact,
  children,
}: {
  step: number;
  title: string;
  compact: boolean;
  children: React.ReactNode;
}) {
  return (
    <Card className={compact ? "px-20 py-24" : "px-32 py-28"}>
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

/**
 * The full CRT-order form the user chose for Trade detail's edit path
 * (docs/decisions.md § Phase 4c): every field the New trade form can set is
 * editable here too, plus `exitReason`/`holdMinutes`, which 4a deferred to
 * this screen. `rValueAtEntry` never appears in this form or its schema —
 * `updateTrade` has no way to touch that column.
 */
export function TradeEditForm({
  trade,
  models,
  attachments,
  accountIsNearDrawdownLimit,
  drawdownPercent,
  drawdownLimitPercent,
  onCancel,
  onSaved,
}: TradeEditFormProps) {
  const t = useT();
  const locale = useLocale();
  // Same signal/rationale as trade-view.tsx: no mock exists for this screen
  // at any width, so mobile collapses the same numbered sections to a single
  // column at the app's existing 900px mobile boundary rather than inventing
  // a second breakpoint mechanism.
  const isMobile = locale === "ko";
  const [isPending, startTransition] = useTransition();
  const [serverError, setServerError] = useState<string | null>(null);
  const [showSweepOverride, setShowSweepOverride] = useState(
    tradeToEditInput(trade).sweepSideOverride !== null,
  );
  const [resultTouched, setResultTouched] = useState(trade.result !== null);

  const {
    control,
    register,
    handleSubmit,
    setValue,
    formState: { errors },
  } = useForm<EditTradeInput>({
    resolver: zodResolver(createEditTradeSchema(locale)),
    mode: "onTouched",
    defaultValues: tradeToEditInput(trade),
  });

  const values = useWatch({ control }) as EditTradeInput;
  const tradeAttachments = useTradeAttachments(trade.id, attachments);
  usePasteAttachment(
    (files) => void tradeAttachments.addFiles(files),
    tradeAttachments.attachments.length < MAX_ATTACHMENTS_PER_TRADE,
  );

  const derived = useMemo(() => {
    const rangeHigh = parseNumberInput(values.rangeHigh ?? "");
    const rangeLow = parseNumberInput(values.rangeLow ?? "");
    const entry = parseNumberInput(values.entry ?? "");
    const stop = parseNumberInput(values.stop ?? "");
    const target = values.target ? parseNumberInput(values.target) : null;
    const exit = values.exit ? parseNumberInput(values.exit) : null;

    const rangeReady = rangeHigh !== null && rangeLow !== null && rangeHigh > rangeLow;
    const size = rangeReady ? rangeSize({ rangeHigh: rangeHigh!, rangeLow: rangeLow! }) : null;

    const derivedSweep =
      rangeReady && stop !== null
        ? deriveSweepSide({ stop, rangeHigh: rangeHigh!, rangeLow: rangeLow! })
        : null;
    const sweepSide: SweepSide | null = values.sweepSideOverride ?? derivedSweep;

    const planned =
      entry !== null && stop !== null && target !== null ? plannedR({ entry, stop, target }) : null;
    const realized =
      entry !== null && stop !== null && exit !== null
        ? realizedR({ entry, stop, exit, direction: values.direction })
        : null;

    return { rangeHigh, rangeLow, entry, stop, target, exit, size, sweepSide, planned, realized };
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

  function onExitChange(raw: string) {
    if (resultTouched) return;
    const exit = parseNumberInput(raw);
    if (exit === null || derived.entry === null || derived.stop === null) return;
    const r = realizedR({ entry: derived.entry, stop: derived.stop, exit, direction: values.direction });
    if (r === null) return;
    const suggestion: TradeResult = r > 0.05 ? "win" : r < -0.05 ? "loss" : "be";
    setValue("result", suggestion, { shouldDirty: true });
  }

  function onSubmit(input: EditTradeInput) {
    setServerError(null);
    startTransition(async () => {
      const result = await updateTrade(trade.id, input, locale);
      if (result.ok) {
        onSaved();
      } else {
        setServerError(result.error);
      }
    });
  }

  const priceCaptions =
    derived.rangeHigh !== null && derived.rangeLow !== null && derived.size !== null
      ? {
          low: `${t({ en: "Low", ko: "저점" })} ${formatPrice(derived.rangeLow, values.instrument)}`,
          mid: `50% ${formatPrice(derived.rangeLow + derived.size / 2, values.instrument)}`,
          high: `${t({ en: "High", ko: "고점" })} ${formatPrice(derived.rangeHigh, values.instrument)}`,
        }
      : undefined;

  return (
    <form
      onSubmit={handleSubmit(onSubmit)}
      noValidate
      className={cn("mx-auto flex max-w-[1000px] flex-col gap-16", isMobile ? "p-20" : "p-32")}
    >
      {/* 1 — Context */}
      <SectionCard step={1} title={t({ en: "Context", ko: "맥락" })} compact={isMobile}>
        <div className={cn("grid gap-16", isMobile ? "grid-cols-1" : "grid-cols-2")}>
          <Field label={t({ en: "Instrument", ko: "종목" })} htmlFor="instrument" error={errors.instrument?.message}>
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
            <Input id="date" type="date" {...register("date")} />
          </Field>
        </div>

        <div className={cn("mt-16 grid gap-16", isMobile ? "grid-cols-1" : "grid-cols-2")}>
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
      <SectionCard step={2} title={t({ en: "Range & sweep", ko: "레인지 · 스윕" })} compact={isMobile}>
        <div className={cn("grid gap-16", isMobile ? "grid-cols-1" : "grid-cols-3")}>
          <Field label={t({ en: "HTF pairing", ko: "HTF 페어링" })} htmlFor="htf-pairing">
            <Select id="htf-pairing" {...register("htfPairing")}>
              {HTF_PAIRING_ORDER.map((value) => (
                <option key={value} value={value}>
                  {t(HTF_PAIRING_LABELS[value])}
                </option>
              ))}
            </Select>
          </Field>
          <Field label={t({ en: "Range high", ko: "레인지 상단" })} htmlFor="range-high" error={errors.rangeHigh?.message}>
            <Input id="range-high" inputMode="decimal" {...register("rangeHigh")} />
          </Field>
          <Field label={t({ en: "Range low", ko: "레인지 하단" })} htmlFor="range-low" error={errors.rangeLow?.message}>
            <Input id="range-low" inputMode="decimal" {...register("rangeLow")} />
          </Field>
        </div>

        <Panel
          className={cn(
            "mt-16 rounded-20",
            isMobile
              ? "flex flex-col gap-20 px-20 pt-24 pb-20"
              : "grid grid-cols-[1fr_180px] gap-28 px-28 pt-26 pb-20",
          )}
        >
          <RangeDiagram
            rangeHigh={derived.rangeHigh ?? 0}
            rangeLow={derived.rangeLow ?? 0}
            sweepSide={derived.sweepSide ?? "none"}
            target={derived.target}
            labels={{ sweep: t({ en: "Sweep", ko: "스윕" }), target: t({ en: "Target", ko: "타겟" }) }}
            captions={priceCaptions}
          />
          <div
            className={cn(
              "flex flex-col gap-18 border-panel",
              isMobile ? "border-t pt-16" : "border-l pl-28",
            )}
          >
            <div>
              <div className="text-13 font-semibold text-muted">{t({ en: "Range size", ko: "레인지 크기" })}</div>
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
              <div className="text-13 font-semibold text-muted">{t({ en: "Sweep side", ko: "스윕 사이드" })}</div>
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
                {showSweepOverride ? t({ en: "Use derived", ko: "자동값 사용" }) : t({ en: "Override", ko: "직접 지정" })}
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
                options={SWEEP_SIDE_ORDER.map((value) => ({ value, label: t(SWEEP_SIDE_LABELS[value]) }))}
              />
            )}
          />
        )}
      </SectionCard>

      {/* 3 — Execution */}
      <SectionCard step={3} title={t({ en: "Execution", ko: "실행" })} compact={isMobile}>
        <div className={cn("grid gap-16", isMobile ? "grid-cols-2" : "grid-cols-4")}>
          <Field label={t({ en: "Entry", ko: "진입가" })} htmlFor="entry" error={errors.entry?.message}>
            <Input id="entry" inputMode="decimal" {...register("entry")} />
          </Field>
          <Field label={t({ en: "Stop", ko: "손절가" })} htmlFor="stop" error={errors.stop?.message}>
            <Input id="stop" inputMode="decimal" {...register("stop")} />
          </Field>
          <Field label={t({ en: "Target", ko: "타겟" })} htmlFor="target" error={errors.target?.message}>
            <Input id="target" inputMode="decimal" {...register("target")} />
          </Field>
          <Field label={t({ en: "Size (lots)", ko: "사이즈 (랏)" })} htmlFor="size" error={errors.size?.message}>
            <Input id="size" inputMode="decimal" {...register("size")} />
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

        <div className={cn("mt-16 grid gap-16", isMobile ? "grid-cols-1" : "grid-cols-2")}>
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

        <div className={cn("mt-16 grid gap-16", isMobile ? "grid-cols-1" : "grid-cols-2")}>
          <Field
            label={t({ en: "Exit", ko: "청산가" })}
            htmlFor="exit"
            error={errors.exit?.message}
            hint={t({ en: "Leave empty while the trade is still open.", ko: "아직 청산 전이면 비워두세요." })}
          >
            <Input
              id="exit"
              inputMode="decimal"
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
                  onChange={(value) => {
                    setResultTouched(true);
                    field.onChange(value);
                  }}
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

        <div className={cn("mt-16 grid gap-16", isMobile ? "grid-cols-1" : "grid-cols-2")}>
          <Field label={t({ en: "Exit reason", ko: "청산 사유" })} htmlFor="exit-reason" error={errors.exitReason?.message}>
            <Input id="exit-reason" placeholder="Partial into 50%" {...register("exitReason")} />
          </Field>
          <Field label={t({ en: "Hold (minutes)", ko: "보유 시간 (분)" })} htmlFor="hold-minutes" error={errors.holdMinutes?.message}>
            <Input id="hold-minutes" inputMode="numeric" placeholder="38" {...register("holdMinutes")} />
          </Field>
        </div>

        {derived.realized !== null && (
          <p className="mt-12 text-13 font-semibold text-secondary">
            {t({ en: "Realized", ko: "실현" })}{" "}
            <span className={cn(derived.realized >= 0 ? "text-gain" : "text-loss")}>
              {formatR(derived.realized)}
            </span>
          </p>
        )}
      </SectionCard>

      {/* 4 — Chart & notes */}
      <SectionCard step={4} title={t({ en: "Chart & notes", ko: "차트 · 노트" })} compact={isMobile}>
        <div className={cn("grid gap-16", isMobile ? "grid-cols-1" : "grid-cols-2")}>
          <div>
            <Dropzone
              disabled={tradeAttachments.attachments.length >= MAX_ATTACHMENTS_PER_TRADE}
              title={t({ en: "Drag chart screenshots here", ko: "차트 스크린샷을 여기로" })}
              hint={t({
                en: "Two shots recommended: HTF range + entry timeframe · paste with ⌘V",
                ko: "HTF 레인지 + 진입 타임프레임 2장 권장 · ⌘V로 붙여넣기 가능",
              })}
              buttonLabel={t({ en: "Choose file", ko: "파일 선택" })}
              onFiles={(files) => void tradeAttachments.addFiles(files)}
            />
            {tradeAttachments.error !== null && (
              <p className="mt-8 text-11_5 font-medium text-loss">{tradeAttachments.error}</p>
            )}
            {tradeAttachments.uploading > 0 && (
              <p className="mt-8 text-11_5 font-medium text-faint">{t({ en: "Uploading…", ko: "업로드 중…" })}</p>
            )}
            <AttachmentThumbnails
              attachments={tradeAttachments.attachments}
              onRemove={(path) => void tradeAttachments.removeAttachment(path)}
              className="mt-12"
            />
          </div>
          <div>
            <Textarea
              placeholder={t({ en: "What did you see? What did you do?", ko: "무엇을 봤고 어떻게 행동했나요?" })}
              {...register("notes")}
            />
            <Controller
              control={control}
              name="tags"
              render={({ field }) => (
                <div className="mt-12 flex flex-wrap gap-8">
                  {TAG_PRESETS.map((preset) => {
                    const label = t(preset);
                    const selected = field.value.includes(label);
                    return (
                      <ToggleChip
                        key={preset.en}
                        selected={selected}
                        onToggle={() =>
                          field.onChange(
                            selected ? field.value.filter((tag) => tag !== label) : [...field.value, label],
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
        <Card className={cn(isMobile ? "px-20 py-20" : "px-32 py-24")}>
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
        </Card>
      )}

      {serverError !== null && <p className="text-13 font-semibold text-loss">{serverError}</p>}

      <div className="flex gap-12">
        <Button type="button" tone="neutral" size="lg" className="flex-1" disabled={isPending} onClick={onCancel}>
          {t({ en: "Cancel", ko: "취소" })}
        </Button>
        <Button type="submit" size="lg" className="flex-2" disabled={isPending}>
          {isPending ? t({ en: "Saving…", ko: "저장하는 중…" }) : t({ en: "Save changes", ko: "변경사항 저장" })}
        </Button>
      </div>
    </form>
  );
}
