"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { Button, Modal, Panel } from "@/components/ui";
import { checkCashMovementDeletion, type LedgerEntry } from "@/lib/domain/capital";
import { formatSignedCurrency, formatTradeDate } from "@/lib/format";
import { useLocale, useT } from "@/lib/i18n/locale-context";
import { deleteCashMovement } from "./actions";
import { describeLedgerEntry } from "./ledger-copy";
import type { CapitalData, CapitalSummary } from "./use-capital-summary";

/**
 * Not in the mocks — the only way to correct a mistyped cash movement
 * (docs/decisions.md § Phase 8: delete, then record it again; no edit). Opened
 * by clicking a cash row in the ledger.
 */
export function DeleteCashModal({
  data,
  summary,
  entry,
  variant,
  onClose,
}: {
  data: CapitalData;
  summary: CapitalSummary;
  entry: LedgerEntry;
  variant: "modal" | "sheet";
  onClose: () => void;
}) {
  const t = useT();
  const locale = useLocale();
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  const check = checkCashMovementDeletion(data.account, data.cashMovements, data.trades, entry.id);
  const isDeposit = entry.kind === "deposit";

  function confirm() {
    setError(null);
    startTransition(async () => {
      const result = await deleteCashMovement(entry.id);
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
      title={
        isDeposit
          ? t({ en: "Delete this deposit?", ko: "이 입금을 삭제할까요?" })
          : t({ en: "Delete this withdrawal?", ko: "이 출금을 삭제할까요?" })
      }
      footer={
        <div className="flex gap-12">
          <Button tone="neutral" size="lg" className="flex-1 rounded-14 py-15 text-15" onClick={onClose}>
            {t({ en: "Cancel", ko: "취소" })}
          </Button>
          <Button
            size="lg"
            className="flex-[2] rounded-14 py-15 text-15"
            disabled={!check.ok || isPending}
            onClick={confirm}
          >
            {isPending ? t({ en: "Deleting…", ko: "삭제하는 중…" }) : t({ en: "Delete", ko: "삭제" })}
          </Button>
        </div>
      }
    >
      <div className="flex flex-col gap-14 pb-8">
        <Panel className="flex flex-col gap-6 px-20 py-16">
          <div className="flex items-baseline justify-between gap-12">
            <span className="text-13_5 font-semibold text-secondary">{formatTradeDate(entry.date, locale)}</span>
            <span className="text-15 font-extrabold text-ink">
              {formatSignedCurrency(entry.amount, data.account.currency)}
            </span>
          </div>
          <span className="text-13 font-medium text-muted">{describeLedgerEntry(entry, summary.modelNameById, t)}</span>
        </Panel>

        <p className="text-13_5 leading-[1.6] text-secondary">
          {t({
            en: "The balance and 1R are recalculated from this date on. Trades already logged keep the 1R they were logged with.",
            ko: "이 날짜 이후의 잔고와 1R이 다시 계산됩니다. 이미 기록한 트레이드의 1R은 그대로입니다.",
          })}
        </p>

        {!check.ok && (
          <p className="text-13_5 font-semibold leading-[1.6] text-ink">
            {t({
              en: "A later withdrawal depends on this deposit — deleting it would take the balance below zero. Delete that withdrawal first.",
              ko: "이후의 출금이 이 입금에 기대고 있어, 삭제하면 잔고가 0 아래로 내려갑니다. 그 출금을 먼저 삭제하세요.",
            })}
          </p>
        )}

        {error !== null && <p className="text-13 font-semibold text-loss">{error}</p>}
      </div>
    </Modal>
  );
}
