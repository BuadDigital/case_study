"use client";

import { useQuery } from "@tanstack/react-query";
import { appDataKeys } from "@platform/app-shared/query/app-data-keys";
import { LIVE_QUEUE_POLL_INTERVAL_MS } from "@platform/app-shared/query/live-query";
import { loadOperationsTasks, loadCourtVisitFees } from "../lib/app-data/operations-tasks-reads";

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
