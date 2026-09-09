/**
 * Tunable rules the spec left open, resolved with the design owner.
 * Kept as named constants (not inlined) so they stay a single source of
 * truth and can move into Settings later. See docs/decisions.md.
 */

/**
 * Half-width of the "mid-range" band used by `offPlan`, as a fraction of the
 * range. 0.10 means an entry landing between 40% and 60% of the range counts
 * as mid-range, measured symmetrically around the 50% equilibrium line — the
 * only range level docs/README.md actually draws.
 */
export const MID_RANGE_HALF_BAND = 0.1;

/**
 * How close (in percentage points of drawdown) the account may get to its
 * drawdown limit before the trade form warns. docs/README.md § Capital:
 * "warns in the trade form when the account is within 2% of the limit".
 */
export const DRAWDOWN_WARNING_MARGIN_PCT = 2;
