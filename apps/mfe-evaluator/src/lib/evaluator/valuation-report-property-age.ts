/**
 * Report-only property age: years since building-license issue date, minus 2.
 * Does not write back to the inspector workspace — print/preview cells only.
 */

const LICENSE_AGE_OFFSET_YEARS = 2;

function normalizeDigits(raw: string): string {
  let out = "";
  for (const ch of raw) {
    if (ch >= "٠" && ch <= "٩") {
      out += String.fromCharCode(48 + (ch.charCodeAt(0) - "٠".charCodeAt(0)));
      continue;
    }
    if (ch >= "۰" && ch <= "۹") {
      out += String.fromCharCode(48 + (ch.charCodeAt(0) - "۰".charCodeAt(0)));
      continue;
    }
    out += ch;
  }
  return out;
}

function pad2(n: number): string {
  return n < 10 ? `0${n}` : String(n);
}

function hijriPartsFromGregorian(date: Date): {
  year: number;
  month: number;
  day: number;
} | null {
  if (Number.isNaN(date.getTime())) return null;
  try {
    const parts = new Intl.DateTimeFormat("en-u-ca-islamic-umalqura", {
      year: "numeric",
      month: "numeric",
      day: "numeric",
    }).formatToParts(date);
    const year = Number(parts.find((p) => p.type === "year")?.value);
    const month = Number(parts.find((p) => p.type === "month")?.value);
    const day = Number(parts.find((p) => p.type === "day")?.value);
    if (!year || !month || !day) return null;
    return { year, month, day };
  } catch {
    return null;
  }
}

function hijriToGregorianIso(year: number, month: number, day: number): string | null {
  if (year < 1300 || year > 1600 || month < 1 || month > 12 || day < 1 || day > 30) {
    return null;
  }
  const approxGregorianYear = Math.floor((year - 1) * 0.970_224 + 622.539);
  const start = new Date(approxGregorianYear - 1, 0, 1);
  const end = new Date(approxGregorianYear + 1, 11, 31);
  for (let t = start.getTime(); t <= end.getTime(); t += 86_400_000) {
    const candidate = new Date(t);
    const hijri = hijriPartsFromGregorian(candidate);
    if (
      hijri?.year === year &&
      hijri.month === month &&
      hijri.day === day
    ) {
      return `${candidate.getFullYear()}-${pad2(candidate.getMonth() + 1)}-${pad2(candidate.getDate())}`;
    }
  }
  return null;
}

/** Parse inspector license date (Hijri or Gregorian) to a local noon Date. */
export function parseLicenseDateForAge(
  raw: string | null | undefined,
): Date | null {
  const trimmed = normalizeDigits((raw ?? "").trim());
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
    const gIso = hijriToGregorianIso(year, month, day);
    if (!gIso) return null;
    const [gy, gm, gd] = gIso.split("-").map(Number);
    return new Date(gy!, gm! - 1, gd!, 12, 0, 0, 0);
  }

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

export function formatReportPropertyAgeYears(years: number): string {
  return `${years} سنوات`;
}
