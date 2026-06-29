const RIYADH_TZ = "Asia/Riyadh";

function calendarDayInRiyadh(date: Date): string {
  return date.toLocaleDateString("en-CA", { timeZone: RIYADH_TZ });
}

/** Instant (ISO) falls on today's calendar day in Saudi Arabia. */
export function isInstantTodayInRiyadh(iso: string, now = new Date()): boolean {
  const parsed = new Date(iso);
  if (Number.isNaN(parsed.getTime())) return false;
  return calendarDayInRiyadh(parsed) === calendarDayInRiyadh(now);
}

/** Date-only string (YYYY-MM-DD) equals today in Saudi Arabia. */
export function isDateOnlyTodayInRiyadh(
  dateOnly: string,
  now = new Date(),
): boolean {
  const trimmed = dateOnly.trim();
  if (!/^\d{4}-\d{2}-\d{2}$/.test(trimmed)) return false;
  return trimmed === calendarDayInRiyadh(now);
}
