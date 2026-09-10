import { cn } from "@/lib/cn";
import { rangePosition } from "@/lib/domain/trade";

/**
 * The CRT range, drawn as layout rather than a chart — docs/README.md
 * § Assets: "The range diagram is layout, not a chart; build it from divs."
 *
 * Vertical position is price: the top edge is the range high, the bottom edge
 * the range low, and the hairline across the middle is the 50% equilibrium.
 * Horizontal position is only reading order (sweep first, expansion, then
 * target), so those offsets are presentational and match the mock.
 *
 * The `detail` variant adds the 3px expansion leg and where the exit landed,
 * plus a neutral marker for a target that was never reached (mock 2b).
 */
export interface RangeDiagramProps {
  rangeHigh: number;
  rangeLow: number;
  sweepSide: "low" | "high" | "both" | "none";
  target?: number | null;
  exit?: number | null;
  variant?: "form" | "detail";
  labels: {
    sweep: string;
    target: string;
    /** Detail only, e.g. "Expansion · exit at 59%". */
    expansion?: string;
  };
  /** Formatted prices for the caption row: low / 50% / high. */
  captions?: { low: string; mid: string; high: string };
  className?: string;
}

export function RangeDiagram({
  rangeHigh,
  rangeLow,
  sweepSide,
  target,
  exit,
  variant = "form",
  labels,
  captions,
  className,
}: RangeDiagramProps) {
  const isDetail = variant === "detail";
  const range = { rangeHigh, rangeLow };

  /** Price -> distance from the top of the bar, clamped into it. */
  const topPercent = (price: number | null | undefined) => {
    const position = rangePosition(price, range);
    if (position === null) return null;
    return `${(1 - Math.max(0, Math.min(1, position))) * 100}%`;
  };

  const exitTop = isDetail ? topPercent(exit) : null;
  const showSweepLow = sweepSide === "low" || sweepSide === "both";
  const showSweepHigh = sweepSide === "high" || sweepSide === "both";

  return (
    <div className={className}>
      <div
        className={cn("relative rounded-12 bg-panel", isDetail ? "h-76" : "h-64")}
        role="img"
        aria-label={`Range ${rangeLow} to ${rangeHigh}`}
      >
        {/* Range high / low rules, and the 50% equilibrium hairline. */}
        <div className="absolute inset-x-0 top-0 h-2 rounded-pill bg-disabled" />
        <div className="absolute inset-x-0 bottom-0 h-2 rounded-pill bg-disabled" />
        <div className="absolute inset-x-0 top-1/2 h-px bg-border" />

        {/* Sweep marker: hangs below the swept extreme. */}
        {showSweepLow && (
          <div className="absolute bottom-[-8px] left-[16%] h-26 w-4 rounded-pill bg-accent" />
        )}
        {showSweepHigh && (
          <div className="absolute top-[-8px] left-[16%] h-26 w-4 rounded-pill bg-accent" />
        )}
        {(showSweepLow || showSweepHigh) && (
          <div
            className={cn(
              "absolute left-[12%] text-11 font-bold text-accent",
              showSweepLow ? "bottom-[-34px]" : "top-[-34px]",
            )}
          >
            {labels.sweep}
          </div>
        )}

        {/* Expansion leg and where the exit landed (detail only). */}
        {isDetail && exitTop !== null && (
          <>
            <div
              className="absolute right-[38%] left-[22%] h-3 rounded-pill bg-gain"
              style={{ top: exitTop }}
            />
            {labels.expansion !== undefined && (
              <div className="absolute top-[14%] left-[22%] text-11 font-bold text-gain">
                {labels.expansion}
              </div>
            )}
          </>
        )}

        {/* Target: red above the high edge while live, neutral once missed. */}
        {target !== null && target !== undefined && (
          <>
            <div
              className={cn(
                "absolute top-[-8px] right-[6%] h-26 w-4 rounded-pill",
                isDetail ? "bg-disabled" : "bg-gain",
              )}
            />
            <div
              className={cn(
                "absolute top-[-34px] right-[4%] text-11 font-bold",
                isDetail ? "text-faint" : "text-gain",
              )}
            >
              {labels.target}
            </div>
          </>
        )}
      </div>

      {captions !== undefined && (
        // A plain `flex justify-between` row collapses its own gap to zero
        // once the three captions' natural width exceeds the container — on
        // a narrow (<900px) card with 5-decimal FX prices, that read as the
        // three values jammed together with no space at all. Grid columns
        // keep a guaranteed gap regardless of overflow, and let a caption
        // that's still too wide for its column wrap onto a second line
        // instead of spilling into its neighbor.
        <div className="mt-18 grid grid-cols-3 gap-8 text-11_5 font-medium text-faint">
          <span className="text-left">{captions.low}</span>
          <span className="text-center">{captions.mid}</span>
          <span className="text-right">{captions.high}</span>
        </div>
      )}
    </div>
  );
}
