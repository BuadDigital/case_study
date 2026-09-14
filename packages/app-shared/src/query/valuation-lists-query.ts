"use client";

import { useQuery, type QueryClient } from "@tanstack/react-query";
import {
  getValuationLists,
  type ValuationListsDto,
} from "@platform/api-client";
import { apiConfig } from "../auth/api-config";

export const valuationListsQueryKey = ["valuation-lists"] as const;

/**
 * Push a fresh catalogue into the shared cache so screens like bourse «أنواع الحد»
 * see admin edits without waiting for staleTime.
 */
export function syncValuationListsCache(
  queryClient: QueryClient,
  data: ValuationListsDto,
): void {
  queryClient.setQueryData(valuationListsQueryKey, data);
}

/**
 * Valuation lists via react-query — previously fetched twice on the final-review
 * screen (review tab + final-opinion section) with no cache (client-swr-dedup).
 */
export function useValuationListsQuery() {
  return useQuery({
    queryKey: valuationListsQueryKey,
    queryFn: async (): Promise<ValuationListsDto | null> => {
      const config = apiConfig();
      if (!config) return null;
      const res = await getValuationLists(config);
      return res.ok ? res.data : null;
    },
    staleTime: 5 * 60_000,
    gcTime: 30 * 60_000,
  });
}
