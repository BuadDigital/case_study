"use client";

import { useQuery } from "@tanstack/react-query";
import { prototypeKeys } from "@platform/app-shared/query/prototype-keys";
import {
  listWorkflowTasks,
  type WorkflowTaskDto,
} from "@platform/api-client";
import {
  loadPoListRows,
  loadPropertyListItems,
} from "@platform/app-shared/prototype/work-orders-read";
import {
  requireWorkOrdersApiConfig,
  unwrapApiResult,
} from "@platform/app-shared/prototype/work-orders-api-config";

const STALE_MS = 60_000;
const GC_MS = 10 * 60_000;
const queryDefaults = { staleTime: STALE_MS, gcTime: GC_MS };

/** PO list rows for dashboard stats — shared prototype query keys. */
export function usePoListRowsQuery() {
  return useQuery({
    queryKey: prototypeKeys.poListRows(),
    queryFn: loadPoListRows,
    ...queryDefaults,
  });
}

/** Property list items — slim property-rows API. */
export function usePropertyListItemsQuery() {
  return useQuery({
    queryKey: prototypeKeys.propertyListItems(),
    queryFn: loadPropertyListItems,
    ...queryDefaults,
  });
}

export type DashboardValuationRequestRow = {
  id: string;
  displayId: string;
  propId: string;
  appraiser: string;
  status: string;
  date: string;
};

function mapValuationTask(task: WorkflowTaskDto): DashboardValuationRequestRow {
  const propertyLabel = task.title?.trim() || task.propertyId || "—";
  const displayId = `${task.poNumber}-${task.propertyOrdinal}`;
  return {
    id: task.id,
    displayId,
    propId: propertyLabel,
    appraiser: task.assigneeName?.trim() || "—",
    status:
      task.status === "completed"
        ? "done"
        : task.status === "blocked"
          ? "fail"
          : "progress",
    date: task.createdAt,
  };
}

function isOpenAppraisalTask(task: WorkflowTaskDto): boolean {
  return task.status === "open" || task.status === "blocked";
}

async function loadRecentValuationRequestsFromTasks(): Promise<
  DashboardValuationRequestRow[]
> {
  const config = requireWorkOrdersApiConfig();
  const result = await listWorkflowTasks(config);
  const tasks = unwrapApiResult(result, "تعذّر تحميل طلبات التقييم");

  const appraisalRows = tasks
    .filter((t) => t.kind === "property-appraisal" && isOpenAppraisalTask(t))
    .sort((a, b) => b.updatedAt.localeCompare(a.updatedAt))
    .slice(0, 6)
    .map(mapValuationTask);

  if (appraisalRows.length > 0) return appraisalRows;

  return tasks
    .filter((t) => t.kind === "valuation-coordination" && isOpenAppraisalTask(t))
    .sort((a, b) => b.updatedAt.localeCompare(a.updatedAt))
    .slice(0, 6)
    .map(mapValuationTask);
}

export function useRecentValuationRequestsQuery() {
  return useQuery({
    queryKey: ["dashboard", "recent-valuation-requests"],
    queryFn: loadRecentValuationRequestsFromTasks,
    ...queryDefaults,
  });
}
