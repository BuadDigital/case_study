"use client";

import { useMemo } from "react";
import { useQuery, type QueryClient } from "@tanstack/react-query";
import {
  getValuationLists,
  type ValuationListItemDto,
  type ValuationListsDto,
} from "@platform/api-client";
import { apiConfig } from "../auth/api-config";

const valuationListsQueryKey = ["valuation-lists"] as const;

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

/**
 * One admin-managed list's enabled rows, in order.
 *
 * Returns `undefined` until the dictionary has loaded, so callers can keep their
 * built-in options for that first render instead of flashing an empty picker.
 * Once loaded the array is authoritative — including when it is empty.
 */
export function useEnabledValuationListRows(
  listId: string,
): ValuationListItemDto[] | undefined {
  const { data, isPending, isError } = useValuationListsQuery();
  return useMemo(() => {
    if (isPending || isError || !data) return undefined;
    return (data.lists?.[listId] ?? [])
      .filter((row) => row.isEnabled && row.name.trim().length > 0)
      .slice()
      .sort((a, b) => a.sortOrder - b.sortOrder);
  }, [data, isPending, isError, listId]);
}
