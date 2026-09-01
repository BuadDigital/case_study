import type {
  CreateOperationsTaskRequest,
  OperationsTaskDto,
  PatchOperationsTaskRequest,
  ReassignOperationsTaskRequest,
} from "@platform/api-client";
import {
  addOperationsTaskComment,
  createOperationsTask,
  listCourtVisitFees,
  listOperationsTasks,
  patchOperationsTask,
  reassignOperationsTask,
  remindOperationsTask,
  type CourtVisitFeeReportRowDto,
} from "@platform/api-client";
import {
  beginOfflineLease,
  enqueueOutbox,
} from "@platform/offline-client";
import {
  currentOfflineUserId,
  isBrowserOffline,
} from "@platform/app-shared/offline/offline-write";
import {
  mergePrefetchedOperationsTaskPatch,
  readPrefetchedOperationsTasks,
  savePrefetchedOperationsTasks,
} from "@platform/app-shared/offline/prefetch-read";
import {
  resolveApiError,
  workOrdersApiConfig,
} from "../work-orders-api-config";

export type OperationsTask = OperationsTaskDto;

export const OPERATIONS_TASKS_CHANGED_EVENT = "eval-operations-tasks-changed";

export function notifyOperationsTasksChanged(): void {
  if (typeof window === "undefined") return;
  window.dispatchEvent(new CustomEvent(OPERATIONS_TASKS_CHANGED_EVENT));
}

function offlineTaskStub(
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

async function enqueueOperationsTaskPatch(
  id: string,
  body: PatchOperationsTaskRequest,
): Promise<boolean> {
  const userId = currentOfflineUserId();
  if (!userId) return false;
  await enqueueOutbox({
    userId,
    kind: "operations-task-patch",
    targetId: id,
    payloadJson: JSON.stringify(body),
  });
  await beginOfflineLease(userId);
  await mergePrefetchedOperationsTaskPatch(id, body as Record<string, unknown>);
  notifyOperationsTasksChanged();
  return true;
}

async function enqueueOperationsTaskComment(
  id: string,
  text: string,
  kind?: string,
  files?: {
    name: string;
    size: string;
    attachmentId?: string | null;
    contentType?: string | null;
  }[],
): Promise<boolean> {
  const userId = currentOfflineUserId();
  if (!userId) return false;
  await enqueueOutbox({
    userId,
    kind: "operations-task-comment",
    targetId: id,
    payloadJson: JSON.stringify({ text, kind, files }),
  });
  await beginOfflineLease(userId);
  notifyOperationsTasksChanged();
  return true;
}

export async function loadOperationsTasks(query?: {
  assigneeId?: string;
  createdBy?: string;
  status?: string;
}): Promise<OperationsTask[]> {
  const config = workOrdersApiConfig();
  const userId = currentOfflineUserId();

  if (!config || isBrowserOffline()) {
    const cached = await readPrefetchedOperationsTasks<OperationsTask>();
    if (!cached) return [];
    return filterPrefetchedOpsTasks(cached, query);
  }

  try {
    const result = await listOperationsTasks(config, query);
    if (!result.ok) {
      const cached = await readPrefetchedOperationsTasks<OperationsTask>();
      if (cached) return filterPrefetchedOpsTasks(cached, query);
      throw new Error(
        result.message ??
          resolveApiError(result.kind, undefined, "تعذّر تحميل المهام"),
      );
    }
    if (userId) {
      await savePrefetchedOperationsTasks(result.data);
    }
    return result.data;
  } catch {
    const cached = await readPrefetchedOperationsTasks<OperationsTask>();
    if (cached) return filterPrefetchedOpsTasks(cached, query);
    throw new Error("تعذّر تحميل المهام");
  }
}

function filterPrefetchedOpsTasks(
  tasks: OperationsTask[],
  query?: {
    assigneeId?: string;
    createdBy?: string;
    status?: string;
  },
): OperationsTask[] {
  return tasks.filter((task) => {
    if (query?.assigneeId && task.assigneeId !== query.assigneeId) return false;
    if (query?.createdBy && task.createdBy !== query.createdBy) return false;
    if (query?.status && task.status !== query.status) return false;
    return true;
  });
}

export async function createOperationsTaskRecord(
  body: CreateOperationsTaskRequest,
): Promise<{ ok: true; task: OperationsTask } | { ok: false; error: string }> {
  const config = workOrdersApiConfig();
  if (!config) return { ok: false, error: "تسجيل الدخول مطلوب" };
  const result = await createOperationsTask(config, body);
  if (!result.ok) {
    return {
      ok: false,
      error:
        result.message ??
        resolveApiError(result.kind, undefined, "تعذّر إنشاء المهمة"),
    };
  }
  notifyOperationsTasksChanged();
  return { ok: true, task: result.data };
}

export async function patchOperationsTaskRecord(
  id: string,
  body: PatchOperationsTaskRequest,
): Promise<
  | { ok: true; task: OperationsTask; queued?: boolean }
  | { ok: false; error: string }
> {
  const userId = currentOfflineUserId();
  const config = workOrdersApiConfig();

  if ((!config || isBrowserOffline()) && userId) {
    const queued = await enqueueOperationsTaskPatch(id, body);
    if (!queued) return { ok: false, error: "تسجيل الدخول مطلوب" };
    const merged =
      (await mergePrefetchedOperationsTaskPatch<OperationsTask>(
        id,
        body as Record<string, unknown>,
      )) ?? offlineTaskStub(id, body);
    return { ok: true, task: merged, queued: true };
  }

  if (!config) return { ok: false, error: "تسجيل الدخول مطلوب" };

  try {
    const result = await patchOperationsTask(config, id, body);
    if (!result.ok) {
      if (result.kind === "network" && userId) {
        const queued = await enqueueOperationsTaskPatch(id, body);
        if (queued) {
          const merged =
            (await mergePrefetchedOperationsTaskPatch<OperationsTask>(
              id,
              body as Record<string, unknown>,
            )) ?? offlineTaskStub(id, body);
          return { ok: true, task: merged, queued: true };
        }
      }
      return {
        ok: false,
        error:
          result.message ??
          resolveApiError(result.kind, undefined, "تعذّر تحديث المهمة"),
      };
    }
    notifyOperationsTasksChanged();
    return { ok: true, task: result.data };
  } catch (err) {
    if (userId && (await enqueueOperationsTaskPatch(id, body))) {
      const merged =
        (await mergePrefetchedOperationsTaskPatch<OperationsTask>(
          id,
          body as Record<string, unknown>,
        )) ?? offlineTaskStub(id, body);
      return { ok: true, task: merged, queued: true };
    }
    return {
      ok: false,
      error: err instanceof Error ? err.message : "تعذّر تحديث المهمة",
    };
  }
}

export async function reassignOperationsTaskRecord(
  id: string,
  body: ReassignOperationsTaskRequest,
): Promise<{ ok: true; task: OperationsTask } | { ok: false; error: string }> {
  const config = workOrdersApiConfig();
  if (!config) return { ok: false, error: "تسجيل الدخول مطلوب" };
  const result = await reassignOperationsTask(config, id, body);
  if (!result.ok) {
    return {
      ok: false,
      error:
        result.message ??
        resolveApiError(result.kind, undefined, "تعذّر إعادة التوجيه"),
    };
  }
  notifyOperationsTasksChanged();
  return { ok: true, task: result.data };
}

export async function remindOperationsTaskRecord(
  id: string,
): Promise<{ ok: true; task: OperationsTask } | { ok: false; error: string }> {
  const config = workOrdersApiConfig();
  if (!config) return { ok: false, error: "تسجيل الدخول مطلوب" };
  const result = await remindOperationsTask(config, id);
  if (!result.ok) {
    return {
      ok: false,
      error:
        result.message ??
        resolveApiError(result.kind, undefined, "تعذّر إرسال التذكير"),
    };
  }
  notifyOperationsTasksChanged();
  return { ok: true, task: result.data };
}

export async function addOperationsTaskCommentRecord(
  id: string,
  text: string,
  kind?: string,
  files?: {
    name: string;
    size: string;
    attachmentId?: string | null;
    contentType?: string | null;
  }[],
): Promise<
  | { ok: true; task: OperationsTask; queued?: boolean }
  | { ok: false; error: string }
> {
  const userId = currentOfflineUserId();
  const config = workOrdersApiConfig();

  if ((!config || isBrowserOffline()) && userId) {
    const queued = await enqueueOperationsTaskComment(id, text, kind, files);
    if (!queued) return { ok: false, error: "تسجيل الدخول مطلوب" };
    const cached = await readPrefetchedOperationsTasks<OperationsTask>();
    const task =
      cached?.find((row) => row.id === id) ?? offlineTaskStub(id);
    return { ok: true, task, queued: true };
  }

  if (!config) return { ok: false, error: "تسجيل الدخول مطلوب" };

  try {
    const result = await addOperationsTaskComment(config, id, text, kind, files);
    if (!result.ok) {
      if (result.kind === "network" && userId) {
        const queued = await enqueueOperationsTaskComment(id, text, kind, files);
        if (queued) {
          const cached = await readPrefetchedOperationsTasks<OperationsTask>();
          const task =
            cached?.find((row) => row.id === id) ?? offlineTaskStub(id);
          return { ok: true, task, queued: true };
        }
      }
      return {
        ok: false,
        error:
          result.message ??
          resolveApiError(result.kind, undefined, "تعذّر إضافة التعليق"),
      };
    }
    notifyOperationsTasksChanged();
    return { ok: true, task: result.data };
  } catch (err) {
    if (userId && (await enqueueOperationsTaskComment(id, text, kind, files))) {
      const cached = await readPrefetchedOperationsTasks<OperationsTask>();
      const task =
        cached?.find((row) => row.id === id) ?? offlineTaskStub(id);
      return { ok: true, task, queued: true };
    }
    return {
      ok: false,
      error: err instanceof Error ? err.message : "تعذّر إضافة التعليق",
    };
  }
}

export function isActiveOperationsTask(task: OperationsTask): boolean {
  return task.status === "created" || task.status === "in_progress";
}

export function isTerminalOperationsTask(task: OperationsTask): boolean {
  return task.status === "completed" || task.status === "cancelled";
}

export async function loadCourtVisitFees(query?: {
  creditAssigneeId?: string;
}): Promise<CourtVisitFeeReportRowDto[]> {
  const config = workOrdersApiConfig();
  if (!config) return [];
  const result = await listCourtVisitFees(config, query);
  if (!result.ok) {
    throw new Error(
      result.message ??
        resolveApiError(result.kind, undefined, "تعذّر تحميل أتعاب الزيارة"),
    );
  }
  return result.data;
}
