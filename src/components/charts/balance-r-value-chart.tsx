import type { ReactNode } from "react";
import { extentOf, toX, toY, type Extent } from "./geometry";

/**
 * Capital hero — docs/README.md § Capital: "a dual-line chart, 720x170
 * viewBox — balance as a 3px #191f28 line with a 10%->0 area fill, 1R value as
 * a 2.5px #3182f6 line on the same time axis (its own scale, no axis drawn).
 * Deposit and withdrawal events are step discontinuities in the balance line,
 * each marked with an r=4 ink dot and named in the caption row (500 11px
 * #b0b8c1). Legend top-right: 14x3 radius-99 swatches with 600 11.5px #4e5968
 * labels."
 *
 * The step discontinuity falls out of the data: a cash movement contributes
 * two points at the same `x` (balance before, balance after), so the polyline
 * jumps vertically. Points without an `x` are spaced evenly by index.
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
  /** Position on the time axis, 0..1. */
  x?: number;
}

/** A caption pinned under its own point on the time axis. */
export interface PositionedCaption {
  label: string;
  x: number;
}

export interface BalanceAndRValueChartProps {
  points: readonly CapitalPoint[];
  /** Plain strings spread edge to edge, or captions placed at their `x`. */
  captions?: readonly string[] | readonly PositionedCaption[];
  legend?: { balance: string; rValue: string };
  /** Mock 3a's "Balance & 1R value" (700 15px), left of the legend. */
  title?: ReactNode;
  gradientId?: string;
  className?: string;
}

function toBandY(value: number, extent: Extent): number {
  const ratio = (value - extent.min) / (extent.max - extent.min);
  return R_BAND_TOP + (1 - ratio) * (R_BAND_BOTTOM - R_BAND_TOP);
}

function isPositioned(
  captions: readonly string[] | readonly PositionedCaption[],
): captions is readonly PositionedCaption[] {
  return typeof captions[0] === "object";
}

export function BalanceAndRValueChart({
  points,
  captions,
  legend,
  title,
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

  const xs = points.map((p, i) => (p.x !== undefined ? p.x * WIDTH : toX(i, points.length, WIDTH)));
  const balanceYs = balances.map((b) => toY(b, balanceExtent, HEIGHT, PADDING));
  const rValueYs = rValues.map((r) => toBandY(r, rValueExtent));

  const balanceLine = xs.map((x, i) => `${x},${balanceYs[i]}`).join(" ");
  const rValueLine = xs.map((x, i) => `${x},${rValueYs[i]}`).join(" ");
  const area =
    points.length > 0
      ? `${xs.map((x, i) => `${i === 0 ? "M" : "L"}${x},${balanceYs[i]}`).join(" ")} L${xs[xs.length - 1]},${HEIGHT} L${xs[0]},${HEIGHT} Z`
      : "";

  return (
    <div className={className}>
      {(title !== undefined || legend !== undefined) && (
        <div className="mb-12 flex items-baseline justify-between gap-16">
          {title !== undefined && (
            <span className="text-15 font-bold tracking-[-.02em] text-ink">{title}</span>
          )}
          {legend !== undefined && (
            <div className="ml-auto flex gap-14 text-11_5 font-semibold text-secondary">
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
            <path d={area} fill={`url(#${gradientId})`} />
            <polyline
              points={balanceLine}
              fill="none"
              stroke="var(--color-ink)"
              strokeWidth={3}
              strokeLinejoin="round"
              strokeLinecap="round"
            />
            <polyline
              points={rValueLine}
              fill="none"
              stroke="var(--color-accent)"
              strokeWidth={2.5}
              strokeLinejoin="round"
              strokeLinecap="round"
            />
            {points.map((point, i) =>
              point.isCashEvent ? (
                <circle key={i} cx={xs[i]} cy={balanceYs[i]} r={4} fill="var(--color-ink)" />
              ) : null,
            )}
          </>
        )}
      </svg>

      {captions !== undefined &&
        captions.length > 0 &&
        (isPositioned(captions) ? (
          <div className="relative mt-8 h-16 text-11 font-medium text-faint">
            {captions.map((caption, i) => {
              // Edge captions align to their edge so they never hang off the card.
              const shift = caption.x < 0.08 ? "0%" : caption.x > 0.92 ? "-100%" : "-50%";
              return (
                <span
                  key={i}
                  className="absolute top-0 whitespace-nowrap"
                  style={{ left: `${caption.x * 100}%`, transform: `translateX(${shift})` }}
                >
                  {caption.label}
                </span>
              );
            })}
          </div>
        ) : (
          <div className="mt-8 flex justify-between text-11 font-medium text-faint">
            {captions.map((caption, i) => (
              <span key={i}>{caption}</span>
            ))}
          </div>
        ))}
    </div>
  );
}
