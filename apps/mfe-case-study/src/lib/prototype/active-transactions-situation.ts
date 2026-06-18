import type { PageId, RoleId } from "@platform/types";
import { activeTransactionNavForRole, filterTasksForCaseStudy } from "@platform/app-shared/prototype/active-transactions";
import type { PoIntakeRecord } from "./po-intake-data";
import { PARTY_TASK_PAGES } from "@platform/app-shared/prototype/party-task-pages";
import { isSuperAdmin } from "@platform/app-shared/prototype/prototype-role-access";
import type { PoRow } from "@platform/app-shared/prototype/constants";
import { filterTasksForDistribution,filterTasksForPrimaryData } from "./transaction-filters";
import { tasksForPartyAssignee,tasksForRole,type WorkflowTask } from "./tasks-storage";

const RIYADH_TZ = "Asia/Riyadh";
const PARTY_ROLE_IDS = new Set(
  Object.values(PARTY_TASK_PAGES).map((d) => d.roleId),
);

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

export function isPoRegisteredToday(
  record: PoIntakeRecord,
  now = new Date(),
): boolean {
  if (record.createdAtUtc && isInstantTodayInRiyadh(record.createdAtUtc, now)) {
    return true;
  }
  return isDateOnlyTodayInRiyadh(record.receivedFromEnfathAt, now);
}

/** Tasks assigned to the signed-in prototype user (role / party assignee / custom grant). */
export function tasksAssignedToViewer(
  role: RoleId,
  tasks: WorkflowTask[],
  viewerEmail?: string | null,
  customGrantedPages?: readonly PageId[],
): WorkflowTask[] {
  if (isSuperAdmin(role)) return tasks;

  const roleTasks = PARTY_ROLE_IDS.has(role)
    ? tasksForPartyAssignee(role, tasks, undefined, viewerEmail)
    : tasksForRole(role, tasks);

  const granted = customGrantedPages ?? [];
  if (granted.length === 0) return roleTasks;

  const extra: WorkflowTask[] = [];
  if (granted.includes("active-case-study")) {
    extra.push(...filterTasksForCaseStudy(tasks));
  }
  if (granted.includes("active-distribution")) {
    extra.push(...filterTasksForDistribution(tasks));
  }
  if (granted.includes("active-primary-data")) {
    extra.push(...filterTasksForPrimaryData(tasks, new Map()));
  }

  const byId = new Map<string, WorkflowTask>();
  for (const task of [...roleTasks, ...extra]) byId.set(task.id, task);
  return [...byId.values()];
}

export function countIncompleteWorkOrders(rows: PoRow[]): number {
  return rows.filter((p) => p.status !== "done").length;
}

/** Sum expected property slots for POs registered in the system today. */
export function countPropertiesRegisteredToday(
  records: PoIntakeRecord[],
  now = new Date(),
): number {
  return records
    .filter((r) => isPoRegisteredToday(r, now))
    .reduce((sum, r) => sum + Math.max(0, r.expectedPropertyCount ?? 0), 0);
}

export function countTasksArrivedToday(
  tasks: WorkflowTask[],
  now = new Date(),
): number {
  return tasks.filter((t) => isInstantTodayInRiyadh(t.createdAt, now)).length;
}

export function countTasksCompletedToday(
  tasks: WorkflowTask[],
  now = new Date(),
): number {
  return tasks.filter(
    (t) =>
      t.status === "completed" && isInstantTodayInRiyadh(t.updatedAt, now),
  ).length;
}

export type ActiveTransactionsSituationFlags = {
  showPoMetrics: boolean;
  showTransactionMetrics: boolean;
};

export function situationVisibilityForPages(
  pages: readonly PageId[],
): ActiveTransactionsSituationFlags {
  const merged = [...new Set(pages)];
  const showPoMetrics = merged.includes("po");
  const showTransactionMetrics = activeTransactionNavForRole(merged).some(
    (item) => item.available && !item.placeholder,
  );
  return { showPoMetrics, showTransactionMetrics };
}

export type ActiveTransactionsSituationStats = {
  incompletePo: number | undefined;
  propertiesToday: number | undefined;
  transactionsArrivedToday: number | undefined;
  transactionsDoneToday: number | undefined;
  flags: ActiveTransactionsSituationFlags;
  ready: boolean;
};

export function computeActiveTransactionsSituation(input: {
  role: RoleId;
  rolePages?: readonly PageId[];
  customGrantedPages?: readonly PageId[];
  poRows: PoRow[] | undefined;
  poRecords: PoIntakeRecord[] | undefined;
  tasks: WorkflowTask[] | undefined;
  poRowsReady: boolean;
  poRecordsReady: boolean;
  tasksReady: boolean;
  now?: Date;
}): ActiveTransactionsSituationStats {
  const effectivePages = [
    ...new Set([
      ...(input.rolePages?.length ? input.rolePages : (["dashboard"] as PageId[])),
      ...(input.customGrantedPages ?? []),
    ]),
  ] as PageId[];

  const flags = situationVisibilityForPages(effectivePages);
  const now = input.now ?? new Date();
  const needPoData = flags.showPoMetrics;
  const needTasks = flags.showTransactionMetrics;
  const poReady = !needPoData || (input.poRowsReady && input.poRecordsReady);
  const tasksReady = !needTasks || input.tasksReady;
  const ready = poReady && tasksReady;

  if (!ready) {
    return {
      incompletePo: needPoData ? undefined : 0,
      propertiesToday: needPoData ? undefined : 0,
      transactionsArrivedToday: needTasks ? undefined : 0,
      transactionsDoneToday: needTasks ? undefined : 0,
      flags,
      ready: false,
    };
  }

  const mine = needTasks
    ? tasksAssignedToViewer(
        input.role,
        input.tasks ?? [],
        undefined,
        input.customGrantedPages,
      )
    : [];

  return {
    incompletePo: needPoData
      ? countIncompleteWorkOrders(input.poRows ?? [])
      : 0,
    propertiesToday: needPoData
      ? countPropertiesRegisteredToday(input.poRecords ?? [], now)
      : 0,
    transactionsArrivedToday: needTasks
      ? countTasksArrivedToday(mine, now)
      : 0,
    transactionsDoneToday: needTasks
      ? countTasksCompletedToday(mine, now)
      : 0,
    flags,
    ready: true,
  };
}
