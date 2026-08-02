import { openDB, type DBSchema, type IDBPDatabase } from "idb";
import {
  createUserCryptoKey,
  decryptBytes,
  decryptJson,
  encryptBytes,
  encryptJson,
  isWebCryptoAvailable,
  OfflineCryptoUnavailableError,
  type EncryptedPayload,
} from "./crypto";
import {
  OFFLINE_CHANNEL,
  OFFLINE_DB_NAME,
  OFFLINE_DB_VERSION,
  type OfflineBlobRecord,
  type OfflineDraftRecord,
  type OfflineLease,
  type OfflineMetaRecord,
  type OfflineOutboxItem,
  type OfflinePrefetchRecord,
} from "./types";

type EncryptedRow = {
  id: string;
  userId: string;
  iv: ArrayBuffer;
  ciphertext: ArrayBuffer;
  updatedAtUtc: string;
  meta?: Record<string, string | number | boolean | null | undefined>;
};

interface OfflineDb extends DBSchema {
  keys: {
    key: string;
    value: { userId: string; key: CryptoKey };
  };
  drafts: {
    key: string;
    value: EncryptedRow;
    indexes: { "by-user": string };
  };
  blobs: {
    key: string;
    value: EncryptedRow;
    indexes: { "by-user": string; "by-scope-key": string };
  };
  outbox: {
    key: string;
    value: EncryptedRow;
    indexes: { "by-user": string; "by-status": string };
  };
  prefetch: {
    key: string;
    value: EncryptedRow;
    indexes: { "by-user": string };
  };
  meta: {
    key: string;
    value: OfflineMetaRecord;
  };
}

let dbPromise: Promise<IDBPDatabase<OfflineDb>> | null = null;
const keyCache = new Map<string, CryptoKey>();

function channel(): BroadcastChannel | null {
  if (typeof BroadcastChannel === "undefined") return null;
  try {
    return new BroadcastChannel(OFFLINE_CHANNEL);
  } catch {
    return null;
  }
}

export function broadcastOffline(type: string, detail?: unknown): void {
  const ch = channel();
  ch?.postMessage({ type, detail });
  ch?.close();
  if (typeof window !== "undefined") {
    window.dispatchEvent(new CustomEvent(type, { detail }));
  }
}

async function getDb(): Promise<IDBPDatabase<OfflineDb>> {
  if (!dbPromise) {
    dbPromise = openDB<OfflineDb>(OFFLINE_DB_NAME, OFFLINE_DB_VERSION, {
      upgrade(db) {
        if (!db.objectStoreNames.contains("keys")) {
          db.createObjectStore("keys", { keyPath: "userId" });
        }
        if (!db.objectStoreNames.contains("drafts")) {
          const store = db.createObjectStore("drafts", { keyPath: "id" });
          store.createIndex("by-user", "userId");
        }
        if (!db.objectStoreNames.contains("blobs")) {
          const store = db.createObjectStore("blobs", { keyPath: "id" });
          store.createIndex("by-user", "userId");
          store.createIndex("by-scope-key", "meta.scopeKey" as never);
        }
        if (!db.objectStoreNames.contains("outbox")) {
          const store = db.createObjectStore("outbox", { keyPath: "id" });
          store.createIndex("by-user", "userId");
          store.createIndex("by-status", "meta.status" as never);
        }
        if (!db.objectStoreNames.contains("prefetch")) {
          const store = db.createObjectStore("prefetch", { keyPath: "id" });
          store.createIndex("by-user", "userId");
        }
        if (!db.objectStoreNames.contains("meta")) {
          db.createObjectStore("meta", { keyPath: "key" });
        }
      },
      blocking() {
        dbPromise = null;
      },
    });
  }
  return dbPromise;
}

export async function ensureOfflineKey(userId: string): Promise<CryptoKey> {
  if (!isWebCryptoAvailable()) {
    throw new OfflineCryptoUnavailableError();
  }
  const cached = keyCache.get(userId);
  if (cached) return cached;
  const db = await getDb();
  const existing = await db.get("keys", userId);
  if (existing?.key) {
    keyCache.set(userId, existing.key);
    return existing.key;
  }
  const key = await createUserCryptoKey();
  await db.put("keys", { userId, key });
  keyCache.set(userId, key);
  return key;
}

async function putEncrypted<T>(
  store: "drafts" | "blobs" | "outbox" | "prefetch",
  userId: string,
  id: string,
  value: T,
  meta?: EncryptedRow["meta"],
): Promise<void> {
  if (!isWebCryptoAvailable()) {
    throw new OfflineCryptoUnavailableError();
  }
  const key = await ensureOfflineKey(userId);
  const enc = await encryptJson(key, value);
  const db = await getDb();
  await db.put(store, {
    id,
    userId,
    iv: enc.iv,
    ciphertext: enc.ciphertext,
    updatedAtUtc: new Date().toISOString(),
    meta,
  });
}

async function getEncrypted<T>(
  store: "drafts" | "blobs" | "outbox" | "prefetch",
  userId: string,
  id: string,
): Promise<T | null> {
  if (!isWebCryptoAvailable()) return null;
  const db = await getDb();
  const row = await db.get(store, id);
  if (!row || row.userId !== userId) return null;
  const key = await ensureOfflineKey(userId);
  return decryptJson<T>(key, {
    iv: row.iv,
    ciphertext: row.ciphertext,
  });
}

async function listEncrypted<T>(
  store: "drafts" | "blobs" | "outbox" | "prefetch",
  userId: string,
): Promise<T[]> {
  if (!isWebCryptoAvailable()) return [];
  const db = await getDb();
  const rows = await db.getAllFromIndex(store, "by-user", userId);
  const key = await ensureOfflineKey(userId);
  const out: T[] = [];
  for (const row of rows) {
    try {
      out.push(
        await decryptJson<T>(key, {
          iv: row.iv,
          ciphertext: row.ciphertext,
        }),
      );
    } catch {
      /* tampered / wrong key — skip */
    }
  }
  return out;
}

export async function saveOfflineDraft(
  draft: OfflineDraftRecord,
): Promise<void> {
  await putEncrypted("drafts", draft.userId, draft.id, draft, {
    taskId: draft.taskId,
    kind: draft.kind,
  });
}

export async function getOfflineDraft(
  userId: string,
  id: string,
): Promise<OfflineDraftRecord | null> {
  return getEncrypted<OfflineDraftRecord>("drafts", userId, id);
}

export async function listOfflineDrafts(
  userId: string,
): Promise<OfflineDraftRecord[]> {
  return listEncrypted<OfflineDraftRecord>("drafts", userId);
}

export async function saveOfflineBlob(
  blob: OfflineBlobRecord,
): Promise<void> {
  if (!isWebCryptoAvailable()) {
    throw new OfflineCryptoUnavailableError();
  }
  const key = await ensureOfflineKey(blob.userId);
  const enc = await encryptBytes(key, blob.bytes);
  const metaPayload = {
    ...blob,
    bytes: undefined as unknown as ArrayBuffer,
  };
  const metaEnc = await encryptJson(key, metaPayload);
  const db = await getDb();
  await db.put("blobs", {
    id: blob.id,
    userId: blob.userId,
    iv: metaEnc.iv,
    ciphertext: metaEnc.ciphertext,
    updatedAtUtc: new Date().toISOString(),
    meta: {
      scope: blob.scope,
      scopeKey: blob.scopeKey,
      fileName: blob.fileName,
      sizeBytes: blob.sizeBytes,
      bytesIv: arrayBufferToBase64(enc.iv),
      bytesCipher: arrayBufferToBase64(enc.ciphertext),
    },
  });
}

function arrayBufferToBase64(buf: ArrayBuffer): string {
  const bytes = new Uint8Array(buf);
  let binary = "";
  for (let i = 0; i < bytes.length; i += 1) {
    binary += String.fromCharCode(bytes[i]!);
  }
  return btoa(binary);
}

function base64ToArrayBuffer(b64: string): ArrayBuffer {
  const binary = atob(b64);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i += 1) {
    bytes[i] = binary.charCodeAt(i);
  }
  return bytes.buffer;
}

export async function getOfflineBlob(
  userId: string,
  id: string,
): Promise<OfflineBlobRecord | null> {
  if (!isWebCryptoAvailable()) return null;
  const db = await getDb();
  const row = await db.get("blobs", id);
  if (!row || row.userId !== userId) return null;
  const key = await ensureOfflineKey(userId);
  const meta = await decryptJson<Omit<OfflineBlobRecord, "bytes"> & {
    bytes?: undefined;
  }>(key, { iv: row.iv, ciphertext: row.ciphertext });
  const bytesIv = String(row.meta?.bytesIv ?? "");
  const bytesCipher = String(row.meta?.bytesCipher ?? "");
  if (!bytesIv || !bytesCipher) return null;
  const bytes = await decryptBytes(key, {
    iv: base64ToArrayBuffer(bytesIv),
    ciphertext: base64ToArrayBuffer(bytesCipher),
  });
  return { ...meta, bytes };
}

export async function listOfflineBlobs(
  userId: string,
): Promise<OfflineBlobRecord[]> {
  const db = await getDb();
  const rows = await db.getAllFromIndex("blobs", "by-user", userId);
  const out: OfflineBlobRecord[] = [];
  for (const row of rows) {
    const blob = await getOfflineBlob(userId, row.id);
    if (blob) out.push(blob);
  }
  return out;
}

export async function markBlobUploaded(
  userId: string,
  id: string,
  serverAttachmentId: string,
): Promise<void> {
  const blob = await getOfflineBlob(userId, id);
  if (!blob) return;
  await saveOfflineBlob({ ...blob, serverAttachmentId });
}

export async function saveOutboxItem(item: OfflineOutboxItem): Promise<void> {
  await putEncrypted("outbox", item.userId, item.id, item, {
    status: item.status,
    kind: item.kind,
    targetId: item.targetId,
  });
  await publishPendingCount(item.userId);
}

export async function getOutboxItem(
  userId: string,
  id: string,
): Promise<OfflineOutboxItem | null> {
  return getEncrypted<OfflineOutboxItem>("outbox", userId, id);
}

export async function listOutboxItems(
  userId: string,
): Promise<OfflineOutboxItem[]> {
  return listEncrypted<OfflineOutboxItem>("outbox", userId);
}

export async function deleteOutboxItem(
  userId: string,
  id: string,
): Promise<void> {
  const db = await getDb();
  const row = await db.get("outbox", id);
  if (row && row.userId === userId) {
    await db.delete("outbox", id);
  }
  await publishPendingCount(userId);
}

export async function countPendingOutbox(userId: string): Promise<number> {
  const items = await listOutboxItems(userId);
  return items.filter(
    (item) =>
      item.status === "pending" ||
      item.status === "uploading" ||
      item.status === "failed",
  ).length;
}

export async function publishPendingCount(userId: string): Promise<number> {
  const count = await countPendingOutbox(userId);
  try {
    sessionStorage.setItem("ejada_offline_pending_count", String(count));
  } catch {
    /* ignore */
  }
  broadcastOffline("ejada-offline-pending-changed", { count, userId });
  return count;
}

export async function savePrefetch(
  record: OfflinePrefetchRecord,
): Promise<void> {
  // Soft-skip on insecure contexts (LAN http://192.168.x.x) — prefetch is best-effort.
  if (!isWebCryptoAvailable()) return;
  await putEncrypted("prefetch", record.userId, record.id, record, {
    kind: record.kind,
  });
}

export async function getPrefetch(
  userId: string,
  id: string,
): Promise<OfflinePrefetchRecord | null> {
  return getEncrypted<OfflinePrefetchRecord>("prefetch", userId, id);
}

export async function listPrefetch(
  userId: string,
): Promise<OfflinePrefetchRecord[]> {
  return listEncrypted<OfflinePrefetchRecord>("prefetch", userId);
}

export async function setMeta(key: string, value: unknown): Promise<void> {
  const db = await getDb();
  await db.put("meta", { key, valueJson: JSON.stringify(value) });
}

export async function getMeta<T>(key: string): Promise<T | null> {
  const db = await getDb();
  const row = await db.get("meta", key);
  if (!row) return null;
  try {
    return JSON.parse(row.valueJson) as T;
  } catch {
    return null;
  }
}

export async function getOfflineLease(
  userId: string,
): Promise<OfflineLease | null> {
  return getMeta<OfflineLease>(`lease:${userId}`);
}

export async function setOfflineLease(lease: OfflineLease): Promise<void> {
  await setMeta(`lease:${lease.userId}`, lease);
  broadcastOffline("ejada-offline-lease-changed", lease);
}

export async function requestPersistentStorage(): Promise<boolean> {
  if (typeof navigator === "undefined" || !navigator.storage?.persist) {
    return false;
  }
  try {
    return await navigator.storage.persist();
  } catch {
    return false;
  }
}

export async function estimateStorage(): Promise<{
  usage: number;
  quota: number;
} | null> {
  if (typeof navigator === "undefined" || !navigator.storage?.estimate) {
    return null;
  }
  try {
    const est = await navigator.storage.estimate();
    return {
      usage: est.usage ?? 0,
      quota: est.quota ?? 0,
    };
  } catch {
    return null;
  }
}

/** Wipe all offline data for a user (logout / disable). */
export async function purgeOfflineData(
  userId: string,
  reason: string,
): Promise<void> {
  const db = await getDb();
  const tx = db.transaction(
    ["keys", "drafts", "blobs", "outbox", "prefetch", "meta"],
    "readwrite",
  );
  const drafts = await tx.objectStore("drafts").index("by-user").getAllKeys(userId);
  for (const id of drafts) await tx.objectStore("drafts").delete(id);
  const blobs = await tx.objectStore("blobs").index("by-user").getAllKeys(userId);
  for (const id of blobs) await tx.objectStore("blobs").delete(id);
  const outbox = await tx.objectStore("outbox").index("by-user").getAllKeys(userId);
  for (const id of outbox) await tx.objectStore("outbox").delete(id);
  const prefetch = await tx
    .objectStore("prefetch")
    .index("by-user")
    .getAllKeys(userId);
  for (const id of prefetch) await tx.objectStore("prefetch").delete(id);
  await tx.objectStore("keys").delete(userId);
  await tx.objectStore("meta").delete(`lease:${userId}`);
  await tx.done;
  keyCache.delete(userId);
  try {
    sessionStorage.setItem("ejada_offline_pending_count", "0");
  } catch {
    /* ignore */
  }
  broadcastOffline("ejada-offline-purged", { userId, reason });
  broadcastOffline("ejada-offline-pending-changed", { count: 0, userId });
}

/** Close DB handle so other tabs can delete/upgrade. */
export async function closeOfflineDb(): Promise<void> {
  if (!dbPromise) return;
  const db = await dbPromise;
  db.close();
  dbPromise = null;
  keyCache.clear();
}

export type { EncryptedPayload };
