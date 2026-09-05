import type { QueryClient, QueryKey } from "@tanstack/react-query";

export type OptimisticPatchResult<T> = {
  match: (item: T) => boolean;
  /** Row as it was before this patch. */
  previousItem: T | undefined;
  /** Row written by this patch — rollback only if the cache item still matches. */
  expectedItem: T | undefined;
};

/**
 * Instantly patch a React Query list cache.
 * Use for safe UI status flips (queues, chips) — not for financial totals.
 */
export function optimisticPatchListItem<T>(
  queryClient: QueryClient,
  queryKey: QueryKey,
  match: (item: T) => boolean,
  patch: (item: T) => T,
): OptimisticPatchResult<T> {
  const previous = queryClient.getQueryData<T[]>(queryKey);
  if (!previous) {
    return { match, previousItem: undefined, expectedItem: undefined };
  }
  let previousItem: T | undefined;
  let expectedItem: T | undefined;
  const patched = previous.map((item) => {
    if (!match(item)) return item;
    previousItem = item;
    expectedItem = patch(item);
    return expectedItem;
  });
  queryClient.setQueryData<T[]>(queryKey, patched);
  return { match, previousItem, expectedItem };
}

/** Unconditional full-list restore — prefer {@link restoreOptimisticPatch}. */
export function restoreQueryData<T>(
  queryClient: QueryClient,
  queryKey: QueryKey,
  previous: T[] | undefined,
): void {
  if (previous !== undefined) {
    queryClient.setQueryData(queryKey, previous);
  }
}

function sameOptimisticItem<T>(a: T, b: T): boolean {
  if (a === b) return true;
  try {
    return JSON.stringify(a) === JSON.stringify(b);
  } catch {
    return false;
  }
}

/**
 * Roll back only the row this mutation patched, and only if no later write
 * changed that same row. Concurrent patches on *other* rows are preserved.
 * If this row was overwritten, invalidate so the server becomes source of truth.
 */
export function restoreOptimisticPatch<T>(
  queryClient: QueryClient,
  queryKey: QueryKey,
  snapshot: OptimisticPatchResult<T> | undefined,
): "restored" | "invalidated" | "noop" {
  if (!snapshot?.previousItem || !snapshot.expectedItem) return "noop";
  const current = queryClient.getQueryData<T[]>(queryKey);
  if (!current) return "noop";

  const index = current.findIndex(snapshot.match);
  if (index < 0) {
    void queryClient.invalidateQueries({ queryKey });
    return "invalidated";
  }

  if (!sameOptimisticItem(current[index], snapshot.expectedItem)) {
    void queryClient.invalidateQueries({ queryKey });
    return "invalidated";
  }

  const next = current.slice();
  next[index] = snapshot.previousItem;
  queryClient.setQueryData(queryKey, next);
  return "restored";
}

/** The paged envelope (`PagedResultDto`) — only `items` is patched. */
type PagedItems<T> = { items: T[] };

/**
 * {@link optimisticPatchListItem} for one server page (pagination-contract
 * envelope): the row is patched inside `items`, the counts are untouched.
 */
export function optimisticPatchPagedItem<T>(
  queryClient: QueryClient,
  queryKey: QueryKey,
  match: (item: T) => boolean,
  patch: (item: T) => T,
): OptimisticPatchResult<T> {
  const previous = queryClient.getQueryData<PagedItems<T>>(queryKey);
  if (!previous || !Array.isArray(previous.items)) {
    return { match, previousItem: undefined, expectedItem: undefined };
  }
  let previousItem: T | undefined;
  let expectedItem: T | undefined;
  const items = previous.items.map((item) => {
    if (!match(item)) return item;
    previousItem = item;
    expectedItem = patch(item);
    return expectedItem;
  });
  if (previousItem !== undefined) {
    queryClient.setQueryData<PagedItems<T>>(queryKey, { ...previous, items });
  }
  return { match, previousItem, expectedItem };
}

/** {@link restoreOptimisticPatch} for one server page. */
export function restoreOptimisticPagedPatch<T>(
  queryClient: QueryClient,
  queryKey: QueryKey,
  snapshot: OptimisticPatchResult<T> | undefined,
): "restored" | "invalidated" | "noop" {
  if (!snapshot?.previousItem || !snapshot.expectedItem) return "noop";
  const current = queryClient.getQueryData<PagedItems<T>>(queryKey);
  if (!current || !Array.isArray(current.items)) return "noop";

  const index = current.items.findIndex(snapshot.match);
  if (
    index < 0 ||
    !sameOptimisticItem(current.items[index], snapshot.expectedItem)
  ) {
    void queryClient.invalidateQueries({ queryKey });
    return "invalidated";
  }

  const items = current.items.slice();
  items[index] = snapshot.previousItem;
  queryClient.setQueryData<PagedItems<T>>(queryKey, { ...current, items });
  return "restored";
}
