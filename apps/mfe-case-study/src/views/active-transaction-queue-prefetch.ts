"use client";

/**
 * Hover-intent warming for the queue's own server reads — the next / previous
 * page and the other «show completed» position. Keys and loaders mirror
 * `useWorkflowTasksPageQuery` / `useWorkflowTasksFilteredQuery`, so the click
 * finds the rows already cached. Reads only.
 */
import type { QueryClient } from "@tanstack/react-query";
import type { WorkflowTaskListFilters } from "@platform/api-client";
import { appDataKeys } from "@platform/app-shared/query/app-data-keys";
import {
  loadWorkflowTasksForQuery,
  loadWorkflowTasksPage,
} from "../lib/app-data/tasks-reads";
import { buildQueuePageQuery } from "./active-transaction-queue-state";

/** Inside the queue hooks' stale window — a fresh entry is not fetched twice. */
const PREFETCH_STALE_MS = 30_000;

export function prefetchQueueTasks(
  queryClient: QueryClient,
  input: { paged: boolean; filters: WorkflowTaskListFilters; page: number },
): void {
  if (input.paged) {
    const query = buildQueuePageQuery({ filters: input.filters, page: input.page });
    void queryClient.prefetchQuery({
      queryKey: appDataKeys.workflowTasksPage(query),
      queryFn: () => loadWorkflowTasksPage(query),
      staleTime: PREFETCH_STALE_MS,
    });
    return;
  }
  const narrowed = Object.keys(input.filters).length > 0;
  void queryClient.prefetchQuery({
    queryKey: narrowed
      ? appDataKeys.workflowTasksFiltered(input.filters)
      : appDataKeys.workflowTasks(),
    queryFn: () =>
      loadWorkflowTasksForQuery(narrowed ? input.filters : undefined),
    staleTime: PREFETCH_STALE_MS,
  });
}
