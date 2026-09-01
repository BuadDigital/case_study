import { pad2 } from "@platform/app-shared/format/date";

function normalizeDateDigits(raw: string): string {
  let out = "";
  for (const ch of raw) {
    if (ch >= "٠" && ch <= "٩") {
      out += String.fromCharCode("0".charCodeAt(0) + (ch.charCodeAt(0) - "٠".charCodeAt(0)));
      continue;
    }
    if (ch >= "۰" && ch <= "۹") {
      out += String.fromCharCode("0".charCodeAt(0) + (ch.charCodeAt(0) - "۰".charCodeAt(0)));
      continue;
    }
    out += ch;
  }
  return out;
}

export type DualCalendarKind = "gregorian" | "hijri";

export type DualCalendarDateParts = {
  kind: DualCalendarKind;
  year: number;
  month: number;
  day: number;
};

function hijriPartsFromGregorianDate(date: Date): Omit<DualCalendarDateParts, "kind"> | null {
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

export function gregorianIsoToHijriParts(iso: string): DualCalendarDateParts | null {
  const day = iso.trim().slice(0, 10);
  if (!/^\d{4}-\d{2}-\d{2}$/.test(day)) return null;
  const parts = hijriPartsFromGregorianDate(new Date(`${day}T12:00:00`));
  if (!parts) return null;
  return { kind: "hijri", ...parts };
}

export function hijriPartsToGregorianIso(
  year: number,
  month: number,
  day: number,
): string | null {
  if (year < 1300 || year > 1600 || month < 1 || month > 12 || day < 1 || day > 30) {
    return null;
  }
  const approxYear = year - 579;
  const start = new Date(approxYear - 1, 0, 1);
  const end = new Date(approxYear + 1, 11, 31);
  for (let t = start.getTime(); t <= end.getTime(); t += 86_400_000) {
    const candidate = new Date(t);
    const hijri = hijriPartsFromGregorianDate(candidate);
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

function parseSlashTriplet(
  a: number,
  b: number,
  c: number,
): DualCalendarDateParts | null {
  if (a >= 1300 && a <= 1600 && b >= 1 && b <= 12 && c >= 1 && c <= 30) {
    return { kind: "hijri", year: a, month: b, day: c };
  }
  if (c >= 1300 && c <= 1600 && b >= 1 && b <= 12 && a >= 1 && a <= 31) {
    return { kind: "hijri", year: c, month: b, day: a };
  }
  if (a >= 1900 && b >= 1 && b <= 12 && c >= 1 && c <= 31) {
    return { kind: "gregorian", year: a, month: b, day: c };
  }
  if (c >= 1900 && b >= 1 && b <= 12 && a >= 1 && a <= 31) {
    return { kind: "gregorian", year: c, month: b, day: a };
  }
  return null;
}

export function parseDualCalendarDate(raw: string): DualCalendarDateParts | null {
  const trimmed = normalizeDateDigits(raw.trim());
  if (!trimmed) return null;

  const hijriMarked =
    /هـ/.test(trimmed) ||
    /\bh\b/i.test(trimmed.replace(/\s+/g, "")) ||
    trimmed.startsWith("h:");
  const gregorianMarked = /م/.test(trimmed) || trimmed.startsWith("g:");

  const withoutMarker = trimmed
    .replace(/^h:/i, "")
    .replace(/^g:/i, "")
    .replace(/[^\d/.\-]/g, "")
    .trim();

  const isoMatch = /^(\d{4})-(\d{1,2})-(\d{1,2})$/.exec(withoutMarker);
  if (isoMatch) {
    const year = Number(isoMatch[1]);
    const month = Number(isoMatch[2]);
    const day = Number(isoMatch[3]);
    if (hijriMarked || (!gregorianMarked && year >= 1300 && year < 1600)) {
      return { kind: "hijri", year, month, day };
    }
    return { kind: "gregorian", year, month, day };
  }

  const slashMatch = /^(\d{1,4})[/.\-](\d{1,2})[/.\-](\d{1,4})$/.exec(withoutMarker);
  if (slashMatch) {
    const parsed = parseSlashTriplet(
      Number(slashMatch[1]),
      Number(slashMatch[2]),
      Number(slashMatch[3]),
    );
    if (!parsed) return null;
    if (hijriMarked) return { ...parsed, kind: "hijri" };
    if (gregorianMarked) return { ...parsed, kind: "gregorian" };
    return parsed;
  }

  return null;
}

export function formatDualCalendarDate(parts: DualCalendarDateParts): string {
  const body = `${pad2(parts.day)}/${pad2(parts.month)}/${parts.year}`;
  return parts.kind === "hijri" ? `${body} هـ` : `${body} م`;
}

export function gregorianIsoFromParts(
  year: number,
  month: number,
  day: number,
): string | null {
  if (year < 1900 || month < 1 || month > 12 || day < 1 || day > 31) return null;
  const dt = new Date(year, month - 1, day);
  if (
    dt.getFullYear() !== year ||
    dt.getMonth() !== month - 1 ||
    dt.getDate() !== day
  ) {
    return null;
  }
  return `${year}-${pad2(month)}-${pad2(day)}`;
}

export function dualCalendarGregorianIso(parts: DualCalendarDateParts): string | null {
  if (parts.kind === "gregorian") {
    return gregorianIsoFromParts(parts.year, parts.month, parts.day);
  }
  return hijriPartsToGregorianIso(parts.year, parts.month, parts.day);
}

export function convertDualCalendarDate(
  parts: DualCalendarDateParts,
  target: DualCalendarKind,
): DualCalendarDateParts | null {
  if (parts.kind === target) return parts;
  const iso = dualCalendarGregorianIso(parts);
  if (!iso) return null;
  if (target === "gregorian") {
    const [year, month, day] = iso.split("-").map(Number);
    return { kind: "gregorian", year, month, day };
  }
  return gregorianIsoToHijriParts(iso);
}

export function detectDualCalendarKind(raw: string): DualCalendarKind {
  return parseDualCalendarDate(raw)?.kind ?? "gregorian";
}
