"use client";

import { useEffect } from "react";
import { Check } from "lucide-react";
import { Controller, type Control, type UseFormRegister } from "react-hook-form";
import type { FieldErrors } from "react-hook-form";
import {
  Button,
  Card,
  Chip,
  Combobox,
  Dropzone,
  Field,
  Input,
  Segmented,
  Select,
  Textarea,
  ToggleChip,
} from "@/components/ui";
import { RangeDiagram } from "@/components/range-diagram";
import { AttachmentThumbnails } from "@/components/attachment-thumbnails";
import { cn } from "@/lib/cn";
import { formatCurrency, formatPrice } from "@/lib/format";
import { useFormatR } from "@/lib/settings/context";
import { MAX_ATTACHMENTS_PER_TRADE } from "@/lib/attachments";
import { INSTRUMENT_PRESETS } from "@/lib/instruments";
import { HTF_PAIRING_LABELS, HTF_PAIRING_ORDER, SESSION_LABELS, TAG_PRESETS } from "@/lib/labels";
import type { AccountKind, SweepSide, TradeModel, TradeResult } from "@/lib/domain/types";
import { useT } from "@/lib/i18n/locale-context";
import type { useDraftAttachments } from "./use-draft-attachments";
import type { NewTradeInput } from "./schema";
import type { WarningCode } from "@/lib/domain/warnings";

export const WIZARD_STEP_COUNT = 4;

export interface WizardDerived {
  rangeHigh: number | null;
  rangeLow: number | null;
  entry: number | null;
  stop: number | null;
  target: number | null;
  exit: number | null;
  size: number | null;
  sweepSide: SweepSide | null;
  planned: number | null;
  realized: number | null;
}

/** Field names validated before advancing off each step — matches the schema's required set per CRT section. */
export const WIZARD_STEP_FIELDS: Record<number, (keyof NewTradeInput)[]> = {
  1: ["instrument", "date"],
  2: ["rangeHigh", "rangeLow"],
  3: ["entry", "stop", "size"],
  4: [],
};

export interface MobileQuickLogWizardProps {
  step: number;
  onBack: () => void;
  onNext: () => void;
  control: Control<NewTradeInput>;
  register: UseFormRegister<NewTradeInput>;
  errors: FieldErrors<NewTradeInput>;
  values: NewTradeInput;
  derived: WizardDerived;
  models: TradeModel[];
  rValueToday: number;
  accountKind: AccountKind;
  currency: string;
  attachments: ReturnType<typeof useDraftAttachments>;
  onExitChange: (raw: string) => void;
  onResultChange: (value: TradeResult) => void;
  warnings: WarningCode[];
  warningText: Record<WarningCode, string>;
  serverError: string | null;
  isPending: boolean;
}

function StepHeading({ children }: { children: React.ReactNode }) {
  return <h2 className="text-20 font-extrabold tracking-[-.02em] text-ink">{children}</h2>;
}

/**
 * Mock 1d-quicklog's big single-question style (docs/README.md § Quick log):
 * "Question as a display line (800 24px/1.35...) ... Four tappable option
 * rows: radius 16, padding 18/20, 2px transparent border, #f4f5f7 fill...
 * selected = #e8f3ff fill, 2px #3182f6 border, 700 #1b64da text, trailing ✓."
 * Only the sweep-side question in the mock actually uses this pattern — kept
 * as a one-off block here rather than a new primitive, since nothing else in
 * this wizard needs it (docs/decisions.md § Phase 4d).
 */
function BigChoiceRow({
  label,
  selected,
  onSelect,
}: {
  label: string;
  selected: boolean;
  onSelect: () => void;
}) {
  return (
    <button
      type="button"
      role="radio"
      aria-checked={selected}
      onClick={onSelect}
      className={cn(
        "flex items-center justify-between rounded-16 border-2 px-20 py-18 text-left text-15_5 font-semibold transition-colors duration-150 ease-out",
        "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent focus-visible:ring-offset-2",
        selected
          ? "border-accent bg-accent-tint font-bold text-accent-pressed"
          : "border-transparent bg-divider text-secondary",
      )}
    >
      {label}
      {selected && <Check aria-hidden size={18} className="text-accent" />}
    </button>
  );
}

export function MobileQuickLogWizard({
  step,
  onBack,
  onNext,
  control,
  register,
  errors,
  values,
  derived,
  models,
  rValueToday,
  accountKind,
  currency,
  attachments,
  onExitChange,
  onResultChange,
  warnings,
  warningText,
  serverError,
  isPending,
}: MobileQuickLogWizardProps) {
  const formatR = useFormatR();
  const t = useT();

  // Each step is a fresh screen — without this, advancing/going back keeps
  // whatever scroll position the previous (often taller) step left behind,
  // landing mid-page with no way to tell which field is which.
  useEffect(() => {
    window.scrollTo(0, 0);
  }, [step]);

  const rangeReady = derived.rangeHigh !== null && derived.rangeLow !== null;
  const sweepOptions: { value: SweepSide; label: string }[] = [
    { value: "low", label: t({ en: "Low purged · Long bias", ko: "저점 퍼지 · 롱 방향" }) },
    { value: "high", label: t({ en: "High purged · Short bias", ko: "고점 퍼지 · 숏 방향" }) },
    { value: "both", label: t({ en: "Both swept", ko: "양방향 퍼지" }) },
    { value: "none", label: t({ en: "No sweep (off-plan)", ko: "스윕 없음 (규칙 외)" }) },
  ];

  return (
    <div className="mx-auto flex max-w-[560px] flex-col gap-24 px-20 py-24">
      {step === 1 && (
        <div className="flex flex-col gap-20">
          <StepHeading>{t({ en: "Context", ko: "컨텍스트" })}</StepHeading>
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
      )}

      {step === 2 && (
        <div className="flex flex-col gap-20">
          <StepHeading>{t({ en: "Range & sweep", ko: "레인지 · 스윕" })}</StepHeading>
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
            <Input id="range-high" inputMode="decimal" placeholder="1.2655" {...register("rangeHigh")} />
          </Field>
          <Field
            label={t({ en: "Range low", ko: "레인지 하단" })}
            htmlFor="range-low"
            error={errors.rangeLow?.message}
          >
            <Input id="range-low" inputMode="decimal" placeholder="1.2605" {...register("rangeLow")} />
          </Field>

          {rangeReady ? (
            <div className="flex flex-col gap-14 pt-4">
              <div>
                <div className="text-24 leading-[1.35] font-extrabold tracking-[-.03em] text-ink">
                  {t({ en: "Which side of the range got swept first?", ko: "레인지의 어느 쪽을 먼저 쓸었나요?" })}
                </div>
                <div className="mt-8 text-13_5 font-medium text-faint">
                  {t(HTF_PAIRING_LABELS[values.htfPairing])}{" "}
                  {t({ en: "range", ko: "레인지" })}{" "}
                  {formatPrice(derived.rangeLow!, values.instrument)} —{" "}
                  {formatPrice(derived.rangeHigh!, values.instrument)}
                </div>
              </div>

              {/*
                RangeDiagram's sweep-side label sits *outside* the diagram box
                itself (top:-34px / bottom:-34px, so it reads next to the
                marker rather than inside the bar) — on desktop the
                surrounding Panel's own padding happens to cover that, but
                this compact mobile layout packs siblings much closer, and the
                label was overlapping the subtitle line above it. My-40 gives
                it room on both sides regardless of which side gets swept.
              */}
              <RangeDiagram
                className="my-40 h-88"
                rangeHigh={derived.rangeHigh!}
                rangeLow={derived.rangeLow!}
                sweepSide={values.sweepSideOverride ?? "none"}
                target={null}
                labels={{ sweep: t({ en: "Sweep", ko: "스윕" }), target: t({ en: "Target", ko: "타겟" }) }}
              />

              <Controller
                control={control}
                name="sweepSideOverride"
                render={({ field }) => (
                  <div role="radiogroup" className="flex flex-col gap-10">
                    {sweepOptions.map((option) => (
                      <BigChoiceRow
                        key={option.value}
                        label={option.label}
                        selected={field.value === option.value}
                        onSelect={() => field.onChange(option.value)}
                      />
                    ))}
                  </div>
                )}
              />
            </div>
          ) : (
            <p className="text-13_5 font-medium text-faint">
              {t({
                en: "Enter the range high and low to choose the sweep side.",
                ko: "레인지 상단·하단을 입력하면 스윕 사이드를 고를 수 있습니다.",
              })}
            </p>
          )}
        </div>
      )}

      {step === 3 && (
        <div className="flex flex-col gap-20">
          <StepHeading>{t({ en: "Execution", ko: "실행" })}</StepHeading>
          <Field label={t({ en: "Entry", ko: "진입가" })} htmlFor="entry" error={errors.entry?.message}>
            <Input id="entry" inputMode="decimal" placeholder="1.2620" {...register("entry")} />
          </Field>
          <Field label={t({ en: "Stop", ko: "손절가" })} htmlFor="stop" error={errors.stop?.message}>
            <Input id="stop" inputMode="decimal" placeholder="1.2600" {...register("stop")} />
          </Field>
          <Field label={t({ en: "Target", ko: "타겟" })} htmlFor="target" error={errors.target?.message}>
            <Input id="target" inputMode="decimal" placeholder="1.2680" {...register("target")} />
          </Field>
          <Field label={t({ en: "Size (lots)", ko: "사이즈 (랏)" })} htmlFor="size" error={errors.size?.message}>
            <Input id="size" inputMode="decimal" placeholder="1.0" {...register("size")} />
          </Field>

          <div className="flex items-center justify-between rounded-16 bg-accent-tint px-20 py-16">
            <span className="text-14 font-semibold text-accent-pressed">
              {t({ en: "Auto-calculated R:R", ko: "자동 계산 R:R" })}
            </span>
            <span className="text-20 font-extrabold text-accent-pressed">
              {derived.planned === null ? "—" : `1 : ${derived.planned.toFixed(1)}R`}
            </span>
          </div>
          <p className="-mt-8 text-11_5 font-medium text-faint">
            {t({
              en: accountKind === "backtest"
                ? `1R today · ${formatCurrency(rValueToday, currency)} — this account freezes 1R to the balance as of this trade's own date, not today's.`
                : `1R today · ${formatCurrency(rValueToday, currency)} — frozen onto this trade when you log it.`,
              ko: accountKind === "backtest"
                ? `오늘의 1R · ${formatCurrency(rValueToday, currency)} — 이 계좌는 오늘이 아니라 이 트레이드 날짜 시점의 잔고로 1R을 고정합니다.`
                : `오늘의 1R · ${formatCurrency(rValueToday, currency)} — 기록하는 순간 이 값으로 고정됩니다.`,
            })}
          </p>

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
          <Field
            label={t({ en: "Exit", ko: "청산가" })}
            htmlFor="exit"
            error={errors.exit?.message}
            hint={t({ en: "Leave empty while the trade is still open.", ko: "아직 청산 전이면 비워두세요." })}
          >
            <Input
              id="exit"
              inputMode="decimal"
              placeholder="1.2650"
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

          {derived.realized !== null && (
            <p className="-mt-8 text-13 font-semibold text-secondary">
              {t({ en: "Realized", ko: "실현" })}{" "}
              <span className={cn(derived.realized >= 0 ? "text-gain" : "text-loss")}>
                {formatR(derived.realized)}
              </span>
            </p>
          )}
        </div>
      )}

      {step === 4 && (
        <div className="flex flex-col gap-20">
          <StepHeading>{t({ en: "Chart & notes", ko: "차트 · 노트" })}</StepHeading>
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
              <p className="mt-8 text-11_5 font-medium text-faint">{t({ en: "Uploading…", ko: "업로드 중…" })}</p>
            )}
            <AttachmentThumbnails
              attachments={attachments.attachments}
              onRemove={(path) => void attachments.removeAttachment(path)}
              className="mt-12"
            />
          </div>

          <Textarea
            placeholder={t({ en: "What did you see? What did you do?", ko: "무엇을 봤고 어떻게 행동했나요?" })}
            {...register("notes")}
          />
          <Controller
            control={control}
            name="tags"
            render={({ field }) => (
              <div className="flex flex-wrap gap-8">
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

          {warnings.length > 0 && (
            <Card className="bg-panel px-20 py-18">
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
        </div>
      )}

      <div className="sticky bottom-0 -mx-20 flex gap-10 bg-page px-20 pt-8 pb-4">
        {step > 1 && (
          <Button type="button" tone="neutral" size="lg" className="flex-1" onClick={onBack} disabled={isPending}>
            {t({ en: "Back", ko: "이전" })}
          </Button>
        )}
        {step < WIZARD_STEP_COUNT ? (
          <Button key="next" type="button" size="lg" className="flex-2" onClick={onNext}>
            {t({ en: "Next", ko: "다음" })}
          </Button>
        ) : (
          <Button key="submit" type="submit" size="lg" className="flex-2" disabled={isPending}>
            {isPending ? t({ en: "Logging…", ko: "기록하는 중…" }) : t({ en: "Log trade", ko: "기록하기" })}
          </Button>
        )}
      </div>
    </div>
  );
}
