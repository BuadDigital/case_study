/**
 * A small list one user keeps on this device (localStorage), readable through
 * `useSyncExternalStore` — the store behind «المفضلة» and the pinned rows of «أعمالي».
 *
 * How it works: one localStorage entry per user (`{prefix}:{userId}`) holding a JSON array; `read`
 * returns the same array object while the stored text is unchanged (so React does not re-render),
 * `write` saves and announces the change on `changedEvent`, and `subscribe` listens to that event
 * and to the browser's `storage` event (another tab).
 * Edge cases: no window (server render) → the empty list and no-ops; a blocked or full storage →
 * reads the empty list and drops the write; entries that fail `isItem` are left out; a signed-out
 * reader shares the «anonymous» entry.
 */
export function createUserListStore<T>(options: {
  prefix: string;
  changedEvent: string;
  isItem: (item: unknown) => item is T;
}) {
  const empty: readonly T[] = [];
  const snapshots = new Map<string, { raw: string | null; value: readonly T[] }>();
  const storageKey = (userId: string | null | undefined) =>
    `${options.prefix}:${userId?.trim() || "anonymous"}`;

  function read(userId: string | null | undefined): readonly T[] {
    if (typeof window === "undefined") return empty;

    const key = storageKey(userId);
    let raw: string | null = null;
    try {
      raw = window.localStorage.getItem(key);
    } catch {
      return empty;
    }
    const cached = snapshots.get(key);
    if (cached?.raw === raw) return cached.value;

    let value: readonly T[] = empty;
    if (raw) {
      try {
        const parsed: unknown = JSON.parse(raw);
        if (Array.isArray(parsed)) value = parsed.filter(options.isItem);
      } catch {
        value = empty;
      }
    }

    snapshots.set(key, { raw, value });
    return value;
  }

  function write(userId: string | null | undefined, items: readonly T[]): void {
    if (typeof window === "undefined") return;
    const key = storageKey(userId);
    const raw = JSON.stringify(items);
    try {
      window.localStorage.setItem(key, raw);
    } catch {
      return;
    }
    snapshots.set(key, { raw, value: items });
    window.dispatchEvent(new Event(options.changedEvent));
  }

  function subscribe(userId: string | null | undefined, onChange: () => void): () => void {
    if (typeof window === "undefined") return () => {};

    const key = storageKey(userId);
    const onStorage = (event: StorageEvent) => {
      if (event.key === key) onChange();
    };
    window.addEventListener(options.changedEvent, onChange);
    window.addEventListener("storage", onStorage);
    return () => {
      window.removeEventListener(options.changedEvent, onChange);
      window.removeEventListener("storage", onStorage);
    };
  }

  return { empty, read, write, subscribe };
}
