import type { PoRow } from "@platform/app-shared/prototype/constants";
import { normalizePoListStatus } from "@platform/app-shared/prototype/po-list-status";
import type { OperationsTaskDto } from "@platform/api-client";

/** HTML DONE_ST — completed / fully billed / cancelled. */
function isDashPoDone(status: string): boolean {
  const s = normalizePoListStatus(status);
  return s === "completed" || s === "fully_billed" || s === "cancelled";
}

const DMY_DATE_RE = /^(\d{1,2})\/(\d{1,2})\/(\d{4})$/;

export function parseDashDate(value: string | undefined | null): number {
  if (!value) return Number.NaN;
  const iso = Date.parse(value);
  if (!Number.isNaN(iso)) return iso;
  const m = DMY_DATE_RE.exec(value.trim());
  if (m) {
    const d = Number(m[1]);
    const mo = Number(m[2]) - 1;
    const y = Number(m[3]);
    return new Date(y, mo, d).getTime();
  }
  return Number.NaN;
}

export function startOfLocalDay(ts = Date.now()): number {
  const d = new Date(ts);
  d.setHours(0, 0, 0, 0);
  return d.getTime();
}

export function daysUntilDue(dueTs: number, todayTs = startOfLocalDay()): number {
  return Math.round((dueTs - todayTs) / 86_400_000);
}

export function formatDueChip(dleft: number): { text: string; color: string } {
  if (dleft < 0)
    return { text: `متأخر ${Math.abs(dleft)} ي`, color: "#d9694f" };
  if (dleft === 0) return { text: "اليوم", color: "#d9a441" };
  if (dleft <= 1) return { text: `خلال ${dleft} ي`, color: "#d9a441" };
  return { text: `خلال ${dleft} ي`, color: "#3f8f5f" };
}

export function formatRelativeAr(ts: number, now = Date.now()): string {
  const m = Math.round((now - ts) / 60_000);
  if (m < 1) return "الآن";
  if (m < 60) return `قبل ${m} د`;
  const h = Math.floor(m / 60);
  const mm = m % 60;
  return `قبل ${h} س${mm ? ` ${mm} د` : ""}`;
}

export function formatGapAr(gapMin: number): string {
  if (gapMin < 60) return `منذ ${gapMin} دقيقة`;
  const h = Math.floor(gapMin / 60);
  const m = gapMin % 60;
  return `منذ ${h} ساعة${m ? ` و${m} دقيقة` : ""}`;
}

export function formatDateLtr(value: string): string {
  const ts = parseDashDate(value);
  if (Number.isNaN(ts)) return value || "—";
  const d = new Date(ts);
  const dd = String(d.getDate()).padStart(2, "0");
  const mm = String(d.getMonth() + 1).padStart(2, "0");
  const yyyy = d.getFullYear();
  return `${dd}/${mm}/${yyyy}`;
}

export function isOpsTaskActive(status: string): boolean {
  const s = status.toLowerCase();
  return s !== "completed" && s !== "cancelled" && s !== "done" && s !== "canceled";
}

export function opsTaskTypeLabel(type: string): string {
  switch (type) {
    case "court_visit":
      return "زيارة محكمة";
    case "inquiry":
      return "استفسار";
    case "bourse":
      return "استفسار بورصة";
    default:
      return "مهمة";
  }
}

export function opsTaskScopeText(task: OperationsTaskDto): string {
  if (task.poNumber) return `PO ${task.poNumber}`;
  if (task.deeds?.length) return task.deeds.slice(0, 2).join(" · ");
  if (task.scope === "general") return "مهمة عامة";
  return task.scope || "—";
}

export function taskCountdown(dueAt: string, now = Date.now()): {
  txt: string;
  over: boolean;
} {
  const due = parseDashDate(dueAt);
  if (Number.isNaN(due)) return { txt: "—", over: false };
  const diff = due - now;
  const over = diff < 0;
  const abs = Math.abs(diff);
  const mins = Math.round(abs / 60_000);
  if (mins < 60) {
    return { txt: over ? `متأخر ${mins} د` : `${mins} د`, over };
  }
  const hrs = Math.floor(mins / 60);
  if (hrs < 48) {
    return { txt: over ? `متأخر ${hrs} س` : `${hrs} س`, over };
  }
  const days = Math.round(hrs / 24);
  return { txt: over ? `متأخر ${days} ي` : `${days} ي`, over };
}

export function activePoOrders(rows: PoRow[]): PoRow[] {
  return rows.filter((o) => !isDashPoDone(o.status));
}

export type DashKpiModel = {
  activeOrders: number;
  atRisk: number;
  atRiskPct: number;
  propsLeft: number;
  totalProps: number;
  inProcPct: number;
  openTasks: number;
  overdueTasks: number;
  overduePct: number;
  failuresOpen: number;
  stopped: number;
  stoppedPct: number;
};

export function buildDashKpis(
  poRows: PoRow[],
  openTasks: OperationsTaskDto[],
  failuresOpen: number,
  now = Date.now(),
): DashKpiModel {
  const active = activePoOrders(poRows);
  const today = startOfLocalDay(now);
  let atRisk = 0;
  let propsLeft = 0;
  for (const o of active) {
    const due = parseDashDate(o.dueDate);
    if (!Number.isNaN(due) && daysUntilDue(due, today) <= 1) atRisk += 1;
    propsLeft += Math.max(0, o.count - o.done);
  }
  let totalProps = 0;
  let stopped = 0;
  for (const o of poRows) {
    totalProps += o.count;
    if (normalizePoListStatus(o.status) === "stopped") stopped += 1;
  }
  const overdueTasks = openTasks.filter((t) => {
    const due = parseDashDate(t.dueAt);
    return !Number.isNaN(due) && due < now;
  });

  return {
    activeOrders: active.length,
    atRisk,
    atRiskPct: active.length ? Math.round((atRisk / active.length) * 100) : 0,
    propsLeft,
    totalProps,
    inProcPct: totalProps ? Math.round((propsLeft / totalProps) * 100) : 0,
    openTasks: openTasks.length,
    overdueTasks: overdueTasks.length,
    overduePct: openTasks.length
      ? Math.round((overdueTasks.length / openTasks.length) * 100)
      : 0,
    failuresOpen,
    stopped,
    stoppedPct: active.length ? Math.round((stopped / active.length) * 100) : 0,
  };
}

export type DashCompletionModel = {
  pTotal: number;
  pReg: number;
  pDone: number;
  pInProg: number;
  pNotReg: number;
  compPct: number;
  regPct: number;
  avgPerPo: string;
  remaining: number;
};

export function buildCompletion(poRows: PoRow[]): DashCompletionModel {
  let pTotal = 0;
  let pReg = 0;
  let pDone = 0;
  for (const o of poRows) {
    pTotal += o.count;
    pReg += o.registered;
    pDone += o.done;
  }
  const pInProg = Math.max(0, pReg - pDone);
  const pNotReg = Math.max(0, pTotal - pReg);
  return {
    pTotal,
    pReg,
    pDone,
    pInProg,
    pNotReg,
    compPct: pTotal ? Math.round((pDone / pTotal) * 100) : 0,
    regPct: pTotal ? Math.round((pReg / pTotal) * 100) : 0,
    avgPerPo: poRows.length ? (pTotal / poRows.length).toFixed(1) : "0",
    remaining: pTotal - pDone,
  };
}
