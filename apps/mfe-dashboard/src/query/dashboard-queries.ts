"use client";

import {
  listFailures,
  listOperationsTasks,
  type FailureRecordDto,
  type OperationsTaskDto,
} from "@platform/api-client";
import { useQuery } from "@tanstack/react-query";
import {
  requireWorkOrdersApiConfig,
  unwrapApiResult,
} from "@platform/app-shared/prototype/work-orders-api-config";
import { prototypeKeys } from "@platform/app-shared/query/prototype-keys";
import {
  loadPoListRows,
  loadPropertyListItems,
} from "@platform/app-shared/prototype/work-orders-read";

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

async function loadOpsTasks(): Promise<OperationsTaskDto[]> {
  const config = requireWorkOrdersApiConfig();
  const result = await listOperationsTasks(config);
  return unwrapApiResult(result, "تعذّر تحميل المهام");
}

export function useDashboardOpsTasksQuery() {
  return useQuery({
    queryKey: ["dashboard", "operations-tasks"],
    queryFn: loadOpsTasks,
    ...queryDefaults,
  });
}

const OPEN_FAILURE_STATUSES = new Set([
  "internal",
  "review",
  "returned",
  "open",
  "pending",
]);

async function loadOpenFailuresCount(): Promise<number> {
  const config = requireWorkOrdersApiConfig();
  const result = await listFailures(config);
  const rows = unwrapApiResult(result, "تعذّر تحميل التعذرات") as FailureRecordDto[];
  return rows.filter((f) => OPEN_FAILURE_STATUSES.has(f.status)).length;
}

export function useDashboardOpenFailuresCountQuery() {
  return useQuery({
    queryKey: ["dashboard", "open-failures-count"],
    queryFn: loadOpenFailuresCount,
    ...queryDefaults,
  });
}
