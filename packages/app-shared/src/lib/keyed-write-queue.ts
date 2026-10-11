/**
 * Whole-payload draft writes must be serialised per record. Every write reads
 * the cached draft, folds its change in and PUTs the whole payload, and the
 * cache only advances when the PUT resolves — so two overlapping writes (a
 * debounced field patch and a button save, or a map pin flush a moment later)
 * would both build on the same stale cache and the later one would erase the
 * earlier on the server, then its response would erase it on screen (seen
 * 2026-09-05 in the engineering survey under a slow dev server).
 *
 * One queue per draft family: keys are only unique inside a family.
 */
type KeyedWriteQueue = {
  enqueue<T>(key: string, work: () => Promise<T>): Promise<T>;
  /** Resolves once every queued write for the key has settled. */
  awaitIdle(key: string): Promise<void>;
};

export function createKeyedWriteQueue(): KeyedWriteQueue {
  const queues = new Map<string, Promise<unknown>>();
  return {
    enqueue<T>(key: string, work: () => Promise<T>): Promise<T> {
      const previous = queues.get(key) ?? Promise.resolve();
      const run = previous.catch(() => undefined).then(work);
      queues.set(key, run);
      const settle = () => {
        if (queues.get(key) === run) queues.delete(key);
      };
      // Not `.finally`: that would re-throw the rejection on an unobserved chain.
      run.then(settle, settle);
      return run;
    },
    async awaitIdle(key: string): Promise<void> {
      const pending = queues.get(key);
      if (pending) await pending.catch(() => undefined);
    },
  };
}
