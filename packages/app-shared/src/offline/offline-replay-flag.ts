let replayDepth = 0;

/** Marks API writes that belong to outbox replay so the interceptor does not re-queue them. */
export function runAsOfflineReplay<T>(fn: () => Promise<T>): Promise<T> {
  replayDepth += 1;
  return fn().finally(() => {
    replayDepth = Math.max(0, replayDepth - 1);
  });
}

export function isOfflineReplayInFlight(): boolean {
  return replayDepth > 0;
}
