"use client";

import { useQuery } from "@tanstack/react-query";
import { fetchGovernedPropertyDocuments } from "../lib/app-data/governed-property-documents-reads";

export function governedPropertyDocumentsQueryKey(poNumber: string, propertyId: string) {
  return ["governed-property-documents", poNumber.trim(), propertyId.trim()] as const;
}

/** Documents-tab uploads and «other documents» rows, with their type and review state. */
export function useGovernedPropertyDocumentsQuery(input: {
  poNumber: string;
  propertyId: string;
  enabled?: boolean;
}) {
  const enabled =
    (input.enabled ?? true) && Boolean(input.poNumber.trim() && input.propertyId.trim());
  return useQuery({
    queryKey: governedPropertyDocumentsQueryKey(input.poNumber, input.propertyId),
    queryFn: () => fetchGovernedPropertyDocuments(input.poNumber, input.propertyId),
    enabled,
    staleTime: 30_000,
    gcTime: 10 * 60_000,
  });
}
