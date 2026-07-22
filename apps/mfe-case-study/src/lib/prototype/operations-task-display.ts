import type { OperationsTaskDto } from "@platform/api-client";
import type { InternalDelegationLetter } from "./internal-delegation-letters";
import { printInternalDelegationLetter } from "./internal-delegation-letter-html";
import type { DelegationAgentInfo } from "./internal-delegation-letters";

export const OPERATIONS_TASK_TYPE_LABELS: Record<string, string> = {
  court_visit: "زيارة محكمة",
  reshoot: "إعادة تصوير",
  field_visit: "زيارة ميدانية",
  inquiry: "استفسار",
  general: "مهمة عامة",
};

/** SVG path inner markup — matches Case Study.html TASK_TYPES.ico */
export const OPERATIONS_TASK_TYPE_ICON_PATHS: Record<string, string> = {
  court_visit:
    '<path d="M3 21h18M6 21V10M18 21V10M4 10h16L12 3z"/><path d="M9 21v-5h6v5"/>',
  reshoot:
    '<path d="M23 4v6h-6M1 20v-6h6"/><path d="M3.5 9a9 9 0 0 1 14.8-3.4L23 10M1 14l4.7 4.4A9 9 0 0 0 20.5 15"/>',
  field_visit:
    '<path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z"/><circle cx="12" cy="10" r="3"/>',
  inquiry:
    '<circle cx="12" cy="12" r="10"/><path d="M9.1 9a3 3 0 0 1 5.8 1c0 2-3 3-3 3"/><path d="M12 17h.01"/>',
  general:
    '<path d="M21 12v7a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11"/><path d="M9 11l3 3L22 4"/>',
};

export const OPERATIONS_TASK_STATUS_LABELS: Record<string, string> = {
  created: "منشأة",
  in_progress: "قيد التنفيذ",
  paused: "متوقفة مؤقتاً",
  completed: "منجزة",
  cancelled: "ملغاة",
};

export const OPERATIONS_TASK_PRIORITY_LABELS: Record<string, string> = {
  high: "عالية",
  medium: "متوسطة",
  low: "منخفضة",
};

export const OPERATIONS_TASK_PRIORITY_COLORS: Record<string, string> = {
  high: "#d9694f",
  medium: "#d9a441",
  low: "#8a8d96",
};

export const OPERATIONS_TASK_SCOPE_LABELS: Record<string, string> = {
  transaction: "معاملة",
  work_order: "أمر عمل",
  multi: "عدة معاملات",
  general: "عامة",
};

export const OPERATIONS_TASK_STATUS_COLORS: Record<string, string> = {
  created: "#102b4e",
  in_progress: "#d9a441",
  paused: "#8a8d96",
  completed: "#3f8f5f",
  cancelled: "#d9694f",
};

export const OPERATIONS_TASK_REMIND_LABELS: Record<string, string> = {
  high: "كل ساعة ضمن الدوام",
  medium: "مراجعة منتصف/نهاية الدوام",
  low: "مراجعة يوم العمل التالي",
};

const WH_START = 8;
const WH_END = 17;
const WH_NOON = 12;
const DAY_MS = 86_400_000;

function pad2(n: number): string {
  return String(n).padStart(2, "0");
}

function isWorkDay(d: Date): boolean {
  const g = d.getDay();
  return g >= 0 && g <= 4; // الأحد–الخميس
}

function atHour(d: Date, h: number): number {
  return new Date(d.getFullYear(), d.getMonth(), d.getDate(), h, 0, 0, 0).getTime();
}

function nextWorkDayNoon(ts: number): number {
  const d = new Date(ts);
  do {
    d.setDate(d.getDate() + 1);
  } while (!isWorkDay(d));
  return atHour(d, WH_NOON);
}

function nextCheckpoint(ts: number): number {
  const d = new Date(ts);
  const h = d.getHours() + d.getMinutes() / 60;
  if (isWorkDay(d)) {
    if (h < WH_NOON) return atHour(d, WH_NOON);
    if (h < WH_END) return atHour(d, WH_END);
  }
  return nextWorkDayNoon(ts);
}

function nextWorkHour(ts: number): number {
  const d = new Date(ts);
  if (isWorkDay(d) && d.getHours() < WH_START) return atHour(d, WH_START);
  const cand = new Date(
    d.getFullYear(),
    d.getMonth(),
    d.getDate(),
    d.getHours() + 1,
    0,
    0,
    0,
  );
  if (
    isWorkDay(cand) &&
    cand.getHours() >= WH_START &&
    cand.getHours() <= WH_END
  ) {
    return cand.getTime();
  }
  const nd = new Date(ts);
  do {
    nd.setDate(nd.getDate() + 1);
  } while (!isWorkDay(nd));
  return atHour(nd, WH_START);
}

/** Matches Case Study.html nextReminderTs — anchor = last reminder or now. */
export function nextReminderTs(priority: string, now = Date.now()): number {
  if (priority === "high") return nextWorkHour(now);
  if (priority === "low") return nextWorkDayNoon(now);
  return nextCheckpoint(now);
}

/** Next reminder using task's last reminder / createdAt as anchor (server parity). */
export function nextReminderTsForTask(
  task: Pick<OperationsTaskDto, "priority" | "reminders" | "createdAt">,
  now = Date.now(),
): number {
  let anchor = new Date(task.createdAt).getTime();
  if (Number.isNaN(anchor)) anchor = now;
  const reminders = task.reminders ?? [];
  if (reminders.length > 0) {
    const last = new Date(reminders[reminders.length - 1]!.at).getTime();
    if (!Number.isNaN(last)) anchor = last;
  }
  return nextReminderTs(task.priority, anchor);
}

/** Matches Case Study.html remindCountdownStr (plain text) */
export function remindCountdownLabel(priority: string, now = Date.now()): string {
  return formatCountdownDiff(nextReminderTs(priority, now) - now);
}

export function remindCountdownLabelForTask(
  task: Pick<OperationsTaskDto, "priority" | "reminders" | "createdAt">,
  now = Date.now(),
): string {
  return formatCountdownDiff(nextReminderTsForTask(task, now) - now);
}

function formatCountdownDiff(diffRaw: number): string {
  let diff = diffRaw;
  if (diff < 0) diff = 0;
  const d = Math.floor(diff / DAY_MS);
  const h = Math.floor((diff % DAY_MS) / 3_600_000);
  const m = Math.floor((diff % 3_600_000) / 60_000);
  const s = Math.floor((diff % 60_000) / 1000);
  const hms = `${pad2(h)}:${pad2(m)}:${pad2(s)}`;
  return d > 0 ? `${d} ي · ${hms}` : hms;
}

export function operationsTaskTypeLabel(type: string): string {
  return OPERATIONS_TASK_TYPE_LABELS[type] ?? type;
}

export function operationsTaskStatusLabel(status: string): string {
  return OPERATIONS_TASK_STATUS_LABELS[status] ?? status;
}

export function operationsTaskPriorityLabel(priority: string): string {
  return OPERATIONS_TASK_PRIORITY_LABELS[priority] ?? priority;
}

export function operationsTaskScopeLabel(scope: string): string {
  return OPERATIONS_TASK_SCOPE_LABELS[scope] ?? scope;
}

/** Matches Case Study.html taskScopeText */
export function operationsTaskLinkLabel(task: OperationsTaskDto): string {
  if (task.scope === "transaction") {
    return `صك ${task.deeds[0] ?? "—"}`;
  }
  if (task.scope === "work_order") {
    return task.poNumber?.trim() || "—";
  }
  if (task.scope === "multi") {
    return task.deeds.length ? `${task.deeds.length} صكوك` : "—";
  }
  if (task.scope === "general") return "غير مرتبطة";
  if (task.poNumber?.trim()) return task.poNumber.trim();
  if (task.deeds.length === 1) return task.deeds[0] ?? "—";
  if (task.deeds.length > 1) return `${task.deeds.length} صكوك`;
  return "—";
}

export function isActiveOperationsTaskStatus(status: string): boolean {
  return status === "created" || status === "in_progress";
}

export function isTerminalOperationsTaskStatus(status: string): boolean {
  return status === "completed" || status === "cancelled";
}

/** Creator-facing receipt indicator (دورة اسناد المهام §9). */
export function operationsTaskReceiptLabel(
  task: Pick<OperationsTaskDto, "receiptConfirmedAt" | "status">,
): "مؤكَّد" | "بانتظار المنفّذ" | null {
  if (isTerminalOperationsTaskStatus(task.status)) return null;
  return task.receiptConfirmedAt ? "مؤكَّد" : "بانتظار المنفّذ";
}

export type TaskCountdown = { txt: string; over: boolean };

export function formatTaskDueLabel(iso: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "—";
  try {
    const date = new Intl.DateTimeFormat("ar-SA", {
      year: "numeric",
      month: "short",
      day: "numeric",
    }).format(d);
    const time = new Intl.DateTimeFormat("ar-SA", {
      hour: "2-digit",
      minute: "2-digit",
      hour12: false,
    }).format(d);
    return `${date} · ${time}`;
  } catch {
    return d.toLocaleString("ar");
  }
}

export function taskCountdown(dueAt: string, status: string, now = Date.now()): TaskCountdown {
  if (status === "paused") return { txt: "متوقفة", over: false };
  if (isTerminalOperationsTaskStatus(status)) return { txt: "—", over: false };
  const due = new Date(dueAt).getTime();
  if (Number.isNaN(due)) return { txt: "—", over: false };
  let diff = due - now;
  const over = diff < 0;
  if (over) diff = -diff;
  const d = Math.floor(diff / 86_400_000);
  const h = Math.floor((diff % 86_400_000) / 3_600_000);
  const m = Math.floor((diff % 3_600_000) / 60_000);
  const s = Math.floor((diff % 60_000) / 1000);
  const hms = `${pad2(h)}:${pad2(m)}:${pad2(s)}`;
  const dayPart =
    d > 0
      ? `${d}${d === 1 ? " يوم" : d === 2 ? " يومان" : " أيام"} · `
      : "";
  return {
    txt: `${over ? "متأخرة · " : ""}${dayPart}${hms}`,
    over,
  };
}

/** @deprecated use taskCountdown */
export function dueCountdownLabel(dueAt: string, status: string): string {
  return taskCountdown(dueAt, status).txt;
}

export type TaskUrgency = { color: string; pulse: boolean } | null;

export function taskUrgency(
  dueAt: string,
  status: string,
  now = Date.now(),
): TaskUrgency {
  if (!isActiveOperationsTaskStatus(status)) return null;
  const due = new Date(dueAt).getTime();
  if (Number.isNaN(due)) return null;
  const diff = due - now;
  if (diff <= 2 * 3_600_000) return { color: "#d9694f", pulse: true };
  if (diff <= 8 * 3_600_000) return { color: "#d9a441", pulse: false };
  return { color: "#3f8f5f", pulse: false };
}

export const TASK_STEPPER_STEPS = [
  { id: "created", label: "منشأة" },
  { id: "in_progress", label: "قيد التنفيذ" },
  { id: "completed", label: "منجزة" },
] as const;

/** Matches HTML: only created / in_progress / completed map; paused has no active step. */
export function taskStepperIndex(status: string): number | null {
  if (status === "created") return 0;
  if (status === "in_progress") return 1;
  if (status === "completed") return 2;
  return null;
}

/** طباعة خطاب التفويض من snapshot المهمة (court_visit). */
export function printOperationsTaskDelegationLetter(
  task: OperationsTaskDto,
  agent?: DelegationAgentInfo,
  options?: { city?: string },
): void {
  if (task.type !== "court_visit" || task.letterRows.length === 0) return;
  const first = task.letterRows[0]!;
  const created = new Date(task.createdAt);
  const city =
    options?.city?.trim() ||
    courtCityFromLetterCourt(first.court) ||
    "—";
  const letter: InternalDelegationLetter = {
    id: `${first.court}::${first.circuit}`,
    city,
    court: first.court,
    circuit: first.circuit,
    selectedProperties: task.letterRows.map((row) => ({
      propertyId: `${row.po}-${row.deed}`,
      workOrder: row.po,
      deedNo: row.deed,
      owner: row.owner,
      requestNo: row.request,
    })),
    poNumbers: [...new Set(task.letterRows.map((r) => r.po.trim()).filter(Boolean))],
    reference: task.reference,
    createdAt: task.createdAt,
    dateHijri: formatHijriAr(created),
    dateGreg: formatGregAr(created),
    issuedProperties: task.letterRows.map((row) => ({
      propertyId: `${row.po}-${row.deed}`,
      workOrder: row.po,
      deedNo: row.deed,
      owner: row.owner,
      requestNo: row.request,
    })),
    issuedAt: task.createdAt,
  };
  printInternalDelegationLetter(letter, agent);
}

function courtCityFromLetterCourt(court: string): string {
  const name = court.trim();
  if (!name) return "";
  // Common pattern: "محكمة التنفيذ بجدة" → جدة
  const m = name.match(/ب([\u0600-\u06FF\s]+)$/);
  if (m?.[1]) return m[1].trim();
  return "";
}

function formatGregAr(d: Date): string {
  if (Number.isNaN(d.getTime())) return "—";
  const y = d.getFullYear();
  const m = d.getMonth() + 1;
  const day = d.getDate();
  return `${y}/${m}/${day} م`;
}

function formatHijriAr(d: Date): string {
  if (Number.isNaN(d.getTime())) return "—";
  try {
    const parts = new Intl.DateTimeFormat("ar-SA-u-ca-islamic-umalqura", {
      year: "numeric",
      month: "numeric",
      day: "numeric",
    }).formatToParts(d);
    const y = parts.find((p) => p.type === "year")?.value;
    const m = parts.find((p) => p.type === "month")?.value;
    const day = parts.find((p) => p.type === "day")?.value;
    if (y && m && day) return `${y}/${m}/${day} هـ`;
  } catch {
    /* fall through */
  }
  return "—";
}
