const MINUTE_MS = 60_000;
const HOUR_MS = 3_600_000;
const DAY_MS = 86_400_000;

/** Arabic relative time for notification timestamps. */
export function formatNotificationTime(iso: string, now = Date.now()): string {
  const then = Date.parse(iso);
  if (Number.isNaN(then)) return "";

  const diff = Math.max(0, now - then);
  if (diff < MINUTE_MS) return "الآن";
  if (diff < HOUR_MS) {
    const minutes = Math.floor(diff / MINUTE_MS);
    return minutes === 1 ? "منذ دقيقة" : `منذ ${minutes} دقائق`;
  }
  if (diff < DAY_MS) {
    const hours = Math.floor(diff / HOUR_MS);
    return hours === 1 ? "منذ ساعة" : `منذ ${hours} ساعات`;
  }
  const days = Math.floor(diff / DAY_MS);
  return days === 1 ? "منذ يوم" : `منذ ${days} أيام`;
}
