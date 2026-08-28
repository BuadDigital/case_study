import { getAuthSession } from "@platform/auth-client";
import {
  beginOfflineLease,
  clearOfflineLease,
  enqueueSubmitLocally,
  persistAttachmentLocally,
  persistDraftLocally,
  readLocalDraftPayload,
  requestPersistentStorage,
  runOfflineSync,
  tickOfflineLease,
  type OfflineDraftRecord,
  type OfflineSyncDeps,
} from "@platform/offline-client";

export function currentOfflineUserId(): string | null {
  return getAuthSession()?.user?.id?.trim() || null;
}

export function isBrowserOffline(): boolean {
  return typeof navigator !== "undefined" && navigator.onLine === false;
}

export function isOfflineCapableRole(role: string | null | undefined): boolean {
  return role === "field-inspector" || role === "government-reviewer";
}

/**
 * Only network / server outages should fall back to the outbox.
 * Validation / auth / forbidden must surface to the user immediately.
 * Outbox works on insecure LAN origins via plaintext storage fallback.
 */
function isTransientConnectivityFailure(err: unknown): boolean {
  if (err instanceof TypeError) return true;
  if (!(err instanceof Error)) return false;

  if (
    "errors" in err &&
    (err as { errors?: unknown }).errors &&
    typeof (err as { errors?: unknown }).errors === "object"
  ) {
    return false;
  }

  if (
    "offlineQueueable" in err &&
    (err as { offlineQueueable?: boolean }).offlineQueueable === false
  ) {
    return false;
  }

  const message = err.message.toLowerCase();
  return (
    message.includes("failed to fetch") ||
    message.includes("networkerror") ||
    message.includes("load failed") ||
    message.includes("network request failed") ||
    message.includes("تعذّر الاتصال بالخادم") ||
    message.includes("حدث خطأ في الخادم")
  );
}

async function queueDraftOrRethrow(
  err: unknown,
  queue: () => Promise<void>,
): Promise<{ queued: true }> {
  if (!isTransientConnectivityFailure(err)) {
    throw err;
  }
  try {
    await queue();
    return { queued: true };
  } catch {
    // Prefer the original online failure (validation, server message, …).
    throw err;
  }
}

export async function saveDraftWithOfflineFallback(input: {
  taskId: string;
  kind: OfflineDraftRecord["kind"];
  payload: unknown;
  onlineSave: () => Promise<void>;
}): Promise<{ queued: boolean }> {
  const userId = currentOfflineUserId();
  if (!userId) {
    await input.onlineSave();
    return { queued: false };
  }

  if (isBrowserOffline()) {
    await persistDraftLocally({
      userId,
      taskId: input.taskId,
      kind: input.kind,
      payload: input.payload,
    });
    await beginOfflineLease(userId);
    return { queued: true };
  }

  try {
    await input.onlineSave();
    return { queued: false };
  } catch (err) {
    return queueDraftOrRethrow(err, async () => {
      await persistDraftLocally({
        userId,
        taskId: input.taskId,
        kind: input.kind,
        payload: input.payload,
      });
      await beginOfflineLease(userId);
    });
  }
}

export async function submitWithOfflineFallback(input: {
  taskId: string;
  kind: OfflineDraftRecord["kind"];
  payload: unknown;
  onlineSubmit: () => Promise<void>;
}): Promise<{ queued: boolean }> {
  const userId = currentOfflineUserId();
  if (!userId) {
    await input.onlineSubmit();
    return { queued: false };
  }

  if (isBrowserOffline()) {
    await persistDraftLocally({
      userId,
      taskId: input.taskId,
      kind: input.kind,
      payload: input.payload,
    });
    await enqueueSubmitLocally({ userId, taskId: input.taskId });
    await beginOfflineLease(userId);
    return { queued: true };
  }

  try {
    await input.onlineSubmit();
    return { queued: false };
  } catch (err) {
    return queueDraftOrRethrow(err, async () => {
      await persistDraftLocally({
        userId,
        taskId: input.taskId,
        kind: input.kind,
        payload: input.payload,
      });
      await enqueueSubmitLocally({ userId, taskId: input.taskId });
      await beginOfflineLease(userId);
    });
  }
}

export async function uploadAttachmentWithOfflineFallback(input: {
  scope: string;
  scopeKey: string;
  fileName: string;
  contentType: string;
  bytes: ArrayBuffer;
  onlineUpload: () => Promise<string>;
}): Promise<{ attachmentId: string; queued: boolean }> {
  const userId = currentOfflineUserId();
  if (!userId) {
    const attachmentId = await input.onlineUpload();
    return { attachmentId, queued: false };
  }

  if (isBrowserOffline()) {
    const { localAttachmentId } = await persistAttachmentLocally({
      userId,
      scope: input.scope,
      scopeKey: input.scopeKey,
      fileName: input.fileName,
      contentType: input.contentType,
      bytes: input.bytes,
    });
    await beginOfflineLease(userId);
    return { attachmentId: localAttachmentId, queued: true };
  }

  try {
    const attachmentId = await input.onlineUpload();
    return { attachmentId, queued: false };
  } catch (err) {
    if (!isTransientConnectivityFailure(err)) {
      throw err;
    }
    try {
      const { localAttachmentId } = await persistAttachmentLocally({
        userId,
        scope: input.scope,
        scopeKey: input.scopeKey,
        fileName: input.fileName,
        contentType: input.contentType,
        bytes: input.bytes,
      });
      await beginOfflineLease(userId);
      return { attachmentId: localAttachmentId, queued: true };
    } catch {
      throw err;
    }
  }
}

export async function loadQueuedDraftPayload<T>(
  kind: OfflineDraftRecord["kind"],
  taskId: string,
): Promise<T | null> {
  const userId = currentOfflineUserId();
  if (!userId) return null;
  return readLocalDraftPayload<T>(userId, kind, taskId);
}

/** Persistent storage only needs one request per session, not one per sync tick. */
let persistentStorageRequest: Promise<boolean> | null = null;

function requestPersistentStorageOnce(): Promise<boolean> {
  if (!persistentStorageRequest) {
    persistentStorageRequest = requestPersistentStorage();
  }
  return persistentStorageRequest;
}

export async function syncOfflineQueue(
  deps: OfflineSyncDeps,
): Promise<{ pending: number; failed: number }> {
  const userId = currentOfflineUserId();
  if (!userId) return { pending: 0, failed: 0 };
  await requestPersistentStorageOnce();
  const result = await runOfflineSync(userId, deps);
  if (result.pending === 0 && result.failed === 0 && navigator.onLine) {
    await clearOfflineLease(userId);
  }
  return result;
}

export async function evaluateOfflineLease(): Promise<{
  locked: boolean;
  warn1h: boolean;
  warn2h: boolean;
} | null> {
  const userId = currentOfflineUserId();
  if (!userId) return null;
  const tick = await tickOfflineLease(userId);
  if (!tick) return null;
  return {
    locked: tick.lease.locked,
    warn1h: tick.warn1h,
    warn2h: tick.warn2h,
  };
}
