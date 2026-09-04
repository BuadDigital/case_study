import type {
  OperationsTaskDto,
  PatchOperationsTaskRequest,
} from "@platform/api-client";

export type OperationsTask = OperationsTaskDto;

/** Query shape shared by the API loader and the offline cache filter. */
/**
 * The operations-task list query — mirrors
 * `docs/architecture/pagination-contract.md` §3. `assigneeId`, `createdBy` and
 * `status` predate the contract; the rest moved from the screen to the server.
 */
export type OperationsTaskQuery = {
  assigneeId?: string;
  createdBy?: string;
  /** Single status; an unrecognised value returns an empty list. */
  status?: string;
  /** `general` | `transaction` | `work_order` | `multi`. */
  scope?: string;
  /** `general` | `court_visit` | `reshoot` | `field_visit` | `inquiry`. */
  type?: string;
  /** `true` keeps only `created` and `in_progress`. */
  activeOnly?: boolean;
  /** `true` drops rows parked on an active property failure. */
  excludeFailurePaused?: boolean;
  /** Free text over Title / DisplayId / AssigneeName / PoNumber / Reference. */
  q?: string;
  sort?: "queue" | "created" | "due" | "updated" | "priority";
  dir?: "asc" | "desc";
};

/** Attachment descriptor accepted by the comment command. */
export type OperationsTaskCommentFile = {
  name: string;
  size: string;
  attachmentId?: string | null;
  contentType?: string | null;
};

export const OPERATIONS_TASKS_CHANGED_EVENT = "eval-operations-tasks-changed";

export function notifyOperationsTasksChanged(): void {
  if (typeof window === "undefined") return;
  window.dispatchEvent(new CustomEvent(OPERATIONS_TASKS_CHANGED_EVENT));
}

/** Placeholder row returned when a write is queued offline and no cache row exists. */
export function offlineTaskStub(
  id: string,
  patch?: PatchOperationsTaskRequest,
): OperationsTask {
  const now = new Date().toISOString();
  return {
    id,
    type: "court_visit",
    status: patch?.status ?? "in_progress",
    priority: patch?.priority ?? "medium",
    createdAtUtc: now,
    updatedAtUtc: now,
    ...patch,
  } as unknown as OperationsTask;
}

/** Applies the server-side query filters to prefetched rows. */
/** `OperationsTaskLifecycleRules.FailurePauseReasonPrefix` — shared with the server. */
const FAILURE_PAUSE_REASON_PREFIX = "تعذر نشط";

/**
 * Client-side mirror of the server's list filters, used when the offline
 * prefetch cache answers instead of the API. The endpoint is the source of
 * truth; this only keeps the cached answer consistent with it.
 */
export function filterPrefetchedOpsTasks(
  tasks: OperationsTask[],
  query?: OperationsTaskQuery,
): OperationsTask[] {
  const q = query?.q?.trim();
  return tasks.filter((task) => {
    if (query?.assigneeId && task.assigneeId !== query.assigneeId) return false;
    if (query?.createdBy && task.createdBy !== query.createdBy) return false;
    if (query?.status && task.status !== query.status) return false;
    if (query?.scope && task.scope !== query.scope) return false;
    if (query?.type && task.type !== query.type) return false;
    if (query?.activeOnly && !isActiveOperationsTask(task)) return false;
    if (
      query?.excludeFailurePaused &&
      task.status === "paused" &&
      (task.pauseReason ?? "").trimStart().startsWith(FAILURE_PAUSE_REASON_PREFIX)
    ) {
      return false;
    }
    if (q) {
      // Deeds are deliberately absent — `DeedsJson` is not searchable server-side
      // (pagination-contract §3, "still client-side" #2).
      const hay = `${task.title} ${task.displayId} ${task.assigneeName} ${task.poNumber ?? ""} ${task.reference ?? ""}`;
      if (!hay.includes(q)) return false;
    }
    return true;
  });
}

export function isActiveOperationsTask(task: OperationsTask): boolean {
  return task.status === "created" || task.status === "in_progress";
}

export function isTerminalOperationsTask(task: OperationsTask): boolean {
  return task.status === "completed" || task.status === "cancelled";
}
