"use client";

import { Card, Chip, Dropzone, Panel } from "@/components/ui";
import { RangeDiagram } from "@/components/range-diagram";
import { AttachmentThumbnails } from "@/components/attachment-thumbnails";
import { cn } from "@/lib/cn";
import {
  formatHoldMinutes,
  formatLoggedAt,
  formatCurrency,
  formatPips,
  formatPrice,
  formatSignedCurrency,
} from "@/lib/format";
import { useFormatR } from "@/lib/settings/context";
import { MAX_ATTACHMENTS_PER_TRADE } from "@/lib/attachments";
import {
  HTF_PAIRING_LABELS,
  SESSION_LABELS,
  SWEEP_SIDE_LABELS,
} from "@/lib/labels";
import {
  captureRate,
  commissionAmount,
  commissionR,
  offPlan,
  plannedR,
  pnlAmount,
  pricePnlAmount,
  swapAmount,
  swapR,
  rangePosition,
  rangeSize,
  realizedR,
  risk,
} from "@/lib/domain/trade";
import type { Trade } from "@/lib/domain/types";
import { useIsMobile, useLocale, useT } from "@/lib/i18n/locale-context";
import { usePasteAttachment } from "@/lib/use-paste-attachment";
import { useTradeAttachments } from "./use-trade-attachments";

export interface TradeViewProps {
  trade: Trade;
  attachments: readonly { path: string }[];
  currency: string;
}

function InfoTile({ label, value }: { label: string; value: string }) {
  return (
    <Panel className="rounded-16 px-18 py-16">
      <div className="text-12 font-semibold text-muted">{label}</div>
      <div className="mt-4 text-17 font-extrabold text-ink">{value}</div>
    </Panel>
  );
}

export function TradeView({ trade, attachments, currency }: TradeViewProps) {
  const formatR = useFormatR();
  const t = useT();
  const locale = useLocale();

  const tradeAttachments = useTradeAttachments(trade.id, attachments);
  usePasteAttachment(
    (files) => void tradeAttachments.addFiles(files),
    tradeAttachments.attachments.length < MAX_ATTACHMENTS_PER_TRADE,
  );

  const realized = realizedR(trade);
  const pnl = pnlAmount(trade);
  // Only captioned when a swap was actually recorded: a null means nobody has
  // filled it in yet, and printing "swap $0.00" there would claim a fact the
  // row doesn't have. An explicit 0 does get shown — it says the position was
  // closed the same day and genuinely paid nothing.
  const swap = trade.swap === null ? null : swapAmount(trade);
  const swapInR = swapR(trade);
  // Always a number (0 on pre-commission trades), so only captioned when > 0.
  const commission = commissionAmount(trade);
  const commissionInR = commissionR(trade);
  const pricePnl = pricePnlAmount(trade);
  const hasCosts = swap !== null || commission > 0;
  const planned = plannedR(trade);
  const capture = captureRate(trade);
  const size = rangeSize(trade);
  const risked = risk(trade);
  const exitPosition = rangePosition(trade.exit, trade);
  const isOffPlan = offPlan(trade);
  const em = "—";

  // Trade detail has no mock at any width (docs/README.md only mocks it at
  // 1000px), so the mobile layout below is designed from the same card
  // vocabulary rather than ported from a screen — same approach as
  // Phase 3's EmptyState/BottomTabBar. `locale` is this app's own
  // mobile/desktop signal (Phase 3: it flips at exactly 900px), reused here
  // rather than introducing a second breakpoint mechanism.
  const isMobile = useIsMobile();

  return (
    <div className={cn("mx-auto flex max-w-[1000px] flex-col gap-16", isMobile ? "p-20" : "p-32")}>
      {/* Result card */}
      <Card
        className={cn(
          isMobile
            ? "flex flex-col gap-20 px-20 py-24"
            : "grid grid-cols-[220px_1fr] items-center gap-36 px-32 py-28",
        )}
      >
        <div>
          <div className="text-13 font-semibold text-muted">{t({ en: "Realized", ko: "실현" })}</div>
          <div
            className={cn(
              "mt-4 leading-[1.1] font-extrabold tracking-[-.04em]",
              isMobile ? "text-30" : "text-48",
              realized === null ? "text-ink" : realized >= 0 ? "text-gain" : "text-loss",
            )}
          >
            {realized === null ? em : formatR(realized)}
          </div>
          {pnl !== null && (
            <div className="mt-4 text-15 font-bold text-muted">
              {formatSignedCurrency(pnl, currency)}
              {hasCosts && ` ${t({ en: "net", ko: "순손익" })}`}
            </div>
          )}
          {pnl !== null && hasCosts && pricePnl !== null && (
            <div className="mt-4 text-12_5 font-medium text-faint">
              {t({ en: "Price", ko: "가격 손익" })} {formatSignedCurrency(pricePnl, currency)}
            </div>
          )}
          {/*
            The R headline above is price R and the amount beside it is net of
            swap, so when there is a swap the two no longer reconcile through
            1R alone — this line is what closes that gap on screen
            (docs/decisions.md § Swap).
          */}
          {swap !== null && (
            <div className="mt-4 text-12_5 font-medium text-faint">
              {t({ en: "Swap", ko: "스왑" })} {formatSignedCurrency(swap, currency)}
              {swapInR !== null && ` · ${formatR(swapInR)}`}
              {trade.exit === null &&
                ` · ${t({
                  en: "not in the balance until this trade is closed",
                  ko: "청산 전에는 잔고에 반영되지 않습니다",
                })}`}
            </div>
          )}
          {/* Same reconciling role as the swap line, for the commission term (docs/decisions.md § Commission). */}
          {commission > 0 && (
            <div className="mt-4 text-12_5 font-medium text-faint">
              {t({ en: "Commission", ko: "커미션" })} {formatSignedCurrency(-commission, currency, 2)}
              {` (${t({ en: "entry", ko: "진입" })} ${formatCurrency(trade.entryCommission, currency, 2)} · ${t({ en: "exit", ko: "청산" })} ${formatCurrency(trade.exitCommission, currency, 2)})`}
              {commissionInR !== null && ` · ${formatR(-commissionInR)}`}
              {trade.exit === null &&
                ` · ${t({
                  en: "not in the balance until this trade is closed",
                  ko: "청산 전에는 잔고에 반영되지 않습니다",
                })}`}
            </div>
          )}
          {planned !== null && (
            <div className="mt-6 text-12_5 font-medium text-faint">
              {t({ en: "Planned", ko: "계획" })} {planned.toFixed(1)}R
              {capture !== null &&
                ` · ${Math.round(capture * 100)}% ${t({ en: "captured", ko: "달성" })}`}
            </div>
          )}
        </div>
        <div className={cn("grid gap-12", isMobile ? "grid-cols-2" : "grid-cols-4")}>
          <InfoTile label={t({ en: "Entry", ko: "진입가" })} value={formatPrice(trade.entry, trade.instrument)} />
          <InfoTile label={t({ en: "Stop", ko: "손절가" })} value={formatPrice(trade.stop, trade.instrument)} />
          <InfoTile
            label={t({ en: "Exit", ko: "청산가" })}
            value={trade.exit === null ? em : formatPrice(trade.exit, trade.instrument)}
          />
          <InfoTile
            label={t({ en: "Hold", ko: "보유 시간" })}
            value={trade.holdMinutes === null ? em : formatHoldMinutes(trade.holdMinutes)}
          />
        </div>
      </Card>

      {/* CRT sequence card */}
      <Card className={cn(isMobile ? "px-20 py-24" : "px-32 py-28")}>
        <h2 className="text-16 font-bold tracking-[-.02em] text-ink">
          {t({ en: "CRT sequence", ko: "CRT 시퀀스" })}
        </h2>
        <div className="mt-16 flex flex-wrap gap-10">
          <Chip shape="pill">{t(HTF_PAIRING_LABELS[trade.htfPairing])}</Chip>
          <Chip shape="pill">{t(SWEEP_SIDE_LABELS[trade.sweepSide])}</Chip>
          {trade.confirmation !== null && trade.confirmation !== "" && (
            <Chip shape="pill">{trade.confirmation}</Chip>
          )}
          <Chip shape="pill">{t(SESSION_LABELS[trade.session])}</Chip>
          <Chip shape="pill" tone={isOffPlan ? "neutral" : "accent"}>
            {isOffPlan ? t({ en: "Off-plan", ko: "off-plan" }) : t({ en: "On plan", ko: "계획대로" })}
          </Chip>
        </div>

        <Panel
          className={cn(
            "mt-18 items-center rounded-20",
            isMobile ? "flex flex-col gap-20 px-20 pt-24 pb-20" : "grid grid-cols-[1fr_190px] gap-28 px-28 pt-30 pb-22",
          )}
        >
          <div className="w-full">
            <RangeDiagram
              variant="detail"
              rangeHigh={trade.rangeHigh}
              rangeLow={trade.rangeLow}
              sweepSide={trade.sweepSide}
              target={trade.target}
              exit={trade.exit}
              labels={{
                sweep: t({ en: "Sweep", ko: "스윕" }),
                target: t({ en: "Target", ko: "타겟" }),
                expansion:
                  exitPosition === null
                    ? undefined
                    : t({
                        en: `Expansion · exit at ${Math.round(exitPosition * 100)}%`,
                        ko: `확장 · ${Math.round(exitPosition * 100)}% 지점 청산`,
                      }),
              }}
              captions={{
                low: `${t({ en: "Low", ko: "저점" })} ${formatPrice(trade.rangeLow, trade.instrument)}`,
                mid: `50% ${formatPrice((trade.rangeHigh + trade.rangeLow) / 2, trade.instrument)}`,
                high: `${t({ en: "High", ko: "고점" })} ${formatPrice(trade.rangeHigh, trade.instrument)}`,
              }}
            />
          </div>
          <div
            className={cn(
              "flex w-full flex-col gap-14 border-panel",
              isMobile ? "border-t pt-16" : "border-l pl-24",
            )}
          >
            <div>
              <div className="text-12 font-semibold text-muted">
                {t({ en: "Range size", ko: "레인지 크기" })}
              </div>
              <div className="mt-2 text-20 font-extrabold text-ink">
                {size === null
                  ? em
                  : t({ en: `${formatPips(size, trade.instrument)} pips`, ko: `${formatPips(size, trade.instrument)}핍` })}
              </div>
            </div>
            <div>
              <div className="text-12 font-semibold text-muted">{t({ en: "Risk", ko: "리스크" })}</div>
              <div className="mt-2 text-20 font-extrabold text-ink">
                {risked === null
                  ? em
                  : t({
                      en: `${formatPips(risked, trade.instrument)} pips`,
                      ko: `${formatPips(risked, trade.instrument)}핍`,
                    })}
              </div>
            </div>
            <div>
              <div className="text-12 font-semibold text-muted">
                {t({ en: "Exit reason", ko: "청산 사유" })}
              </div>
              <div className="mt-2 text-14 font-bold text-ink">
                {trade.exitReason === null || trade.exitReason === "" ? em : trade.exitReason}
              </div>
            </div>
          </div>
        </Panel>
      </Card>

      <div className={cn("grid gap-16", isMobile ? "grid-cols-1" : "grid-cols-2")}>
        {/* Charts card */}
        <Card className="px-28 py-26">
          <div className="flex items-baseline justify-between">
            <h2 className="text-16 font-bold tracking-[-.02em] text-ink">
              {t({ en: "Charts", ko: "차트" })}
            </h2>
            <label className="cursor-pointer text-12_5 font-semibold text-accent hover:text-accent-pressed">
              {t({ en: "Add", ko: "추가" })}
              <input
                type="file"
                accept="image/*"
                multiple
                hidden
                disabled={tradeAttachments.attachments.length >= MAX_ATTACHMENTS_PER_TRADE}
                onChange={(event) => {
                  const files = Array.from(event.target.files ?? []);
                  if (files.length > 0) void tradeAttachments.addFiles(files);
                  event.target.value = "";
                }}
              />
            </label>
          </div>

          {tradeAttachments.error !== null && (
            <p className="mt-8 text-11_5 font-medium text-loss">{tradeAttachments.error}</p>
          )}

          {tradeAttachments.attachments.length === 0 && tradeAttachments.uploading === 0 ? (
            <Dropzone
              className="mt-16 h-[150px]"
              title={t({ en: "No screenshots yet", ko: "아직 스크린샷이 없습니다" })}
              hint={t({ en: "Drag, choose a file, or paste with ⌘V", ko: "드래그, 파일 선택, 또는 ⌘V로 붙여넣기" })}
              buttonLabel={t({ en: "Choose file", ko: "파일 선택" })}
              onFiles={(files) => void tradeAttachments.addFiles(files)}
            />
          ) : (
            <div className="mt-16 flex flex-col gap-12">
              <p className="text-11_5 font-medium text-faint">
                {t({ en: "Paste a screenshot with ⌘V to add another.", ko: "⌘V로 붙여넣으면 스크린샷이 추가됩니다." })}
              </p>
              <AttachmentThumbnails
                attachments={tradeAttachments.attachments}
                onRemove={(path) => void tradeAttachments.removeAttachment(path)}
              />
              {tradeAttachments.uploading > 0 && (
                <p className="text-11_5 font-medium text-faint">
                  {t({ en: "Uploading…", ko: "업로드 중…" })}
                </p>
              )}
            </div>
          )}
        </Card>

        {/* Notes card */}
        <Card className="px-28 py-26">
          <h2 className="text-16 font-bold tracking-[-.02em] text-ink">{t({ en: "Notes", ko: "노트" })}</h2>
          <p className="mt-14 text-14 leading-[1.7] text-body">
            {trade.notes === null || trade.notes === ""
              ? t({ en: "No notes.", ko: "작성된 노트가 없습니다." })
              : trade.notes}
          </p>
          <div className="my-20 h-1 bg-divider" />
          <div className="text-13 font-semibold text-muted">{t({ en: "Tags", ko: "태그" })}</div>
          <div className="mt-10 flex flex-wrap gap-8">
            {trade.tags.length === 0 ? (
              <span className="text-12_5 font-medium text-faint">
                {t({ en: "No tags.", ko: "태그 없음." })}
              </span>
            ) : (
              trade.tags.map((tag) => (
                <Chip key={tag} shape="pill">
                  {tag}
                </Chip>
              ))
            )}
          </div>
          <div className="my-20 h-1 bg-divider" />
          <div className="flex justify-between text-12_5 font-medium text-faint">
            <span>
              {t({ en: "Logged", ko: "기록" })} {formatLoggedAt(new Date(trade.createdAt), locale)}
            </span>
            {trade.updatedAt !== trade.createdAt && (
              <span>
                {t({ en: "Edited", ko: "수정" })} {formatLoggedAt(new Date(trade.updatedAt), locale)}
              </span>
            )}
          </div>
        </Card>
      </div>
    </div>
  );
}
