import { toArabicDigits } from "../lib/arabic-digits";
import { pad2 } from "./date";

/**
 * Umm al-Qura Hijri ⇄ Gregorian — the one place the app reads the Hijri calendar.
 * Conversion goes through Intl (`islamic-umalqura`) on a local-noon anchor, so a
 * timestamp near midnight or a DST edge never lands on the neighbouring day.
 */

/** A calendar day, month 1-12. */
type CalendarDate = { year: number; month: number; day: number };

/** Hijri years the app accepts (≈ 1882–2174 م). */
const HIJRI_MIN_YEAR = 1300;
const HIJRI_MAX_YEAR = 1600;

const ISO_DAY = /^(\d{4})-(\d{2})-(\d{2})/;
/** Mean lengths used only to guess where to look; Intl has the last word. */
const MEAN_HIJRI_YEAR_DAYS = 354.367;
const MEAN_HIJRI_MONTH_DAYS = 29.5306;

let umalqura: Intl.DateTimeFormat | null | undefined;

function umalquraFormatter(): Intl.DateTimeFormat | null {
  if (umalqura !== undefined) return umalqura;
  try {
    umalqura = new Intl.DateTimeFormat("en-u-ca-islamic-umalqura-nu-latn", {
      year: "numeric",
      month: "numeric",
      day: "numeric",
    });
  } catch {
    umalqura = null;
  }
  return umalqura;
}

function localNoon(year: number, month: number, day: number): Date {
  const d = new Date(2000, 0, 1, 12, 0, 0, 0);
  d.setFullYear(year, month - 1, day);
  return d;
}

/** True when the Gregorian day exists (30/02/2020 → false). */
export function isValidGregorianDate(year: number, month: number, day: number): boolean {
  if (![year, month, day].every(Number.isInteger)) return false;
  if (month < 1 || month > 12 || day < 1 || day > 31) return false;
  const d = localNoon(year, month, day);
  return d.getFullYear() === year && d.getMonth() === month - 1 && d.getDate() === day;
}

function gregorianDay(input: Date | string | CalendarDate): CalendarDate | null {
  if (input instanceof Date) {
    if (Number.isNaN(input.getTime())) return null;
    return { year: input.getFullYear(), month: input.getMonth() + 1, day: input.getDate() };
  }
  if (typeof input === "string") {
    const m = ISO_DAY.exec(input.trim());
    if (!m) return null;
    const parts = { year: Number(m[1]), month: Number(m[2]), day: Number(m[3]) };
    return isValidGregorianDate(parts.year, parts.month, parts.day) ? parts : null;
  }
  return isValidGregorianDate(input.year, input.month, input.day) ? input : null;
}

/**
 * Gregorian day → Umm al-Qura Hijri. A `Date` counts by its local calendar day; a string is read
 * as `YYYY-MM-DD` (any time part ignored). Impossible / unparseable input → null.
 */
export function gregorianToHijri(input: Date | string | CalendarDate): CalendarDate | null {
  const g = gregorianDay(input);
  const fmt = umalquraFormatter();
  if (!g || !fmt) return null;
  const parts = fmt.formatToParts(localNoon(g.year, g.month, g.day));
  const year = Number(parts.find((p) => p.type === "year")?.value);
  const month = Number(parts.find((p) => p.type === "month")?.value);
  const day = Number(parts.find((p) => p.type === "day")?.value);
  if (!year || !month || !day) return null;
  return { year, month, day };
}

function approxHijriDayNumber(h: CalendarDate): number {
  return (
    Math.floor((h.year - 1) * MEAN_HIJRI_YEAR_DAYS) +
    Math.floor((h.month - 1) * MEAN_HIJRI_MONTH_DAYS) +
    h.day
  );
}

function sameDay(a: CalendarDate | null, b: CalendarDate): boolean {
  return a != null && a.year === b.year && a.month === b.month && a.day === b.day;
}

function asCalendarDate(d: Date): CalendarDate {
  return { year: d.getFullYear(), month: d.getMonth() + 1, day: d.getDate() };
}

/**
 * Umm al-Qura Hijri → Gregorian. Null when the Hijri day does not exist (30 in a 29-day month),
 * is out of range (years 1300–1600), or Intl lacks the calendar.
 */
export function hijriToGregorian(year: number, month: number, day: number): CalendarDate | null {
  if (![year, month, day].every(Number.isInteger)) return null;
  if (year < HIJRI_MIN_YEAR || year > HIJRI_MAX_YEAR) return null;
  if (month < 1 || month > 12 || day < 1 || day > 30) return null;
  if (!umalquraFormatter()) return null;
  const target = { year, month, day };
  // 1 Muharram 1 AH = 19 July 622 (proleptic Gregorian); walk from the mean-calendar guess.
  const guess = localNoon(622, 7, 19 + approxHijriDayNumber(target) - 1);
  for (let i = 0; i < 4; i += 1) {
    const h = gregorianToHijri(guess);
    if (!h) return null;
    const delta = approxHijriDayNumber(target) - approxHijriDayNumber(h);
    if (delta === 0) break;
    guess.setDate(guess.getDate() + delta);
  }
  for (const offset of [0, -1, 1, -2, 2, -3, 3]) {
    const candidate = new Date(guess.getTime());
    candidate.setDate(candidate.getDate() + offset);
    if (sameDay(gregorianToHijri(candidate), target)) return asCalendarDate(candidate);
  }
  return null;
}

/** {@link hijriToGregorian} as `YYYY-MM-DD`. */
export function hijriToGregorianIso(year: number, month: number, day: number): string | null {
  const g = hijriToGregorian(year, month, day);
  return g ? `${g.year}-${pad2(g.month)}-${pad2(g.day)}` : null;
}

/** True when the Umm al-Qura day exists (in the accepted year range). */
export function isValidHijriDate(year: number, month: number, day: number): boolean {
  return hijriToGregorian(year, month, day) != null;
}

type HijriFormatOptions = {
  /** "latin" → 16/04/1448, "arabic" → ١٦/٠٤/١٤٤٨. Default "latin". */
  digits?: "latin" | "arabic";
  /** "dmy" → day/month/year (date picker), "ymd" → year/month/day (official letters). Default "dmy". */
  order?: "dmy" | "ymd";
  /** Zero-pad day and month to two digits. Default true. */
  pad?: boolean;
  /** Append « هـ». Default true. */
  suffix?: boolean;
};

/** Official letters (site-location acknowledgment, internal delegation): «1448/4/16 هـ». */
export const HIJRI_LETTER_FORMAT: HijriFormatOptions = {
  digits: "latin",
  order: "ymd",
  pad: false,
};

/** Hijri day as text — e.g. «16/04/1448 هـ» (defaults) or «١٤٤٨/٤/١٦ هـ» (arabic, ymd, no pad). */
export function formatHijriDate(parts: CalendarDate, options: HijriFormatOptions = {}): string {
  const { digits = "latin", order = "dmy", pad = true, suffix = true } = options;
  const d = pad ? pad2(parts.day) : String(parts.day);
  const m = pad ? pad2(parts.month) : String(parts.month);
  const body = order === "ymd" ? `${parts.year}/${m}/${d}` : `${d}/${m}/${parts.year}`;
  const text = suffix ? `${body} هـ` : body;
  return digits === "arabic" ? toArabicDigits(text) : text;
}

/** Gregorian day → formatted Hijri, or `fallback` when it cannot be converted. */
export function formatGregorianAsHijri(
  input: Date | string | CalendarDate,
  options: HijriFormatOptions = {},
  fallback = "—",
): string {
  const h = gregorianToHijri(input);
  return h ? formatHijriDate(h, options) : fallback;
}

/** Arabic Hijri month name (e.g. «ربيع الآخر») — null when the month cannot be resolved. */
export function hijriMonthNameAr(year: number, month: number): string | null {
  const g = hijriToGregorian(year, month, 15);
  if (!g) return null;
  try {
    return new Intl.DateTimeFormat("ar-SA-u-ca-islamic-umalqura", { month: "long" }).format(
      localNoon(g.year, g.month, g.day),
    );
  } catch {
    return null;
  }
}
