"use client";

import { useQuery } from "@tanstack/react-query";
import {
  getValuationLists,
  type ValuationListsDto,
} from "@platform/api-client";
import { apiConfig } from "../auth/api-config";

/**
 * Valuation lists via react-query — previously fetched twice on the final-review
 * screen (review tab + final-opinion section) with no cache (client-swr-dedup).
 */
export function useValuationListsQuery() {
  return useQuery({
    queryKey: ["valuation-lists"],
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
