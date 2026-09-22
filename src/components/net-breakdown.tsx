"use client";

import { cn } from "@/lib/cn";
import { formatSignedCurrency } from "@/lib/format";
import { useT } from "@/lib/i18n/locale-context";

/**
 * The tail of the trade forms' money preview, after the price P&L:
 * " · swap −$18 · commission −$7.00 → +$175". Renders nothing when there is
 * neither a swap nor any commission, so a plain trade keeps the old one-figure
 * line. Mirrors `pnlAmount`: price + swap − commission.
 */
export function NetBreakdown({
  price,
  swap,
  commission,
  currency,
}: {
  price: number;
  swap: number | null;
  /** Entry + exit, positive. */
  commission: number;
  currency: string;
}) {
  const t = useT();
  if (swap === null && commission === 0) return null;
  const net = price + (swap ?? 0) - commission;

  return (
    <>
      {swap !== null && (
        <>
          {` · ${t({ en: "swap", ko: "스왑" })} `}
          {formatSignedCurrency(swap, currency)}
        </>
      )}
      {commission !== 0 && (
        <>
          {` · ${t({ en: "commission", ko: "커미션" })} `}
          {formatSignedCurrency(-commission, currency, 2)}
        </>
      )}
      {" → "}
      <span className={cn(net >= 0 ? "text-gain" : "text-loss")}>{formatSignedCurrency(net, currency)}</span>
    </>
  );
}
