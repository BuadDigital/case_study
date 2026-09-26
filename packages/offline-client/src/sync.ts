import {
  deleteOfflineBlobs,
  deleteOfflineDraft,
  deleteOutboxItem,
  getOfflineBlob,
  getOfflineDraft,
  getOutboxItem,
  listOfflineBlobRows,
  listOutboxItems,
  markBlobUploaded,
  publishPendingCount,
  saveOutboxItem,
} from "./store";
import {
  OFFLINE_BACKGROUND_SYNC_TAG,
  OFFLINE_SYNC_EVENT,
  randomUuid,
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
  /** Device-captured request fields (photo EXIF, document type) to send with the upload. */
  extras?: Record<string, unknown>;
}) => Promise<{ ok: true; attachmentId: string } | { ok: false; error: string; terminal?: boolean }>;

export type SubmissionSaveFn = (input: {
  taskId: string;
  payloadJson: string;
}) => Promise<{ ok: true } | { ok: false; error: string; terminal?: boolean }>;

export type SubmissionSubmitFn = (input: {
  taskId: string;
  idempotencyKey?: string;
}) => Promise<{ ok: true } | { ok: false; error: string; terminal?: boolean }>;

export type KeyEnvelopeCreateFn = (input: {
  bodyJson: string;
  idempotencyKey?: string;
}) => Promise<
  | { ok: true; envelopeId: string }
  | { ok: false; error: string; terminal?: boolean }
>;

export type KeyEnvelopeMutationFn = (input: {
  envelopeId: string;
  payloadJson: string;
  idempotencyKey?: string;
}) => Promise<{ ok: true } | { ok: false; error: string; terminal?: boolean }>;

export type OperationsTaskPatchFn = (input: {
  taskId: string;
  bodyJson: string;
}) => Promise<{ ok: true } | { ok: false; error: string; terminal?: boolean }>;

export type OperationsTaskCommentFn = (input: {
  taskId: string;
  payloadJson: string;
}) => Promise<{ ok: true } | { ok: false; error: string; terminal?: boolean }>;

export type PropertyCourtAccessFn = (input: {
  bodyJson: string;
}) => Promise<{ ok: true } | { ok: false; error: string; terminal?: boolean }>;

export type OfflineSyncDeps = {
  uploadAttachment: AttachmentUploadFn;
  saveSubmission: SubmissionSaveFn;
  submitSubmission: SubmissionSubmitFn;
  patchOperationsTask?: OperationsTaskPatchFn;
  addOperationsTaskComment?: OperationsTaskCommentFn;
  upsertPropertyCourtAccess?: PropertyCourtAccessFn;
  createKeyEnvelope?: KeyEnvelopeCreateFn;
  addKeyEnvelopeAssignment?: KeyEnvelopeMutationFn;
  confirmKeyEnvelopeAssignment?: KeyEnvelopeMutationFn;
  createKeyEnvelopeHandoff?: KeyEnvelopeMutationFn;
  confirmKeyEnvelopeHandoff?: KeyEnvelopeMutationFn;
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
    id: item.id ?? randomUuid(),
    userId: item.userId,
    kind: item.kind,
    status: item.status ?? "pending",
    createdAtUtc: now,
    updatedAtUtc: now,
    attempts: 0,
    targetId: item.targetId,
    payloadJson: item.payloadJson,
    idempotencyKey: item.idempotencyKey,
    localAttachmentId: item.localAttachmentId,
    scope: item.scope,
    scopeKey: item.scopeKey,
    fileName: item.fileName,
    contentType: item.contentType,
    sizeBytes: item.sizeBytes,
    lastError: item.lastError,
  };
  await saveOutboxItem(full);
  void requestBackgroundSync();
  return full;
}

/** Ask the SW to wake the page and sync when connectivity returns (Chrome/Android). */
export async function requestBackgroundSync(): Promise<boolean> {
  if (typeof navigator === "undefined" || !("serviceWorker" in navigator)) {
    return false;
  }
  try {
    const reg = await navigator.serviceWorker.ready;
    const syncManager = (
      reg as ServiceWorkerRegistration & {
        sync?: { register: (tag: string) => Promise<void> };
      }
    ).sync;
    if (!syncManager?.register) return false;
    await syncManager.register(OFFLINE_BACKGROUND_SYNC_TAG);
    return true;
  } catch {
    return false;
  }
}

function kindOrder(kind: OutboxKind): number {
  if (kind === "attachment-upload") return 0;
  if (
    kind === "party-submission-save" ||
    kind === "key-envelope-create" ||
    kind === "operations-task-patch" ||
    kind === "property-court-access"
  ) {
    return 1;
  }
  if (
    kind === "operations-task-comment" ||
    kind === "key-envelope-assignment-add" ||
    kind === "key-envelope-handoff-create"
  ) {
    return 2;
  }
  if (
    kind === "key-envelope-assignment-confirm" ||
    kind === "key-envelope-handoff-confirm"
  ) {
    return 3;
  }
  return 4; // party-submission-submit
}

function isLocalEnvelopeId(id: string): boolean {
  return (
    id.startsWith("local-pending:") ||
    id.startsWith("pending:") ||
    id.startsWith("local:")
  );
}

function envelopeMapKey(userId: string, clientId: string): string {
  return `envelope-map:${userId}:${clientId}`;
}

async function rememberEnvelopeIdMap(
  userId: string,
  clientId: string,
  serverId: string,
): Promise<void> {
  const { setMeta } = await import("./store");
  await setMeta(envelopeMapKey(userId, clientId), { serverId });
}

async function resolveEnvelopeId(
  userId: string,
  envelopeId: string,
): Promise<string | null> {
  if (!isLocalEnvelopeId(envelopeId)) return envelopeId;
  const { getMeta } = await import("./store");
  const mapped = await getMeta<{ serverId?: string }>(
    envelopeMapKey(userId, envelopeId),
  );
  return mapped?.serverId?.trim() || null;
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

/** Built once per sync run; processAttachment appends fresh server ids as uploads land. */
async function buildLocalAttachmentMap(
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
  // Also check blobs that already have server ids (meta only — no byte decrypt).
  const { listOfflineBlobMeta } = await import("./store");
  const blobs = await listOfflineBlobMeta(userId);
  for (const blob of blobs) {
    if (blob.serverAttachmentId) {
      map.set(blob.id, blob.serverAttachmentId);
    }
  }
  return map;
}

function recordUploadedAttachment(
  attachmentMap: Map<string, string>,
  item: OfflineOutboxItem,
  blobId: string,
  serverAttachmentId: string,
): void {
  attachmentMap.set(blobId, serverAttachmentId);
  if (item.localAttachmentId) {
    attachmentMap.set(item.localAttachmentId, serverAttachmentId);
  }
}

async function processAttachment(
  userId: string,
  item: OfflineOutboxItem,
  deps: OfflineSyncDeps,
  attachmentMap: Map<string, string>,
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
    recordUploadedAttachment(
      attachmentMap,
      item,
      blob.id,
      blob.serverAttachmentId,
    );
    await markBlobUploaded(userId, blob.id, blob.serverAttachmentId);
    await deleteOutboxItem(userId, item.id);
    return true;
  }
  const result = await deps.uploadAttachment({
    scope: blob.scope,
    scopeKey: blob.scopeKey,
    fileName: blob.fileName,
    contentType: blob.contentType,
    bytes: blob.bytes,
    extras: blob.uploadExtras,
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
  // Confirmed: the local bytes go now (spec §3.4); the encrypted id mapping stays so
  // queued saves that still name the local id can be rewritten.
  await markBlobUploaded(userId, blob.id, result.attachmentId);
  recordUploadedAttachment(attachmentMap, item, blob.id, result.attachmentId);
  await deleteOutboxItem(userId, item.id);
  return true;
}

/** Draft kinds kept locally per task (`OfflineDraftRecord.kind`). */
const DRAFT_KINDS = ["field-inspection"] as const;

/**
 * The server confirmed a queued save. A newer autosave may have been folded into
 * the same row while it was in flight — then it stays queued; otherwise the row
 * goes, and so does the local draft once no other save for the task is waiting.
 */
async function completeSave(
  userId: string,
  item: OfflineOutboxItem,
): Promise<void> {
  const current = await getOutboxItem(userId, item.id);
  if (current && current.payloadJson !== item.payloadJson) {
    await saveOutboxItem({
      ...current,
      status: "pending",
      updatedAtUtc: new Date().toISOString(),
    });
    return;
  }
  await deleteOutboxItem(userId, item.id);
  const stillQueued = (await listOutboxItems(userId)).some(
    (other) =>
      other.kind === "party-submission-save" && other.targetId === item.targetId,
  );
  if (stillQueued) return;
  for (const kind of DRAFT_KINDS) {
    const id = `${kind}:${item.targetId}`;
    // Typing continued after this save was queued: that newer local copy is still unsent.
    const draft = await getOfflineDraft(userId, id);
    if (draft && Date.parse(draft.updatedAtUtc) > Date.parse(item.updatedAtUtc)) continue;
    await deleteOfflineDraft(userId, id);
  }
}

/** Upload id mappings are kept this long after sync for late local-id rewrites. */
const RELEASED_MAPPING_TTL_MS = 7 * 24 * 60 * 60 * 1000;

/**
 * After a clean pass: drop what earlier builds left behind — "done" outbox rows and
 * uploaded photos that still held their bytes — and expire old id mappings.
 * Prefetched documents (ids that are not `local:`) are a read cache and stay.
 */
async function releaseSyncedLocalCopies(userId: string): Promise<void> {
  const items = await listOutboxItems(userId);
  for (const item of items) {
    if (item.status === "done") await deleteOutboxItem(userId, item.id);
  }
  const active = items.some(
    (item) =>
      item.status === "pending" ||
      item.status === "failed" ||
      item.status === "uploading",
  );
  const rows = await listOfflineBlobRows(userId);
  const expired: string[] = [];
  const now = Date.now();
  for (const row of rows) {
    if (!row.id.startsWith("local:")) continue;
    if (row.released) {
      const age = now - Date.parse(row.updatedAtUtc);
      if (!active && age > RELEASED_MAPPING_TTL_MS) expired.push(row.id);
    } else if (row.serverAttachmentId) {
      await markBlobUploaded(userId, row.id, row.serverAttachmentId);
    }
  }
  await deleteOfflineBlobs(userId, expired);
}

async function processSave(
  userId: string,
  item: OfflineOutboxItem,
  deps: OfflineSyncDeps,
  attachmentMap: Map<string, string>,
): Promise<boolean> {
  const payloadJson = rewriteLocalAttachmentIds(item.payloadJson, attachmentMap);
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
  await completeSave(userId, item);
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
  const result = await deps.submitSubmission({
    taskId: item.targetId,
    idempotencyKey: item.idempotencyKey,
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

async function processOperationsTaskPatch(
  userId: string,
  item: OfflineOutboxItem,
  deps: OfflineSyncDeps,
  attachmentMap: Map<string, string>,
): Promise<boolean> {
  if (!deps.patchOperationsTask) {
    await saveOutboxItem({
      ...item,
      status: "failed",
      lastError: "مزامنة مهام العمليات غير مفعّلة",
      updatedAtUtc: new Date().toISOString(),
    });
    return false;
  }
  const bodyJson = rewriteLocalAttachmentIds(item.payloadJson, attachmentMap);
  if (bodyJson.includes("local:")) {
    await saveOutboxItem({
      ...item,
      status: "failed",
      lastError: "بانتظار رفع المرفقات",
      updatedAtUtc: new Date().toISOString(),
    });
    return false;
  }
  const result = await deps.patchOperationsTask({
    taskId: item.targetId,
    bodyJson,
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

async function processOperationsTaskComment(
  userId: string,
  item: OfflineOutboxItem,
  deps: OfflineSyncDeps,
  attachmentMap: Map<string, string>,
): Promise<boolean> {
  if (!deps.addOperationsTaskComment) {
    await saveOutboxItem({
      ...item,
      status: "failed",
      lastError: "مزامنة تعليقات المهام غير مفعّلة",
      updatedAtUtc: new Date().toISOString(),
    });
    return false;
  }
  const payloadJson = rewriteLocalAttachmentIds(item.payloadJson, attachmentMap);
  if (payloadJson.includes("local:")) {
    await saveOutboxItem({
      ...item,
      status: "failed",
      lastError: "بانتظار رفع مرفقات التعليق",
      updatedAtUtc: new Date().toISOString(),
    });
    return false;
  }
  const result = await deps.addOperationsTaskComment({
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

async function processPropertyCourtAccess(
  userId: string,
  item: OfflineOutboxItem,
  deps: OfflineSyncDeps,
): Promise<boolean> {
  if (!deps.upsertPropertyCourtAccess) {
    await saveOutboxItem({
      ...item,
      status: "failed",
      lastError: "مزامنة مسار الدخول غير مفعّلة",
      updatedAtUtc: new Date().toISOString(),
    });
    return false;
  }
  const result = await deps.upsertPropertyCourtAccess({
    bodyJson: item.payloadJson,
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

async function processKeyEnvelopeCreate(
  userId: string,
  item: OfflineOutboxItem,
  deps: OfflineSyncDeps,
  attachmentMap: Map<string, string>,
): Promise<boolean> {
  if (!deps.createKeyEnvelope) {
    await saveOutboxItem({
      ...item,
      status: "failed",
      lastError: "مزامنة الظروف غير مفعّلة",
      updatedAtUtc: new Date().toISOString(),
    });
    return false;
  }
  const bodyJson = rewriteLocalAttachmentIds(item.payloadJson, attachmentMap);
  if (bodyJson.includes("local:")) {
    await saveOutboxItem({
      ...item,
      status: "failed",
      lastError: "بانتظار رفع مرفقات الظرف",
      updatedAtUtc: new Date().toISOString(),
    });
    return false;
  }
  const result = await deps.createKeyEnvelope({
    bodyJson,
    idempotencyKey: item.idempotencyKey,
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
  // Map client placeholder ids so later assignment/handoff outbox items can resolve.
  if (result.envelopeId) {
    await rememberEnvelopeIdMap(userId, item.targetId, result.envelopeId);
    try {
      const parsed = JSON.parse(item.payloadJson) as {
        clientEnvelopeId?: string;
      };
      if (parsed.clientEnvelopeId) {
        await rememberEnvelopeIdMap(
          userId,
          parsed.clientEnvelopeId,
          result.envelopeId,
        );
      }
    } catch {
      /* ignore */
    }
  }
  await deleteOutboxItem(userId, item.id);
  return true;
}

async function processKeyEnvelopeMutation(
  userId: string,
  item: OfflineOutboxItem,
  deps: OfflineSyncDeps,
  mutate:
    | "addKeyEnvelopeAssignment"
    | "confirmKeyEnvelopeAssignment"
    | "createKeyEnvelopeHandoff"
    | "confirmKeyEnvelopeHandoff",
  attachmentMap: Map<string, string>,
): Promise<boolean> {
  const fn = deps[mutate];
  if (!fn) {
    await saveOutboxItem({
      ...item,
      status: "failed",
      lastError: "مزامنة المناولة/الإسناد غير مفعّلة",
      updatedAtUtc: new Date().toISOString(),
    });
    return false;
  }

  let payload: { envelopeId?: string; [key: string]: unknown };
  try {
    payload = JSON.parse(item.payloadJson) as {
      envelopeId?: string;
      [key: string]: unknown;
    };
  } catch {
    await saveOutboxItem({
      ...item,
      status: "terminal",
      lastError: "بيانات غير صالحة",
      updatedAtUtc: new Date().toISOString(),
    });
    return false;
  }

  const clientEnvelopeId = String(payload.envelopeId ?? item.targetId).trim();
  const envelopeId = await resolveEnvelopeId(userId, clientEnvelopeId);
  if (!envelopeId) {
    await saveOutboxItem({
      ...item,
      status: "failed",
      lastError: "بانتظار مزامنة تسجيل الظرف",
      updatedAtUtc: new Date().toISOString(),
    });
    return false;
  }

  const payloadJson = rewriteLocalAttachmentIds(
    JSON.stringify({ ...payload, envelopeId }),
    attachmentMap,
  );
  if (payloadJson.includes("local:")) {
    await saveOutboxItem({
      ...item,
      status: "failed",
      lastError: "بانتظار رفع مرفقات المناولة",
      updatedAtUtc: new Date().toISOString(),
    });
    return false;
  }

  const result = await fn({
    envelopeId,
    payloadJson,
    idempotencyKey: item.idempotencyKey,
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

/** Web Locks name shared by every tab of this origin. */
const SYNC_LOCK_NAME = "ejada-offline-sync";

/**
 * One replay at a time across tabs: every open tab runs the coordinator over the same
 * IndexedDB outbox, and two tabs replaying the same queued submit sent it twice — one
 * hit a row-version conflict and the item was dropped. A tab that finds the lock held
 * skips this pass; the holder is already syncing. (Web Locks needs a secure origin;
 * without it each tab still has the in-tab guard below.)
 */
export async function runOfflineSync(
  userId: string,
  deps: OfflineSyncDeps,
): Promise<{ pending: number; failed: number }> {
  const locks = typeof navigator !== "undefined" ? navigator.locks : undefined;
  if (!locks?.request) return runOfflineSyncPass(userId, deps);
  return locks.request(SYNC_LOCK_NAME, { ifAvailable: true }, async (lock) =>
    lock
      ? runOfflineSyncPass(userId, deps)
      : { pending: await publishPendingCount(userId), failed: 0 },
  );
}

async function runOfflineSyncPass(
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

    const attachmentMap =
      items.length > 0
        ? await buildLocalAttachmentMap(userId)
        : new Map<string, string>();

    for (const item of items) {
      await saveOutboxItem({
        ...item,
        status: "uploading",
        updatedAtUtc: new Date().toISOString(),
      });
      let ok = false;
      if (item.kind === "attachment-upload") {
        ok = await processAttachment(userId, item, deps, attachmentMap);
      } else if (item.kind === "party-submission-save") {
        ok = await processSave(userId, item, deps, attachmentMap);
      } else if (item.kind === "party-submission-submit") {
        ok = await processSubmit(userId, item, deps);
      } else if (item.kind === "operations-task-patch") {
        ok = await processOperationsTaskPatch(
          userId,
          item,
          deps,
          attachmentMap,
        );
      } else if (item.kind === "operations-task-comment") {
        ok = await processOperationsTaskComment(
          userId,
          item,
          deps,
          attachmentMap,
        );
      } else if (item.kind === "property-court-access") {
        ok = await processPropertyCourtAccess(userId, item, deps);
      } else if (item.kind === "key-envelope-create") {
        ok = await processKeyEnvelopeCreate(userId, item, deps, attachmentMap);
      } else if (item.kind === "key-envelope-assignment-add") {
        ok = await processKeyEnvelopeMutation(
          userId,
          item,
          deps,
          "addKeyEnvelopeAssignment",
          attachmentMap,
        );
      } else if (item.kind === "key-envelope-assignment-confirm") {
        ok = await processKeyEnvelopeMutation(
          userId,
          item,
          deps,
          "confirmKeyEnvelopeAssignment",
          attachmentMap,
        );
      } else if (item.kind === "key-envelope-handoff-create") {
        ok = await processKeyEnvelopeMutation(
          userId,
          item,
          deps,
          "createKeyEnvelopeHandoff",
          attachmentMap,
        );
      } else if (item.kind === "key-envelope-handoff-confirm") {
        ok = await processKeyEnvelopeMutation(
          userId,
          item,
          deps,
          "confirmKeyEnvelopeHandoff",
          attachmentMap,
        );
      } else {
        ok = false;
        await saveOutboxItem({
          ...item,
          status: "terminal",
          lastError: `نوع طابور غير معروف: ${item.kind}`,
          updatedAtUtc: new Date().toISOString(),
        });
      }
      if (!ok) failed += 1;
    }
    await releaseSyncedLocalCopies(userId).catch(() => {});
  } finally {
    syncRunning = false;
  }

  const pending = await publishPendingCount(userId);
  setSyncState(failed > 0 || pending > 0 ? "failed" : "synced");
  return { pending, failed };
}
