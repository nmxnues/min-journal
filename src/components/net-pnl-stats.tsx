"use client";

import { StatCard } from "@/components/ui";
import { cn } from "@/lib/cn";
import type { MoneyStats } from "@/lib/domain/stats";
import { formatCurrency, formatPercent, formatSignedCurrency } from "@/lib/format";
import { useT } from "@/lib/i18n/locale-context";

const em = "—";

/**
 * The dashboard's net P&L row: win rate and averages over what the account
 * actually kept (price + swap − commission), plus the commission total —
 * beside the R stat row, not replacing it (docs/decisions.md § Commission).
 */
export function NetPnlStats({
  stats,
  currency,
  compact = false,
}: {
  stats: MoneyStats;
  currency: string;
  /** Mobile: two columns, smaller cards. */
  compact?: boolean;
}) {
  const t = useT();
  const avgNetWin = stats.avgNetWin === null ? em : formatSignedCurrency(stats.avgNetWin, currency);
  const avgNetLoss = stats.avgNetLoss === null ? em : formatSignedCurrency(stats.avgNetLoss, currency);
  const tone = (v: number | null) => (v === null || v === 0 ? "ink" : v > 0 ? "gain" : "loss");

  return (
    <div className={cn("grid gap-16", compact ? "grid-cols-2 gap-10" : "grid-cols-2 min-[1200px]:grid-cols-4")}>
      <StatCard
        size={compact ? "sm" : "lg"}
        className={compact ? "px-18 py-16" : undefined}
        label={t({ en: "Net win rate", ko: "순손익 승률" })}
        value={stats.netWinRate === null ? em : formatPercent(stats.netWinRate)}
        sub={t({ en: "after swap & commission", ko: "스왑·커미션 반영" })}
      />
      <StatCard
        size={compact ? "sm" : "lg"}
        className={compact ? "px-18 py-16" : undefined}
        label={t({ en: "Avg net P&L", ko: "평균 순손익" })}
        value={stats.avgNetPnl === null ? em : formatSignedCurrency(stats.avgNetPnl, currency)}
        tone={tone(stats.avgNetPnl)}
        sub={t({ en: "per closed trade", ko: "청산 트레이드당" })}
      />
      <StatCard
        size={compact ? "sm" : "lg"}
        // Phone: full width, so the pair stays on one line at full size
        // (a half-width card clipped it to "−$6", or shrank it unreadably).
        className={compact ? "col-span-2 px-18 py-16" : undefined}
        label={t({ en: "Avg net win / loss", ko: "평균 순수익 / 순손실" })}
        value={<WinLossValue win={avgNetWin} loss={avgNetLoss} />}
      />
      <StatCard
        size={compact ? "sm" : "lg"}
        // Full width too, so the row under the win/loss card isn't half empty.
        className={compact ? "col-span-2 px-18 py-16" : undefined}
        label={t({ en: "Commission paid", ko: "커미션 합계" })}
        value={stats.totalCommission === 0 ? formatCurrency(0, currency) : formatSignedCurrency(-stats.totalCommission, currency, 2)}
        tone={stats.totalCommission > 0 ? "loss" : "ink"}
        sub={t({
          en: `${stats.closedCount} closed ${stats.closedCount === 1 ? "trade" : "trades"}`,
          ko: `청산 ${stats.closedCount}건`,
        })}
      />
    </div>
  );
}

/**
 * Average advance per character of this value, in em, at the card's 800
 * weight — measured in Chrome with Pretendard on "+$2,567 / −$613" through
 * "+$123,456 / −$123,456": 0.52–0.55 at the desktop 30px/-.03em size and
 * 0.57–0.58 at the phone's 26px. Rounded up so the fit errs on the small side.
 */
const EM_PER_CHAR = 0.6;

/**
 * "+$2,567 / −$613" on one line that always fits its card. The pair used to
 * wrap on desktop and, in the phone's half-width card, run out of the card
 * and get clipped ("−$6"). CSS only, so the first paint is already right:
 * the wrapper is an inline-size container, and the line's font-size is the
 * card's own size (1em) unless the text would be wider than the card, in
 * which case it scales down to fit (100cqi = the card's content width).
 */
function WinLossValue({ win, loss }: { win: string; loss: string }) {
  // Characters plus the " / " separator (the gaps render about one char each).
  const chars = win.length + loss.length + 3;
  return (
    <span className="block [container-type:inline-size]">
      <span
        className="flex items-baseline gap-[0.2em] whitespace-nowrap"
        style={{ fontSize: `min(1em, calc(100cqi / ${(chars * EM_PER_CHAR).toFixed(2)}))` }}
      >
        <span className="text-gain">{win}</span>
        <span className="text-faint">/</span>
        <span className="text-loss">{loss}</span>
      </span>
    </span>
  );
}
