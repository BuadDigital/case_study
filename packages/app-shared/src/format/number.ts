// toLocaleString creates Intl.NumberFormat on every call — screens call fmt for
// dozens of cells each render, so we keep one formatter per fraction-digit count.
const NUM_FORMATS = new Map<number, Intl.NumberFormat>();

export function fmt(n: number | null | undefined, digits = 0): string {
  if (n == null || !Number.isFinite(n)) return "—";
  // Latin digits aligned with the rest of the system (property card, adjustments table, reports).
  let formatter = NUM_FORMATS.get(digits);
  if (!formatter) {
    formatter = new Intl.NumberFormat("en-US", {
      maximumFractionDigits: digits,
      minimumFractionDigits: digits > 0 ? Math.min(digits, 2) : 0,
    });
    NUM_FORMATS.set(digits, formatter);
  }
  return formatter.format(n);
}

// Finance screens show amounts with a max fraction digits and no forced trailing zeros
// (1,234.5 not 1,234.50) — a separate formatter keeps that display.
const MAX_ONLY_FORMATS = new Map<number, Intl.NumberFormat>();

/** Equivalent to toLocaleString("en-US", { maximumFractionDigits: digits }) with "—" for empty. */
export function fmtMax(n: number | null | undefined, digits = 2): string {
  if (n == null || !Number.isFinite(n)) return "—";
  let formatter = MAX_ONLY_FORMATS.get(digits);
  if (!formatter) {
    formatter = new Intl.NumberFormat("en-US", { maximumFractionDigits: digits });
    MAX_ONLY_FORMATS.set(digits, formatter);
  }
  return formatter.format(n);
}

/** SAR amount — fmt with SAR suffix; "—" with no suffix when absent. */
export function fmtSar(n: number | null | undefined, digits = 2): string {
  if (n == null || !Number.isFinite(n)) return "—";
  return `${fmt(n, digits)} ر.س`;
}
