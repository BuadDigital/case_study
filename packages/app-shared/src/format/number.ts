import { toLatinDigits } from "../lib/arabic-digits";

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

type SarFormatOptions = {
  /** Fraction digits (default 2). */
  digits?: number;
  /**
   * How the fraction prints:
   * - false (default): always `digits` places — 1,234.50
   * - true: up to `digits`, no trailing zeros (like fmtMax) — 1,234.5 / 1,234
   * - "whole": whole amounts with no fraction, others with `digits` places — 1,234 / 1,234.50
   */
  trim?: boolean | "whole";
};

/**
 * The one SAR amount format: Latin digits, en-US grouping, « ر.س» suffix;
 * "—" with no suffix when the amount is absent. Never «ريال» or a "SAR" prefix.
 * `fmtSar(n)` / `fmtSar(n, 0)` fix the fraction; pass options to trim it.
 */
export function fmtSar(
  n: number | null | undefined,
  options: number | SarFormatOptions = 2,
): string {
  if (n == null || !Number.isFinite(n)) return "—";
  const { digits = 2, trim = false } =
    typeof options === "number" ? { digits: options } : options;
  const text =
    trim === true
      ? fmtMax(n, digits)
      : fmt(n, trim === "whole" && Number.isInteger(n) ? 0 : digits);
  return `${text} ر.س`;
}

// Unit suffixes people type after the number (area, percent, riyal) — longest first.
const UNIT_SUFFIX = /(م²|م2|m²|m2|%|ر\.س|ريال)/g;
const THOUSANDS_GROUPED = /^-?\d{1,3}(,\d{3})+$/;
const PLAIN_NUMBER = /^-?(\d+\.?\d*|\.\d+)$/;

/**
 * Text a person typed → number; NaN when it is not a number (blank included).
 * One rule for the whole app so an area or amount reads the same everywhere:
 * - Arabic/Persian digits → Latin; ٫ (U+066B) is the decimal point; ٬ (U+066C) is dropped.
 * - Units (م² م2 m² m2 % ر.س ريال), spaces and NBSP are dropped.
 * - ASCII comma: with a "." present, commas are thousands. Without one, well-formed
 *   3-digit groups ("1,250", "12,345,678") are thousands; otherwise a single comma is
 *   the decimal point ("12,5" → 12.5, "1,25" → 1.25); anything else is NaN.
 * Ambiguity: "1,250" reads as 1250 (thousands), matching the backend's area parser
 * (EngineeringSurveyFeeRules.TryParseAreaM2) — type "1.25" or "1٫25" for a fraction.
 */
export function parseLocaleNumber(
  raw: string | number | null | undefined,
): number {
  if (typeof raw === "number") return raw;
  if (raw == null) return Number.NaN;
  let s = toLatinDigits(String(raw))
    .replace(/٫/g, ".")
    .replace(/٬/g, "")
    .replace(UNIT_SUFFIX, "")
    .replace(/\s/g, ""); // \s covers NBSP (U+00A0) and narrow NBSP (U+202F)
  if (s.includes(",")) {
    if (s.includes(".") || THOUSANDS_GROUPED.test(s)) s = s.replace(/,/g, "");
    else if (s.split(",").length === 2) s = s.replace(",", ".");
    else return Number.NaN;
  }
  return PLAIN_NUMBER.test(s) ? Number(s) : Number.NaN;
}

/** Typed text that reads as a number greater than zero (an area, a price) — the backend's `LocaleNumber.TryParsePositive`. */
export function isPositiveLocaleNumber(
  raw: string | number | null | undefined,
): boolean {
  const n = parseLocaleNumber(raw);
  return Number.isFinite(n) && n > 0;
}
