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
  type OperationsTaskQuery,
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

/**
 * The screen's query state. Status, scope, type, the "active only" toggle, the
 * failure-pause exclusion, the search term and the sort are all sent to the
 * server (`docs/architecture/pagination-contract.md` §3); what stays here is
 * listed on `visibleOperationsTasks`.
 */
export type OperationsTaskQueryState = {
  search: string;
  statusFilter: string;
  scopeFilter: string;
  typeFilter: string;
  showAll: boolean;
};

export const INITIAL_OPERATIONS_TASK_QUERY: OperationsTaskQueryState = {
  search: "",
  statusFilter: "",
  scopeFilter: "",
  typeFilter: "",
  showAll: false,
};

export type OperationsTaskQueryAction =
  | { type: "search"; value: string }
  | { type: "status"; value: string }
  | { type: "scope"; value: string }
  | { type: "taskType"; value: string }
  | { type: "showAll"; value: boolean };

/** Pure reducer; an unchanged value returns the same object so the query key holds. */
export function operationsTaskQueryReducer(
  state: OperationsTaskQueryState,
  action: OperationsTaskQueryAction,
): OperationsTaskQueryState {
  switch (action.type) {
    case "search":
      return action.value === state.search
        ? state
        : { ...state, search: action.value };
    case "status":
      return action.value === state.statusFilter
        ? state
        : { ...state, statusFilter: action.value };
    case "scope":
      return action.value === state.scopeFilter
        ? state
        : { ...state, scopeFilter: action.value };
    case "taskType":
      return action.value === state.typeFilter
        ? state
        : { ...state, typeFilter: action.value };
    case "showAll":
      return action.value === state.showAll
        ? state
        : { ...state, showAll: action.value };
    default:
      return state;
  }
}

/**
 * Query state → the `GET /api/operations-tasks` parameters. `sort: "queue"` is
 * the screen's own `taskStatusRank` band order, so the rows arrive in the order
 * the table renders them.
 */
export function toOperationsTaskListQuery(
  state: OperationsTaskQueryState,
  options: {
    /** Executor queues are scoped to the viewer's distribution assignee id. */
    assigneeId?: string;
    /** Executor queues also hide rows parked on an active failure. */
    excludeFailurePaused: boolean;
    /** Debounced search term; falls back to the live one. */
    search?: string;
  },
): OperationsTaskQuery {
  const q = (options.search ?? state.search).trim();
  return {
    ...(options.assigneeId ? { assigneeId: options.assigneeId } : {}),
    ...(state.statusFilter ? { status: state.statusFilter } : {}),
    ...(state.scopeFilter ? { scope: state.scopeFilter } : {}),
    ...(state.typeFilter ? { type: state.typeFilter } : {}),
    // Mirrors the screen's "show all" toggle in its off position; an explicit
    // status filter wins, exactly as `visibleOperationsTasks` had it.
    ...(!state.showAll && !state.statusFilter ? { activeOnly: true } : {}),
    ...(options.excludeFailurePaused ? { excludeFailurePaused: true } : {}),
    ...(q ? { q } : {}),
    sort: "queue",
    dir: "desc",
  };
}

/** The KPI band's shape — counted by the endpoint (`useOperationsTaskStatusCounts`). */
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
    // The pause-reason half also runs server-side (`excludeFailurePaused`);
    // kept here because the offline cache and stale pages can still carry it.
    if (t.status === "paused" && isOpsTaskFailurePauseReason(t.pauseReason)) {
      return false;
    }
    // The other half needs the Failures records and the PO → property map,
    // neither of which is in the Operations database — pagination-contract §3,
    // "still client-side" #1. `totalCount` can therefore overstate what this
    // viewer sees.
    return !isOperationsTaskBlockedByFailure(t, failures, poRecords);
  });
}

/**
 * Status, scope, the "active only" toggle and the free text are applied by the
 * server. What is left here is the deed term — `DeedsJson` is a `jsonb` column
 * the endpoint cannot substring-match (pagination-contract §3, "still
 * client-side" #2) — and the deterministic band ordering the table renders.
 */
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
