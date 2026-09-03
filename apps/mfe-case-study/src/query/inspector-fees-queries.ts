"use client";

import { useQuery } from "@tanstack/react-query";
import { appDataKeys } from "@platform/app-shared/query/app-data-keys";
import type { ListInspectorFeesQuery } from "@platform/api-client";
import { loadInspectorFeesSummary } from "@platform/app-shared/app-data/inspector-fees-api";

const STALE_MS = 30_000;
const GC_MS = 10 * 60_000;
const queryDefaults = { staleTime: STALE_MS, gcTime: GC_MS };

export function useInspectorFeesQuery(
  query: ListInspectorFeesQuery,
  options?: { enabled?: boolean },
) {
  return useQuery({
    queryKey: appDataKeys.inspectorFees(query),
    queryFn: () => loadInspectorFeesSummary(query),
    enabled: options?.enabled ?? true,
    ...queryDefaults,
  });
}
