/**
 * Pure state behind `OfflineSyncCoordinator`: which outbox rows are still live,
 * the supervisor heartbeat payload, the top-bar label/icon, the replay failure
 * classification and the Arabic labels. No React, no I/O —
 * `useOfflineSyncCoordinator` and `offline-sync-replay` call these and the
 * component only renders their output.
 */
import type {
  OfflineOutboxItem,
  OfflineSyncState,
} from "@platform/offline-client";

export const OFFLINE_PENDING_COUNT_SESSION_KEY = "ejada_offline_pending_count";
export const OFFLINE_SYNC_INTERVAL_MS = 30_000;
export const FIELD_SYNC_HEARTBEAT_INTERVAL_MS = 60_000;
/** Outbox rows older than this are flagged in the pending list. */
export const STALE_OUTBOX_HOURS = 2;

export const UNAUTHENTICATED_REPLAY_ERROR = "غير مصادق";

export function arrayBufferToBase64(buf: ArrayBuffer): string {
  const bytes = new Uint8Array(buf);
  let binary = "";
  for (let i = 0; i < bytes.length; i += 1) {
    binary += String.fromCharCode(bytes[i]!);
  }
  return btoa(binary);
}

export function outboxKindLabel(kind: string): string {
  switch (kind) {
    case "attachment-upload":
      return "رفع مرفق";
    case "party-submission-save":
      return "حفظ مسودة";
    case "party-submission-submit":
      return "إرسال مهمة";
    case "operations-task-patch":
      return "تحديث مهمة عمليات";
    case "operations-task-comment":
      return "تعليق مهمة";
    case "property-court-access":
      return "مسار دخول المحكمة";
    case "key-envelope-create":
      return "تسجيل ظرف مفاتيح";
    case "key-envelope-assignment-add":
      return "إسناد ظرف";
    case "key-envelope-assignment-confirm":
      return "تأكيد إسناد";
    case "key-envelope-handoff-create":
      return "مناولة مفاتيح";
    case "key-envelope-handoff-confirm":
      return "تأكيد مناولة";
    default:
      return kind;
  }
}

export function ageHours(iso: string, now: number = Date.now()): number {
  const t = Date.parse(iso);
  if (Number.isNaN(t)) return 0;
  return (now - t) / (60 * 60 * 1000);
}

export function isStaleOutboxItem(
  item: Pick<OfflineOutboxItem, "createdAtUtc">,
  now: number = Date.now(),
): boolean {
  return ageHours(item.createdAtUtc, now) >= STALE_OUTBOX_HOURS;
}

/** Rows that still need the network: queued, in flight, or awaiting retry. */
export function activeOutboxItems<T extends Pick<OfflineOutboxItem, "status">>(
  items: T[],
): T[] {
  return items.filter(
    (item) =>
      item.status === "pending" ||
      item.status === "uploading" ||
      item.status === "failed",
  );
}

export type FieldSyncHeartbeatMeta = {
  displayName?: string | null;
  roleId?: string | null;
};

export type FieldSyncHeartbeatReport = {
  pendingCount: number;
  oldestPendingAtUtc?: string | null;
  kinds: string[];
  displayName?: string | null;
  roleId?: string | null;
};

/**
 * Supervisor heartbeat body. An idle queue reports zero without an oldest
 * timestamp; a live queue reports the oldest row and the distinct kinds in
 * first-seen order (single pass — no sort or extra arrays).
 */
export function buildFieldSyncHeartbeat(
  items: OfflineOutboxItem[],
  meta: FieldSyncHeartbeatMeta,
): FieldSyncHeartbeatReport {
  const active = activeOutboxItems(items);
  if (active.length === 0) {
    return {
      pendingCount: 0,
      kinds: [],
      displayName: meta.displayName,
      roleId: meta.roleId,
    };
  }
  let oldest: string | undefined;
  const kindSet = new Set<string>();
  for (const item of active) {
    if (oldest === undefined || item.createdAtUtc < oldest) {
      oldest = item.createdAtUtc;
    }
    kindSet.add(item.kind);
  }
  return {
    pendingCount: active.length,
    oldestPendingAtUtc: oldest ?? null,
    kinds: [...kindSet],
    displayName: meta.displayName,
    roleId: meta.roleId,
  };
}

export type SyncStatusInput = {
  locked: boolean;
  syncState: OfflineSyncState;
  pending: number;
};

export function syncStatusLabel({
  locked,
  syncState,
  pending,
}: SyncStatusInput): string {
  if (locked) return "جلسة offline مقفلة";
  if (syncState === "syncing") return "جاري المزامنة";
  if (syncState === "offline") {
    return pending > 0
      ? `دون اتصال — ${pending} في طابور الحفظ`
      : "دون اتصال";
  }
  if (syncState === "failed") return "فشلت المزامنة — إعادة محاولة";
  if (pending > 0) return `${pending} بانتظار المزامنة`;
  return "تمت المزامنة";
}

export function syncStatusIcon(
  syncState: OfflineSyncState,
  pending: number,
): "🕓" | "⚠️" | "✅" {
  if (syncState === "syncing") return "🕓";
  if (syncState === "failed" || pending > 0) return "⚠️";
  return "✅";
}

export function pendingUnloadWarning(pending: number): string {
  return `هناك ${pending} عناصر لم تُرفع بعد. أبقِ النظام مفتوحاً حتى تكتمل.`;
}

/** Toasts to raise for an offline lease tick, in display order. */
export function offlineLeaseToasts(lease: {
  warn1h: boolean;
  warn2h: boolean;
}): string[] {
  const out: string[] = [];
  if (lease.warn1h) out.push("مضت ساعة دون اتصال — تبقى ساعتان قبل القفل");
  if (lease.warn2h) out.push("مضت ساعتان دون اتصال — تبقى ساعة قبل القفل");
  return out;
}

/** An `auth` / `forbidden` reply means the session is gone: purge, don't retry. */
export function isAuthRejected(kind: string | undefined): boolean {
  return kind === "auth" || kind === "forbidden";
}

export type ReplayFailure = { ok: false; error: string; terminal: boolean };

/**
 * Classifies an API failure for the outbox: auth/forbidden is always terminal;
 * validation is terminal only for handlers whose payload cannot be fixed by a
 * retry (`validationTerminal`). Everything else stays retryable.
 */
export function replayFailure(
  kind: string | undefined,
  error: string,
  options: { validationTerminal?: boolean } = {},
): ReplayFailure {
  return {
    ok: false,
    error,
    terminal:
      isAuthRejected(kind) ||
      (options.validationTerminal === true && kind === "validation"),
  };
}

export function unauthenticatedReplayFailure(): ReplayFailure {
  return { ok: false, error: UNAUTHENTICATED_REPLAY_ERROR, terminal: true };
}

export function invalidPayloadFailure(error: string): ReplayFailure {
  return { ok: false, error, terminal: true };
}

/** `null` when the stored JSON no longer parses — the row is then terminal. */
export function parseReplayPayload<T>(json: string): T | null {
  try {
    return JSON.parse(json) as T;
  } catch {
    return null;
  }
}

/** Picks the server attachment that matches a queued upload, else the first row. */
export function matchExistingAttachment<
  T extends { id?: string; fileName: string; sizeBytes: number },
>(existing: T[], upload: { fileName: string; byteLength: number }): T | undefined {
  if (existing.length === 0) return undefined;
  return (
    existing.find(
      (row) =>
        row.fileName === upload.fileName && row.sizeBytes === upload.byteLength,
    ) ?? existing[0]
  );
}
