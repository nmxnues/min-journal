"use client";

import { Card, Chip, Dropzone, Panel } from "@/components/ui";
import { RangeDiagram } from "@/components/range-diagram";
import { AttachmentThumbnails } from "@/components/attachment-thumbnails";
import { cn } from "@/lib/cn";
import {
  formatHoldMinutes,
  formatLoggedAt,
  formatPips,
  formatPrice,
  formatR,
} from "@/lib/format";
import { MAX_ATTACHMENTS_PER_TRADE } from "@/lib/attachments";
import {
  HTF_PAIRING_LABELS,
  SESSION_LABELS,
  SWEEP_SIDE_LABELS,
} from "@/lib/labels";
import {
  captureRate,
  offPlan,
  plannedR,
  rangePosition,
  rangeSize,
  realizedR,
  risk,
} from "@/lib/domain/trade";
import type { Trade } from "@/lib/domain/types";
import { useLocale, useT } from "@/lib/i18n/locale-context";
import { usePasteAttachment } from "@/lib/use-paste-attachment";
import { useTradeAttachments } from "./use-trade-attachments";

export interface TradeViewProps {
  trade: Trade;
  attachments: readonly { path: string }[];
}

function InfoTile({ label, value }: { label: string; value: string }) {
  return (
    <Panel className="rounded-16 px-18 py-16">
      <div className="text-12 font-semibold text-muted">{label}</div>
      <div className="mt-4 text-17 font-extrabold text-ink">{value}</div>
    </Panel>
  );
}

export function TradeView({ trade, attachments }: TradeViewProps) {
  const t = useT();
  const locale = useLocale();

  const tradeAttachments = useTradeAttachments(trade.id, attachments);
  usePasteAttachment(
    (files) => void tradeAttachments.addFiles(files),
    tradeAttachments.attachments.length < MAX_ATTACHMENTS_PER_TRADE,
  );

  const realized = realizedR(trade);
  const planned = plannedR(trade);
  const capture = captureRate(trade);
  const size = rangeSize(trade);
  const risked = risk(trade);
  const exitPosition = rangePosition(trade.exit, trade);
  const isOffPlan = offPlan(trade);
  const em = "—";

  return (
    <div className="mx-auto flex max-w-[1000px] flex-col gap-16 p-32">
      {/* Result card */}
      <Card className="grid grid-cols-[220px_1fr] items-center gap-36 px-32 py-28">
        <div>
          <div className="text-13 font-semibold text-muted">{t({ en: "Realized", ko: "실현" })}</div>
          <div
            className={cn(
              "mt-4 text-48 leading-[1.1] font-extrabold tracking-[-.04em]",
              realized === null ? "text-ink" : realized >= 0 ? "text-gain" : "text-loss",
            )}
          >
            {realized === null ? em : formatR(realized)}
          </div>
          {planned !== null && (
            <div className="mt-6 text-12_5 font-medium text-faint">
              {t({ en: "Planned", ko: "계획" })} {planned.toFixed(1)}R
              {capture !== null &&
                ` · ${Math.round(capture * 100)}% ${t({ en: "captured", ko: "달성" })}`}
            </div>
          )}
        </div>
        <div className="grid grid-cols-4 gap-12">
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
      <Card className="px-32 py-28">
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

        <Panel className="mt-18 grid grid-cols-[1fr_190px] items-center gap-28 rounded-20 px-28 pt-30 pb-22">
          <div>
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
          <div className="flex flex-col gap-14 border-l border-panel pl-24">
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

      <div className="grid grid-cols-2 gap-16">
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
