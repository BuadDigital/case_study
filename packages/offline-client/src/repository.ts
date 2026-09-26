import { enqueueOutbox } from "./sync";
import {
  getOfflineDraft,
  listOutboxItems,
  saveOfflineBlob,
  saveOfflineDraft,
  saveOutboxItem,
} from "./store";
import {
  makeLocalAttachmentId,
  type OfflineDraftRecord,
} from "./types";

export async function persistDraftLocally(input: {
  userId: string;
  taskId: string;
  kind: OfflineDraftRecord["kind"];
  payload: unknown;
}): Promise<OfflineDraftRecord> {
  const id = `${input.kind}:${input.taskId}`;
  const record: OfflineDraftRecord = {
    id,
    userId: input.userId,
    taskId: input.taskId,
    kind: input.kind,
    payloadJson: JSON.stringify(input.payload),
    updatedAtUtc: new Date().toISOString(),
  };
  await saveOfflineDraft(record);
  // Each save is a full snapshot: fold it into the save already waiting for this task
  // instead of queueing one encrypted copy per autosave while offline.
  const waiting = (await listOutboxItems(input.userId)).find(
    (item) =>
      item.kind === "party-submission-save" &&
      item.targetId === input.taskId &&
      (item.status === "pending" || item.status === "failed"),
  );
  if (waiting) {
    await saveOutboxItem({
      ...waiting,
      payloadJson: record.payloadJson,
      status: "pending",
      updatedAtUtc: record.updatedAtUtc,
    });
    return record;
  }
  await enqueueOutbox({
    userId: input.userId,
    kind: "party-submission-save",
    targetId: input.taskId,
    payloadJson: record.payloadJson,
  });
  return record;
}

export async function cachePrefetchAttachment(input: {
  userId: string;
  attachmentId: string;
  scope: string;
  scopeKey: string;
  fileName: string;
  contentType: string;
  bytes: ArrayBuffer;
}): Promise<void> {
  await saveOfflineBlob({
    id: input.attachmentId,
    userId: input.userId,
    scope: input.scope,
    scopeKey: input.scopeKey,
    fileName: input.fileName,
    contentType: input.contentType,
    sizeBytes: input.bytes.byteLength,
    bytes: input.bytes,
    createdAtUtc: new Date().toISOString(),
    serverAttachmentId: input.attachmentId,
  });
}

export async function enqueueSubmitLocally(input: {
  userId: string;
  taskId: string;
  idempotencyKey?: string;
}): Promise<void> {
  await enqueueOutbox({
    userId: input.userId,
    kind: "party-submission-submit",
    targetId: input.taskId,
    payloadJson: JSON.stringify({ taskId: input.taskId }),
    idempotencyKey: input.idempotencyKey,
  });
}

export async function persistAttachmentLocally(input: {
  userId: string;
  scope: string;
  scopeKey: string;
  fileName: string;
  contentType: string;
  bytes: ArrayBuffer;
  localId?: string;
  uploadExtras?: Record<string, unknown>;
}): Promise<{ localAttachmentId: string }> {
  const localAttachmentId = input.localId ?? makeLocalAttachmentId();
  await saveOfflineBlob({
    id: localAttachmentId,
    userId: input.userId,
    scope: input.scope,
    scopeKey: input.scopeKey,
    fileName: input.fileName,
    contentType: input.contentType,
    sizeBytes: input.bytes.byteLength,
    bytes: input.bytes,
    createdAtUtc: new Date().toISOString(),
    uploadExtras: input.uploadExtras,
  });
  await enqueueOutbox({
    userId: input.userId,
    kind: "attachment-upload",
    targetId: localAttachmentId,
    localAttachmentId,
    scope: input.scope,
    scopeKey: input.scopeKey,
    fileName: input.fileName,
    contentType: input.contentType,
    sizeBytes: input.bytes.byteLength,
    payloadJson: JSON.stringify({
      scope: input.scope,
      scopeKey: input.scopeKey,
    }),
  });
  return { localAttachmentId };
}

export async function readLocalDraftPayload<T>(
  userId: string,
  kind: OfflineDraftRecord["kind"],
  taskId: string,
): Promise<T | null> {
  const draft = await getOfflineDraft(userId, `${kind}:${taskId}`);
  if (!draft) return null;
  try {
    return JSON.parse(draft.payloadJson) as T;
  } catch {
    return null;
  }
}
