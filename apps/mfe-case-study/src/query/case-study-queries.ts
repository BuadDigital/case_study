"use client";

import {
  keepPreviousData,
  useQuery,
  type QueryClient,
} from "@tanstack/react-query";
import { appDataKeys } from "@platform/app-shared/query/app-data-keys";
import { LIVE_QUEUE_POLL_INTERVAL_MS } from "@platform/app-shared/query/live-query";
import { isFeatureEnabled } from "@platform/app-shared/feature-flags";
import { useAppAccess } from "@platform/app-shared/contexts/AppAccessContext";
import {
  loadPoListCounts,
  loadPoListRowsPage,
} from "@platform/app-shared/app-data/work-orders-read";
import { loadPropertyListItems } from "@platform/app-shared/app-data/work-orders-read";
import {
  getPoRecord,
  loadPendingBourseItems,
  loadPoRecords,
} from "../lib/app-data/po-intake-reads";
import {
  loadWorkflowTasks,
  loadWorkflowTasksForQuery,
  loadWorkflowTasksPage,
  syncTasksFromPoRecords,
} from "../lib/app-data/tasks-storage";
import { loadCaseStudyFormDraftsForParents } from "../lib/app-data/case-study-form-reads";
import type {
  WorkflowTaskListFilters,
  WorkflowTaskListQuery,
  WorkOrderListCountsQuery,
  WorkOrderListQuery,
} from "@platform/api-client";

export { loadWorkflowTasks, loadWorkflowTasksForQuery };
export { WORK_ORDERS_CHANGED_EVENT } from "../lib/work-orders-api-config";
export { TASKS_CHANGED_EVENT, TASKS_STORAGE_KEY } from "../lib/app-data/tasks-storage";

const STALE_MS = 60_000;
const GC_MS = 10 * 60_000;
/** Server-filtered lists go stale sooner — a page flip must not show a stale window. */
const LIST_PAGE_STALE_MS = 30_000;
const queryDefaults = { staleTime: STALE_MS, gcTime: GC_MS };
const listPageDefaults = {
  staleTime: LIST_PAGE_STALE_MS,
  gcTime: GC_MS,
  /** Keep the previous page on screen while the next one loads. */
  placeholderData: keepPreviousData,
};

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
    queryFn: () => loadWorkflowTasksForQuery(),
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

/**
 * One server page of the PO list: paging, status/type filters, search and sort
 * are all query parameters (pagination-contract §1).
 */
export function usePoListRowsPageQuery(query: WorkOrderListQuery) {
  return useQuery({
    queryKey: appDataKeys.poListRowsPage(query),
    queryFn: () => loadPoListRowsPage(query),
    ...listPageDefaults,
  });
}

/**
 * The PO list KPI band and empty-state totals — one `COUNT` request keyed by
 * the same filters as the page query (pagination-contract §1.1). Deliberately
 * not keyed by `page`/`sort`/`dir`: flipping a page must not refetch it.
 */
export function useWorkOrderListCountsQuery(query: WorkOrderListCountsQuery) {
  return useQuery({
    queryKey: appDataKeys.poListCounts(query),
    queryFn: () => loadPoListCounts(query),
    ...listPageDefaults,
  });
}

/**
 * All workflow tasks matching a server-side filter set (kind / status / phase /
 * assignee / sort). The rows the screen still refines client-side stay in the
 * browser — pagination-contract §2.
 */
export function useWorkflowTasksFilteredQuery(
  filters: WorkflowTaskListFilters,
  options?: { live?: boolean; enabled?: boolean },
) {
  const live = options?.live === true && isFeatureEnabled("liveQueuePolling");
  // An empty filter set is the same request the shell prefetches — share its
  // cache entry instead of opening a second identical one.
  const narrowed = Object.keys(filters).length > 0;
  return useQuery({
    queryKey: narrowed
      ? appDataKeys.workflowTasksFiltered(filters)
      : appDataKeys.workflowTasks(),
    queryFn: () => loadWorkflowTasksForQuery(narrowed ? filters : undefined),
    enabled: options?.enabled ?? true,
    ...queryDefaults,
    placeholderData: keepPreviousData,
    refetchInterval: live ? LIVE_QUEUE_POLL_INTERVAL_MS : false,
  });
}

/** One server page of workflow tasks — pagination-contract §2. */
export function useWorkflowTasksPageQuery(
  query: WorkflowTaskListQuery,
  options?: { live?: boolean; enabled?: boolean },
) {
  const live = options?.live === true && isFeatureEnabled("liveQueuePolling");
  return useQuery({
    queryKey: appDataKeys.workflowTasksPage(query),
    queryFn: () => loadWorkflowTasksPage(query),
    enabled: options?.enabled ?? true,
    ...listPageDefaults,
    refetchInterval: live ? LIVE_QUEUE_POLL_INTERVAL_MS : false,
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

/**
 * Case-study + party form drafts for a set of listed parents in one request
 * (`GET /api/case-study-forms/batch`). Keyed on the sorted, `\0`-joined parent id
 * set — a fresh `tasks` array identity does not refetch; only a different row set,
 * the stale window, the live poll or an explicit invalidation
 * (`appDataKeys.caseStudyFormBatches()`) does.
 */
export function useCaseStudyFormBatchQuery(
  parentTaskIdsKey: string,
  options?: { live?: boolean; enabled?: boolean },
) {
  const live = options?.live === true && isFeatureEnabled("liveQueuePolling");
  return useQuery({
    queryKey: appDataKeys.caseStudyFormBatch(parentTaskIdsKey),
    queryFn: () =>
      loadCaseStudyFormDraftsForParents(parentTaskIdsKey.split("\0")),
    enabled: (options?.enabled ?? true) && parentTaskIdsKey.length > 0,
    ...queryDefaults,
    // Rows keep their last progress while the next id set loads.
    placeholderData: keepPreviousData,
    refetchInterval: live ? LIVE_QUEUE_POLL_INTERVAL_MS : false,
  });
}

