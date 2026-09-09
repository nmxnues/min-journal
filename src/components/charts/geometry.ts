/**
 * Shared helpers for the hand-authored inline SVG charts. No chart library:
 * docs/build-prompt.md §2 requires the mocks' exact stroke/fill/caption specs
 * be reproduced directly.
 *
 * Every chart uses preserveAspectRatio="none" like the mocks, so the viewBox
 * is a fixed drawing grid that stretches to the container width.
 */

export interface Extent {
  min: number;
  max: number;
}

export function extentOf(values: readonly number[]): Extent {
  if (values.length === 0) return { min: 0, max: 1 };
  const min = Math.min(...values);
  const max = Math.max(...values);
  // A flat series would divide by zero; give it a hair of height so the line
  // renders through the middle instead of collapsing onto an edge.
  return min === max ? { min: min - 0.5, max: max + 0.5 } : { min, max };
}

/** Map a value to a y coordinate, inverted so larger values sit higher. */
export function toY(value: number, extent: Extent, height: number, padding = 0): number {
  const usable = height - padding * 2;
  const ratio = (value - extent.min) / (extent.max - extent.min);
  return padding + (1 - ratio) * usable;
}

/** Evenly spaced x coordinates across the viewBox width. */
export function toX(index: number, count: number, width: number): number {
  if (count <= 1) return width;
  return (index / (count - 1)) * width;
}

export function toPoints(
  values: readonly number[],
  width: number,
  height: number,
  extent: Extent,
  padding = 0,
): string {
  return values
    .map((value, i) => `${toX(i, values.length, width)},${toY(value, extent, height, padding)}`)
    .join(" ");
}

/** Closes a line down to the baseline so it can be filled. */
export function toAreaPath(
  values: readonly number[],
  width: number,
  height: number,
  extent: Extent,
  padding = 0,
): string {
  if (values.length === 0) return "";
  const line = values
    .map((value, i) => `${i === 0 ? "M" : "L"}${toX(i, values.length, width)},${toY(value, extent, height, padding)}`)
    .join(" ");
  return `${line} L${width},${height} L0,${height} Z`;
}

/**
 * Map a series into a horizontal band of the viewBox instead of its full
 * height. The capital chart needs this for the 1R line: 1R is a fixed
 * percentage of the balance, so on its own full-height scale it traces the
 * exact same normalised shape as the balance line and hides underneath it.
 * The mock draws 1R lower and flatter (y 106-152 of 170), which is what this
 * reproduces — "its own scale, no axis drawn".
 */
export function toPointsInBand(
  values: readonly number[],
  width: number,
  extent: Extent,
  bandTop: number,
  bandBottom: number,
): string {
  const height = bandBottom - bandTop;
  return values
    .map((value, i) => {
      const ratio = (value - extent.min) / (extent.max - extent.min);
      return `${toX(i, values.length, width)},${bandTop + (1 - ratio) * height}`;
    })
    .join(" ");
}
