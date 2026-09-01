export type OfflineSyncState = "synced" | "syncing" | "failed" | "offline";

export type OutboxKind =
  | "attachment-upload"
  | "party-submission-save"
  | "party-submission-submit"
  | "operations-task-patch"
  | "operations-task-comment"
  | "property-court-access"
  | "key-envelope-create"
  | "key-envelope-assignment-add"
  | "key-envelope-assignment-confirm"
  | "key-envelope-handoff-create"
  | "key-envelope-handoff-confirm";

export type OutboxStatus =
  | "pending"
  | "uploading"
  | "done"
  | "failed"
  | "terminal";

export type OfflineOutboxItem = {
  id: string;
  userId: string;
  kind: OutboxKind;
  status: OutboxStatus;
  createdAtUtc: string;
  updatedAtUtc: string;
  attempts: number;
  lastError?: string;
  /** Attachment: local blob id. Submission: task id. */
  targetId: string;
  /** JSON payload for replay. */
  payloadJson: string;
  /** When kind is attachment-upload, the local placeholder id written into drafts. */
  localAttachmentId?: string;
  scope?: string;
  scopeKey?: string;
  fileName?: string;
  contentType?: string;
  sizeBytes?: number;
};

export type OfflineDraftRecord = {
  id: string;
  userId: string;
  taskId: string;
  kind: "field-inspection";
  payloadJson: string;
  updatedAtUtc: string;
};

export type OfflineBlobRecord = {
  id: string;
  userId: string;
  scope: string;
  scopeKey: string;
  fileName: string;
  contentType: string;
  sizeBytes: number;
  bytes: ArrayBuffer;
  createdAtUtc: string;
  /** Server attachment id after successful upload. */
  serverAttachmentId?: string;
};

export type OfflinePrefetchRecord = {
  id: string;
  userId: string;
  kind: string;
  payloadJson: string;
  updatedAtUtc: string;
};

export type OfflineMetaRecord = {
  key: string;
  valueJson: string;
};

export type OfflineLease = {
  userId: string;
  offlineSinceUtc: string | null;
  leaseExpiresAtUtc: string | null;
  warned1h: boolean;
  warned2h: boolean;
  locked: boolean;
};

export const OFFLINE_CHANNEL = "ejada-offline";
export const OFFLINE_PENDING_EVENT = "ejada-offline-pending-changed";
export const OFFLINE_SYNC_EVENT = "ejada-offline-sync-changed";
export const OFFLINE_LEASE_EVENT = "ejada-offline-lease-changed";
export const OFFLINE_DB_NAME = "ejada-offline-v1";
export const OFFLINE_DB_VERSION = 1;
export const OFFLINE_LEASE_MS = 3 * 60 * 60 * 1000;
export const OFFLINE_WARN_1H_MS = 60 * 60 * 1000;
export const OFFLINE_WARN_2H_MS = 2 * 60 * 60 * 1000;
/** Service Worker Background Sync tag (must match apps/shell/public/sw.js). */
export const OFFLINE_BACKGROUND_SYNC_TAG = "ejada-offline-sync";

const LOCAL_ATTACHMENT_PREFIX = "local:";

export function makeLocalAttachmentId(): string {
  return `${LOCAL_ATTACHMENT_PREFIX}${crypto.randomUUID()}`;
}
