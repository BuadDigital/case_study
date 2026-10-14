/**
 * Which reads are currently served from the downloaded snapshot although the
 * browser is online — the server failed and a `*-reads` loader fell back to
 * `prefetch-read` instead of throwing. The screen then shows real-looking rows,
 * so `SnapshotFallbackNotice` (shell) says they may be stale.
 *
 * Plain module state (no React): loaders call `noteSnapshotFallback` in their
 * fallback branch and `noteLiveRead` after a server read succeeds.
 */

const sources = new Set<string>();
const listeners = new Set<() => void>();

function emit(): void {
  for (const listener of listeners) listener();
}

/** A loader returned the cached copy while online. */
export function noteSnapshotFallback(source: string): void {
  if (sources.has(source)) return;
  sources.add(source);
  emit();
}

/** The same loader got a live server answer — its copy is current again. */
export function noteLiveRead(source: string): void {
  if (!sources.delete(source)) return;
  emit();
}

/** True while at least one read is showing the cached copy. */
export function isSnapshotFallbackActive(): boolean {
  return sources.size > 0;
}

export function subscribeSnapshotFallback(listener: () => void): () => void {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

/** Test seam — forget every source. */
export function resetSnapshotFallback(): void {
  if (sources.size === 0) return;
  sources.clear();
  emit();
}
