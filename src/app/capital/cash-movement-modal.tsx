"use client";

import { useState, useTransition } from "react";
import { Button, Field, Input, Modal, Panel, Segmented, Select } from "@/components/ui";
import { availableBalanceOn, previewCashMovement, validateWithdrawal } from "@/lib/domain/capital";
import type { CashMovementType } from "@/lib/domain/types";
import { formatCurrency, parseNumberInput } from "@/lib/format";
import { useT } from "@/lib/i18n/locale-context";
import { recordCashMovement } from "./actions";
import type { CapitalData, CapitalSummary } from "./use-capital-summary";

/**
 * Mock 3b — "Record cash movement": Deposit / Withdrawal, a large Amount
 * field, Date and Account side by side, a Note, and the preview panel with
 * "Balance after" and "1R moves to $X from $Y".
 *
 * The preview is today's view — the balance the account will have and the 1R
 * the next logged trade will freeze — since that's what recording cash
 * actually changes; no existing trade's 1R moves (docs/README.md § Capital).
 */
export function CashMovementModal({
  data,
  summary,
  variant,
  onClose,
  onRecorded,
}: {
  data: CapitalData;
  summary: CapitalSummary;
  variant: "modal" | "sheet";
  onClose: () => void;
  onRecorded: () => void;
}) {
  const t = useT();
  const { account, cashMovements, trades, today } = data;
  const [isPending, startTransition] = useTransition();
  const [serverError, setServerError] = useState<string | null>(null);

  const [type, setType] = useState<CashMovementType>("deposit");
  const [amount, setAmount] = useState("");
  const [date, setDate] = useState(today);
  const [note, setNote] = useState("");

  const amountValue = parseNumberInput(amount);
  const hasAmount = amountValue !== null && amountValue > 0;

  const dateError =
    date === ""
      ? t({ en: "Pick a date.", ko: "날짜를 선택하세요." })
      : date < account.startedAt
        ? t({ en: "That's before this account started.", ko: "계좌 시작일보다 이전입니다." })
        : date > today
          ? t({ en: "Cash can't be recorded for a future date.", ko: "미래 날짜로는 기록할 수 없습니다." })
          : null;

  // Against the lowest balance from that date on, so a backdated withdrawal
  // can't overdraw a later point either.
  const available =
    type === "withdrawal" && dateError === null ? availableBalanceOn(account, cashMovements, trades, date) : null;
  const exceedsBalance =
    available !== null && hasAmount && validateWithdrawal(amountValue, available).reason === "exceeds_balance";

  // A blocked withdrawal gets no preview: a negative "Balance after" describes something that can't be recorded.
  const preview =
    hasAmount && !exceedsBalance ? previewCashMovement(account, summary.balance, type, amountValue) : null;
  const canSubmit = hasAmount && dateError === null && !exceedsBalance && !isPending;

  function submit() {
    setServerError(null);
    startTransition(async () => {
      const result = await recordCashMovement({ accountId: account.id, type, amount, date, note });
      if (result.ok) onRecorded();
      else setServerError(result.error);
    });
  }

  const em = "—";

  return (
    <Modal
      open
      onClose={onClose}
      variant={variant}
      closeLabel={t({ en: "Close", ko: "닫기" })}
      title={t({ en: "Record cash movement", ko: "입출금 기록" })}
      footer={
        <div className="flex gap-12">
          <Button tone="neutral" size="lg" className="flex-1 rounded-14 py-15 text-15" onClick={onClose}>
            {t({ en: "Cancel", ko: "취소" })}
          </Button>
          <Button size="lg" className="flex-[2] rounded-14 py-15 text-15" disabled={!canSubmit} onClick={submit}>
            {isPending
              ? t({ en: "Saving…", ko: "저장하는 중…" })
              : type === "deposit"
                ? t({ en: "Record deposit", ko: "입금 기록" })
                : t({ en: "Record withdrawal", ko: "출금 기록" })}
          </Button>
        </div>
      }
    >
      <form
        className="flex flex-col pt-4 pb-8"
        onSubmit={(event) => {
          event.preventDefault();
          if (canSubmit) submit();
        }}
      >
        <Segmented
          name={t({ en: "Type", ko: "유형" })}
          value={type}
          onChange={setType}
          options={[
            { value: "deposit", label: t({ en: "Deposit", ko: "입금" }) },
            { value: "withdrawal", label: t({ en: "Withdrawal", ko: "출금" }) },
          ]}
        />

        <Field
          label={t({ en: "Amount", ko: "금액" })}
          htmlFor="cash-amount"
          className="mt-18"
          error={
            exceedsBalance
              ? t({
                  en: `More than the ${formatCurrency(available!, account.currency)} available on this date.`,
                  ko: `이 날짜에 출금 가능한 ${formatCurrency(available!, account.currency)}보다 많습니다.`,
                })
              : undefined
          }
        >
          <div className="relative">
            <Input
              id="cash-amount"
              inputMode="decimal"
              autoComplete="off"
              placeholder="5,000"
              value={amount}
              onChange={(e) => setAmount(e.target.value)}
              className="py-16 pr-64 pl-18 text-22 font-extrabold"
            />
            <span className="pointer-events-none absolute top-1/2 right-18 -translate-y-1/2 text-13 font-semibold text-faint">
              {account.currency}
            </span>
          </div>
        </Field>

        <div className="mt-16 grid grid-cols-2 gap-14">
          <Field label={t({ en: "Date", ko: "날짜" })} htmlFor="cash-date" error={dateError ?? undefined}>
            <Input
              id="cash-date"
              type="date"
              min={account.startedAt}
              max={today}
              value={date}
              onChange={(e) => setDate(e.target.value)}
            />
          </Field>
          {/* A select even with one account, so multi-account drops in here later (docs/README.md § Capital). */}
          <Field label={t({ en: "Account", ko: "계좌" })} htmlFor="cash-account">
            <Select id="cash-account" value={account.id} onChange={() => undefined}>
              <option value={account.id}>{account.name}</option>
            </Select>
          </Field>
        </div>

        <Field label={t({ en: "Note", ko: "메모" })} htmlFor="cash-note" className="mt-16">
          <Input
            id="cash-note"
            placeholder={t({ en: "Monthly top-up · bank transfer", ko: "월 정기 입금 · 계좌 이체" })}
            value={note}
            onChange={(e) => setNote(e.target.value)}
            className="text-14 font-medium"
          />
        </Field>

        <Panel className="mt-18 flex flex-col gap-10 px-20 py-18">
          <div className="flex items-baseline justify-between gap-12 text-13_5 font-semibold text-secondary">
            <span>{t({ en: "Balance after", ko: "기록 후 잔고" })}</span>
            <span className="text-15 font-extrabold text-ink">
              {preview === null ? em : formatCurrency(preview.balanceAfter, account.currency)}
            </span>
          </div>
          <div className="flex items-baseline justify-between gap-12 text-13_5 font-semibold text-secondary">
            <span>{t({ en: "1R moves to", ko: "1R 변경" })}</span>
            {preview === null ? (
              <span className="text-15 font-extrabold text-ink">{em}</span>
            ) : (
              <span className="text-15 font-extrabold text-accent">
                {formatCurrency(preview.rValueAfter, account.currency)}{" "}
                <span className="text-12_5 font-semibold text-muted">
                  {t({
                    en: `from ${formatCurrency(preview.rValueBefore, account.currency)}`,
                    ko: `${formatCurrency(preview.rValueBefore, account.currency)}에서`,
                  })}
                </span>
              </span>
            )}
          </div>
          <p className="text-12 font-medium leading-[1.5] text-faint">
            {date === today || dateError !== null
              ? t({
                  en: "Only trades logged after this date use the new 1R.",
                  ko: "이 날짜 이후에 기록하는 트레이드부터 새 1R을 씁니다.",
                })
              : t({
                  en: "Trades already logged keep their 1R — only trades you log from now on use the new one.",
                  ko: "이미 기록한 트레이드는 1R이 그대로이고, 지금부터 기록하는 트레이드만 새 1R을 씁니다.",
                })}
          </p>
        </Panel>

        {serverError !== null && <p className="mt-12 text-13 font-semibold text-loss">{serverError}</p>}

        {/* Enter in any field submits, like every other form in the app. */}
        <button type="submit" hidden aria-hidden tabIndex={-1} />
      </form>
    </Modal>
  );
}
