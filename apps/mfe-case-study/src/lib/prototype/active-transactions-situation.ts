const RIYADH_TZ = "Asia/Riyadh";

export const RIYADH_TIME_ZONE = RIYADH_TZ;

function calendarDayInRiyadh(date: Date): string {
  return date.toLocaleDateString("en-CA", { timeZone: RIYADH_TZ });
}

/** `DD/MM/YYYY · HH:mm` in Saudi Arabia (Asia/Riyadh), Western digits. */
export function formatInstantInRiyadh(iso: string): string {
  const trimmed = iso.trim();
  if (!trimmed) return "—";

  if (/^\d{4}-\d{2}-\d{2}$/.test(trimmed)) {
    const [y, m, d] = trimmed.split("-").map(Number);
    const dd = String(d).padStart(2, "0");
    const mm = String(m).padStart(2, "0");
    return `${dd}/${mm}/${y}`;
  }

  const parsed = new Date(trimmed);
  if (Number.isNaN(parsed.getTime())) return trimmed;

  const parts = new Intl.DateTimeFormat("en-GB", {
    timeZone: RIYADH_TZ,
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  }).formatToParts(parsed);

  const pick = (type: Intl.DateTimeFormatPartTypes) =>
    parts.find((p) => p.type === type)?.value ?? "";

  const datePart = `${pick("day")}/${pick("month")}/${pick("year")}`;
  if (!trimmed.includes("T")) return datePart;

  return `${datePart} · ${pick("hour")}:${pick("minute")}`;
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
