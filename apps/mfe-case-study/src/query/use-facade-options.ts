"use client";

import { useMemo } from "react";
import { useValuationListsQuery } from "@platform/app-shared/query/valuation-lists-query";

/**
 * Admin-managed «أنواع الواجهات» for the inspector's facade picker.
 *
 * Returns `undefined` until the dictionary has loaded, so callers can keep their
 * built-in options for that first render instead of flashing an empty picker.
 * Once loaded the array is authoritative — including when it is empty.
 */
export function useFacadeOptions(): string[] | undefined {
  const { data, isPending, isError } = useValuationListsQuery();
  return useMemo(() => {
    if (isPending || isError || !data) return undefined;
    return (data.lists?.facades ?? [])
      .filter((row) => row.isEnabled)
      .slice()
      .sort((a, b) => a.sortOrder - b.sortOrder)
      .map((row) => row.name.trim())
      .filter((name) => name.length > 0);
  }, [data, isPending, isError]);
}
