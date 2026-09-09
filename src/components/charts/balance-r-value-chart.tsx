import { extentOf, toAreaPath, toPoints, toPointsInBand, toX, toY } from "./geometry";

/**
 * Capital hero — docs/README.md § Capital: "a dual-line chart, 720x170
 * viewBox — balance as a 3px #191f28 line with a 10%->0 area fill, 1R value as
 * a 2.5px #3182f6 line on the same time axis (its own scale, no axis drawn).
 * Deposit and withdrawal events are step discontinuities in the balance line,
 * each marked with an r=4 ink dot and named in the caption row (500 11px
 * #b0b8c1). Legend top-right: 14x3 radius-99 swatches with 600 11.5px #4e5968
 * labels."
 *
 * The step discontinuity falls out of the data: a cash movement produces two
 * points at the same x, so the polyline jumps vertically.
 */
const WIDTH = 720;
const HEIGHT = 170;
const PADDING = 12;

/**
 * The 1R line lives in the lower part of the plot, matching the mock's
 * y 106-152 of 170. Without this it would share the balance line's normalised
 * shape exactly (1R is a fixed % of balance) and vanish underneath it.
 */
const R_BAND_TOP = HEIGHT * 0.62;
const R_BAND_BOTTOM = HEIGHT * 0.89;

export interface CapitalPoint {
  balance: number;
  rValue: number;
  /** Marks a cash movement — drawn as an ink dot on the balance line. */
  isCashEvent?: boolean;
}

export interface BalanceAndRValueChartProps {
  points: readonly CapitalPoint[];
  captions?: readonly string[];
  legend?: { balance: string; rValue: string };
  gradientId?: string;
  className?: string;
}

export function BalanceAndRValueChart({
  points,
  captions,
  legend,
  gradientId = "capital-fill",
  className,
}: BalanceAndRValueChartProps) {
  const balances = points.map((p) => p.balance);
  const rValues = points.map((p) => p.rValue);

  // Separate scales, and the 1R line gets its own band as well (see
  // R_BAND_TOP): sharing an axis would flatten 1R onto the baseline, while
  // sharing the full height would hide it exactly under the balance line.
  const balanceExtent = extentOf(balances);
  const rValueExtent = extentOf(rValues);

  return (
    <div className={className}>
      {legend !== undefined && (
        <div className="mb-8 flex justify-end gap-14 text-11_5 font-semibold text-secondary">
          <span className="flex items-center gap-6">
            <span className="h-3 w-14 rounded-pill bg-ink" />
            {legend.balance}
          </span>
          <span className="flex items-center gap-6">
            <span className="h-3 w-14 rounded-pill bg-accent" />
            {legend.rValue}
          </span>
        </div>
      )}

      <svg
        viewBox={`0 0 ${WIDTH} ${HEIGHT}`}
        preserveAspectRatio="none"
        role="img"
        aria-label="Account balance and the value of 1R over time"
        className="block h-[170px] w-full"
      >
        <defs>
          <linearGradient id={gradientId} x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="var(--color-ink)" stopOpacity=".10" />
            <stop offset="100%" stopColor="var(--color-ink)" stopOpacity="0" />
          </linearGradient>
        </defs>

        {points.length > 1 && (
          <>
            <path
              d={toAreaPath(balances, WIDTH, HEIGHT, balanceExtent, PADDING)}
              fill={`url(#${gradientId})`}
            />
            <polyline
              points={toPoints(balances, WIDTH, HEIGHT, balanceExtent, PADDING)}
              fill="none"
              stroke="var(--color-ink)"
              strokeWidth={3}
              strokeLinejoin="round"
              strokeLinecap="round"
            />
            <polyline
              points={toPointsInBand(rValues, WIDTH, rValueExtent, R_BAND_TOP, R_BAND_BOTTOM)}
              fill="none"
              stroke="var(--color-accent)"
              strokeWidth={2.5}
              strokeLinejoin="round"
              strokeLinecap="round"
            />
            {points.map((point, i) =>
              point.isCashEvent ? (
                <circle
                  key={i}
                  cx={toX(i, points.length, WIDTH)}
                  cy={toY(point.balance, balanceExtent, HEIGHT, PADDING)}
                  r={4}
                  fill="var(--color-ink)"
                />
              ) : null,
            )}
          </>
        )}
      </svg>

      {captions !== undefined && captions.length > 0 && (
        <div className="mt-8 flex justify-between text-11 font-medium text-faint">
          {captions.map((caption, i) => (
            <span key={i}>{caption}</span>
          ))}
        </div>
      )}
    </div>
  );
}
