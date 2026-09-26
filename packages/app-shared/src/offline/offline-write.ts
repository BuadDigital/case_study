import { getAuthSession } from "@platform/auth-client";
import {
  beginOfflineLease,
  clearOfflineLease,
  deleteOfflineDraft,
  enqueueSubmitLocally,
  getOfflineDraft,
  listOutboxItems,
  persistAttachmentLocally,
  persistDraftLocally,
  readLocalDraftPayload,
  requestPersistentStorage,
  runOfflineSync,
  saveOfflineDraft,
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
 * The outbox is encrypted on every origin (software AES-GCM where Web Crypto is missing).
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
  idempotencyKey?: string;
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
    await enqueueSubmitLocally({
      userId,
      taskId: input.taskId,
      idempotencyKey: input.idempotencyKey,
    });
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
      await enqueueSubmitLocally({
        userId,
        taskId: input.taskId,
        idempotencyKey: input.idempotencyKey,
      });
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
  /**
   * Request fields the online upload sends besides the file (photo EXIF location and
   * capture time, document type). Kept with the queued copy and replayed with it.
   */
  uploadExtras?: Record<string, unknown>;
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
      uploadExtras: input.uploadExtras,
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
        uploadExtras: input.uploadExtras,
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

/* ─── Local working copy (spec §3.4: «الحفظ لحظي أثناء الإدخال») ─── */

type WorkingCopyWriter = {
  running: Promise<void> | null;
  next: OfflineDraftRecord | null;
};

const workingCopyWriters = new Map<string, WorkingCopyWriter>();

/**
 * Keeps every edit on the device the moment it is made — the network save stays
 * debounced, so without this the last keystrokes lived only in memory and were lost
 * if the phone killed the app. Encrypted like all offline data; rapid edits collapse
 * to one write (latest wins), so typing never queues stale work.
 */
export function saveLocalWorkingCopy(input: {
  taskId: string;
  kind: OfflineDraftRecord["kind"];
  payload: unknown;
}): Promise<void> {
  const userId = currentOfflineUserId();
  if (!userId || !input.taskId) return Promise.resolve();
  const id = `${input.kind}:${input.taskId}`;
  const writer = workingCopyWriters.get(id) ?? { running: null, next: null };
  workingCopyWriters.set(id, writer);
  writer.next = {
    id,
    userId,
    taskId: input.taskId,
    kind: input.kind,
    payloadJson: JSON.stringify(input.payload),
    updatedAtUtc: new Date().toISOString(),
  };
  if (!writer.running) {
    writer.running = (async () => {
      while (writer.next) {
        const record = writer.next;
        writer.next = null;
        await saveOfflineDraft(record).catch(() => {
          /* storage unavailable — the network save still runs */
        });
      }
      writer.running = null;
    })();
  }
  return writer.running;
}

/** The device's working copy of a task, when one exists. */
export async function readLocalWorkingCopy<T>(
  kind: OfflineDraftRecord["kind"],
  taskId: string,
): Promise<{ payload: T; updatedAtUtc: string } | null> {
  const userId = currentOfflineUserId();
  if (!userId) return null;
  try {
    const draft = await getOfflineDraft(userId, `${kind}:${taskId}`);
    if (!draft) return null;
    return { payload: JSON.parse(draft.payloadJson) as T, updatedAtUtc: draft.updatedAtUtc };
  } catch {
    return null;
  }
}

/**
 * The server holds everything up to `savedFromUtc` (when that save read its draft):
 * drop the working copy — unless typing went on since, or an offline save is queued.
 */
export async function clearLocalWorkingCopy(
  kind: OfflineDraftRecord["kind"],
  taskId: string,
  savedFromUtc: string,
): Promise<void> {
  const userId = currentOfflineUserId();
  if (!userId) return;
  const id = `${kind}:${taskId}`;
  try {
    await workingCopyWriters.get(id)?.running;
    const draft = await getOfflineDraft(userId, id);
    if (!draft || Date.parse(draft.updatedAtUtc) > Date.parse(savedFromUtc)) return;
    const queued = (await listOutboxItems(userId)).some(
      (item) => item.kind === "party-submission-save" && item.targetId === taskId,
    );
    if (queued) return;
    await deleteOfflineDraft(userId, id);
  } catch {
    /* leave it — the next load compares timestamps */
  }
}
