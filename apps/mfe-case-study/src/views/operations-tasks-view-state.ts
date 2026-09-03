/**
 * Pure queue/selection rules behind `OperationsTasksView`. No React, no writes —
 * everything here is a function of the tasks list plus the current filters, so
 * the view keeps JSX and event wiring only.
 */
import type { StaffUser } from "@platform/app-shared/app-data/constants";
import type { FailureRecord } from "@platform/app-shared/failures/failures-types";
import {
  isActiveOperationsTask,
  type OperationsTask,
} from "../lib/app-data/operations-tasks-model";
import { isTerminalOperationsTaskStatus } from "../lib/app-data/operations-task-display";
import {
  isOperationsTaskBlockedByFailure,
  isOpsTaskFailurePauseReason,
} from "../lib/app-data/operations-task-failure-obstruction";
import { assigneesForType } from "./OperationsTasksViewParts";
import type { DistributionAssignee } from "../lib/app-data/distribution-parties";
import type { PoIntakeRecord } from "../lib/app-data/po-intake-data";

/** Party account shape used for the "is this row mine" checks. */
export type OperationsQueueAccount =
  | { assigneeId?: string | null; name?: string | null }
  | null
  | undefined;

export type OperationsTaskFilters = {
  search: string;
  statusFilter: string;
  scopeFilter: string;
  showAll: boolean;
};

export type OperationsTaskKpis = {
  active: number;
  created: number;
  paused: number;
  inProgress: number;
  completed: number;
};

// Scope order is fixed — one module-level function instead of a closure allocated per comparison
// (js-cache-function-results).
export const taskStatusRank = (status: string) =>
  status === "paused" ? 1 : isTerminalOperationsTaskStatus(status) ? 2 : 0;

/**
 * Executor queues hide a task while a linked failure is open, or while it is
 * parked for a failure pause (until auto-resume / staff clears the obstruction).
 */
export function queueTasksForViewer(
  tasks: OperationsTask[],
  useIndependentQueue: boolean,
  failures: FailureRecord[],
  poRecords: PoIntakeRecord[],
): OperationsTask[] {
  if (!useIndependentQueue) return tasks;
  return tasks.filter((t) => {
    if (t.status === "paused" && isOpsTaskFailurePauseReason(t.pauseReason)) {
      return false;
    }
    return !isOperationsTaskBlockedByFailure(t, failures, poRecords);
  });
}

export function operationsTaskKpis(
  queueTasks: OperationsTask[],
): OperationsTaskKpis {
  const created = queueTasks.filter((t) => t.status === "created").length;
  const inProgress = queueTasks.filter((t) => t.status === "in_progress").length;
  const paused = queueTasks.filter((t) => t.status === "paused").length;
  const completed = queueTasks.filter((t) => t.status === "completed").length;
  return {
    active: created + inProgress,
    created,
    paused,
    inProgress,
    completed,
  };
}

export function visibleOperationsTasks(
  queueTasks: OperationsTask[],
  filters: OperationsTaskFilters,
): OperationsTask[] {
  const q = filters.search.trim();
  const list = queueTasks.filter((t) => {
    // Cheap comparisons first — build the search string only for survivors and when text exists.
    if (filters.statusFilter && t.status !== filters.statusFilter) return false;
    if (filters.scopeFilter && t.scope !== filters.scopeFilter) return false;
    if (!filters.showAll && !filters.statusFilter && !isActiveOperationsTask(t)) {
      return false;
    }
    if (!q) return true;
    const hay = `${t.title} ${t.assigneeName} ${t.displayId} ${t.poNumber ?? ""} ${t.deeds.join(" ")}`;
    return hay.includes(q);
  });
  // Decorate once per task — instead of parsing the date on every comparison.
  return list
    .map((task) => ({
      task,
      rank: taskStatusRank(task.status),
      createdAtMs: new Date(task.createdAt).getTime(),
    }))
    .sort((a, b) =>
      a.rank !== b.rank
        ? a.rank - b.rank
        : // newest first within the same status band
          b.createdAtMs - a.createdAtMs,
    )
    .map((d) => d.task);
}

/**
 * Tasks paused for a failure that is no longer blocking — the view reopens them
 * as «Created» so the assignee confirms receipt again (fresh start, not mid-work).
 */
export function operationsTasksToResumeAfterFailure(
  tasks: OperationsTask[],
  failures: FailureRecord[],
  poRecords: PoIntakeRecord[],
): OperationsTask[] {
  return tasks.filter(
    (t) =>
      t.status === "paused" &&
      isOpsTaskFailurePauseReason(t.pauseReason) &&
      !isOperationsTaskBlockedByFailure(t, failures, poRecords),
  );
}

/** A detail row the viewer must be pushed off: parked for, or blocked by, a failure. */
export function operationsTaskHiddenByFailure(
  task: OperationsTask,
  failures: FailureRecord[],
  poRecords: PoIntakeRecord[],
): boolean {
  const parkedForFailure =
    task.status === "paused" && isOpsTaskFailurePauseReason(task.pauseReason);
  return parkedForFailure || isOperationsTaskBlockedByFailure(task, failures, poRecords);
}

/** Matches by distribution assignee id first, then by display name. */
export function matchesOperationsTaskAssignee(
  task: Pick<OperationsTask, "assigneeId" | "assigneeName">,
  account: OperationsQueueAccount,
  fallbackName?: string | null,
): boolean {
  const taskAid = task.assigneeId?.trim() ?? "";
  const myAid = account?.assigneeId?.trim() ?? "";
  if (myAid && taskAid && myAid === taskAid) return true;
  const myName = (account?.name ?? fallbackName ?? "").trim();
  const taskName = task.assigneeName?.trim() ?? "";
  if (myName && taskName && myName === taskName) return true;
  return false;
}

export function reviewerStaffForAccount(
  account: OperationsQueueAccount,
  staffUsers: StaffUser[],
): StaffUser | null {
  const id = account?.assigneeId?.trim();
  if (!id) return null;
  return staffUsers.find((u) => u.distributionAssigneeId?.trim() === id) ?? null;
}

/** Close-modal credit picker — type assignees plus the task's own two parties. */
export function creditAssigneeOptions(
  task: OperationsTask | null,
  staffUsers: StaffUser[],
): DistributionAssignee[] {
  if (!task) return [];
  const base = [...assigneesForType(task.type, staffUsers)];
  const ensure = (id: string | null | undefined, name: string | null | undefined) => {
    const trimmed = id?.trim();
    if (!trimmed) return;
    if (!base.some((a) => a.id === trimmed)) {
      base.push({ id: trimmed, name: name?.trim() || trimmed });
    }
  };
  ensure(task.originalAssigneeId, task.originalAssigneeName);
  ensure(task.assigneeId, task.assigneeName);
  return base;
}

/** `yyyy-mm-dd` + `hh:mm` from the date/time inputs, in the viewer's local zone. */
export function dueDateFromLocalParts(date: string, time: string): Date {
  const [y, mo, da] = date.split("-").map(Number);
  const [hh, mm] = (time || "12:00").split(":").map(Number);
  return new Date(y!, (mo ?? 1) - 1, da ?? 1, hh ?? 12, mm ?? 0);
}
