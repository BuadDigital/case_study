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

export function isPastDue(dueIso: string): boolean {
  if (!dueIso) return false;
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const due = new Date(`${dueIso}T12:00:00`);
  return due < today;
}
