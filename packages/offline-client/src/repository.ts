import { enqueueOutbox } from "./sync";
import {
  getOfflineDraft,
  saveOfflineBlob,
  saveOfflineDraft,
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
}): Promise<void> {
  await enqueueOutbox({
    userId: input.userId,
    kind: "party-submission-submit",
    targetId: input.taskId,
    payloadJson: JSON.stringify({ taskId: input.taskId }),
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
