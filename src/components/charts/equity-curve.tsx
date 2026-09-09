import { cn } from "@/lib/cn";
import { extentOf, toAreaPath, toPoints, toX, toY } from "./geometry";

/**
 * Dashboard hero curve — docs/README.md § Dashboard: "inline SVG, 720x180
 * viewBox, preserveAspectRatio='none', height 180px. 3px stroke in the P&L
 * color, round joins/caps, plus a same-color area fill fading to 0 opacity
 * (top stop 16%). End point marked with an r=5 dot. Axis captions below:
 * 500 11px #b0b8c1, left = period start, center = max drawdown, right =
 * period end."
 */
const WIDTH = 720;
const HEIGHT = 180;

export interface EquityCurveProps {
  /** Cumulative R at each closed trade, in order. */
  values: readonly number[];
  captions?: { start: string; middle: string; end: string };
  /** Which P&L colour to draw in; defaults to the sign of the final value. */
  tone?: "gain" | "loss";
  gradientId?: string;
  className?: string;
}

export function EquityCurve({
  values,
  captions,
  tone,
  gradientId = "equity-curve-fill",
  className,
}: EquityCurveProps) {
  const last = values.length > 0 ? values[values.length - 1] : 0;
  const color = (tone ?? (last < 0 ? "loss" : "gain")) === "loss" ? "var(--pnl-loss)" : "var(--pnl-gain)";

  const extent = extentOf(values);
  const points = toPoints(values, WIDTH, HEIGHT, extent, 12);
  const area = toAreaPath(values, WIDTH, HEIGHT, extent, 12);
  const endX = toX(values.length - 1, values.length, WIDTH);
  const endY = toY(last, extent, HEIGHT, 12);

  return (
    <div className={className}>
      <svg
        viewBox={`0 0 ${WIDTH} ${HEIGHT}`}
        preserveAspectRatio="none"
        role="img"
        aria-label="Cumulative R over the period"
        className="block h-[180px] w-full"
      >
        <defs>
          <linearGradient id={gradientId} x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor={color} stopOpacity=".16" />
            <stop offset="100%" stopColor={color} stopOpacity="0" />
          </linearGradient>
        </defs>

        {values.length > 1 && (
          <>
            <path d={area} fill={`url(#${gradientId})`} />
            <polyline
              points={points}
              fill="none"
              stroke={color}
              strokeWidth={3}
              strokeLinejoin="round"
              strokeLinecap="round"
            />
            <circle cx={endX} cy={endY} r={5} fill={color} />
          </>
        )}
      </svg>

      {captions !== undefined && (
        <div className="mt-8 flex justify-between text-11 font-medium text-faint">
          <span>{captions.start}</span>
          <span>{captions.middle}</span>
          <span>{captions.end}</span>
        </div>
      )}
    </div>
  );
}

/** Mobile home hero: 300x70, 3px stroke, no fill (docs/README.md § Mobile). */
export function Sparkline({
  values,
  tone,
  className,
}: {
  values: readonly number[];
  tone?: "gain" | "loss";
  className?: string;
}) {
  const last = values.length > 0 ? values[values.length - 1] : 0;
  const color = (tone ?? (last < 0 ? "loss" : "gain")) === "loss" ? "var(--pnl-loss)" : "var(--pnl-gain)";
  const extent = extentOf(values);

  return (
    <svg
      viewBox="0 0 300 70"
      preserveAspectRatio="none"
      role="img"
      aria-label="Recent performance"
      className={cn("block h-[70px] w-full", className)}
    >
      {values.length > 1 && (
        <polyline
          points={toPoints(values, 300, 70, extent, 6)}
          fill="none"
          stroke={color}
          strokeWidth={3}
          strokeLinejoin="round"
          strokeLinecap="round"
        />
      )}
    </svg>
  );
}
