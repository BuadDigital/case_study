import type {
  CreateOperationsTaskRequest,
  PatchOperationsTaskRequest,
  ReassignOperationsTaskRequest,
} from "@platform/api-client";
import {
  addOperationsTaskComment,
  createOperationsTask,
  patchOperationsTask,
  reassignOperationsTask,
  remindOperationsTask,
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
} from "@platform/app-shared/offline/prefetch-read";
import {
  resolveApiError,
  workOrdersApiConfig,
} from "../work-orders-api-config";
import {
  notifyOperationsTasksChanged,
  offlineTaskStub,
  type OperationsTask,
  type OperationsTaskCommentFile,
} from "./operations-tasks-model";

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
  files?: OperationsTaskCommentFile[],
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

/** Cached row for an offline write, falling back to a stub when nothing is cached. */
async function cachedTaskOrStub(id: string): Promise<OperationsTask> {
  const cached = await readPrefetchedOperationsTasks<OperationsTask>();
  return cached?.find((row) => row.id === id) ?? offlineTaskStub(id);
}

async function mergedTaskOrStub(
  id: string,
  body: PatchOperationsTaskRequest,
): Promise<OperationsTask> {
  return (
    (await mergePrefetchedOperationsTaskPatch<OperationsTask>(
      id,
      body as Record<string, unknown>,
    )) ?? offlineTaskStub(id, body)
  );
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
    return { ok: true, task: await mergedTaskOrStub(id, body), queued: true };
  }

  if (!config) return { ok: false, error: "تسجيل الدخول مطلوب" };

  try {
    const result = await patchOperationsTask(config, id, body);
    if (!result.ok) {
      if (result.kind === "network" && userId) {
        const queued = await enqueueOperationsTaskPatch(id, body);
        if (queued) {
          return {
            ok: true,
            task: await mergedTaskOrStub(id, body),
            queued: true,
          };
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
      return { ok: true, task: await mergedTaskOrStub(id, body), queued: true };
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
  files?: OperationsTaskCommentFile[],
): Promise<
  | { ok: true; task: OperationsTask; queued?: boolean }
  | { ok: false; error: string }
> {
  const userId = currentOfflineUserId();
  const config = workOrdersApiConfig();

  if ((!config || isBrowserOffline()) && userId) {
    const queued = await enqueueOperationsTaskComment(id, text, kind, files);
    if (!queued) return { ok: false, error: "تسجيل الدخول مطلوب" };
    return { ok: true, task: await cachedTaskOrStub(id), queued: true };
  }

  if (!config) return { ok: false, error: "تسجيل الدخول مطلوب" };

  try {
    const result = await addOperationsTaskComment(config, id, text, kind, files);
    if (!result.ok) {
      if (result.kind === "network" && userId) {
        const queued = await enqueueOperationsTaskComment(id, text, kind, files);
        if (queued) {
          return { ok: true, task: await cachedTaskOrStub(id), queued: true };
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
      return { ok: true, task: await cachedTaskOrStub(id), queued: true };
    }
    return {
      ok: false,
      error: err instanceof Error ? err.message : "تعذّر إضافة التعليق",
    };
  }
}
