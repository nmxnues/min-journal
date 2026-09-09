"use client";

import { useState, useTransition } from "react";
import { Button, Field, Input, Modal, Panel, Segmented } from "@/components/ui";
import { formatCurrency } from "@/lib/format";
import { parseNumberInput } from "@/lib/format";
import { useT } from "@/lib/i18n/locale-context";
import { createAccount } from "./actions";

const RISK_OPTIONS = ["0.5", "1", "2"] as const;

/**
 * Shown when the user opens New trade with no account yet — the current state
 * of a fresh install. Not the Capital screen (that's Phase 8, and it will edit
 * this same row): just the minimum a trade needs to exist, since
 * `trades.account_id` and `trades.r_value_at_entry` are NOT NULL and 1R is
 * meaningless without a balance and a risk setting.
 */
export function AccountSetup({
  onCreated,
  onCancel,
}: {
  onCreated: () => void;
  onCancel: () => void;
}) {
  const t = useT();
  const [isPending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  const [name, setName] = useState("Main");
  const [currency] = useState("USD");
  const [startingCapital, setStartingCapital] = useState("");
  const [riskPercent, setRiskPercent] = useState<string>("1");
  const [drawdownLimitPercent, setDrawdownLimitPercent] = useState("10");

  const capital = parseNumberInput(startingCapital);
  const risk = parseNumberInput(riskPercent);
  const previewR = capital !== null && risk !== null ? capital * (risk / 100) : null;

  function submit() {
    setError(null);
    startTransition(async () => {
      const result = await createAccount({
        name,
        currency,
        startingCapital,
        riskPercent,
        drawdownLimitPercent,
      });
      if (result.ok) onCreated();
      else setError(result.error);
    });
  }

  return (
    <Modal
      open
      onClose={onCancel}
      title={t({ en: "Set up your account", ko: "계좌 설정" })}
      footer={
        <Button size="lg" className="w-full" disabled={isPending} onClick={submit}>
          {isPending
            ? t({ en: "Saving…", ko: "저장하는 중…" })
            : t({ en: "Save and continue", ko: "저장하고 계속" })}
        </Button>
      }
    >
      <div className="flex flex-col gap-16 pb-8">
        <p className="text-13_5 leading-[1.6] text-secondary">
          {t({
            en: "Every trade stores the cash value of 1R as it stood the day it was logged, so this has to exist before the first one.",
            ko: "모든 트레이드는 기록 시점의 1R 금액을 함께 저장합니다. 첫 기록 전에 계좌가 필요합니다.",
          })}
        </p>

        <Field label={t({ en: "Account name", ko: "계좌 이름" })} htmlFor="account-name">
          <Input id="account-name" value={name} onChange={(e) => setName(e.target.value)} />
        </Field>

        <Field
          label={t({ en: "Starting capital (USD)", ko: "시작 자본 (USD)" })}
          htmlFor="starting-capital"
        >
          <Input
            id="starting-capital"
            inputMode="decimal"
            placeholder="15,000"
            value={startingCapital}
            onChange={(e) => setStartingCapital(e.target.value)}
          />
        </Field>

        <Field label={t({ en: "Risk per trade", ko: "트레이드당 리스크" })}>
          <Segmented
            name="risk"
            value={riskPercent}
            onChange={setRiskPercent}
            options={RISK_OPTIONS.map((value) => ({ value, label: `${value}%` }))}
          />
        </Field>

        <Field
          label={t({ en: "Drawdown limit (%)", ko: "드로다운 한도 (%)" })}
          htmlFor="drawdown-limit"
          hint={t({
            en: "The form warns once you're within 2 points of this.",
            ko: "이 한도에 2%p 이내로 근접하면 폼에서 경고합니다.",
          })}
        >
          <Input
            id="drawdown-limit"
            inputMode="decimal"
            value={drawdownLimitPercent}
            onChange={(e) => setDrawdownLimitPercent(e.target.value)}
          />
        </Field>

        {previewR !== null && (
          <Panel className="rounded-16 px-20 py-16">
            <div className="flex items-baseline justify-between">
              <span className="text-13 font-semibold text-secondary">
                {t({ en: "1R starts at", ko: "시작 1R" })}
              </span>
              <span className="text-17 font-extrabold text-ink">{formatCurrency(previewR)}</span>
            </div>
            <p className="mt-8 text-11_5 font-medium text-faint">
              {t({
                en: "It follows the balance from here — deposits raise it, withdrawals lower it.",
                ko: "이후 잔고를 따라 움직입니다 — 입금하면 오르고 출금하면 내려갑니다.",
              })}
            </p>
          </Panel>
        )}

        {error !== null && <p className="text-13 font-semibold text-loss">{error}</p>}
      </div>
    </Modal>
  );
}
