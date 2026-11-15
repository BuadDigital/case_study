/**
 * Concurrent identical reads share one request.
 *
 * How it works: the first call for a key starts `run`; calls with the same key while it is still in
 * flight get the same promise; the entry is dropped as soon as it settles, so the next call fetches
 * fresh. Edge cases: nothing is cached after settling — a list read right after an upload is never
 * stale. Added 2026-11-15: a property page asked for the same attachment list twice within
 * milliseconds (two panels mounting together).
 */
const inFlight = new Map<string, Promise<unknown>>();

export function shareInFlight<T>(key: string, run: () => Promise<T>): Promise<T> {
  const pending = inFlight.get(key);
  if (pending) return pending as Promise<T>;
  const promise = run().finally(() => {
    inFlight.delete(key);
  });
  inFlight.set(key, promise);
  return promise;
}
