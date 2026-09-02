"use client";

import { useMemo } from "react";
import { activeValuationListOptions } from "@platform/api-client";
import { useValuationListsQuery } from "@platform/app-shared/query/valuation-lists-query";
import { PROPERTY_BOUNDARY_TYPE_OPTIONS } from "../lib/app-data/po-intake-data";

const FALLBACK = PROPERTY_BOUNDARY_TYPE_OPTIONS.filter((o) => o.value.length > 0).map(
  (o) => ({ value: o.value, label: o.label }),
);

/**
 * Admin-managed «أنواع الحد» for the bourse «النوع» column.
 *
 * Returns built-in defaults until the dictionary loads, then the catalog is authoritative.
 */
export function useBoundaryTypeOptions(): { value: string; label: string }[] {
  const { data, isPending, isError } = useValuationListsQuery();
  return useMemo(() => {
    if (isPending || isError || !data) return FALLBACK;
    const fromCatalog = activeValuationListOptions(data.lists, "boundaryTypes");
    return fromCatalog.length > 0 ? fromCatalog : FALLBACK;
  }, [data, isPending, isError]);
}
