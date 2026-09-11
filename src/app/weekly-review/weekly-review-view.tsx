"use client";

import { Check, ChevronLeft, ChevronRight, Plus, X } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { BottomTabBar } from "@/components/nav/bottom-tab-bar";
import { toNavItems, toTabItems } from "@/components/nav/routes";
import { SignOutButton } from "@/components/nav/sign-out-button";
import { TopBar } from "@/components/nav/top-bar";
import { Button, Card, EmptyState, StatCard, Textarea } from "@/components/ui";
import { cn } from "@/lib/cn";
import { realizedR } from "@/lib/domain/trade";
import type { FocusItem, Trade, TradeModel, WeeklyReview } from "@/lib/domain/types";
import {
  bestWorstTrade,
  dayByDayBars,
  formatWeekLabel,
  isoWeekRange,
  shiftIsoWeek,
  tagFrequency,
  type IsoWeek,
} from "@/lib/domain/weekly-review";
import { formatPercent } from "@/lib/format";
import { useFormatR } from "@/lib/settings/context";
import { useLocale, useT } from "@/lib/i18n/locale-context";
import { DIRECTION_LABELS, SESSION_LABELS } from "@/lib/labels";
import { signOut } from "../actions";
import { saveFocusItems, saveReviewText } from "./actions";

const WEEKDAY_LABELS = {
  en: ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"],
  ko: ["월", "화", "수", "목", "금", "토", "일"],
};

export interface WeeklyReviewSummary {
  netR: number;
  tradeCount: number;
  winRate: number | null;
  decidedCount: number;
  winCount: number;
  ruleAdherence: number | null;
  offPlanCount: number;
  avgOfPriorWeeks: number;
}

export interface WeeklyReviewViewProps {
  week: IsoWeek;
  hasAccount: boolean;
  review?: WeeklyReview;
  previous?: WeeklyReview | null;
  trades?: Trade[];
  models?: TradeModel[];
  summary?: WeeklyReviewSummary;
}

const em = "—";

export function WeeklyReviewView({ week, hasAccount, review, previous, trades = [], models = [], summary }: WeeklyReviewViewProps) {
  const formatR = useFormatR();
  const t = useT();
  const locale = useLocale();
  const isMobile = locale === "ko";
  const router = useRouter();
  const [isPending, startTransition] = useTransition();

  const [whatWorked, setWhatWorked] = useState(review?.whatWorked ?? "");
  const [whatDidnt, setWhatDidnt] = useState(review?.whatDidnt ?? "");
  const [oneChange, setOneChange] = useState(review?.oneChange ?? "");
  const [focusItems, setFocusItems] = useState<FocusItem[]>(review?.focusItems ?? []);
  const [newFocusText, setNewFocusText] = useState("");
  const [saveError, setSaveError] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);

  const modelById = new Map(models.map((m) => [m.id, m]));

  const topBar = (
    <TopBar
      items={toNavItems(t)}
      activeHref=""
      right={
        <>
          <Button onClick={() => router.push("/trades/new")}>{t({ en: "New trade", ko: "New trade" })}</Button>
          <SignOutButton signOutAction={signOut} />
        </>
      }
    />
  );

  const mobileHeader = (
    <div className="flex items-center justify-between px-20 pt-16 pb-8">
      <span className="text-20 font-extrabold tracking-[-.03em] text-ink">{t({ en: "Weekly review", ko: "주간 리뷰" })}</span>
      <Button size="sm" onClick={() => router.push("/trades/new")}>
        {t({ en: "New", ko: "기록하기" })}
      </Button>
    </div>
  );

  if (!hasAccount) {
    return (
      <div className="flex min-h-full flex-col bg-page">
        {isMobile ? mobileHeader : topBar}
        <div className="flex flex-1 items-center justify-center p-32">
          <EmptyState
            title={t({ en: "Nothing to review yet", ko: "아직 리뷰할 내용이 없습니다" })}
            description={t({
              en: "Log a trade first, then come back at the end of the week.",
              ko: "먼저 트레이드를 기록한 뒤 주말에 다시 들러보세요.",
            })}
            action={<Button onClick={() => router.push("/trades/new")}>{t({ en: "New trade", ko: "New trade" })}</Button>}
            className="w-full max-w-[440px]"
          />
        </div>
        {isMobile && <BottomTabBar items={toTabItems(t)} activeHref="" />}
      </div>
    );
  }

  const { from: weekFrom } = isoWeekRange(week);
  const prevHref = `/weekly-review?week=${shiftIsoWeek(week, -1)}`;
  const nextHref = `/weekly-review?week=${shiftIsoWeek(week, 1)}`;

  const bars = dayByDayBars(trades, weekFrom);
  const maxAbsBar = Math.max(1e-9, ...bars.map((b) => Math.abs(b.netR)));
  const { best, worst } = bestWorstTrade(trades);
  const tags = tagFrequency(trades);
  const maxTagCount = Math.max(0, ...tags.map((tg) => tg.count));

  const canCopy = Boolean(previous?.whatWorked || previous?.whatDidnt || previous?.oneChange);

  function copyLastWeek() {
    if (previous === null || previous === undefined) return;
    setWhatWorked(previous.whatWorked ?? "");
    setWhatDidnt(previous.whatDidnt ?? "");
    setOneChange(previous.oneChange ?? "");
  }

  function onSaveReview() {
    setSaveError(null);
    setSaved(false);
    startTransition(async () => {
      const result = await saveReviewText(week, { whatWorked, whatDidnt, oneChange });
      if (result.ok) setSaved(true);
      else setSaveError(result.error);
    });
  }

  function toggleFocus(index: number) {
    const next = focusItems.map((item, i) => (i === index ? { ...item, checked: !item.checked } : item));
    setFocusItems(next);
    void saveFocusItems(week, next);
  }

  function removeFocus(index: number) {
    const next = focusItems.filter((_, i) => i !== index);
    setFocusItems(next);
    void saveFocusItems(week, next);
  }

  function addFocus() {
    const text = newFocusText.trim();
    if (text === "") return;
    const next = [...focusItems, { text, checked: false }];
    setFocusItems(next);
    setNewFocusText("");
    void saveFocusItems(week, next);
  }

  function trade(t2: Trade | null) {
    if (t2 === null) return null;
    const model = t2.modelId === null ? null : (modelById.get(t2.modelId) ?? null);
    return { trade: t2, model };
  }
  const bestInfo = trade(best);
  const worstInfo = trade(worst);

  return (
    <div className="flex min-h-full flex-col bg-page">
      {!isMobile && topBar}
      {isMobile && mobileHeader}

      <div className={cn("flex items-center justify-between", isMobile ? "px-20 pb-8" : "bg-surface px-32 py-20")}>
        <div className="flex items-center gap-16">
          <Link href={prevHref} aria-label={t({ en: "Previous week", ko: "지난 주" })} className="rounded-6 text-faint hover:text-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent focus-visible:ring-offset-2">
            <ChevronLeft aria-hidden size={18} />
          </Link>
          <span className={cn("font-bold tracking-[-.02em] text-ink", isMobile ? "text-16" : "text-18")}>
            {formatWeekLabel(week, locale)}
          </span>
          <Link href={nextHref} aria-label={t({ en: "Next week", ko: "다음 주" })} className="rounded-6 text-faint hover:text-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent focus-visible:ring-offset-2">
            <ChevronRight aria-hidden size={18} />
          </Link>
        </div>
        {!isMobile && canCopy && (
          <button
            type="button"
            onClick={copyLastWeek}
            className="rounded-10 bg-divider px-14 py-10 text-13 font-semibold text-secondary hover:bg-divider-hover focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent focus-visible:ring-offset-2"
          >
            {t({ en: "Copy last week's notes", ko: "지난주 노트 복사" })}
          </button>
        )}
      </div>

      <div className={cn("mx-auto flex w-full max-w-[1000px] flex-1 flex-col gap-16", isMobile ? "p-20" : "p-32")}>
        {isMobile && canCopy && (
          <button
            type="button"
            onClick={copyLastWeek}
            className="self-start rounded-10 bg-divider px-14 py-10 text-13 font-semibold text-secondary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent focus-visible:ring-offset-2"
          >
            {t({ en: "Copy last week's notes", ko: "지난주 노트 복사" })}
          </button>
        )}

        {summary === undefined ? (
          <Card className="px-32 py-40">
            <EmptyState
              title={t({ en: "No trades this week", ko: "이번 주 기록이 없습니다" })}
              description={t({ en: "Log a trade to see this week's numbers.", ko: "트레이드를 기록하면 이번 주 통계가 표시됩니다." })}
            />
          </Card>
        ) : (
          <>
            <div className={cn("grid gap-16", isMobile ? "grid-cols-2" : "grid-cols-4")}>
              <StatCard
                label={t({ en: "Net", ko: "순 R" })}
                value={formatR(summary.netR)}
                tone={summary.netR >= 0 ? "gain" : "loss"}
                sub={t({ en: `${summary.tradeCount} trades`, ko: `${summary.tradeCount}건` })}
              />
              <StatCard
                label={t({ en: "Win rate", ko: "승률" })}
                value={summary.winRate === null ? em : formatPercent(summary.winRate)}
                sub={`${summary.winCount} / ${summary.decidedCount}`}
              />
              <StatCard
                label={t({ en: "Rule adherence", ko: "규칙 준수율" })}
                value={summary.ruleAdherence === null ? em : formatPercent(summary.ruleAdherence)}
                sub={t({ en: `${summary.offPlanCount} off-plan`, ko: `off-plan ${summary.offPlanCount}건` })}
              />
              <StatCard
                label={t({ en: "Vs. 4-week avg", ko: "최근 4주 평균 대비" })}
                value={formatR(summary.netR - summary.avgOfPriorWeeks)}
                tone={summary.netR - summary.avgOfPriorWeeks >= 0 ? "gain" : "loss"}
                sub={t({ en: `avg ${formatR(summary.avgOfPriorWeeks)}`, ko: `평균 ${formatR(summary.avgOfPriorWeeks)}` })}
              />
            </div>

            <div className={cn("grid gap-16", isMobile ? "grid-cols-1" : "grid-cols-[1fr_380px]")}>
              <Card className={cn(isMobile ? "px-20 py-24" : "px-28 py-26")}>
                <span className="text-16 font-bold tracking-[-.02em] text-ink">{t({ en: "Day by day", ko: "요일별" })}</span>
                <div className="mt-18 grid h-[150px] grid-cols-7 items-end gap-8">
                  {bars.map((bar, index) => {
                    const share = Math.abs(bar.netR) / maxAbsBar;
                    const hasTrade = bar.tradeCount > 0;
                    return (
                      <div key={bar.date} className="flex h-full flex-col justify-end gap-8">
                        <div
                          className={cn("rounded-8", hasTrade ? (bar.netR >= 0 ? "bg-gain" : "bg-loss") : "bg-[#e5e8eb]")}
                          style={{ height: hasTrade ? `${Math.max(share, 0.04) * 100}%` : "4px" }}
                        />
                        <span className={cn("text-center text-11 font-semibold", hasTrade ? "text-faint" : "text-disabled")}>
                          {WEEKDAY_LABELS[locale][index]}
                        </span>
                      </div>
                    );
                  })}
                </div>

                <div className="my-20 h-1 bg-divider" />

                <div className="grid grid-cols-2 gap-16">
                  <Panel title={t({ en: "Best trade", ko: "최고의 트레이드" })} info={bestInfo} t={t} />
                  <Panel title={t({ en: "Worst trade", ko: "최악의 트레이드" })} info={worstInfo} t={t} />
                </div>
              </Card>

              <Card className={cn(isMobile ? "px-20 py-24" : "px-28 py-26")}>
                <span className="text-16 font-bold tracking-[-.02em] text-ink">{t({ en: "Tag frequency", ko: "태그 빈도" })}</span>
                {tags.length === 0 ? (
                  <p className="mt-14 text-12_5 font-medium text-faint">{t({ en: "No tags this week.", ko: "이번 주 태그가 없습니다." })}</p>
                ) : (
                  <div className="mt-18 flex flex-col gap-14">
                    {tags.map((tag) => {
                      const weak = tag.count < maxTagCount / 2;
                      return (
                        <div key={tag.tag}>
                          <div className="flex justify-between text-13_5 font-semibold text-body">
                            <span>{tag.tag}</span>
                            <span>{tag.count}</span>
                          </div>
                          <div className="mt-7 h-7 overflow-hidden rounded-pill bg-divider">
                            <div
                              className={cn("h-full rounded-pill", weak ? "bg-disabled" : "bg-ink")}
                              style={{ width: `${(tag.count / (summary.tradeCount || 1)) * 100}%` }}
                            />
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}

                <div className="my-20 h-1 bg-divider" />

                <span className="text-16 font-bold tracking-[-.02em] text-ink">{t({ en: "Focus for next week", ko: "다음 주 포커스" })}</span>
                <div className="mt-14 flex flex-col gap-10">
                  {focusItems.map((item, index) => (
                    <div key={index} className="flex items-start gap-10">
                      <button
                        type="button"
                        onClick={() => toggleFocus(index)}
                        aria-pressed={item.checked}
                        aria-label={item.text}
                        className={cn(
                          "mt-2 flex h-18 w-18 shrink-0 items-center justify-center rounded-6",
                          item.checked ? "bg-accent text-white" : "bg-divider",
                          "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent focus-visible:ring-offset-2",
                        )}
                      >
                        {item.checked && <Check aria-hidden size={12} />}
                      </button>
                      <span className={cn("flex-1 text-13_5 leading-[1.5] font-medium", item.checked ? "text-faint line-through" : "text-secondary")}>
                        {item.text}
                      </span>
                      <button type="button" onClick={() => removeFocus(index)} aria-label={t({ en: "Remove", ko: "삭제" })} className="rounded-6 text-faint hover:text-loss focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent focus-visible:ring-offset-2">
                        <X aria-hidden size={13} />
                      </button>
                    </div>
                  ))}
                  <div className="mt-4 flex items-center gap-8">
                    <input
                      value={newFocusText}
                      onChange={(e) => setNewFocusText(e.target.value)}
                      onKeyDown={(e) => {
                        if (e.key === "Enter") {
                          e.preventDefault();
                          addFocus();
                        }
                      }}
                      placeholder={t({ en: "Add a focus item", ko: "포커스 항목 추가" })}
                      className="flex-1 rounded-10 bg-divider px-12 py-9 text-13_5 font-medium text-ink outline-none placeholder:text-faint"
                    />
                    <button type="button" onClick={addFocus} aria-label={t({ en: "Add focus item", ko: "포커스 추가" })} className="flex h-32 w-32 items-center justify-center rounded-10 bg-divider text-secondary hover:bg-divider-hover focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent focus-visible:ring-offset-2">
                      <Plus aria-hidden size={16} />
                    </button>
                  </div>
                </div>
              </Card>
            </div>
          </>
        )}

        <Card className={cn(isMobile ? "px-20 py-24" : "px-28 py-26")}>
          <span className="text-16 font-bold tracking-[-.02em] text-ink">{t({ en: "Review", ko: "리뷰" })}</span>
          <div className={cn("mt-16 grid gap-16", isMobile ? "grid-cols-1" : "grid-cols-3")}>
            <div>
              <div className="mb-8 text-13 font-semibold text-muted">{t({ en: "What worked", ko: "잘된 점" })}</div>
              <Textarea
                tone="review"
                value={whatWorked}
                onChange={(e) => setWhatWorked(e.target.value)}
                placeholder={t({ en: "What went right this week?", ko: "이번 주 잘된 점은 무엇인가요?" })}
              />
            </div>
            <div>
              <div className="mb-8 text-13 font-semibold text-muted">{t({ en: "What didn't", ko: "안된 점" })}</div>
              <Textarea
                tone="review"
                value={whatDidnt}
                onChange={(e) => setWhatDidnt(e.target.value)}
                placeholder={t({ en: "What cost you R this week?", ko: "이번 주 손실을 키운 점은 무엇인가요?" })}
              />
            </div>
            <div>
              <div className="mb-8 text-13 font-semibold text-muted">{t({ en: "One change", ko: "한 가지 변화" })}</div>
              <Textarea
                tone="review"
                value={oneChange}
                onChange={(e) => setOneChange(e.target.value)}
                placeholder={t({ en: "Write one sentence you can check against next week.", ko: "다음 주에 확인할 수 있는 한 문장을 적어보세요." })}
              />
            </div>
          </div>
          <div className="mt-16 flex items-center justify-end gap-12">
            {saveError !== null && <p className="text-13 font-semibold text-loss">{saveError}</p>}
            {saved && saveError === null && <p className="text-13 font-semibold text-faint">{t({ en: "Saved", ko: "저장됨" })}</p>}
            <Button size="lg" onClick={onSaveReview} disabled={isPending}>
              {isPending ? t({ en: "Saving…", ko: "저장하는 중…" }) : t({ en: "Save review", ko: "리뷰 저장" })}
            </Button>
          </div>
        </Card>
      </div>

      {isMobile && <BottomTabBar items={toTabItems(t)} activeHref="" />}
    </div>
  );
}

function Panel({
  title,
  info,
  t,
}: {
  title: string;
  info: { trade: Trade; model: TradeModel | null } | null;
  t: (s: { en: string; ko: string }) => string;
}) {
  const formatR = useFormatR();
  const r = info === null ? null : realizedR(info.trade);
  return (
    <div className="rounded-16 bg-surface-subtle px-20 py-18">
      <div className="text-12 font-semibold text-muted">{title}</div>
      {info === null ? (
        <div className="mt-6 text-13_5 font-medium text-faint">{em}</div>
      ) : (
        <>
          <div className="mt-6 text-15 font-bold text-ink">
            {info.trade.instrument} · {t(DIRECTION_LABELS[info.trade.direction])}
          </div>
          <div className="mt-2 text-12 font-medium text-muted">
            {(info.model?.name ?? t({ en: "Unassigned", ko: "미지정" })) + " · " + t(SESSION_LABELS[info.trade.session])}
          </div>
          <div className={cn("mt-8 text-20 font-extrabold", r !== null && r >= 0 ? "text-gain" : "text-loss")}>
            {r === null ? em : formatR(r)}
          </div>
        </>
      )}
    </div>
  );
}
