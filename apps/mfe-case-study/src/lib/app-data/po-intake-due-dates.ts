/** PO intake — business-day due-date calculation from Infath receipt. */

const WORKDAY_START_HOUR = 8;
const WORKDAY_END_HOUR = 17;
const BUSINESS_DAYS_REQUIRED = 4;

export function isBusinessDay(d: Date): boolean {
  const day = d.getDay();
  return day >= 0 && day <= 4;
}

function isWithinBusinessHours(d: Date): boolean {
  const h = d.getHours();
  return h >= WORKDAY_START_HOUR && h < WORKDAY_END_HOUR;
}

function parseReceivedDateTime(receivedIso: string, time?: string): Date | null {
  if (!receivedIso) return null;
  const parts = receivedIso.split("-").map(Number);
  if (parts.length !== 3 || parts.some((n) => Number.isNaN(n))) return null;
  const [y, m, day] = parts;
  const t = time?.trim() || "10:00";
  const [hh, mm] = t.split(":").map(Number);
  const hour = Number.isFinite(hh) ? hh : 10;
  const minute = Number.isFinite(mm) ? mm : 0;
  const d = new Date(y, m - 1, day, hour, minute, 0);
  return Number.isNaN(d.getTime()) ? null : d;
}

function formatLocalIsoDate(d: Date): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

/** Start point: after-hours/holiday receipt → next business day (later). */
export function getEffectiveStartDate(received: Date): Date {
  if (isBusinessDay(received) && isWithinBusinessHours(received)) {
    const start = new Date(received);
    start.setHours(0, 0, 0, 0);
    return start;
  }
  const cursor = new Date(received);
  if (!isBusinessDay(cursor) || received.getHours() >= WORKDAY_END_HOUR) {
    cursor.setDate(cursor.getDate() + 1);
  }
  while (!isBusinessDay(cursor)) {
    cursor.setDate(cursor.getDate() + 1);
  }
  cursor.setHours(0, 0, 0, 0);
  return cursor;
}

/** 4 business days (Sun–Thu) — receipt day counts as day 1 if before 17:00; after 17:00 it does not. */
function addBusinessDaysFromEffectiveStart(start: Date, count: number): Date {
  const d = new Date(start);
  let remaining = count;
  while (remaining > 0) {
    if (isBusinessDay(d)) remaining -= 1;
    if (remaining > 0) d.setDate(d.getDate() + 1);
  }
  return d;
}

/** Business days from Infath receipt date/time (4 execution/estates, 10 private). */
export function computeBusinessDueDate(
  receivedIso: string,
  receivedTime?: string,
  businessDays: number = BUSINESS_DAYS_REQUIRED,
): string {
  const received = parseReceivedDateTime(receivedIso, receivedTime);
  if (!received) return "";
  const effective = getEffectiveStartDate(received);
  const days =
    Number.isFinite(businessDays) && businessDays >= 1
      ? Math.floor(businessDays)
      : BUSINESS_DAYS_REQUIRED;
  const due = addBusinessDaysFromEffectiveStart(effective, days);
  return formatLocalIsoDate(due);
}

/** SLA deadline on the due business day — end of workday (17:00 local). */
export function dueDateToDeadline(dueIso: string): Date | null {
  const trimmed = dueIso.trim();
  if (!trimmed) return null;
  const parts = trimmed.split("-").map(Number);
  if (parts.length !== 3 || parts.some((n) => Number.isNaN(n))) return null;
  const [y, m, day] = parts;
  const d = new Date(y, m - 1, day, WORKDAY_END_HOUR, 0, 0, 0);
  return Number.isNaN(d.getTime()) ? null : d;
}

/** Parse a Y-M-D (optionally with time) as local midnight — ISO date-only is UTC. */
export function parseLocalCalendarDate(iso: string): Date | null {
  const match = iso.trim().match(/^(\d{4})-(\d{2})-(\d{2})/);
  if (!match) return null;
  const y = Number(match[1]);
  const m = Number(match[2]);
  const day = Number(match[3]);
  const d = new Date(y, m - 1, day);
  return Number.isNaN(d.getTime()) ? null : d;
}

export function isPastDue(dueIso: string, now: Date = new Date()): boolean {
  if (!dueIso) return false;
  const due = parseLocalCalendarDate(dueIso);
  if (!due) return false;
  const today = new Date(now);
  today.setHours(0, 0, 0, 0);
  due.setHours(0, 0, 0, 0);
  return due.getTime() < today.getTime();
}

/** Due today through 7 calendar days ahead, inclusive. */
export function isDueSoon(iso: string, now: Date = new Date()): boolean {
  if (!iso) return false;
  const due = parseLocalCalendarDate(iso);
  if (!due) return false;
  const start = new Date(now);
  start.setHours(0, 0, 0, 0);
  due.setHours(0, 0, 0, 0);
  const diffDays = Math.round(
    (due.getTime() - start.getTime()) / 86_400_000,
  );
  return diffDays >= 0 && diffDays <= 7;
}
