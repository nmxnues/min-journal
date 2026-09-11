"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { Button, Card, Field, Input, Modal, Panel, Segmented } from "@/components/ui";
import { cn } from "@/lib/cn";
import { rValueForBalance, type CapitalSeriesPoint } from "@/lib/domain/capital";
import type { Account, RiskSetting } from "@/lib/domain/types";
import { formatCurrency, formatTradeDate, parseNumberInput } from "@/lib/format";
import type { LocaleStrings } from "@/lib/i18n/locale";
import { useLocale, useT } from "@/lib/i18n/locale-context";
import { tradeCountLabel } from "@/lib/labels";
import { updateRiskSetting } from "./actions";
import type { CapitalData, CapitalSummary } from "./use-capital-summary";

type RiskOption = "0.5" | "1" | "2" | "fixed";
const RISK_OPTIONS: readonly RiskOption[] = ["0.5", "1", "2", "fixed"];

/** How many "1R history" rows the card lists — the most recent ones. */
const HISTORY_ROWS = 6;

function optionFor(setting: RiskSetting): RiskOption | null {
  if (setting.riskMode === "fixed") return "fixed";
  const percent = setting.riskPercent;
  return percent === 0.5 ? "0.5" : percent === 1 ? "1" : percent === 2 ? "2" : null;
}

function settingLabel(setting: RiskSetting, currency: string, t: (s: LocaleStrings) => string): string {
  if (setting.riskMode === "fixed") {
    return `${t({ en: "Fixed", ko: "고정" })} ${formatCurrency(setting.fixedRiskAmount ?? 0, currency)}`;
  }
  return `${setting.riskPercent}%`;
}

/**
 * Mock 3a's "Risk per trade" card: today's 1R, the 0.5% / 1% / 2% / Fixed
 * control, the explanatory caption, and the 1R history. Picking an option
 * never applies straight away — docs/README.md § Capital: "changing the risk
 * % applies to future trades only (warn on change)" — it opens the
 * confirmation below first.
 *
 * `compact` is the mobile card, which leaves today's 1R to the 1R card above it.
 */
export function RiskPerTradeCard({
  data,
  summary,
  compact = false,
}: {
  data: CapitalData;
  summary: CapitalSummary;
  compact?: boolean;
}) {
  const t = useT();
  const locale = useLocale();
  const { account } = data;
  const currency = account.currency;
  const [target, setTarget] = useState<RiskOption | null>(null);
  const current = optionFor(account);

  const history = summary.milestones.slice(-HISTORY_ROWS);

  return (
    <Card className={compact ? "rounded-22 px-22 py-20" : "px-28 py-26"}>
      <span className={cn("font-bold tracking-[-.02em] text-ink", compact ? "text-15" : "text-16")}>
        {t({ en: "Risk per trade", ko: "트레이드당 리스크" })}
      </span>

      {!compact && (
        <div className="mt-14 flex items-baseline gap-10">
          <span className="text-34 font-extrabold tracking-[-.03em] text-ink">
            {formatCurrency(summary.rValueToday, currency)}
          </span>
          <span className="text-14 font-semibold text-muted">{t({ en: "= 1R today", ko: "= 오늘의 1R" })}</span>
        </div>
      )}

      <Segmented
        name={t({ en: "Risk per trade", ko: "트레이드당 리스크" })}
        className="mt-14"
        value={current}
        onChange={(option) => {
          // Re-picking Fixed is how a fixed amount gets edited; re-picking a % is a no-op.
          if (option !== current || option === "fixed") setTarget(option);
        }}
        options={RISK_OPTIONS.map((value) => ({
          value,
          label: value === "fixed" ? t({ en: "Fixed", ko: "고정" }) : `${value}%`,
        }))}
      />

      <p className="mt-12 text-12_5 font-medium leading-[1.6] text-faint">
        {account.riskMode === "fixed"
          ? t({
              en: `1R is a fixed ${formatCurrency(account.fixedRiskAmount ?? 0, currency)}, whatever the balance. New trades use it; past trades keep the 1R that applied when they were logged.`,
              ko: `1R은 잔고와 상관없이 ${formatCurrency(account.fixedRiskAmount ?? 0, currency)}로 고정됩니다. 새 트레이드는 이 값을 쓰고, 지난 트레이드는 기록 당시의 1R을 유지합니다.`,
            })
          : t({
              en: "1R follows the balance. New trades use today's value; past trades keep the 1R that applied when they were logged.",
              ko: "1R은 잔고를 따라 움직입니다. 새 트레이드는 오늘 값을 쓰고, 지난 트레이드는 기록 당시의 1R을 유지합니다.",
            })}
      </p>

      <div className="mt-20 mb-16 h-1 bg-divider" />

      <div className="mb-10 text-12 font-semibold text-muted">{t({ en: "1R history", ko: "1R 이력" })}</div>
      <div className="flex flex-col gap-12">
        {history.map((point, i) => (
          <HistoryRow key={i} point={point} currency={currency} />
        ))}
      </div>

      {target !== null && (
        <RiskChangeModal
          account={account}
          balance={summary.balance}
          rValueToday={summary.rValueToday}
          loggedTradeCount={data.trades.length}
          target={target}
          variant={locale === "ko" ? "sheet" : "modal"}
          onClose={() => setTarget(null)}
        />
      )}
    </Card>
  );
}

function HistoryRow({ point, currency }: { point: CapitalSeriesPoint; currency: string }) {
  const t = useT();
  const locale = useLocale();
  const date = formatTradeDate(point.date, locale, true);
  const left =
    point.marker === "risk"
      ? `${date} · ${settingLabel(point.setting, currency, t)}`
      : `${date} · ${formatCurrency(point.balance, currency)}`;

  return (
    <div className="flex justify-between gap-12 text-13 font-semibold text-secondary">
      <span>{left}</span>
      <span className="text-ink">
        {formatCurrency(point.rValue, currency)} / R
      </span>
    </div>
  );
}

function RiskChangeModal({
  account,
  balance,
  rValueToday,
  loggedTradeCount,
  target,
  variant,
  onClose,
}: {
  account: Account;
  balance: number;
  rValueToday: number;
  loggedTradeCount: number;
  target: RiskOption;
  variant: "modal" | "sheet";
  onClose: () => void;
}) {
  const t = useT();
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [fixedAmount, setFixedAmount] = useState(
    String(Math.round(account.riskMode === "fixed" ? (account.fixedRiskAmount ?? rValueToday) : rValueToday)),
  );

  const next: RiskSetting =
    target === "fixed"
      ? { riskMode: "fixed", riskPercent: null, fixedRiskAmount: parseNumberInput(fixedAmount) }
      : { riskMode: "percent", riskPercent: Number(target), fixedRiskAmount: null };
  const nextRValue = rValueForBalance(next, balance);
  const isValid = Number.isFinite(nextRValue) && nextRValue > 0;
  const isUnchanged =
    next.riskMode === account.riskMode &&
    next.riskPercent === account.riskPercent &&
    next.fixedRiskAmount === account.fixedRiskAmount;

  const label = settingLabel(next, account.currency, t);

  function confirm() {
    setError(null);
    startTransition(async () => {
      const result = await updateRiskSetting({
        accountId: account.id,
        riskMode: next.riskMode,
        riskPercent: target === "fixed" ? "" : target,
        fixedRiskAmount: fixedAmount,
      });
      if (result.ok) {
        onClose();
        router.refresh();
      } else {
        setError(result.error);
      }
    });
  }

  return (
    <Modal
      open
      onClose={onClose}
      variant={variant}
      closeLabel={t({ en: "Close", ko: "닫기" })}
      title={t({ en: "Change risk per trade?", ko: "리스크 설정을 바꿀까요?" })}
      footer={
        <div className="flex gap-12">
          <Button tone="neutral" size="lg" className="flex-1 rounded-14 py-15 text-15" onClick={onClose}>
            {t({ en: "Cancel", ko: "취소" })}
          </Button>
          <Button
            size="lg"
            className="flex-[2] rounded-14 py-15 text-15"
            disabled={!isValid || isUnchanged || isPending}
            onClick={confirm}
          >
            {isPending
              ? t({ en: "Saving…", ko: "저장하는 중…" })
              : t({ en: `Switch to ${label}`, ko: `${label} 적용` })}
          </Button>
        </div>
      }
    >
      <div className="flex flex-col gap-16 pt-4 pb-8">
        {target === "fixed" && (
          <Field label={t({ en: `Fixed 1R (${account.currency})`, ko: `고정 1R (${account.currency})` })} htmlFor="fixed-r">
            <Input
              id="fixed-r"
              inputMode="decimal"
              autoComplete="off"
              value={fixedAmount}
              onChange={(e) => setFixedAmount(e.target.value)}
            />
          </Field>
        )}

        <Panel className="flex flex-col gap-10 px-20 py-18">
          <div className="flex items-baseline justify-between gap-12 text-13_5 font-semibold text-secondary">
            <span>{t({ en: "1R for the next trade", ko: "다음 트레이드의 1R" })}</span>
            <span className="text-15 font-extrabold text-accent">
              {isValid ? formatCurrency(nextRValue, account.currency) : "—"}{" "}
              <span className="text-12_5 font-semibold text-muted">
                {t({
                  en: `from ${formatCurrency(rValueToday, account.currency)}`,
                  ko: `${formatCurrency(rValueToday, account.currency)}에서`,
                })}
              </span>
            </span>
          </div>
        </Panel>

        <p className="text-13_5 leading-[1.6] text-secondary">
          {t({
            en: `This applies only to trades you log from now on. The ${tradeCountLabel(loggedTradeCount).en} already logged keep the 1R they were logged with, and the 1R history before today stays as it was.`,
            ko: `지금부터 기록하는 트레이드에만 적용됩니다. 이미 기록한 ${tradeCountLabel(loggedTradeCount).ko}의 트레이드는 기록 당시의 1R을 그대로 유지하고, 오늘 이전의 1R 이력도 바뀌지 않습니다.`,
          })}
        </p>

        {error !== null && <p className="text-13 font-semibold text-loss">{error}</p>}
      </div>
    </Modal>
  );
}
