/**
 * Draft writes are serialised per task. Every write reads the cached
 * submission, folds its change in and PUTs the whole payload, and the cache
 * only advances when the PUT resolves — so two overlapping writes (a debounced
 * coordinate patch and a report upload, or the deed-match click and the
 * declaration a moment later) would both build on the same stale cache and the
 * later one would erase the earlier on the server, then its response would
 * erase it on screen (seen 2026-09-05 under a slow dev server).
 */
const queues = new Map<string, Promise<unknown>>();

export function enqueueEngineeringSurveyDraftWrite<T>(
  taskId: string,
  work: () => Promise<T>,
): Promise<T> {
  const previous = queues.get(taskId) ?? Promise.resolve();
  const run = previous.catch(() => undefined).then(work);
  queues.set(taskId, run);
  const settle = () => {
    if (queues.get(taskId) === run) queues.delete(taskId);
  };
  // Not `.finally`: that would re-throw the rejection on an unobserved chain.
  run.then(settle, settle);
  return run;
}

/** Resolves once every queued draft write for the task has settled. */
export async function awaitEngineeringSurveyDraftWrites(taskId: string): Promise<void> {
  const pending = queues.get(taskId);
  if (pending) await pending.catch(() => undefined);
}
