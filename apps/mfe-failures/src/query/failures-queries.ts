"use client";

import {
  keepPreviousData,
  useQuery,
  type QueryClient,
  type QueryKey,
} from "@tanstack/react-query";
import {
  optimisticPatchListItem,
  optimisticPatchPagedItem,
  restoreOptimisticPagedPatch,
  restoreOptimisticPatch,
  type OptimisticPatchResult,
} from "@platform/app-shared/query/optimistic-list";
import { appDataKeys } from "@platform/app-shared/query/app-data-keys";
import type { FailureListQuery } from "@platform/api-client";
import {
  loadFailuresPageQuery,
  loadFailuresQuery,
} from "../lib/failures-repository";
import type { FailureRecord, FailureStatus } from "@platform/app-shared/failures/failures-types";

const STALE_MS = 60_000;
/** A page is cheap to re-ask for; keep it fresh a little less long than the whole set. */
const LIST_PAGE_STALE_MS = 30_000;
const GC_MS = 10 * 60_000;
const queryDefaults = { staleTime: STALE_MS, gcTime: GC_MS };
const failuresKey = appDataKeys.failures();
/** Every cached page shares this prefix (`appDataKeys.failuresPage`). */
const failuresPagePrefix = [...failuresKey, "page"] as const;

export function useFailuresQuery() {
  return useQuery({
    queryKey: failuresKey,
    queryFn: loadFailuresQuery,
    ...queryDefaults,
  });
}

/** One server page of the failures queue — pagination-contract §5. */
export function useFailuresPageQuery(
  query: FailureListQuery,
  options?: { enabled?: boolean },
) {
  return useQuery({
    queryKey: appDataKeys.failuresPage(query),
    queryFn: () => loadFailuresPageQuery(query),
    enabled: options?.enabled ?? true,
    staleTime: LIST_PAGE_STALE_MS,
    gcTime: GC_MS,
    /** Keep the previous page on screen while the next one loads. */
    placeholderData: keepPreviousData,
  });
}

/** One patch touches the whole set and every cached page that holds the row. */
export type FailuresOptimisticSnapshot = {
  list: OptimisticPatchResult<FailureRecord>;
  pages: { queryKey: QueryKey; snapshot: OptimisticPatchResult<FailureRecord> }[];
};

/** Instant status chip update; caller must roll back via restoreFailuresSnapshot. */
export function optimisticFailureStatus(
  queryClient: QueryClient,
  id: string,
  status: FailureStatus,
  extra?: Partial<FailureRecord>,
): FailuresOptimisticSnapshot {
  const match = (row: FailureRecord) => row.id === id;
  const patch = (row: FailureRecord): FailureRecord => ({
    ...row,
    ...extra,
    status,
    updatedAt: new Date().toISOString(),
  });
  const list = optimisticPatchListItem<FailureRecord>(
    queryClient,
    failuresKey,
    match,
    patch,
  );
  const pages = queryClient
    .getQueryCache()
    .findAll({ queryKey: failuresPagePrefix })
    .map((query) => ({
      queryKey: query.queryKey,
      snapshot: optimisticPatchPagedItem<FailureRecord>(
        queryClient,
        query.queryKey,
        match,
        patch,
      ),
    }));
  return { list, pages };
}

export function restoreFailuresSnapshot(
  queryClient: QueryClient,
  snapshot: FailuresOptimisticSnapshot | undefined,
): void {
  if (!snapshot) return;
  restoreOptimisticPatch(queryClient, failuresKey, snapshot.list);
  for (const page of snapshot.pages) {
    restoreOptimisticPagedPatch(queryClient, page.queryKey, page.snapshot);
  }
}

export function invalidateFailuresRelated(queryClient: QueryClient): void {
  // Prefix match: the whole set and every cached page.
  void queryClient.invalidateQueries({ queryKey: failuresKey });
  void queryClient.invalidateQueries({
    queryKey: appDataKeys.suspendedTransactions(),
  });
  void queryClient.invalidateQueries({
    queryKey: appDataKeys.workflowTasks(),
  });
  void queryClient.invalidateQueries({
    queryKey: appDataKeys.pendingBourseItems(),
  });
}
