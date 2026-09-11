"use client";

import Link from "next/link";
import { Card, Chip } from "@/components/ui";
import { cn } from "@/lib/cn";
import { useT } from "@/lib/i18n/locale-context";

export interface DrawdownAlertInfo {
  drawdownPercent: number;
  limitPercent: number;
}

/**
 * docs/README.md § Capital: the drawdown limit, once crossed, "should surface
 * a warning on the dashboard". Not drawn in any mock — built from the trade
 * form's own warning row (an accent "Check"-style chip beside a line of
 * copy), since there is no danger colour in the tokens and the loss colour
 * must not double as one.
 */
export function DrawdownAlert({
  drawdownPercent,
  limitPercent,
  compact = false,
}: DrawdownAlertInfo & { compact?: boolean }) {
  const t = useT();
  const drawdown = drawdownPercent.toFixed(1);
  const limit = String(Number(limitPercent.toFixed(1)));

  return (
    <Card
      role="alert"
      className={cn("flex items-start gap-10", compact ? "flex-col rounded-22 px-22 py-18" : "items-center px-28 py-20")}
    >
      <Chip tone="accent" shape="stat" className="shrink-0">
        {t({ en: "Limit", ko: "한도" })}
      </Chip>
      <p className="flex-1 text-13_5 leading-[1.6] text-secondary">
        <span className="font-bold text-ink">
          {t({ en: "Drawdown limit reached.", ko: "드로다운 한도에 도달했습니다." })}
        </span>{" "}
        {t({
          en: `Down ${drawdown}% from peak against a ${limit}% limit — your guard says stop trading.`,
          ko: `고점 대비 −${drawdown}%, 한도 ${limit}% — 가드 기준으로는 매매를 멈출 때입니다.`,
        })}
      </p>
      <Link href="/capital" className="shrink-0 rounded-6 text-13 font-semibold text-accent hover:text-accent-pressed focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent focus-visible:ring-offset-2">
        {t({ en: "Open Capital", ko: "자산 보기" })}
      </Link>
    </Card>
  );
}
