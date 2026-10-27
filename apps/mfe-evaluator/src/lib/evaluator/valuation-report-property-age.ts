// ── Valuation fixes · 2026-10-25/26 ──────────────────────────────────────────────────────────
// Round 2 (1b19bedc)
//  • New formatArabicYears / formatArabicMonths (arabicCount) for counted years and months: «سنة
//          واحدة», «سنتان», «4 سنوات», «22 سنة»; «شهر واحد», «شهران», «5 أشهر».
// ──────────────────────────────────────────────────────────────────────────────────────────────

/**
 * Report-only property age: years since building-license issue date, minus 2.
 * Does not write back to the inspector workspace — print/preview cells only.
 */

import {
  hijriToGregorian,
  isValidGregorianDate,
} from "@platform/app-shared/format/hijri";
import { toLatinDigits } from "@platform/app-shared/lib/arabic-digits";

const LICENSE_AGE_OFFSET_YEARS = 2;

/** Parse inspector license date (Hijri or Gregorian) to a local noon Date. */
export function parseLicenseDateForAge(
  raw: string | null | undefined,
): Date | null {
  const trimmed = toLatinDigits((raw ?? "").trim());
  if (!trimmed) return null;

  const hijriMarked =
    /هـ/.test(trimmed) ||
    /\bh\b/i.test(trimmed.replace(/\s+/g, "")) ||
    /^h:/i.test(trimmed);
  const gregorianMarked = /م/.test(trimmed) || /^g:/i.test(trimmed);

  const digits = trimmed
    .replace(/^h:/i, "")
    .replace(/^g:/i, "")
    .replace(/[^\d/.\-]/g, "")
    .trim();

  let year = 0;
  let month = 0;
  let day = 0;

  const iso = /^(\d{4})-(\d{1,2})-(\d{1,2})$/.exec(digits);
  const slash = /^(\d{1,4})[/.\-](\d{1,2})[/.\-](\d{1,4})$/.exec(digits);
  if (iso) {
    year = Number(iso[1]);
    month = Number(iso[2]);
    day = Number(iso[3]);
  } else if (slash) {
    const a = Number(slash[1]);
    const b = Number(slash[2]);
    const c = Number(slash[3]);
    if (a > 31) {
      year = a;
      month = b;
      day = c;
    } else if (c > 31) {
      day = a;
      month = b;
      year = c;
    } else {
      return null;
    }
  } else {
    return null;
  }

  if (!year || month < 1 || month > 12 || day < 1 || day > 31) return null;

  const isHijri =
    hijriMarked || (!gregorianMarked && year >= 1300 && year < 1600);

  if (isHijri) {
    const g = hijriToGregorian(year, month, day);
    if (!g) return null;
    return new Date(g.year, g.month - 1, g.day, 12, 0, 0, 0);
  }

  if (!isValidGregorianDate(year, month, day)) return null;
  return new Date(year, month - 1, day, 12, 0, 0, 0);
}

function completedFullYears(from: Date, to: Date): number {
  let years = to.getFullYear() - from.getFullYear();
  const monthDelta = to.getMonth() - from.getMonth();
  const dayDelta = to.getDate() - from.getDate();
  if (monthDelta < 0 || (monthDelta === 0 && dayDelta < 0)) years -= 1;
  return years;
}

/**
 * Report property age in whole years: (today − license date) − 2, never below 0.
 * Returns null when the license date is missing or unparseable.
 */
export function reportPropertyAgeYearsFromLicense(
  licenseDateRaw: string | null | undefined,
  now: Date = new Date(),
): number | null {
  const license = parseLicenseDateForAge(licenseDateRaw);
  if (!license || Number.isNaN(license.getTime())) return null;
  if (license.getTime() > now.getTime()) return 0;
  const years = completedFullYears(license, now) - LICENSE_AGE_OFFSET_YEARS;
  return years < 0 ? 0 : years;
}

/**
 * Arabic count agreement: 0 → «أقل من سنة», 1 → «سنة واحدة», 2 → «سنتين»,
 * 3–10 → «N سنوات», 11 and up → «N سنة» (103 → «103 سنوات» follows the last two digits).
 */
export function formatReportPropertyAgeYears(years: number): string {
  if (years <= 0) return "أقل من سنة";
  if (years === 1) return "سنة واحدة";
  if (years === 2) return "سنتين";
  const lastTwo = years % 100;
  return lastTwo >= 3 && lastTwo <= 10 ? `${years} سنوات` : `${years} سنة`;
}

/**
 * A counted noun as it stands alone (nominative): 1 → «سنة واحدة», 2 → «سنتان», 3–10 → «N سنوات»,
 * 11 and up → «N سنة» (by the last two digits); a fraction keeps the singular («2.5 سنة»).
 */
function arabicCount(
  n: number,
  forms: { one: string; two: string; few: string; many: string },
): string {
  if (!Number.isInteger(n) || n <= 0) return `${n} ${forms.many}`;
  if (n === 1) return forms.one;
  if (n === 2) return forms.two;
  const lastTwo = n % 100;
  return `${n} ${lastTwo >= 3 && lastTwo <= 10 ? forms.few : forms.many}`;
}

/** «سنة واحدة» / «سنتان» / «4 سنوات» / «22 سنة». */
export function formatArabicYears(years: number): string {
  return arabicCount(years, { one: "سنة واحدة", two: "سنتان", few: "سنوات", many: "سنة" });
}

/** «شهر واحد» / «شهران» / «5 أشهر» / «14 شهراً». */
export function formatArabicMonths(months: number): string {
  return arabicCount(months, { one: "شهر واحد", two: "شهران", few: "أشهر", many: "شهراً" });
}

/** Same wording for a free-text age: whole numbers are reworded, anything else is kept. */
export function formatReportAgeText(raw: string): string {
  const text = raw.trim();
  return /^\d+$/.test(text) ? formatReportPropertyAgeYears(Number(text)) : text;
}
