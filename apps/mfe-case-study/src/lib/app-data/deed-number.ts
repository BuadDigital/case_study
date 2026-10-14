import { toLatinDigits } from "@platform/app-shared/lib/arabic-digits";

/**
 * Normalize deed / real-estate registration numbers for prior-lookup matching.
 * Maps Arabic-Indic digits to ASCII and strips common separators.
 */
export function normalizeDeedNumber(raw: string | null | undefined): string {
  if (!raw) return "";
  return toLatinDigits(raw.trim()).replace(/[\s\-_/\\\u00A0\u200F\u200E]/g, "");
}

export function deedsMatch(
  a: string | null | undefined,
  b: string | null | undefined,
): boolean {
  const na = normalizeDeedNumber(a);
  const nb = normalizeDeedNumber(b);
  if (!na || !nb) return false;
  return na.localeCompare(nb, undefined, { sensitivity: "accent" }) === 0;
}
