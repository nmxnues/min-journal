"use client";

import type { UseFormRegisterReturn } from "react-hook-form";
import { Field, Input } from "@/components/ui";
import { formatCurrency } from "@/lib/format";
import { useT } from "@/lib/i18n/locale-context";
import type { CommissionSide, useCommissionPrefill } from "@/lib/use-commission-prefill";

/**
 * Entry / exit commission inputs, shared by New trade and Trade detail's edit
 * form. Each renders as one grid cell, so the caller decides the row.
 *
 * The hint says where a value came from: the Settings rate while a side is
 * still on the prefill, or a "use rate" link once it holds anything else — a
 * value typed over the prefill, or a stored one such as the 0 every
 * pre-commission trade carries (docs/decisions.md § Commission).
 */
export function CommissionFields({
  registerSide,
  errors,
  prefill,
  sizeRaw,
  perLotPerSide,
  currency,
}: {
  registerSide: (side: CommissionSide) => UseFormRegisterReturn;
  errors: Partial<Record<CommissionSide, { message?: string }>>;
  prefill: ReturnType<typeof useCommissionPrefill>;
  sizeRaw: string;
  perLotPerSide: number;
  currency: string;
}) {
  const t = useT();
  const rate = formatCurrency(perLotPerSide, currency, 2);

  const hint = (side: CommissionSide) => {
    if (!prefill.enabled) {
      return t({
        en: "Positive, in account currency. Set a per-lot rate in Settings to fill this from the size.",
        ko: "계좌 통화 기준 양수. 설정에서 1랏당 편도 커미션을 넣으면 사이즈로 자동 입력됩니다.",
      });
    }
    if (!prefill.isManual(side)) {
      return t({ en: `Auto · size × ${rate} per side`, ko: `자동 · 사이즈 × 편도 ${rate}` });
    }
    return (
      <>
        {t({ en: "Kept as entered · ", ko: "입력값 유지 · " })}
        <button
          type="button"
          className="font-semibold text-accent underline-offset-2 hover:underline"
          onClick={() => prefill.reset(side, sizeRaw)}
        >
          {t({ en: `use size × ${rate}`, ko: `사이즈 × ${rate} 적용` })}
        </button>
      </>
    );
  };

  const labels: Record<CommissionSide, string> = {
    entryCommission: t({ en: "Entry commission", ko: "진입 커미션" }),
    exitCommission: t({ en: "Exit commission", ko: "청산 커미션" }),
  };

  return (
    <>
      {(["entryCommission", "exitCommission"] as const).map((side) => (
        <Field key={side} label={labels[side]} htmlFor={side} error={errors[side]?.message} hint={hint(side)}>
          <Input id={side} inputMode="decimal" placeholder="0" {...registerSide(side)} />
        </Field>
      ))}
    </>
  );
}
