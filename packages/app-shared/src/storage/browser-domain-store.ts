/**
 * Property/domain persistence that does **not** use localStorage.
 * Backed by IndexedDB so values survive refresh and stay off the localStorage quota.
 * One-shot migration copies legacy localStorage keys then deletes them.
 */

const DB_NAME = "ejadah-domain-store";
const DB_VERSION = 1;
const STORE = "kv";

type KvRecord = { key: string; value: string };

let dbPromise: Promise<IDBDatabase> | null = null;

function openDb(): Promise<IDBDatabase> {
  if (typeof indexedDB === "undefined") {
    return Promise.reject(new Error("IndexedDB unavailable"));
  }
  if (!dbPromise) {
    dbPromise = new Promise((resolve, reject) => {
      const req = indexedDB.open(DB_NAME, DB_VERSION);
      req.onupgradeneeded = () => {
        const db = req.result;
        if (!db.objectStoreNames.contains(STORE)) {
          db.createObjectStore(STORE, { keyPath: "key" });
        }
      };
      req.onsuccess = () => resolve(req.result);
      req.onerror = () => reject(req.error ?? new Error("IndexedDB open failed"));
    });
  }
  return dbPromise;
}

async function idbGet(key: string): Promise<string | null> {
  const db = await openDb();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE, "readonly");
    const req = tx.objectStore(STORE).get(key);
    req.onsuccess = () => {
      const row = req.result as KvRecord | undefined;
      resolve(row?.value ?? null);
    };
    req.onerror = () => reject(req.error ?? new Error("IndexedDB get failed"));
  });
}

async function idbSet(key: string, value: string): Promise<void> {
  const db = await openDb();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE, "readwrite");
    tx.objectStore(STORE).put({ key, value } satisfies KvRecord);
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error ?? new Error("IndexedDB put failed"));
  });
}

async function idbDelete(key: string): Promise<void> {
  const db = await openDb();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE, "readwrite");
    tx.objectStore(STORE).delete(key);
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error ?? new Error("IndexedDB delete failed"));
  });
}

/** In-memory mirror for sync reads used by existing call sites. */
const memory = new Map<string, string>();
const migratedLegacy = new Set<string>();

function migrateLegacyLocalStorage(key: string): string | null {
  if (typeof window === "undefined") return null;
  if (migratedLegacy.has(key)) return null;
  migratedLegacy.add(key);
  try {
    const raw = window.localStorage.getItem(key);
    if (raw == null) return null;
    memory.set(key, raw);
    void idbSet(key, raw).then(() => {
      try {
        window.localStorage.removeItem(key);
      } catch {
        /* ignore */
      }
    });
    return raw;
  } catch {
    return null;
  }
}

/** Sync read — memory first, then one-shot localStorage migration. */
export function loadDomainStringSync(key: string): string | null {
  if (memory.has(key)) return memory.get(key)!;
  const migrated = migrateLegacyLocalStorage(key);
  if (migrated != null) return migrated;
  return null;
}

/** Sync write — updates memory immediately; persists to IndexedDB async. */
export function saveDomainStringSync(key: string, value: string): void {
  memory.set(key, value);
  if (typeof window !== "undefined") {
    try {
      window.localStorage.removeItem(key);
    } catch {
      /* ignore */
    }
  }
  void idbSet(key, value).catch(() => {
    /* keep memory; IDB may be blocked in private mode */
  });
}

export function removeDomainStringSync(key: string): void {
  memory.delete(key);
  if (typeof window !== "undefined") {
    try {
      window.localStorage.removeItem(key);
    } catch {
      /* ignore */
    }
  }
  void idbDelete(key).catch(() => {
    /* ignore */
  });
}

/** Hydrate memory from IndexedDB (call once at app boot). */
export async function hydrateDomainStore(keys?: string[]): Promise<void> {
  if (typeof indexedDB === "undefined") return;
  try {
    if (keys?.length) {
      await Promise.all(
        keys.map(async (key) => {
          const value = await idbGet(key);
          if (value != null) memory.set(key, value);
        }),
      );
      return;
    }
    const db = await openDb();
    await new Promise<void>((resolve, reject) => {
      const tx = db.transaction(STORE, "readonly");
      const req = tx.objectStore(STORE).openCursor();
      req.onsuccess = () => {
        const cursor = req.result;
        if (!cursor) {
          resolve();
          return;
        }
        const row = cursor.value as KvRecord;
        memory.set(row.key, row.value);
        cursor.continue();
      };
      req.onerror = () =>
        reject(req.error ?? new Error("IndexedDB cursor failed"));
    });
  } catch {
    /* private mode / blocked IDB — memory + legacy migration still work */
  }
}

export async function loadDomainJson<T>(
  key: string,
  fallback: T,
): Promise<T> {
  try {
    const raw = memory.get(key) ?? (await idbGet(key));
    if (raw == null) {
      const migrated = migrateLegacyLocalStorage(key);
      if (migrated == null) return fallback;
      return JSON.parse(migrated) as T;
    }
    memory.set(key, raw);
    return JSON.parse(raw) as T;
  } catch {
    return fallback;
  }
}

export function loadDomainJsonSync<T>(key: string, fallback: T): T {
  try {
    const raw = loadDomainStringSync(key);
    if (raw == null) return fallback;
    return JSON.parse(raw) as T;
  } catch {
    return fallback;
  }
}

export function saveDomainJsonSync(key: string, value: unknown): void {
  saveDomainStringSync(key, JSON.stringify(value));
}
