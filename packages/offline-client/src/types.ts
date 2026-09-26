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
  /**
   * Stable Idempotency-Key for this outbox intent. Replayed on flush so
   * online retries after timeout match the original user action.
   */
  idempotencyKey?: string;
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
  /**
   * Extra upload-request fields captured on the device (photo EXIF location and
   * capture time, document type) — replayed with the upload so they are not lost.
   */
  uploadExtras?: Record<string, unknown>;
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
/** Last permissions of an offline-capable user, so an offline cold start keeps their role. */
export const OFFLINE_ACCESS_STORAGE_KEY = "ejada_offline_access";
/** Service Worker Background Sync tag (must match apps/shell/public/sw.js). */
export const OFFLINE_BACKGROUND_SYNC_TAG = "ejada-offline-sync";

const LOCAL_ATTACHMENT_PREFIX = "local:";

/**
 * RFC 4122 v4 id. `crypto.randomUUID` only exists on secure origins, and the offline
 * queue must also work on http://LAN-IP field devices — getRandomValues works on both.
 */
export function randomUuid(): string {
  if (typeof crypto.randomUUID === "function") return crypto.randomUUID();
  const bytes = crypto.getRandomValues(new Uint8Array(16));
  bytes[6] = (bytes[6]! & 0x0f) | 0x40;
  bytes[8] = (bytes[8]! & 0x3f) | 0x80;
  const hex = Array.from(bytes, (b) => b.toString(16).padStart(2, "0")).join("");
  return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-${hex.slice(12, 16)}-${hex.slice(16, 20)}-${hex.slice(20)}`;
}

export function makeLocalAttachmentId(): string {
  return `${LOCAL_ATTACHMENT_PREFIX}${randomUuid()}`;
}
