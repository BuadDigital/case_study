"use client";

import { useQuery } from "@tanstack/react-query";
import { prototypeKeys } from "@platform/app-shared/query/prototype-keys";
import { LIVE_QUEUE_POLL_INTERVAL_MS } from "@platform/app-shared/query/live-query";
import { loadOperationsTasks } from "../lib/prototype/operations-tasks-storage";

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
    queryKey: [...prototypeKeys.operationsTasks(), assigneeId, createdBy, status],
    queryFn: () => loadOperationsTasks({ assigneeId, createdBy, status }),
    staleTime: STALE_MS,
    refetchInterval: options?.live ? LIVE_QUEUE_POLL_INTERVAL_MS : false,
  });
}
