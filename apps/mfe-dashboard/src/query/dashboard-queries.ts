"use client";

import { useQuery } from "@tanstack/react-query";
import { prototypeKeys } from "@platform/app-shared/query/prototype-keys";
import {
  loadPoListRows,
  loadWorkOrderDtos,
  mapWorkOrderDtosToPropertyListItems,
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

/** Property list items — derived from shared work-order DTO cache. */
export function usePropertyListItemsQuery() {
  return useQuery({
    queryKey: prototypeKeys.workOrderDtos(),
    queryFn: loadWorkOrderDtos,
    select: mapWorkOrderDtosToPropertyListItems,
    ...queryDefaults,
  });
}
