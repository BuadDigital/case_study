"use client";

import { useQuery, type QueryClient } from "@tanstack/react-query";
import { appDataKeys } from "@platform/app-shared/query/app-data-keys";
import { LIVE_QUEUE_POLL_INTERVAL_MS } from "@platform/app-shared/query/live-query";
import { isFeatureEnabled } from "@platform/app-shared/feature-flags";
import { useAppAccess } from "@platform/app-shared/contexts/AppAccessContext";
import { loadPoListRows } from "@platform/app-shared/app-data/work-orders-read";
import { loadPropertyListItems } from "@platform/app-shared/app-data/work-orders-read";
import {
  getPoRecord,
  loadPendingBourseItems,
  loadPoRecords,
} from "../lib/app-data/po-intake-reads";
import {
  loadWorkflowTasks,
  loadWorkflowTasksForQuery,
  syncTasksFromPoRecords,
} from "../lib/app-data/tasks-storage";

export { loadWorkflowTasks, loadWorkflowTasksForQuery };
export { WORK_ORDERS_CHANGED_EVENT } from "../lib/work-orders-api-config";
export { TASKS_CHANGED_EVENT, TASKS_STORAGE_KEY } from "../lib/app-data/tasks-storage";

const STALE_MS = 60_000;
const GC_MS = 10 * 60_000;
const queryDefaults = { staleTime: STALE_MS, gcTime: GC_MS };

/** Loads POs from API and keeps workflow task slots in sync. */
export async function loadPoRecordsWithTaskSync() {
  // Quiet slot sync: keep primary-data task slots aligned without broadcasting
  // TASKS_CHANGED (that would re-invalidate workflow-tasks on every PO warm
  // and compete with page navigation). Mutating paths already notify.
  // Sync is independent of records — run in parallel, not sequentially (async-parallel).
  const [records, sync] = await Promise.all([
    loadPoRecords(),
    syncTasksFromPoRecords({ notify: false }),
  ]);
  if (!sync.ok) {
    throw new Error(sync.error);
  }
  return records;
}

export function prefetchPoRecord(queryClient: QueryClient, poNumber: string): void {
  const n = poNumber.trim();
  if (!n) return;
  void queryClient.prefetchQuery({
    queryKey: appDataKeys.poRecord(n),
    queryFn: () => getPoRecord(n),
    staleTime: STALE_MS,
  });
}

export function useWorkflowTasksQuery(options?: { live?: boolean }) {
  const live =
    options?.live === true && isFeatureEnabled("liveQueuePolling");
  return useQuery({
    queryKey: appDataKeys.workflowTasks(),
    queryFn: loadWorkflowTasksForQuery,
    ...queryDefaults,
    refetchInterval: live ? LIVE_QUEUE_POLL_INTERVAL_MS : false,
  });
}

export function usePoRecordsQuery() {
  const { authReady, capabilities } = useAppAccess();
  return useQuery({
    queryKey: [...appDataKeys.poRecords(), capabilities.join(",")],
    queryFn: loadPoRecordsWithTaskSync,
    enabled: authReady,
    ...queryDefaults,
  });
}

export function usePendingBourseItemsQuery() {
  return useQuery({
    queryKey: appDataKeys.pendingBourseItems(),
    queryFn: loadPendingBourseItems,
    ...queryDefaults,
  });
}

export function usePoListRowsQuery() {
  return useQuery({
    queryKey: appDataKeys.poListRows(),
    queryFn: loadPoListRows,
    ...queryDefaults,
  });
}

export function usePropertyListItemsQuery() {
  return useQuery({
    queryKey: appDataKeys.propertyListItems(),
    queryFn: loadPropertyListItems,
    ...queryDefaults,
  });
}

export function usePoRecordQuery(poNumber: string | null) {
  return useQuery({
    queryKey: appDataKeys.poRecord(poNumber ?? ""),
    queryFn: () => getPoRecord(poNumber!),
    enabled: Boolean(poNumber),
    ...queryDefaults,
  });
}

