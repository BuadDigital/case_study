"use client";

import { useQuery, type QueryClient } from "@tanstack/react-query";
import { prototypeKeys } from "@platform/app-shared/query/prototype-keys";
import { LIVE_QUEUE_POLL_INTERVAL_MS } from "@platform/app-shared/query/live-query";
import { isFeatureEnabled } from "@platform/app-shared/feature-flags";
import { loadPoListRows } from "@platform/app-shared/prototype/work-orders-read";
import { loadPropertyListItems } from "@platform/app-shared/prototype/work-orders-read";
import {
  getPoRecord,
  loadPendingBourseItems,
  loadPoRecords,
} from "../lib/prototype/po-intake-storage";
import { loadWorkflowTasks, syncTasksFromPoRecords } from "../lib/prototype/tasks-storage";

export { loadWorkflowTasks };
export { WORK_ORDERS_CHANGED_EVENT } from "../lib/work-orders-api-config";
export { TASKS_CHANGED_EVENT, TASKS_STORAGE_KEY } from "../lib/prototype/tasks-storage";

const STALE_MS = 60_000;
const GC_MS = 10 * 60_000;
const queryDefaults = { staleTime: STALE_MS, gcTime: GC_MS };

/** Loads POs from API and keeps workflow task slots in sync. */
export async function loadPoRecordsWithTaskSync() {
  const records = await loadPoRecords();
  await syncTasksFromPoRecords();
  return records;
}

export function prefetchPoRecord(queryClient: QueryClient, poNumber: string): void {
  const n = poNumber.trim();
  if (!n) return;
  void queryClient.prefetchQuery({
    queryKey: prototypeKeys.poRecord(n),
    queryFn: () => getPoRecord(n),
    staleTime: STALE_MS,
  });
}

export function useWorkflowTasksQuery(options?: { live?: boolean }) {
  const live =
    options?.live === true && isFeatureEnabled("liveQueuePolling");
  return useQuery({
    queryKey: prototypeKeys.workflowTasks(),
    queryFn: loadWorkflowTasks,
    ...queryDefaults,
    refetchInterval: live ? LIVE_QUEUE_POLL_INTERVAL_MS : false,
  });
}

export function usePoRecordsQuery() {
  return useQuery({
    queryKey: prototypeKeys.poRecords(),
    queryFn: loadPoRecordsWithTaskSync,
    ...queryDefaults,
  });
}

export function usePendingBourseItemsQuery() {
  return useQuery({
    queryKey: prototypeKeys.pendingBourseItems(),
    queryFn: loadPendingBourseItems,
    ...queryDefaults,
  });
}

export function usePoListRowsQuery() {
  return useQuery({
    queryKey: prototypeKeys.poListRows(),
    queryFn: loadPoListRows,
    ...queryDefaults,
  });
}

export function usePropertyListItemsQuery() {
  return useQuery({
    queryKey: prototypeKeys.propertyListItems(),
    queryFn: loadPropertyListItems,
    ...queryDefaults,
  });
}

export function usePoRecordQuery(poNumber: string | null) {
  return useQuery({
    queryKey: prototypeKeys.poRecord(poNumber ?? ""),
    queryFn: () => getPoRecord(poNumber!),
    enabled: Boolean(poNumber),
    ...queryDefaults,
  });
}

