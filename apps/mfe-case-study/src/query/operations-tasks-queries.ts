"use client";

import { keepPreviousData, useQuery } from "@tanstack/react-query";
import { appDataKeys } from "@platform/app-shared/query/app-data-keys";
import { LIVE_QUEUE_POLL_INTERVAL_MS } from "@platform/app-shared/query/live-query";
import {
  loadCourtVisitFees,
  loadOperationsTasks,
  loadOperationsTasksPage,
} from "../lib/app-data/operations-tasks-reads";
import type { OperationsTaskQuery } from "../lib/app-data/operations-tasks-model";
import type { OperationsTaskListQuery } from "@platform/api-client";

const STALE_MS = 30_000;

export function useOperationsTasksQuery(options?: {
  assigneeId?: string;
  createdBy?: string;
  status?: string;
  live?: boolean;
}) {
  const assigneeId = options?.assigneeId?.trim() || undefined;
  const createdBy = options?.createdBy?.trim() || undefined;
  const status = options?.status?.trim() || undefined;

  return useQuery({
    queryKey: [...appDataKeys.operationsTasks(), assigneeId, createdBy, status],
    queryFn: () => loadOperationsTasks({ assigneeId, createdBy, status }),
    staleTime: STALE_MS,
    refetchInterval: options?.live ? LIVE_QUEUE_POLL_INTERVAL_MS : false,
  });
}

/**
 * All operations tasks matching a server-side filter set (status / scope /
 * type / activeOnly / excludeFailurePaused / search / sort). The rules the
 * screen still applies in the browser stay there — pagination-contract §3.
 */
export function useOperationsTasksFilteredQuery(
  query: OperationsTaskQuery,
  options?: { live?: boolean },
) {
  return useQuery({
    queryKey: appDataKeys.operationsTasksFiltered(query),
    queryFn: () => loadOperationsTasks(query),
    staleTime: STALE_MS,
    placeholderData: keepPreviousData,
    refetchInterval: options?.live ? LIVE_QUEUE_POLL_INTERVAL_MS : false,
  });
}

/** One server page of operations tasks — pagination-contract §3. */
export function useOperationsTasksPageQuery(
  query: OperationsTaskListQuery,
  options?: { live?: boolean; enabled?: boolean },
) {
  return useQuery({
    queryKey: appDataKeys.operationsTasksPage(query),
    queryFn: () => loadOperationsTasksPage(query),
    enabled: options?.enabled ?? true,
    staleTime: STALE_MS,
    placeholderData: keepPreviousData,
    refetchInterval: options?.live ? LIVE_QUEUE_POLL_INTERVAL_MS : false,
  });
}

export function useCourtVisitFeesQuery(options?: {
  creditAssigneeId?: string;
  enabled?: boolean;
}) {
  const creditAssigneeId = options?.creditAssigneeId?.trim() || undefined;
  return useQuery({
    queryKey: appDataKeys.courtVisitFees({ creditAssigneeId }),
    queryFn: () => loadCourtVisitFees({ creditAssigneeId }),
    enabled: options?.enabled ?? true,
    staleTime: STALE_MS,
  });
}

/**
 * The KPI band's counters. `operationsTaskKpis` used to count over every loaded
 * row; with the list narrowed server-side those rows are gone, so each counter
 * is its own one-row request and reads `totalCount` off the paged envelope
 * (pagination-contract §3, "still client-side" #3 — "it needs its own call").
 *
 * The blocked-by-failure rows the viewer's queue hides are not visible to the
 * endpoint, so a counter can overstate by those rows.
 */
export function useOperationsTaskStatusCounts(options: {
  assigneeId?: string;
  excludeFailurePaused: boolean;
  live?: boolean;
}) {
  const base = {
    ...(options.assigneeId ? { assigneeId: options.assigneeId } : {}),
    ...(options.excludeFailurePaused ? { excludeFailurePaused: true } : {}),
    page: 1,
    /** Only `totalCount` is read — never pull a row we do not render. */
    pageSize: 1,
  } as const;

  const created = useOperationsTasksPageQuery(
    { ...base, status: "created" },
    { live: options.live },
  );
  const inProgress = useOperationsTasksPageQuery(
    { ...base, status: "in_progress" },
    { live: options.live },
  );
  const paused = useOperationsTasksPageQuery(
    { ...base, status: "paused" },
    { live: options.live },
  );
  const completed = useOperationsTasksPageQuery(
    { ...base, status: "completed" },
    { live: options.live },
  );

  const createdCount = created.data?.totalCount ?? 0;
  const inProgressCount = inProgress.data?.totalCount ?? 0;
  return {
    active: createdCount + inProgressCount,
    created: createdCount,
    inProgress: inProgressCount,
    paused: paused.data?.totalCount ?? 0,
    completed: completed.data?.totalCount ?? 0,
  };
}
