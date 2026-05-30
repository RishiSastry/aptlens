/** Numeric helpers shared across the scoring modules. */

/** Round and clamp `n` into [lo, hi] (defaults to a 0–100 score range). */
export function clamp(n: number, lo = 0, hi = 100): number {
  return Math.max(lo, Math.min(hi, Math.round(n)));
}

/** Linear interpolation: map `x` from [a, b] onto [outA, outB], clamped to that output range. */
export function lerp(x: number, a: number, b: number, outA: number, outB: number): number {
  if (a === b) return outA;
  const t = (x - a) / (b - a);
  return outA + (outB - outA) * Math.max(0, Math.min(1, t));
}
