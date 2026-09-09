/**
 * Single-slot memoisation keyed on argument identity — the same strategy
 * reselect uses. Selectors here take arrays that are stable per render pass,
 * so one slot is enough to stop re-walking the whole trade list on every read.
 */
export function memoize<Args extends readonly unknown[], R>(
  fn: (...args: Args) => R,
): (...args: Args) => R {
  let lastArgs: Args | null = null;
  let lastResult!: R;

  return (...args: Args): R => {
    if (
      lastArgs !== null &&
      lastArgs.length === args.length &&
      lastArgs.every((arg, i) => Object.is(arg, args[i]))
    ) {
      return lastResult;
    }

    lastArgs = args;
    lastResult = fn(...args);
    return lastResult;
  };
}
