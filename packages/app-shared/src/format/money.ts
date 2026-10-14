/**
 * Exact money math for previews that must equal what the server saves and charges.
 * The server uses C# decimal with MidpointRounding.AwayFromZero; JS doubles drift
 * (3500.5 × 0.15 = 525.0749999… → 525.07 with Math.round), so every amount here is
 * cleaned of float noise and rounded half away from zero, the same as the server.
 */

/** Doubles carry ~15–17 significant digits; anything past 15 is float noise, not data. */
const SIGNIFICANT_DIGITS = 15;

/** n × 10^exp done on the decimal text, so 1.005 × 100 is 100.5 and not 100.49999…. */
function shiftDecimal(n: number, exp: number): number {
  const [mantissa, power] = n.toExponential().split("e");
  return Number(`${mantissa}e${Number(power) + exp}`);
}

/**
 * Rounds to `digits` decimals half away from zero (C# MidpointRounding.AwayFromZero).
 * `digits` may be negative: -2 rounds to the nearest hundred.
 * 2.675 → 2.68, -2.5 → -3, 1365849.9999999998 (digits -2) → 1365900.
 */
export function roundHalfAwayFromZero(value: number, digits = 0): number {
  if (!Number.isFinite(value)) return value;
  const sign = value < 0 ? -1 : 1;
  const clean = Number(Math.abs(value).toPrecision(SIGNIFICANT_DIGITS));
  const rounded = shiftDecimal(Math.round(shiftDecimal(clean, digits)), -digits);
  return rounded === 0 ? 0 : sign * rounded;
}

/** An amount as whole halalas (2 decimals, half away from zero) — sums of these are exact. */
export function toHalalas(sar: number): number {
  if (!Number.isFinite(sar)) return 0;
  return Math.round(shiftDecimal(roundHalfAwayFromZero(sar, 2), 2));
}

/** An amount rounded to 2 decimals half away from zero — what a numeric(…,2) column keeps. */
export function roundSar(sar: number): number {
  return toHalalas(sar) / 100;
}

/** Exact sum of amounts, each first rounded to 2 decimals the way the server stores them. */
export function sumSar(...amounts: number[]): number {
  let halalas = 0;
  for (const a of amounts) halalas += toHalalas(a);
  return halalas / 100;
}

/**
 * VAT on a taxable amount, rounded once to 2 decimals half away from zero —
 * the server's Math.Round(taxable × rate, 2, AwayFromZero). 3500.5 → 525.08.
 */
export function vatSar(taxable: number, rate = 0.15): number {
  const basisPoints = Math.round(rate * 10000);
  return roundHalfAwayFromZero((toHalalas(taxable) * basisPoints) / 10000) / 100;
}
