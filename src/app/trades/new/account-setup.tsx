"use client";

import { useState, useTransition } from "react";
import { Button, Field, Input, Modal, Panel, Segmented } from "@/components/ui";
import type { AccountKind } from "@/lib/domain/types";
import { formatCurrency } from "@/lib/format";
import { parseNumberInput } from "@/lib/format";
import { todayIso } from "@/lib/domain/dates";
import { useT } from "@/lib/i18n/locale-context";
import { createAccount } from "./actions";

const RISK_OPTIONS = ["0.5", "1", "2"] as const;

/**
 * Shown when the user opens New trade with no account yet (the "first-run"
 * context — the original copy is specific to that moment) and, since Phase
 * 9's multi-account follow-up, also reachable from Capital to add a second
 * or third account ("additional") — same form either way, just the intro
 * line and default name differ.
 */
export function AccountSetup({
  context = "first-run",
  onCreated,
  onCancel,
}: {
  context?: "first-run" | "additional";
  onCreated: (accountId: string) => void;
  onCancel: () => void;
}) {
  const t = useT();
  const [isPending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  const [name, setName] = useState(context === "first-run" ? "Main" : "");
  const [currency] = useState("USD");
  const [kind, setKind] = useState<AccountKind>("live");
  const [startingCapital, setStartingCapital] = useState("");
  const [startedAt, setStartedAt] = useState(todayIso());
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
        kind,
        // A live account always starts "now" (unchanged behavior) — only a
        // backtest account's own start date is user-chosen, since it has to
        // predate the earliest trade you're about to backfill for the
        // balance/1R timeline to mean anything (docs/decisions.md § Phase 9
        // backtest follow-up).
        startedAt: kind === "backtest" ? startedAt : todayIso(),
        startingCapital,
        riskPercent,
        drawdownLimitPercent,
      });
      if (result.ok) onCreated(result.id);
      else setError(result.error);
    });
  }

  return (
    <Modal
      open
      onClose={onCancel}
      title={
        context === "first-run"
          ? t({ en: "Set up your account", ko: "계좌 설정" })
          : t({ en: "New account", ko: "새 계좌" })
      }
      footer={
        <Button size="lg" className="w-full" disabled={isPending} onClick={submit}>
          {isPending
            ? t({ en: "Saving…", ko: "저장하는 중…" })
            : context === "first-run"
              ? t({ en: "Save and continue", ko: "저장하고 계속" })
              : t({ en: "Create account", ko: "계좌 만들기" })}
        </Button>
      }
    >
      <div className="flex flex-col gap-16 pb-8">
        <p className="text-13_5 leading-[1.6] text-secondary">
          {context === "first-run"
            ? t({
                en: "Every trade stores the cash value of 1R as it stood the day it was logged, so this has to exist before the first one.",
                ko: "모든 트레이드는 기록 시점의 1R 금액을 함께 저장합니다. 첫 기록 전에 계좌가 필요합니다.",
              })
            : t({
                en: "A separate balance, ledger, and 1R history — trades logged from now on go to whichever account is switched on.",
                ko: "잔고·원장·1R 이력이 완전히 분리된 별도 계좌입니다 — 지금부터의 기록은 전환된 계좌에 들어갑니다.",
              })}
        </p>

        <Field label={t({ en: "Account name", ko: "계좌 이름" })} htmlFor="account-name">
          <Input
            id="account-name"
            placeholder={context === "additional" ? t({ en: "e.g. EUR backtest", ko: "예: 유로 백테스트" }) : undefined}
            value={name}
            onChange={(e) => setName(e.target.value)}
          />
        </Field>

        <Field label={t({ en: "Account type", ko: "계좌 유형" })}>
          <Segmented
            name="kind"
            value={kind}
            onChange={setKind}
            options={[
              { value: "live", label: t({ en: "Live", ko: "실거래" }) },
              { value: "backtest", label: t({ en: "Backtest", ko: "백테스트" }) },
            ]}
          />
        </Field>

        {kind === "backtest" && (
          <Field
            label={t({ en: "Start date", ko: "시작일" })}
            htmlFor="account-started-at"
            hint={t({
              en: "The earliest date you'll log a trade for — 1R for a given date is the balance built from every trade already logged on or before it, not from today's balance.",
              ko: "기록할 트레이드 중 가장 이른 날짜여야 합니다 — 각 날짜의 1R은 오늘 잔고가 아니라 그 날짜까지 기록된 트레이드로 쌓인 잔고를 기준으로 계산됩니다.",
            })}
          >
            <Input
              id="account-started-at"
              type="date"
              value={startedAt}
              onChange={(e) => setStartedAt(e.target.value)}
            />
          </Field>
        )}

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
