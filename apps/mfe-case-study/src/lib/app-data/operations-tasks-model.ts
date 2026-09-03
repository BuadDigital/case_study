import type {
  OperationsTaskDto,
  PatchOperationsTaskRequest,
} from "@platform/api-client";

export type OperationsTask = OperationsTaskDto;

/** Query shape shared by the API loader and the offline cache filter. */
export type OperationsTaskQuery = {
  assigneeId?: string;
  createdBy?: string;
  status?: string;
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
export function filterPrefetchedOpsTasks(
  tasks: OperationsTask[],
  query?: OperationsTaskQuery,
): OperationsTask[] {
  return tasks.filter((task) => {
    if (query?.assigneeId && task.assigneeId !== query.assigneeId) return false;
    if (query?.createdBy && task.createdBy !== query.createdBy) return false;
    if (query?.status && task.status !== query.status) return false;
    return true;
  });
}

export function isActiveOperationsTask(task: OperationsTask): boolean {
  return task.status === "created" || task.status === "in_progress";
}

export function isTerminalOperationsTask(task: OperationsTask): boolean {
  return task.status === "completed" || task.status === "cancelled";
}
