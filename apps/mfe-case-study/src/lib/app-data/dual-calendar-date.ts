import { pad2 } from "@platform/app-shared/format/date";
import {
  formatHijriDate,
  gregorianToHijri,
  hijriMonthNameAr,
  hijriToGregorianIso,
  isValidGregorianDate,
} from "@platform/app-shared/format/hijri";
import { toLatinDigits } from "@platform/app-shared/lib/arabic-digits";

export type DualCalendarKind = "gregorian" | "hijri";

export type DualCalendarDateParts = {
  kind: DualCalendarKind;
  year: number;
  month: number;
  day: number;
};

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
  const trimmed = toLatinDigits(raw.trim());
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
  if (parts.kind === "hijri") return formatHijriDate(parts);
  return `${pad2(parts.day)}/${pad2(parts.month)}/${parts.year} م`;
}

function gregorianIsoFromParts(
  year: number,
  month: number,
  day: number,
): string | null {
  if (year < 1900 || !isValidGregorianDate(year, month, day)) return null;
  return `${year}-${pad2(month)}-${pad2(day)}`;
}

function dualCalendarGregorianIso(parts: DualCalendarDateParts): string | null {
  if (parts.kind === "gregorian") {
    return gregorianIsoFromParts(parts.year, parts.month, parts.day);
  }
  return hijriToGregorianIso(parts.year, parts.month, parts.day);
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
  const hijri = gregorianToHijri(iso);
  return hijri ? { kind: "hijri", ...hijri } : null;
}

type CalendarDayCell = {
  day: number;
  parts: DualCalendarDateParts;
};

function gregorianWeekdaySaturdayFirst(iso: string): number {
  const date = new Date(`${iso}T12:00:00`);
  if (Number.isNaN(date.getTime())) return 0;
  return (date.getDay() + 1) % 7;
}

function daysInGregorianMonth(year: number, month: number): number {
  return new Date(year, month, 0).getDate();
}

export function buildGregorianMonthGrid(
  viewYear: number,
  viewMonth: number,
): (CalendarDayCell | null)[] {
  const firstIso = gregorianIsoFromParts(viewYear, viewMonth, 1);
  if (!firstIso) return [];
  const leading = gregorianWeekdaySaturdayFirst(firstIso);
  const daysInMonth = daysInGregorianMonth(viewYear, viewMonth);
  const cells: (CalendarDayCell | null)[] = Array.from({ length: leading }, () => null);
  for (let day = 1; day <= daysInMonth; day += 1) {
    cells.push({
      day,
      parts: { kind: "gregorian", year: viewYear, month: viewMonth, day },
    });
  }
  while (cells.length % 7 !== 0) cells.push(null);
  return cells;
}

export function buildHijriMonthGrid(
  viewYear: number,
  viewMonth: number,
): (CalendarDayCell | null)[] {
  const monthDays: CalendarDayCell[] = [];
  const startIso = hijriToGregorianIso(viewYear, viewMonth, 1);
  if (!startIso) return [];
  let cursor = new Date(`${startIso}T12:00:00`);
  for (let i = 0; i < 31; i += 1) {
    const hijri = gregorianToHijri(cursor);
    if (!hijri || hijri.year !== viewYear || hijri.month !== viewMonth) break;
    monthDays.push({
      day: hijri.day,
      parts: { kind: "hijri", year: viewYear, month: viewMonth, day: hijri.day },
    });
    cursor = new Date(cursor.getTime() + 86_400_000);
  }
  if (monthDays.length === 0) return [];
  const firstIso = dualCalendarGregorianIso(monthDays[0].parts);
  if (!firstIso) return monthDays;
  const leading = gregorianWeekdaySaturdayFirst(firstIso);
  const cells: (CalendarDayCell | null)[] = Array.from({ length: leading }, () => null);
  cells.push(...monthDays);
  while (cells.length % 7 !== 0) cells.push(null);
  return cells;
}

export function stepDualCalendarMonth(
  _kind: DualCalendarKind,
  year: number,
  month: number,
  delta: number,
): { year: number; month: number } {
  let nextMonth = month + delta;
  let nextYear = year;
  while (nextMonth < 1) {
    nextMonth += 12;
    nextYear -= 1;
  }
  while (nextMonth > 12) {
    nextMonth -= 12;
    nextYear += 1;
  }
  return { year: nextYear, month: nextMonth };
}

export function listDualCalendarYears(kind: DualCalendarKind): number[] {
  const current = todayDualCalendarParts(kind).year;
  if (kind === "hijri") {
    const max = Math.min(1600, current + 5);
    const min = 1300;
    return Array.from({ length: max - min + 1 }, (_, index) => max - index);
  }
  const max = current + 10;
  const min = 1900;
  return Array.from({ length: max - min + 1 }, (_, index) => max - index);
}

export function dualCalendarMonthLabel(
  kind: DualCalendarKind,
  year: number,
  month: number,
): string {
  if (kind === "gregorian") {
    return new Intl.DateTimeFormat("ar-SA-u-nu-latn", {
      month: "long",
      calendar: "gregory",
    }).format(new Date(year, month - 1, 15));
  }
  return hijriMonthNameAr(year, month) ?? String(month);
}

export function dualCalendarYearLabel(
  kind: DualCalendarKind,
  year: number,
): string {
  return kind === "hijri" ? `${year} هـ` : `${year} م`;
}

export function normalizeDualCalendarView(
  calendar: DualCalendarKind,
  year: number,
  month: number,
  selected: DualCalendarDateParts | null,
): { year: number; month: number } {
  const fallback = selected
    ? convertDualCalendarDate(selected, calendar) ?? todayDualCalendarParts(calendar)
    : todayDualCalendarParts(calendar);

  const monthClamped = Math.min(12, Math.max(1, month));
  const grid =
    calendar === "gregorian"
      ? buildGregorianMonthGrid(year, monthClamped)
      : buildHijriMonthGrid(year, monthClamped);

  if (grid.some(Boolean)) {
    return { year, month: monthClamped };
  }

  return { year: fallback.year, month: fallback.month };
}

export function dualCalendarViewAnchor(
  calendar: DualCalendarKind,
  selected: DualCalendarDateParts | null,
): DualCalendarDateParts {
  if (selected) {
    const converted = convertDualCalendarDate(selected, calendar);
    if (converted) return converted;
  }
  return todayDualCalendarParts(calendar);
}

export function todayDualCalendarParts(kind: DualCalendarKind): DualCalendarDateParts {
  const now = new Date();
  if (kind === "gregorian") {
    return {
      kind: "gregorian",
      year: now.getFullYear(),
      month: now.getMonth() + 1,
      day: now.getDate(),
    };
  }
  const hijri = gregorianToHijri(now);
  if (!hijri) return { kind: "hijri", year: 1446, month: 1, day: 1 };
  return { kind: "hijri", ...hijri };
}

export function sameDualCalendarDate(
  a: DualCalendarDateParts | null | undefined,
  b: DualCalendarDateParts | null | undefined,
): boolean {
  if (!a || !b) return false;
  if (a.kind !== b.kind) return false;
  return a.year === b.year && a.month === b.month && a.day === b.day;
}
