"use client";

import { useQuery, useQueryClient, type QueryClient } from "@tanstack/react-query";
import {
  optimisticPatchListItem,
  restoreOptimisticPatch,
  type OptimisticPatchResult,
} from "@platform/app-shared/query/optimistic-list";
import { prototypeKeys } from "@platform/app-shared/query/prototype-keys";
import { loadFailuresQuery } from "../lib/failures-repository";
import type { FailureRecord, FailureStatus } from "@platform/app-shared/failures/failures-types";

const STALE_MS = 60_000;
const GC_MS = 10 * 60_000;
const queryDefaults = { staleTime: STALE_MS, gcTime: GC_MS };
const failuresKey = prototypeKeys.failures();

export function useFailuresQuery() {
  return useQuery({
    queryKey: failuresKey,
    queryFn: loadFailuresQuery,
    ...queryDefaults,
  });
}

/** Instant status chip update; caller must roll back via restoreFailuresSnapshot. */
export function optimisticFailureStatus(
  queryClient: QueryClient,
  id: string,
  status: FailureStatus,
  extra?: Partial<FailureRecord>,
): OptimisticPatchResult<FailureRecord> {
  return optimisticPatchListItem<FailureRecord>(
    queryClient,
    failuresKey,
    (row) => row.id === id,
    (row) => ({
      ...row,
      ...extra,
      status,
      updatedAt: new Date().toISOString(),
    }),
  );
}

export function restoreFailuresSnapshot(
  queryClient: QueryClient,
  snapshot: OptimisticPatchResult<FailureRecord> | undefined,
): void {
  restoreOptimisticPatch(queryClient, failuresKey, snapshot);
}

export function invalidateFailuresRelated(queryClient: QueryClient): void {
  void queryClient.invalidateQueries({ queryKey: failuresKey });
  void queryClient.invalidateQueries({
    queryKey: prototypeKeys.suspendedTransactions(),
  });
  void queryClient.invalidateQueries({
    queryKey: prototypeKeys.workflowTasks(),
  });
  void queryClient.invalidateQueries({
    queryKey: prototypeKeys.pendingBourseItems(),
  });
}
