// ── Valuation fixes · 2026-10-25/26 ──────────────────────────────────────────────────────────
// Round 2 (1b19bedc)
//  • New formatArabicYears / formatArabicMonths (arabicCount) for counted years and months: «سنة
//          واحدة», «سنتان», «4 سنوات», «22 سنة»; «شهر واحد», «شهران», «5 أشهر».
// ──────────────────────────────────────────────────────────────────────────────────────────────

/**
 * Report-only property age: the inspector's age, else years since building-license issue date,
 * minus 2; and the report's date display (yyyy/mm/dd). Does not write back to the inspector
 * workspace — print/preview cells only.
 */

import { pad2, ymd } from "@platform/app-shared/format/date";
import {
  formatHijriDate,
  hijriToGregorian,
  isValidGregorianDate,
  isValidHijriDate,
} from "@platform/app-shared/format/hijri";
import { toLatinDigits } from "@platform/ui-kit";

const LICENSE_AGE_OFFSET_YEARS = 2;

/** One calendar day as typed, with the calendar it belongs to. */
export type ReportCalendarDay = {
  kind: "gregorian" | "hijri";
  year: number;
  month: number;
  day: number;
};

/**
 * Reads a typed date (licence, deed, subdivision minutes) into its calendar day.
 *
 * How it works: Arabic digits become Latin; «هـ» / «h:» marks Hijri, «م» / «g:» Gregorian; the
 * digits are read as yyyy-mm-dd, yyyy/mm/dd or dd/mm/yyyy (the day comes first when the year is
 * last, as the inspector's date field stores it: «10/05/2015 م»). An unmarked year between 1300
 * and 1599 is Hijri.
 *
 * Edge cases: a day that does not exist in its calendar (30/02/2020, 30 Sha'ban 1445) and a
 * triplet whose year cannot be told (01/02/03) give null. Split out of parseLicenseDateForAge
 * (2026-11-04) so the report can print these dates as yyyy/mm/dd without converting them.
 */
export function parseReportCalendarDay(
  raw: string | null | undefined,
): ReportCalendarDay | null {
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
    return isValidHijriDate(year, month, day) ? { kind: "hijri", year, month, day } : null;
  }
  return isValidGregorianDate(year, month, day) ? { kind: "gregorian", year, month, day } : null;
}

/** Parse inspector license date (Hijri or Gregorian) to a local noon Date. */
export function parseLicenseDateForAge(
  raw: string | null | undefined,
): Date | null {
  const parsed = parseReportCalendarDay(raw);
  if (!parsed) return null;
  if (parsed.kind === "hijri") {
    const g = hijriToGregorian(parsed.year, parsed.month, parsed.day);
    if (!g) return null;
    return new Date(g.year, g.month - 1, g.day, 12, 0, 0, 0);
  }
  return new Date(parsed.year, parsed.month - 1, parsed.day, 12, 0, 0, 0);
}

/**
 * A typed date as the report prints every date: yyyy/mm/dd.
 *
 * How it works: a plain ISO date goes through the shared `ymd`; any other typed date is read by
 * parseReportCalendarDay — a Gregorian day prints «2015/05/10», a Hijri day keeps its calendar and
 * prints «1441/03/15 هـ» (the shared formatHijriDate, year first).
 *
 * Edge cases: blank → ""; text that is not a date (a note, a half-typed value) prints as typed.
 * Fixed 2026-11-04: the deed date printed «2025-03-15», the subdivision minutes «2024-06-10» and
 * the licence «10/05/2015 م» beside report dates printed as 2026/11/02.
 */
export function formatReportCalendarDate(raw: string | null | undefined): string {
  const text = (raw ?? "").trim();
  if (!text) return "";
  if (/^\d{4}-\d{2}-\d{2}$/.test(text)) return ymd(text);
  const parsed = parseReportCalendarDay(text);
  if (!parsed) return text;
  if (parsed.kind === "hijri") return formatHijriDate(parsed, { order: "ymd" });
  return `${parsed.year}/${pad2(parsed.month)}/${pad2(parsed.day)}`;
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

/**
 * Same wording for a free-text age: whole numbers are reworded, anything else is kept.
 *
 * How it works: Arabic digits are read as Latin first, so «١٢» prints «12 سنة» like «12».
 * Edge cases: blank stays blank; «12.5» or «حوالي 10» print as typed. Arabic digits used to
 * print untouched (2026-11-04).
 */
export function formatReportAgeText(raw: string): string {
  const text = toLatinDigits(raw.trim());
  return /^\d+$/.test(text) ? formatReportPropertyAgeYears(Number(text)) : raw.trim();
}

/**
 * «عمر البناء» / «عمر العقار» in section 7: the age the inspector entered on site — the same figure
 * the cost approach takes as the effective age — else the age worked out from the building licence.
 *
 * How it works: the inspector's `propertyAgeYears` through formatReportAgeText; when it is blank,
 * reportPropertyAgeYearsFromLicense (years since the licence − 2).
 * Edge cases: neither known → "". Fixed 2026-11-04: the cell used only the licence and printed
 * «—» (no licence date) or a wrong figure (9 for an inspector's 12).
 */
export function reportBuildingAgeLabel(
  inspectorAgeYears: string | null | undefined,
  licenseDateRaw: string | null | undefined,
  now: Date = new Date(),
): string {
  const typed = (inspectorAgeYears ?? "").trim();
  if (typed) return formatReportAgeText(typed);
  const fromLicense = reportPropertyAgeYearsFromLicense(licenseDateRaw, now);
  return fromLicense == null ? "" : formatReportPropertyAgeYears(fromLicense);
}
