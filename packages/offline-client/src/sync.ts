import {
  deleteOutboxItem,
  getOfflineBlob,
  listOutboxItems,
  markBlobUploaded,
  publishPendingCount,
  saveOutboxItem,
} from "./store";
import {
  OFFLINE_SYNC_EVENT,
  type OfflineOutboxItem,
  type OfflineSyncState,
  type OutboxKind,
} from "./types";

export type AttachmentUploadFn = (input: {
  scope: string;
  scopeKey: string;
  fileName: string;
  contentType: string;
  bytes: ArrayBuffer;
}) => Promise<{ ok: true; attachmentId: string } | { ok: false; error: string; terminal?: boolean }>;

export type SubmissionSaveFn = (input: {
  taskId: string;
  payloadJson: string;
}) => Promise<{ ok: true } | { ok: false; error: string; terminal?: boolean }>;

export type SubmissionSubmitFn = (input: {
  taskId: string;
}) => Promise<{ ok: true } | { ok: false; error: string; terminal?: boolean }>;

export type OfflineSyncDeps = {
  uploadAttachment: AttachmentUploadFn;
  saveSubmission: SubmissionSaveFn;
  submitSubmission: SubmissionSubmitFn;
};

let syncState: OfflineSyncState = "synced";
let syncRunning = false;

export function getOfflineSyncState(): OfflineSyncState {
  return syncState;
}

function setSyncState(next: OfflineSyncState): void {
  syncState = next;
  if (typeof window !== "undefined") {
    window.dispatchEvent(
      new CustomEvent(OFFLINE_SYNC_EVENT, { detail: { state: next } }),
    );
  }
}

export async function enqueueOutbox(
  item: Omit<
    OfflineOutboxItem,
    "id" | "createdAtUtc" | "updatedAtUtc" | "attempts" | "status"
  > & { id?: string; status?: OfflineOutboxItem["status"] },
): Promise<OfflineOutboxItem> {
  const now = new Date().toISOString();
  const full: OfflineOutboxItem = {
    id: item.id ?? crypto.randomUUID(),
    userId: item.userId,
    kind: item.kind,
    status: item.status ?? "pending",
    createdAtUtc: now,
    updatedAtUtc: now,
    attempts: 0,
    targetId: item.targetId,
    payloadJson: item.payloadJson,
    localAttachmentId: item.localAttachmentId,
    scope: item.scope,
    scopeKey: item.scopeKey,
    fileName: item.fileName,
    contentType: item.contentType,
    sizeBytes: item.sizeBytes,
    lastError: item.lastError,
  };
  await saveOutboxItem(full);
  return full;
}

function kindOrder(kind: OutboxKind): number {
  if (kind === "attachment-upload") return 0;
  if (kind === "party-submission-save") return 1;
  return 2;
}

/** Replace local: attachment placeholders with server ids inside a JSON string. */
export function rewriteLocalAttachmentIds(
  payloadJson: string,
  map: Map<string, string>,
): string {
  if (map.size === 0) return payloadJson;
  let next = payloadJson;
  for (const [localId, serverId] of map) {
    next = next.split(localId).join(serverId);
  }
  return next;
}

export async function buildLocalAttachmentMap(
  userId: string,
): Promise<Map<string, string>> {
  const map = new Map<string, string>();
  const items = await listOutboxItems(userId);
  for (const item of items) {
    if (
      item.kind === "attachment-upload" &&
      item.localAttachmentId &&
      item.status === "done"
    ) {
      try {
        const parsed = JSON.parse(item.payloadJson) as {
          serverAttachmentId?: string;
        };
        if (parsed.serverAttachmentId) {
          map.set(item.localAttachmentId, parsed.serverAttachmentId);
        }
      } catch {
        /* ignore */
      }
    }
  }
  // Also check blobs that already have server ids
  const { listOfflineBlobs } = await import("./store");
  const blobs = await listOfflineBlobs(userId);
  for (const blob of blobs) {
    if (blob.serverAttachmentId) {
      map.set(blob.id, blob.serverAttachmentId);
    }
  }
  return map;
}

async function processAttachment(
  userId: string,
  item: OfflineOutboxItem,
  deps: OfflineSyncDeps,
): Promise<boolean> {
  const blob = await getOfflineBlob(userId, item.targetId);
  if (!blob) {
    await saveOutboxItem({
      ...item,
      status: "terminal",
      lastError: "الملف المحلي غير موجود",
      updatedAtUtc: new Date().toISOString(),
    });
    return false;
  }
  if (blob.serverAttachmentId) {
    await saveOutboxItem({
      ...item,
      status: "done",
      payloadJson: JSON.stringify({
        serverAttachmentId: blob.serverAttachmentId,
      }),
      updatedAtUtc: new Date().toISOString(),
    });
    return true;
  }
  const result = await deps.uploadAttachment({
    scope: blob.scope,
    scopeKey: blob.scopeKey,
    fileName: blob.fileName,
    contentType: blob.contentType,
    bytes: blob.bytes,
  });
  if (!result.ok) {
    await saveOutboxItem({
      ...item,
      status: result.terminal ? "terminal" : "failed",
      attempts: item.attempts + 1,
      lastError: result.error,
      updatedAtUtc: new Date().toISOString(),
    });
    return false;
  }
  await markBlobUploaded(userId, blob.id, result.attachmentId);
  await saveOutboxItem({
    ...item,
    status: "done",
    attempts: item.attempts + 1,
    payloadJson: JSON.stringify({ serverAttachmentId: result.attachmentId }),
    updatedAtUtc: new Date().toISOString(),
  });
  return true;
}

async function processSave(
  userId: string,
  item: OfflineOutboxItem,
  deps: OfflineSyncDeps,
): Promise<boolean> {
  const map = await buildLocalAttachmentMap(userId);
  const payloadJson = rewriteLocalAttachmentIds(item.payloadJson, map);
  if (payloadJson.includes("local:")) {
    await saveOutboxItem({
      ...item,
      status: "failed",
      lastError: "بانتظار رفع المرفقات",
      updatedAtUtc: new Date().toISOString(),
    });
    return false;
  }
  const result = await deps.saveSubmission({
    taskId: item.targetId,
    payloadJson,
  });
  if (!result.ok) {
    await saveOutboxItem({
      ...item,
      status: result.terminal ? "terminal" : "failed",
      attempts: item.attempts + 1,
      lastError: result.error,
      updatedAtUtc: new Date().toISOString(),
    });
    return false;
  }
  await deleteOutboxItem(userId, item.id);
  return true;
}

async function processSubmit(
  userId: string,
  item: OfflineOutboxItem,
  deps: OfflineSyncDeps,
): Promise<boolean> {
  // Ensure a save with rewritten ids ran first if queued.
  const pending = await listOutboxItems(userId);
  const blocking = pending.some(
    (other) =>
      other.id !== item.id &&
      other.targetId === item.targetId &&
      (other.kind === "attachment-upload" ||
        other.kind === "party-submission-save") &&
      other.status !== "done" &&
      other.status !== "terminal",
  );
  if (blocking) {
    await saveOutboxItem({
      ...item,
      status: "failed",
      lastError: "بانتظار اكتمال الحفظ والمرفقات",
      updatedAtUtc: new Date().toISOString(),
    });
    return false;
  }
  const result = await deps.submitSubmission({ taskId: item.targetId });
  if (!result.ok) {
    await saveOutboxItem({
      ...item,
      status: result.terminal ? "terminal" : "failed",
      attempts: item.attempts + 1,
      lastError: result.error,
      updatedAtUtc: new Date().toISOString(),
    });
    return false;
  }
  await deleteOutboxItem(userId, item.id);
  return true;
}

export async function runOfflineSync(
  userId: string,
  deps: OfflineSyncDeps,
): Promise<{ pending: number; failed: number }> {
  if (syncRunning) {
    return {
      pending: await publishPendingCount(userId),
      failed: 0,
    };
  }
  if (typeof navigator !== "undefined" && !navigator.onLine) {
    setSyncState("offline");
    return { pending: await publishPendingCount(userId), failed: 0 };
  }

  syncRunning = true;
  setSyncState("syncing");
  let failed = 0;
  try {
    const items = (await listOutboxItems(userId))
      .filter(
        (item) =>
          item.status === "pending" ||
          item.status === "failed" ||
          item.status === "uploading",
      )
      .sort((a, b) => {
        const order = kindOrder(a.kind) - kindOrder(b.kind);
        if (order !== 0) return order;
        return a.createdAtUtc.localeCompare(b.createdAtUtc);
      });

    for (const item of items) {
      await saveOutboxItem({
        ...item,
        status: "uploading",
        updatedAtUtc: new Date().toISOString(),
      });
      let ok = false;
      if (item.kind === "attachment-upload") {
        ok = await processAttachment(userId, item, deps);
      } else if (item.kind === "party-submission-save") {
        ok = await processSave(userId, item, deps);
      } else {
        ok = await processSubmit(userId, item, deps);
      }
      if (!ok) failed += 1;
    }
  } finally {
    syncRunning = false;
  }

  const pending = await publishPendingCount(userId);
  setSyncState(failed > 0 || pending > 0 ? "failed" : "synced");
  return { pending, failed };
}
