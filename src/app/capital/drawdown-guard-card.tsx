"use client";

import { Pencil } from "lucide-react";
import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { Button, Card, Input } from "@/components/ui";
import { cn } from "@/lib/cn";
import { formatCurrency } from "@/lib/format";
import { useT } from "@/lib/i18n/locale-context";
import { updateDrawdownLimit } from "./actions";
import type { CapitalData, CapitalSummary } from "./use-capital-summary";

/** "10" / "7.5" — a limit reads as the whole number it usually is. */
function formatLimit(percent: number): string {
  return String(Number(percent.toFixed(1)));
}

/**
 * Mock 3a's "Drawdown guard": current drawdown from the (cash-adjusted, see
 * `drawdownState`) peak, a bar of how much of the limit is used, and the
 * limit itself — "The limit is user-set" (docs/README.md § Capital), edited
 * in place from its own caption.
 */
export function DrawdownGuardCard({
  data,
  summary,
  compact = false,
}: {
  data: CapitalData;
  summary: CapitalSummary;
  compact?: boolean;
}) {
  const t = useT();
  const router = useRouter();
  const { drawdown } = summary;
  const currency = data.account.currency;

  const [editing, setEditing] = useState(false);
  const [limit, setLimit] = useState(formatLimit(drawdown.limitPercent));
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  function save() {
    setError(null);
    startTransition(async () => {
      const result = await updateDrawdownLimit(data.account.id, limit);
      if (result.ok) {
        setEditing(false);
        router.refresh();
      } else {
        setError(result.error);
      }
    });
  }

  const drawdownLabel = drawdown.drawdownAmount > 0 ? `−${drawdown.drawdownPercent.toFixed(1)}%` : "0.0%";

  return (
    <Card className={compact ? "rounded-22 px-22 py-20" : "px-28 py-26"}>
      <span className={cn("font-bold tracking-[-.02em] text-ink", compact ? "text-15" : "text-16")}>
        {t({ en: "Drawdown guard", ko: "드로다운 가드" })}
      </span>

      <div className="mt-14 flex items-baseline justify-between gap-12">
        <span className="text-13 font-semibold text-muted">
          {t({
            en: `From peak ${formatCurrency(drawdown.peakBalance, currency)}`,
            ko: `고점 ${formatCurrency(drawdown.peakBalance, currency)} 대비`,
          })}
        </span>
        <span className="text-20 font-extrabold text-ink">{drawdownLabel}</span>
      </div>

      <div className="mt-10 h-8 overflow-hidden rounded-pill bg-divider">
        <div
          className="h-full rounded-pill bg-accent"
          style={{ width: `${Math.min(1, Math.max(0, drawdown.limitConsumed)) * 100}%` }}
        />
      </div>

      <div className="mt-8 flex items-center justify-between gap-12 text-11_5 font-medium text-faint">
        <button
          type="button"
          onClick={() => {
            setLimit(formatLimit(drawdown.limitPercent));
            setEditing((v) => !v);
          }}
          aria-expanded={editing}
          className={cn(
            "-my-8 inline-flex min-h-32 items-center gap-4 rounded-8 transition-colors duration-150 ease-out hover:text-secondary",
            "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent focus-visible:ring-offset-2",
          )}
        >
          {t({ en: `Limit −${formatLimit(drawdown.limitPercent)}%`, ko: `한도 −${formatLimit(drawdown.limitPercent)}%` })}
          <Pencil aria-hidden size={12} />
        </button>
        <span>
          {t({
            en: `Stop trading at −${formatCurrency(drawdown.limitAmount, currency)}`,
            ko: `−${formatCurrency(drawdown.limitAmount, currency)}에서 매매 중단`,
          })}
        </span>
      </div>

      {editing && (
        <form
          className="mt-12 flex items-center gap-8"
          onSubmit={(event) => {
            event.preventDefault();
            save();
          }}
        >
          <div className="relative w-[112px]">
            <Input
              aria-label={t({ en: "Drawdown limit (%)", ko: "드로다운 한도 (%)" })}
              inputMode="decimal"
              autoFocus
              value={limit}
              onChange={(e) => setLimit(e.target.value)}
              className="py-10 pr-32 pl-14 text-14"
            />
            <span className="pointer-events-none absolute top-1/2 right-14 -translate-y-1/2 text-13 font-semibold text-faint">
              %
            </span>
          </div>
          <Button type="submit" size="sm" disabled={isPending}>
            {t({ en: "Save", ko: "저장" })}
          </Button>
          <Button tone="neutral" size="sm" onClick={() => setEditing(false)}>
            {t({ en: "Cancel", ko: "취소" })}
          </Button>
        </form>
      )}
      {error !== null && <p className="mt-8 text-12_5 font-semibold text-loss">{error}</p>}

      {drawdown.hasReachedLimit ? (
        <p className="mt-12 text-12_5 font-semibold text-ink">
          {t({ en: "Limit reached — the guard says stop trading.", ko: "한도에 도달했습니다 — 매매를 멈출 때입니다." })}
        </p>
      ) : (
        drawdown.isNearLimit && (
          <p className="mt-12 text-12_5 font-semibold text-secondary">
            {t({
              en: "Within 2 points of the limit — the trade form is warning on every new trade.",
              ko: "한도까지 2%p 이내입니다 — 새 트레이드를 기록할 때마다 경고가 뜹니다.",
            })}
          </p>
        )
      )}
    </Card>
  );
}
