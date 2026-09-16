"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { ChevronLeft } from "lucide-react";
import { Button, Chip, Modal } from "@/components/ui";
import { formatTradeDate } from "@/lib/format";
import { DIRECTION_LABELS } from "@/lib/labels";
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
  currency: string;
  tagPresets: string[];
}

export function TradeDetail({
  trade,
  models,
  attachments,
  accountIsNearDrawdownLimit,
  drawdownPercent,
  drawdownLimitPercent,
  currency,
  tagPresets,
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
      <header className="flex items-center justify-between gap-12 bg-surface px-20 py-16 sm:px-32 sm:py-20">
        <div className="flex min-w-0 items-center gap-14">
          <button
            type="button"
            onClick={() => router.push("/")}
            aria-label={t({ en: "Back", ko: "뒤로" })}
            className="flex h-32 w-32 shrink-0 items-center justify-center rounded-10 text-muted transition-colors duration-150 ease-out hover:bg-divider hover:text-ink focus-visible:ring-2 focus-visible:ring-accent focus-visible:ring-offset-2 focus-visible:outline-none"
          >
            <ChevronLeft aria-hidden size={20} />
          </button>
          {/* Trade detail has no mock at any width, so `sm:` here is a plain
              CSS breakpoint (Tailwind's default 640px), not this app's
              locale-driven 900px one — the goal is purely "don't wrap",
              and a shorter date is enough to achieve that well before 900px
              (docs/decisions.md § Phase 4 mobile responsive fix). `truncate`
              is the backstop for a long free-typed instrument name. */}
          <h1 className="min-w-0 truncate text-15 font-bold tracking-[-.02em] text-ink sm:text-17">
            {trade.instrument} ·{" "}
            {t(DIRECTION_LABELS[trade.direction])} ·{" "}
            <span className="hidden sm:inline">{formatTradeDate(trade.date, locale)}</span>
            <span className="sm:hidden">{formatTradeDate(trade.date, locale, true)}</span>
          </h1>
          {model !== null && <Chip className="hidden shrink-0 sm:inline-flex">{model.name}</Chip>}
        </div>

        {mode === "view" && (
          <div className="flex shrink-0 gap-8">
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
        <TradeView trade={trade} attachments={attachmentPaths} currency={currency} />
      ) : (
        <TradeEditForm
          trade={trade}
          models={models}
          attachments={attachmentPaths}
          currency={currency}
          accountIsNearDrawdownLimit={accountIsNearDrawdownLimit}
          drawdownPercent={drawdownPercent}
          drawdownLimitPercent={drawdownLimitPercent}
          tagPresets={tagPresets}
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
