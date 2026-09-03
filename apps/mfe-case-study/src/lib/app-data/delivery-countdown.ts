import { pad2 } from "@platform/app-shared/format/date";
import { dueDateToDeadline } from "./po-intake-data";
import { resolveRemainingTime } from "./my-task-row";

const WEEKDAY_AR = [
  "الأحد",
  "الإثنين",
  "الثلاثاء",
  "الأربعاء",
  "الخميس",
  "الجمعة",
  "السبت",
] as const;

function daysWord(days: number): string {
  if (days === 1) return "يوم";
  if (days === 2) return "يومان";
  if (days >= 3 && days <= 10) return "أيام";
  return "يوماً";
}

/**
 * Live delivery countdown label per countdown-remaining-to-delivery.md
 * Example: `Monday · 4 days 23:57:04`
 */
export function formatLiveDeliveryCountdown(
  dueIso: string,
  now: Date = new Date(),
): string {
  const due = dueDateToDeadline(dueIso);
  if (!due) return "—";

  const weekday = WEEKDAY_AR[due.getDay()] ?? "";
  const state = resolveRemainingTime(dueIso, now);

  if (state.status === "overdue") {
    return "متأخر";
  }
  if (state.status === "missing") {
    return "—";
  }

  const time = `${pad2(state.hours)}:${pad2(state.minutes)}:${pad2(state.seconds)}`;
  return `${weekday} · ${state.days} ${daysWord(state.days)} ${time}`;
}

/** Within 7 days of deadline, or overdue → warn color. */
export function isDeliveryCountdownUrgent(
  dueIso: string,
  now: Date = new Date(),
): boolean {
  const state = resolveRemainingTime(dueIso, now);
  if (state.status === "overdue") return true;
  if (state.status !== "active") return false;
  return state.days < 7;
}
