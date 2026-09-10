"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { ChevronLeft } from "lucide-react";
import { Button, Chip, Modal } from "@/components/ui";
import { formatTradeDate } from "@/lib/format";
import type { Attachment, Trade, TradeModel } from "@/lib/domain/types";
import { useLocale, useT } from "@/lib/i18n/locale-context";
import { deleteTrade } from "./actions";
import { TradeEditForm } from "./trade-edit-form";
import { TradeView } from "./trade-view";

export interface TradeDetailProps {
  trade: Trade;
  models: TradeModel[];
  attachments: Attachment[];
  accountIsNearDrawdownLimit: boolean;
  drawdownPercent: number;
  drawdownLimitPercent: number;
}

const DIRECTION_LABELS = {
  long: { en: "Long", ko: "롱" },
  short: { en: "Short", ko: "숏" },
} as const;

export function TradeDetail({
  trade,
  models,
  attachments,
  accountIsNearDrawdownLimit,
  drawdownPercent,
  drawdownLimitPercent,
}: TradeDetailProps) {
  const t = useT();
  const locale = useLocale();
  const router = useRouter();
  const [mode, setMode] = useState<"view" | "edit">("view");
  const [deleteOpen, setDeleteOpen] = useState(false);
  const [deleteError, setDeleteError] = useState<string | null>(null);
  const [isDeleting, startDelete] = useTransition();

  const model = models.find((m) => m.id === trade.modelId) ?? null;
  const attachmentPaths = attachments.map((a) => ({ path: a.storagePath }));

  function onConfirmDelete() {
    setDeleteError(null);
    startDelete(async () => {
      const result = await deleteTrade(trade.id);
      if (result.ok) {
        router.push("/");
      } else {
        setDeleteError(result.error);
      }
    });
  }

  return (
    <div>
      <header className="flex items-center justify-between bg-surface px-32 py-20">
        <div className="flex items-center gap-14">
          <button
            type="button"
            onClick={() => router.push("/")}
            aria-label={t({ en: "Back", ko: "뒤로" })}
            className="flex h-32 w-32 items-center justify-center rounded-10 text-muted transition-colors duration-150 ease-out hover:bg-divider hover:text-ink focus-visible:ring-2 focus-visible:ring-accent focus-visible:ring-offset-2 focus-visible:outline-none"
          >
            <ChevronLeft aria-hidden size={20} />
          </button>
          <h1 className="text-17 font-bold tracking-[-.02em] text-ink">
            {trade.instrument} · {t(DIRECTION_LABELS[trade.direction])} · {formatTradeDate(trade.date, locale)}
          </h1>
          {model !== null && <Chip>{model.name}</Chip>}
        </div>

        {mode === "view" && (
          <div className="flex gap-8">
            <Button tone="neutral" size="sm" onClick={() => setMode("edit")}>
              {t({ en: "Edit", ko: "수정" })}
            </Button>
            <Button tone="neutral" size="sm" onClick={() => setDeleteOpen(true)}>
              {t({ en: "Delete", ko: "삭제" })}
            </Button>
          </div>
        )}
      </header>

      {mode === "view" ? (
        <TradeView trade={trade} attachments={attachmentPaths} />
      ) : (
        <TradeEditForm
          trade={trade}
          models={models}
          attachments={attachmentPaths}
          accountIsNearDrawdownLimit={accountIsNearDrawdownLimit}
          drawdownPercent={drawdownPercent}
          drawdownLimitPercent={drawdownLimitPercent}
          onCancel={() => setMode("view")}
          onSaved={() => {
            router.refresh();
            setMode("view");
          }}
        />
      )}

      <Modal
        open={deleteOpen}
        onClose={() => setDeleteOpen(false)}
        title={t({ en: "Delete this trade?", ko: "이 트레이드를 삭제할까요?" })}
        closeLabel={t({ en: "Close", ko: "닫기" })}
        footer={
          <div className="flex gap-12">
            <Button
              tone="neutral"
              size="lg"
              className="flex-1"
              onClick={() => setDeleteOpen(false)}
              disabled={isDeleting}
            >
              {t({ en: "Cancel", ko: "취소" })}
            </Button>
            <Button
              tone="primary"
              size="lg"
              className="flex-1"
              onClick={onConfirmDelete}
              disabled={isDeleting}
            >
              {isDeleting ? t({ en: "Deleting…", ko: "삭제하는 중…" }) : t({ en: "Delete", ko: "삭제" })}
            </Button>
          </div>
        }
      >
        <p className="pb-24 text-14 leading-[1.6] text-secondary">
          {t({
            en: "This permanently deletes the trade and its attached chart screenshots. This can't be undone.",
            ko: "이 트레이드와 첨부된 차트 스크린샷이 영구적으로 삭제됩니다. 되돌릴 수 없습니다.",
          })}
        </p>
        {deleteError !== null && <p className="pb-16 text-13 font-semibold text-loss">{deleteError}</p>}
      </Modal>
    </div>
  );
}
