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
        className={compact ? "px-18 py-16" : undefined}
        label={t({ en: "Avg net win / loss", ko: "평균 순수익 / 순손실" })}
        value={
          <span className="flex items-baseline gap-6">
            <span className="text-gain">
              {stats.avgNetWin === null ? em : formatSignedCurrency(stats.avgNetWin, currency)}
            </span>
            <span className="text-faint">/</span>
            <span className="text-loss">
              {stats.avgNetLoss === null ? em : formatSignedCurrency(stats.avgNetLoss, currency)}
            </span>
          </span>
        }
      />
      <StatCard
        size={compact ? "sm" : "lg"}
        className={compact ? "px-18 py-16" : undefined}
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
