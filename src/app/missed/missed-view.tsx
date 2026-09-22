"use client";

import { ChevronLeft, ChevronRight } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { BottomTabBar } from "@/components/nav/bottom-tab-bar";
import { toNavItems, toTabItems } from "@/components/nav/routes";
import { SignOutButton } from "@/components/nav/sign-out-button";
import { TopBar } from "@/components/nav/top-bar";
import { BarRow, Button, Card, CardTitle, Chip, EmptyState, Modal } from "@/components/ui";
import { cn } from "@/lib/cn";
import { formatMonthLabel, isoMonthOf, shiftMonth, type IsoMonth } from "@/lib/domain/dates";
import { missedNetR, type MissedSummary, type MissedTrade } from "@/lib/domain/missed-trade";
import type { AccountKind, IsoDate } from "@/lib/domain/types";
import { formatWeekLabel, isoWeekOf, shiftIsoWeek, type IsoWeek } from "@/lib/domain/weekly-review";
import { formatPrice, formatTradeDate } from "@/lib/format";
import { useLocale, useT } from "@/lib/i18n/locale-context";
import { DIRECTION_LABELS, MISS_REASON_LABELS, RESULT_LABELS, SESSION_LABELS } from "@/lib/labels";
import { useFormatR } from "@/lib/settings/context";
import { signOut } from "../actions";
import { deleteMissedTrade } from "./actions";
import { MissedForm } from "./missed-form";

export interface MissedPeriod {
  kind: "week" | "month";
  /** `YYYY-Www` or `YYYY-MM`. */
  key: string;
  from: IsoDate;
  to: IsoDate;
}

export interface MissedViewProps {
  period: MissedPeriod;
  currentMonth: IsoMonth;
  currentWeek: IsoWeek;
  accountName: string | null;
  accountKind: AccountKind | null;
  /** Real trades' R with their own commission taken off — see `netRAfterCommission`. */
  realNetR: number;
  realTradeCount: number;
  missed: MissedTrade[];
  summary: MissedSummary;
  defaultInstrument: string;
  commissionPerLotPerSide: number;
}

function periodHref(kind: "week" | "month", key: string) {
  return kind === "week" ? `/missed?week=${key}` : `/missed?month=${key}`;
}

const rTone = (r: number) => (r > 0 ? "text-gain" : r < 0 ? "text-loss" : "text-ink");

/**
 * Same language rule as every screen: English on desktop, Korean on phones
 * (lib/i18n/locale.ts). The top bar and bottom tab bar are the shared chrome.
 */
export function MissedView(props: MissedViewProps) {
  const t = useT();
  const isMobile = useLocale() === "ko";
  const router = useRouter();

  return (
    <div className="flex min-h-full flex-col bg-page">
      {!isMobile && (
        <TopBar
          items={toNavItems(t)}
          activeHref="/missed"
          right={
            <>
              <Button onClick={() => router.push("/trades/new")}>{t({ en: "New trade", ko: "New trade" })}</Button>
              <SignOutButton signOutAction={signOut} />
            </>
          }
        />
      )}
      <MissedScreen {...props} isMobile={isMobile} />
      {isMobile && <BottomTabBar items={toTabItems(t)} activeHref="/missed" />}
    </div>
  );
}

function MissedScreen(props: MissedViewProps & { isMobile: boolean }) {
  const { period, currentMonth, currentWeek, missed, isMobile } = props;
  const t = useT();
  const locale = useLocale();
  const [editing, setEditing] = useState<MissedTrade | null>(null);
  const [deleting, setDeleting] = useState<MissedTrade | null>(null);

  const step = (delta: number) =>
    period.kind === "week"
      ? periodHref("week", shiftIsoWeek(period.key, delta))
      : periodHref("month", shiftMonth(period.key, delta));

  // Switching granularity keeps you around the same dates.
  const weekHref = periodHref(
    "week",
    period.kind === "week" ? period.key : period.key === currentMonth ? currentWeek : isoWeekOf(period.from),
  );
  const monthHref = periodHref("month", period.kind === "month" ? period.key : isoMonthOf(period.from));

  const label =
    period.kind === "week" ? formatWeekLabel(period.key, locale) : formatMonthLabel(period.key, locale);

  const periodBar = (
    <div className={cn("flex items-center justify-between gap-16", isMobile ? "px-20 py-12" : "bg-surface px-32 pb-20")}>
      <div className="flex items-center gap-16">
        <Link
          href={step(-1)}
          aria-label={t({ en: "Previous", ko: "이전" })}
          className="rounded-6 text-faint hover:text-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent focus-visible:ring-offset-2"
        >
          <ChevronLeft aria-hidden size={18} />
        </Link>
        <span className={cn("font-bold tracking-[-.02em] text-ink", isMobile ? "text-15" : "text-18")}>{label}</span>
        <Link
          href={step(1)}
          aria-label={t({ en: "Next", ko: "다음" })}
          className="rounded-6 text-faint hover:text-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent focus-visible:ring-offset-2"
        >
          <ChevronRight aria-hidden size={18} />
        </Link>
      </div>
      <div className="flex shrink-0 gap-4 rounded-12 bg-divider p-4">
        {(
          [
            ["week", weekHref, { en: "Week", ko: "주간" }],
            ["month", monthHref, { en: "Month", ko: "월간" }],
          ] as const
        ).map(([kind, href, text]) => (
          <Link
            key={kind}
            href={href}
            aria-current={period.kind === kind ? "page" : undefined}
            className={cn(
              "whitespace-nowrap rounded-10 px-14 py-7 text-13 font-semibold focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent",
              period.kind === kind ? "bg-surface text-ink" : "text-muted hover:text-secondary",
            )}
          >
            {t(text)}
          </Link>
        ))}
      </div>
    </div>
  );

  const form = (
    <Card className={cn(isMobile ? "p-20" : "p-28")}>
      <CardTitle className="mb-20">
        {editing === null
          ? t({ en: "Log a missed trade", ko: "놓친 거래 기록" })
          : t({ en: "Edit missed trade", ko: "놓친 거래 수정" })}
      </CardTitle>
      <MissedForm
        editing={editing}
        onDoneEditing={() => setEditing(null)}
        defaultInstrument={props.defaultInstrument}
        commissionPerLotPerSide={props.commissionPerLotPerSide}
      />
    </Card>
  );

  return (
    <>
      {isMobile && (
        <div className="px-20 pt-16">
          <span className="text-20 font-extrabold tracking-[-.03em] text-ink">{t({ en: "Missed trades", ko: "놓친 거래" })}</span>
        </div>
      )}
      {periodBar}

      <div
        className={cn(
          "flex-1",
          isMobile ? "flex flex-col gap-16 px-16 pb-100" : "grid grid-cols-[minmax(400px,460px)_1fr] items-start gap-24 p-32",
        )}
      >
        <div className={cn(!isMobile && "sticky top-24")}>{form}</div>

        <div className="flex min-w-0 flex-col gap-24">
          <Summary {...props} />
          <MissedList
            missed={missed}
            editingId={editing?.id ?? null}
            onEdit={setEditing}
            onDelete={setDeleting}
            isMobile={isMobile}
          />
        </div>
      </div>

      {deleting !== null && (
        <DeleteModal
          row={deleting}
          variant={isMobile ? "sheet" : "modal"}
          onClose={() => setDeleting(null)}
          onDeleted={() => {
            if (editing?.id === deleting.id) setEditing(null);
          }}
        />
      )}
    </>
  );
}

function Summary({ realNetR, realTradeCount, summary, accountName, accountKind }: MissedViewProps) {
  const t = useT();
  const formatR = useFormatR();
  const maxAbs = Math.max(Math.abs(realNetR), Math.abs(summary.netR), 1e-9);
  const maxReason = Math.max(1, ...summary.byReason.map((r) => r.count));
  const account =
    accountName === null
      ? t({ en: "no account", ko: "계좌 없음" })
      : `${accountName}${accountKind === "backtest" ? t({ en: " · backtest", ko: " · 백테스트" }) : ""}`;

  const compareRow = (name: string, value: number, sub: string, faded: boolean) => (
    <div>
      <div className="flex items-baseline justify-between gap-12">
        <span className="text-14 font-semibold text-body">{name}</span>
        <span className={cn("text-30 font-extrabold tracking-[-.03em]", rTone(value))}>{formatR(value, 2)}</span>
      </div>
      <div className="mt-8 h-10 overflow-hidden rounded-pill bg-divider">
        <div
          className={cn("h-full rounded-pill", value >= 0 ? "bg-gain" : "bg-loss", faded && "opacity-45")}
          style={{ width: `${(Math.abs(value) / maxAbs) * 100}%` }}
        />
      </div>
      <div className="mt-6 text-11_5 font-medium text-faint">{sub}</div>
    </div>
  );

  return (
    <div className="grid grid-cols-1 gap-24 xl:grid-cols-[1.4fr_1fr]">
      <Card className="flex flex-col gap-20 p-28">
        <CardTitle>{t({ en: "Cumulative R · after commission", ko: "누적 R · 커미션 차감" })}</CardTitle>
        {compareRow(
          t({ en: "Taken (real)", ko: "실제 거래" }),
          realNetR,
          `${t({ en: `${realTradeCount} closed`, ko: `${realTradeCount}건 청산` })} · ${account}`,
          false,
        )}
        {compareRow(
          t({ en: "Missed (hypothetical)", ko: "놓친 거래 (가상)" }),
          summary.netR,
          summary.unknownRCount > 0
            ? t({
                en: `${summary.count} missed · ${summary.unknownRCount} without prices, not in the total`,
                ko: `${summary.count}건 · 가격 미입력 ${summary.unknownRCount}건은 합계 제외`,
              })
            : t({ en: `${summary.count} missed`, ko: `${summary.count}건` }),
          true,
        )}
        <p className="border-t border-divider pt-14 text-12_5 font-medium text-muted">
          {t({ en: "Kept apart: missed trades never enter your balance or trade stats.", ko: "놓친 거래는 잔고와 실제 거래 통계에 들어가지 않아요." })}
        </p>
      </Card>

      <div className="flex flex-col gap-24">
        <Card className="p-28">
          <CardTitle>{t({ en: "Missed trades", ko: "놓친 거래" })}</CardTitle>
          <div className="mt-14 flex items-baseline gap-10">
            <span className="text-30 font-extrabold tracking-[-.03em] text-ink">{summary.count}</span>
            <span className="text-13 font-semibold text-muted">{t({ en: "in this period", ko: "건 (이 기간)" })}</span>
          </div>
          <div className="mt-14 flex flex-wrap gap-8">
            <Chip tone="gain" shape="stat">{`${t(RESULT_LABELS.win)} ${summary.winCount}`}</Chip>
            <Chip tone="loss" shape="stat">{`${t(RESULT_LABELS.loss)} ${summary.lossCount}`}</Chip>
            <Chip tone="neutral" shape="stat">{`${t(RESULT_LABELS.be)} ${summary.beCount}`}</Chip>
          </div>
        </Card>

        <Card className="p-28">
          <CardTitle>{t({ en: "What stopped you", ko: "못 들어간 이유" })}</CardTitle>
          <div className="mt-16 flex flex-col gap-14">
            {summary.byReason.map((r, i) => (
              <BarRow
                key={r.reason}
                label={t(MISS_REASON_LABELS[r.reason])}
                value={r.count}
                share={r.count / maxReason}
                tone={i === 0 && r.count > 0 ? "ink" : "weak"}
                height={7}
              />
            ))}
          </div>
        </Card>
      </div>
    </div>
  );
}

function MissedList({
  missed,
  editingId,
  onEdit,
  onDelete,
  isMobile,
}: {
  missed: MissedTrade[];
  editingId: string | null;
  onEdit: (m: MissedTrade) => void;
  onDelete: (m: MissedTrade) => void;
  isMobile: boolean;
}) {
  const t = useT();
  const locale = useLocale();
  const formatR = useFormatR();

  if (missed.length === 0) {
    return (
      <EmptyState
        title={t({ en: "No missed trades in this period", ko: "이 기간에 놓친 거래가 없어요" })}
        description={t({
          en: "Log one on the left the next time fear keeps you out of a valid setup.",
          ko: "유효한 자리를 놓쳤다면 기록해 보세요.",
        })}
      />
    );
  }

  return (
    <Card className={cn(isMobile ? "p-16" : "p-28")}>
      <CardTitle className="mb-12">{t({ en: "Log", ko: "기록" })}</CardTitle>
      <ul className="flex flex-col">
        {missed.map((m) => {
          const r = missedNetR(m);
          const prices =
            m.entry !== null && m.stop !== null
              ? `${formatPrice(m.entry, m.instrument)} / ${formatPrice(m.stop, m.instrument)}${m.target !== null ? ` / ${formatPrice(m.target, m.instrument)}` : ""}`
              : null;
          return (
            <li
              key={m.id}
              className={cn(
                "grid items-center gap-x-16 gap-y-4 border-b border-divider py-14 last:border-b-0",
                isMobile ? "grid-cols-[1fr_auto]" : "grid-cols-[112px_1fr_130px_80px_auto]",
                editingId === m.id && "bg-accent-tint/40",
              )}
            >
              <div className="text-13 font-semibold text-secondary">
                {formatTradeDate(m.date, locale, true)}
                {m.time !== null && <span className="ml-6 text-faint">{m.time}</span>}
              </div>
              <div className="min-w-0">
                <div className="flex items-center gap-8 text-14 font-bold text-ink">
                  {m.instrument}
                  <span className="text-12_5 font-semibold text-muted">
                    {t(DIRECTION_LABELS[m.direction])}
                    {m.session !== null && ` · ${t(SESSION_LABELS[m.session])}`}
                  </span>
                </div>
                {(m.setupNote !== null || prices !== null) && (
                  <div className="mt-2 truncate text-12 font-medium text-faint" title={m.setupNote ?? undefined}>
                    {[prices, m.setupNote].filter(Boolean).join(" · ")}
                  </div>
                )}
              </div>
              <div className="text-13 font-semibold text-body" title={m.missReasonNote ?? undefined}>
                {t(MISS_REASON_LABELS[m.missReason])}
                {m.missReasonNote !== null && <div className="truncate text-12 font-medium text-faint">{m.missReasonNote}</div>}
              </div>
              <div className="text-right">
                <div className={cn("text-15 font-bold", r === null ? "text-faint" : rTone(r))}>
                  {r === null ? "—" : formatR(r, 2)}
                </div>
                <div className="text-11_5 font-medium text-faint">{t(RESULT_LABELS[m.result])}</div>
              </div>
              <div className="flex justify-end gap-4">
                <button
                  type="button"
                  onClick={() => onEdit(m)}
                  className="rounded-8 px-10 py-6 text-12_5 font-semibold text-accent hover:bg-accent-tint focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent"
                >
                  {t({ en: "Edit", ko: "수정" })}
                </button>
                <button
                  type="button"
                  onClick={() => onDelete(m)}
                  className="rounded-8 px-10 py-6 text-12_5 font-semibold text-muted hover:bg-divider focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent"
                >
                  {t({ en: "Delete", ko: "삭제" })}
                </button>
              </div>
            </li>
          );
        })}
      </ul>
    </Card>
  );
}

function DeleteModal({
  row,
  variant,
  onClose,
  onDeleted,
}: {
  row: MissedTrade;
  variant: "modal" | "sheet";
  onClose: () => void;
  onDeleted: () => void;
}) {
  const t = useT();
  const locale = useLocale();
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  function confirm() {
    setError(null);
    startTransition(async () => {
      const result = await deleteMissedTrade(row.id);
      if (!result.ok) {
        setError(result.error);
        return;
      }
      onDeleted();
      onClose();
      router.refresh();
    });
  }

  return (
    <Modal
      open
      onClose={onClose}
      variant={variant}
      closeLabel={t({ en: "Close", ko: "닫기" })}
      title={t({ en: "Delete this missed trade?", ko: "이 놓친 거래를 삭제할까요?" })}
      footer={
        <div className="flex gap-12">
          <Button tone="neutral" size="lg" className="flex-1 rounded-14 py-15 text-15" onClick={onClose}>
            {t({ en: "Cancel", ko: "취소" })}
          </Button>
          <Button size="lg" className="flex-[2] rounded-14 py-15 text-15" disabled={isPending} onClick={confirm}>
            {isPending ? t({ en: "Deleting…", ko: "삭제하는 중…" }) : t({ en: "Delete", ko: "삭제" })}
          </Button>
        </div>
      }
    >
      <p className="text-14 font-medium text-secondary">
        {`${formatTradeDate(row.date, locale, true)} · ${row.instrument} · ${t(DIRECTION_LABELS[row.direction])} · ${t(MISS_REASON_LABELS[row.missReason])}`}
      </p>
      <p className="mt-8 text-12_5 font-medium text-faint">
        {t({ en: "Only this missed-trade entry is removed. Real trades are not affected.", ko: "이 놓친 거래 기록만 지워져요. 실제 거래에는 영향이 없어요." })}
      </p>
      {error !== null && <p className="mt-12 text-13 font-medium text-loss">{error}</p>}
    </Modal>
  );
}
