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
    await persistDraftLocally({
      userId,
      taskId: input.taskId,
      kind: input.kind,
      payload: input.payload,
    });
    await beginOfflineLease(userId);
    return { queued: true };
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
  } catch {
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
  } catch {
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
}

export async function loadQueuedDraftPayload<T>(
  kind: OfflineDraftRecord["kind"],
  taskId: string,
): Promise<T | null> {
  const userId = currentOfflineUserId();
  if (!userId) return null;
  return readLocalDraftPayload<T>(userId, kind, taskId);
}

export async function syncOfflineQueue(
  deps: OfflineSyncDeps,
): Promise<{ pending: number; failed: number }> {
  const userId = currentOfflineUserId();
  if (!userId) return { pending: 0, failed: 0 };
  await requestPersistentStorage();
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
