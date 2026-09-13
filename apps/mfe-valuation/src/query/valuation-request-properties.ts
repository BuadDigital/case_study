"use client";

import { useQuery } from "@tanstack/react-query";
import { loadPropertyListItems } from "@platform/app-shared/app-data/work-orders-read";
import { appDataKeys } from "@platform/app-shared/query/app-data-keys";

/** Shared property rows (same cache as the case-study lists) — deed + work order per property id. */
export function useValuationRequestPropertyRowsQuery() {
  return useQuery({
    queryKey: appDataKeys.propertyListItems(),
    queryFn: loadPropertyListItems,
    staleTime: 60_000,
    gcTime: 10 * 60_000,
  });
}
