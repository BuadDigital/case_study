import { openDB, type DBSchema, type IDBPDatabase } from "idb";
import {
  createUserOfflineKey,
  decryptBytes,
  decryptJson,
  encryptBytes,
  encryptJson,
  fromStoredKey,
  toStoredKey,
  type OfflineKey,
  type StoredOfflineKey,
} from "./crypto";
import {
  OFFLINE_ACCESS_STORAGE_KEY,
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
import { clearOfflinePageCaches } from "./page-cache";

/**
 * Every row is AES-256-GCM encrypted with the user's key (see `crypto.ts`). Rows
 * written as plaintext by older builds on insecure origins (`meta.encoding = plain`)
 * are still readable and are re-encrypted the first time they are read.
 */
const PLAIN_ENCODING = "plain";
const td = new TextDecoder();

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
    value: { userId: string } & StoredOfflineKey;
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
let openGeneration = 0;
const keyCache = new Map<string, OfflineKey>();

function channel(): BroadcastChannel | null {
  if (typeof BroadcastChannel === "undefined") return null;
  try {
    return new BroadcastChannel(OFFLINE_CHANNEL);
  } catch {
    return null;
  }
}

function broadcastOffline(type: string, detail?: unknown): void {
  const ch = channel();
  ch?.postMessage({ type, detail });
  ch?.close();
  if (typeof window !== "undefined") {
    window.dispatchEvent(new CustomEvent(type, { detail }));
  }
}

/** Connection closed/closing while a transaction was started (HMR, logout, versionchange). */
function isDbConnectionError(error: unknown): boolean {
  if (!error || typeof error !== "object") return false;
  const name = "name" in error ? String((error as { name?: unknown }).name) : "";
  const message =
    "message" in error ? String((error as { message?: unknown }).message) : "";
  return (
    name === "InvalidStateError" ||
    /connection is closing|database connection is closing|has been closed|closing/i.test(
      message,
    )
  );
}

function resetDbCache(): void {
  openGeneration += 1;
  dbPromise = null;
}

async function getDb(): Promise<IDBPDatabase<OfflineDb>> {
  if (!dbPromise) {
    const generation = openGeneration;
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
      /** Another connection wants a version change — release promptly. */
      blocking() {
        void forceCloseOfflineDb();
      },
      /** Unexpected close (browser eviction / parallel close). */
      terminated() {
        if (generation === openGeneration) {
          resetDbCache();
        }
      },
    }).then((db) => {
      if (generation !== openGeneration) {
        try {
          db.close();
        } catch {
          /* ignore */
        }
        throw new DOMException(
          "The database connection is closing.",
          "InvalidStateError",
        );
      }
      return db;
    }).catch((error) => {
      if (generation === openGeneration) {
        dbPromise = null;
      }
      throw error;
    });
  }
  return dbPromise;
}

/**
 * Run an IndexedDB op with reopen+retry when the handle was closed mid-flight
 * (common during Next HMR, multi-tab upgrades, logout).
 */
async function withDb<T>(
  op: (db: IDBPDatabase<OfflineDb>) => Promise<T>,
  retries = 3,
): Promise<T> {
  let lastError: unknown;
  for (let attempt = 0; attempt < retries; attempt += 1) {
    try {
      const db = await getDb();
      return await op(db);
    } catch (error) {
      lastError = error;
      if (!isDbConnectionError(error) || attempt === retries - 1) {
        throw error;
      }
      resetDbCache();
    }
  }
  throw lastError;
}

function isPlainRow(row: EncryptedRow): boolean {
  return row.meta?.encoding === PLAIN_ENCODING;
}

function decodePlainJson<T>(row: EncryptedRow): T {
  return JSON.parse(td.decode(new Uint8Array(row.ciphertext))) as T;
}

async function ensureOfflineKey(userId: string): Promise<OfflineKey> {
  const cached = keyCache.get(userId);
  if (cached) return cached;
  return withDb(async (db) => {
    const existing = await db.get("keys", userId);
    if (existing) {
      const key = fromStoredKey(existing);
      // A key this origin cannot use must never be replaced — that would orphan the rows.
      if (!key) throw new Error("مفتاح التشفير المحلي غير صالح على هذا الجهاز.");
      keyCache.set(userId, key);
      return key;
    }
    const key = await createUserOfflineKey();
    await db.put("keys", { userId, ...toStoredKey(key) });
    keyCache.set(userId, key);
    return key;
  });
}

async function putEncrypted<T>(
  store: "drafts" | "blobs" | "outbox" | "prefetch",
  userId: string,
  id: string,
  value: T,
  meta?: EncryptedRow["meta"],
): Promise<void> {
  const key = await ensureOfflineKey(userId);
  const enc = await encryptJson(key, value);
  await withDb((db) =>
    db.put(store, {
      id,
      userId,
      iv: enc.iv,
      ciphertext: enc.ciphertext,
      updatedAtUtc: new Date().toISOString(),
      meta,
    }),
  );
}

/** Legacy plaintext row: decode, then write it back encrypted (same meta minus the flag). */
async function upgradePlainRow<T>(
  store: "drafts" | "outbox" | "prefetch",
  row: EncryptedRow,
): Promise<T> {
  const value = decodePlainJson<T>(row);
  const meta = { ...row.meta };
  delete meta.encoding;
  void putEncrypted(store, row.userId, row.id, value, meta).catch(() => {});
  return value;
}

async function getEncrypted<T>(
  store: "drafts" | "outbox" | "prefetch",
  userId: string,
  id: string,
): Promise<T | null> {
  const row = await withDb((db) => db.get(store, id));
  if (!row || row.userId !== userId) return null;

  try {
    if (isPlainRow(row)) return await upgradePlainRow<T>(store, row);
    const key = await ensureOfflineKey(userId);
    return await decryptJson<T>(key, {
      iv: row.iv,
      ciphertext: row.ciphertext,
    });
  } catch {
    return null;
  }
}

async function listEncrypted<T>(
  store: "drafts" | "outbox" | "prefetch",
  userId: string,
): Promise<T[]> {
  const rows = await withDb((db) =>
    db.getAllFromIndex(store, "by-user", userId),
  );
  const out: T[] = [];
  let cryptoKey: OfflineKey | null = null;

  for (const row of rows) {
    try {
      if (isPlainRow(row)) {
        out.push(await upgradePlainRow<T>(store, row));
        continue;
      }
      if (!cryptoKey) cryptoKey = await ensureOfflineKey(userId);
      out.push(
        await decryptJson<T>(cryptoKey, {
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

/** The server confirmed the save — the local copy of the draft goes (spec §3.4). */
export async function deleteOfflineDraft(
  userId: string,
  id: string,
): Promise<void> {
  await withDb(async (db) => {
    const row = await db.get("drafts", id);
    if (row && row.userId === userId) await db.delete("drafts", id);
  });
}

type BlobMeta = Omit<OfflineBlobRecord, "bytes">;

export async function saveOfflineBlob(
  blob: OfflineBlobRecord,
): Promise<void> {
  const key = await ensureOfflineKey(blob.userId);
  const metaPayload: BlobMeta = { ...blob, bytes: undefined } as BlobMeta;
  delete (metaPayload as { bytes?: unknown }).bytes;
  const [enc, metaEnc] = await Promise.all([
    encryptBytes(key, blob.bytes),
    encryptJson(key, metaPayload),
  ]);
  await withDb((db) =>
    db.put("blobs", {
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
    }),
  );
}

function arrayBufferToBase64(buf: ArrayBuffer): string {
  const bytes = new Uint8Array(buf);
  let binary = "";
  const chunk = 0x8000;
  for (let i = 0; i < bytes.length; i += chunk) {
    binary += String.fromCharCode(...bytes.subarray(i, i + chunk));
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

/** Decode an already-fetched blob row; legacy plaintext rows are re-encrypted on the way. */
async function decodeBlobRow(
  row: EncryptedRow,
  key: OfflineKey | null,
): Promise<OfflineBlobRecord | null> {
  if (isPlainRow(row)) {
    try {
      const meta = decodePlainJson<BlobMeta>(row);
      const bytesPlain = String(row.meta?.bytesPlain ?? "");
      if (!bytesPlain) return null;
      const record = { ...meta, bytes: base64ToArrayBuffer(bytesPlain) };
      void saveOfflineBlob(record).catch(() => {});
      return record;
    } catch {
      return null;
    }
  }

  if (!key) return null;
  try {
    const meta = await decryptJson<BlobMeta>(key, {
      iv: row.iv,
      ciphertext: row.ciphertext,
    });
    const bytesIv = String(row.meta?.bytesIv ?? "");
    const bytesCipher = String(row.meta?.bytesCipher ?? "");
    // Uploaded and released: the bytes are gone, only the id mapping remains.
    if (!bytesIv || !bytesCipher) return null;
    const bytes = await decryptBytes(key, {
      iv: base64ToArrayBuffer(bytesIv),
      ciphertext: base64ToArrayBuffer(bytesCipher),
    });
    return { ...meta, bytes };
  } catch {
    return null;
  }
}

/** Resolve the user's key when any row needs decryption; never throws. */
async function resolveBlobKey(
  userId: string,
  rows: EncryptedRow[],
): Promise<OfflineKey | null> {
  if (!rows.some((row) => !isPlainRow(row))) return null;
  try {
    return await ensureOfflineKey(userId);
  } catch {
    return null;
  }
}

export async function getOfflineBlob(
  userId: string,
  id: string,
): Promise<OfflineBlobRecord | null> {
  const row = await withDb((db) => db.get("blobs", id));
  if (!row || row.userId !== userId) return null;
  const key = await resolveBlobKey(userId, [row]);
  return decodeBlobRow(row, key);
}

/**
 * Blob metadata only — decrypts the small meta JSON and never touches
 * bytesCipher; enough for sync id-mapping over cached photos.
 */
export async function listOfflineBlobMeta(
  userId: string,
): Promise<BlobMeta[]> {
  const rows = await withDb((db) =>
    db.getAllFromIndex("blobs", "by-user", userId),
  );
  const key = await resolveBlobKey(userId, rows);
  const decoded = await Promise.all(
    rows.map(async (row) => {
      try {
        if (isPlainRow(row)) return decodePlainJson<BlobMeta>(row);
        if (!key) return null;
        return await decryptJson<BlobMeta>(key, {
          iv: row.iv,
          ciphertext: row.ciphertext,
        });
      } catch {
        /* tampered / wrong key — skip */
        return null;
      }
    }),
  );
  return decoded.filter((meta): meta is BlobMeta => meta !== null);
}

/**
 * The server confirmed the upload: record its id and drop the local bytes
 * (spec §3.4 — the local copy goes once each item is confirmed). The small
 * encrypted meta row stays only as the local→server id mapping until nothing
 * queued refers to it (`releaseSyncedLocalCopies`).
 */
export async function markBlobUploaded(
  userId: string,
  id: string,
  serverAttachmentId: string,
): Promise<void> {
  const row = await withDb((db) => db.get("blobs", id));
  if (!row || row.userId !== userId) return;
  try {
    const key = await ensureOfflineKey(userId);
    const meta = isPlainRow(row)
      ? decodePlainJson<BlobMeta>(row)
      : await decryptJson<BlobMeta>(key, {
          iv: row.iv,
          ciphertext: row.ciphertext,
        });
    const enc = await encryptJson(key, { ...meta, serverAttachmentId });
    await withDb((db) =>
      db.put("blobs", {
        id: row.id,
        userId: row.userId,
        iv: enc.iv,
        ciphertext: enc.ciphertext,
        updatedAtUtc: new Date().toISOString(),
        meta: {
          scope: meta.scope,
          scopeKey: meta.scopeKey,
          fileName: meta.fileName,
          sizeBytes: meta.sizeBytes,
          released: true,
        },
      }),
    );
  } catch {
    /* wrong key / tampered — leave the row untouched */
  }
}

/** Row-level view of the user's blobs for cleanup: no bytes are decrypted. */
export async function listOfflineBlobRows(userId: string): Promise<
  Array<{
    id: string;
    released: boolean;
    serverAttachmentId?: string;
    updatedAtUtc: string;
  }>
> {
  const rows = await withDb((db) =>
    db.getAllFromIndex("blobs", "by-user", userId),
  );
  const metaById = new Map(
    (await listOfflineBlobMeta(userId)).map((meta) => [meta.id, meta]),
  );
  return rows.map((row) => ({
    id: row.id,
    released: row.meta?.released === true,
    serverAttachmentId: metaById.get(row.id)?.serverAttachmentId,
    updatedAtUtc: row.updatedAtUtc,
  }));
}

/** Remove blob rows by id (released uploads nothing refers to any more). */
export async function deleteOfflineBlobs(
  userId: string,
  ids: readonly string[],
): Promise<void> {
  if (ids.length === 0) return;
  await withDb(async (db) => {
    const tx = db.transaction("blobs", "readwrite");
    for (const id of ids) {
      const row = await tx.store.get(id);
      if (row && row.userId === userId) await tx.store.delete(id);
    }
    await tx.done;
  });
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
  await withDb(async (db) => {
    const row = await db.get("outbox", id);
    if (row && row.userId === userId) {
      await db.delete("outbox", id);
    }
  });
  await publishPendingCount(userId);
}

export async function countPendingOutbox(userId: string): Promise<number> {
  // status is written un-encrypted into row.meta by saveOutboxItem — no need
  // to decrypt payloads just to count.
  const rows = await withDb((db) =>
    db.getAllFromIndex("outbox", "by-user", userId),
  );
  return rows.filter(
    (row) =>
      row.meta?.status === "pending" ||
      row.meta?.status === "uploading" ||
      row.meta?.status === "failed",
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

export async function listPrefetchByUser(
  userId: string,
): Promise<OfflinePrefetchRecord[]> {
  return listEncrypted<OfflinePrefetchRecord>("prefetch", userId);
}

export async function listPrefetchByKind(
  userId: string,
  kind: string,
): Promise<OfflinePrefetchRecord[]> {
  const rows = await listPrefetchByUser(userId);
  return rows.filter((row) => row.kind === kind);
}

export async function setMeta(key: string, value: unknown): Promise<void> {
  await withDb((db) =>
    db.put("meta", { key, valueJson: JSON.stringify(value) }),
  );
}

export async function getMeta<T>(key: string): Promise<T | null> {
  const row = await withDb((db) => db.get("meta", key));
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

/** Wipe all offline data for a user (logout / disable). */
export async function purgeOfflineData(
  userId: string,
  reason: string,
): Promise<void> {
  await withDb(async (db) => {
    const tx = db.transaction(
      ["keys", "drafts", "blobs", "outbox", "prefetch", "meta"],
      "readwrite",
    );
    // Requests on one transaction may be issued concurrently.
    const [drafts, blobs, outbox, prefetch] = await Promise.all([
      tx.objectStore("drafts").index("by-user").getAllKeys(userId),
      tx.objectStore("blobs").index("by-user").getAllKeys(userId),
      tx.objectStore("outbox").index("by-user").getAllKeys(userId),
      tx.objectStore("prefetch").index("by-user").getAllKeys(userId),
    ]);
    for (const id of drafts) await tx.objectStore("drafts").delete(id);
    for (const id of blobs) await tx.objectStore("blobs").delete(id);
    for (const id of outbox) await tx.objectStore("outbox").delete(id);
    for (const id of prefetch) await tx.objectStore("prefetch").delete(id);
    await tx.objectStore("keys").delete(userId);
    await tx.objectStore("meta").delete(`lease:${userId}`);
    await tx.done;
  });
  keyCache.delete(userId);
  try {
    await clearOfflinePageCaches();
  } catch {
    /* Cache Storage unavailable — IndexedDB is already wiped. */
  }
  try {
    sessionStorage.setItem("ejada_offline_pending_count", "0");
    localStorage.removeItem(OFFLINE_ACCESS_STORAGE_KEY);
  } catch {
    /* ignore */
  }
  broadcastOffline("ejada-offline-purged", { userId, reason });
  broadcastOffline("ejada-offline-pending-changed", { count: 0, userId });
}

async function forceCloseOfflineDb(): Promise<void> {
  const pending = dbPromise;
  resetDbCache();
  keyCache.clear();
  if (!pending) return;
  try {
    const db = await pending;
    db.close();
  } catch {
    /* open failed or already closed */
  }
}

/** Close DB handle so other tabs can delete/upgrade. */
export async function closeOfflineDb(): Promise<void> {
  await forceCloseOfflineDb();
}
