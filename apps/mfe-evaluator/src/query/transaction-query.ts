"use client";

import { useQuery } from "@tanstack/react-query";
import {
  getTransactionByProperty,
  linkedPropertyDeeds,
  type TransactionDeedDto,
  type TransactionDetailDto,
} from "@platform/api-client";
import { appDataKeys } from "@platform/app-shared/query/app-data-keys";
import {
  requireWorkOrdersApiConfig,
  unwrapApiResult,
} from "@platform/app-shared/app-data/work-orders-api-config";

const STALE_MS = 60_000;
const GC_MS = 10 * 60_000;
const NO_DEEDS: TransactionDeedDto[] = [];

/**
 * Phase 5 (decision 2026-10-19): the transaction a deed belongs to — the appraiser values the
 * whole linked property, so the window lists every deed. Same cache key as the case-study page.
 */
export function useTransactionByPropertyQuery(propertyId: string | null | undefined) {
  const property = propertyId?.trim() ?? "";
  return useQuery<TransactionDetailDto | null>({
    queryKey: appDataKeys.transactionByProperty(property),
    queryFn: async () => {
      const config = requireWorkOrdersApiConfig();
      if (!property) return null;
      const result = await getTransactionByProperty(config, property);
      if (!result.ok && result.kind === "not_found") return null;
      return unwrapApiResult(result, "تعذّر تحميل بيانات المعاملة");
    },
    enabled: Boolean(property),
    staleTime: STALE_MS,
    gcTime: GC_MS,
  });
}

/** The live deeds of a linked property; a stable empty list for an ordinary property. */
export function useLinkedPropertyDeeds(propertyId: string | null | undefined): TransactionDeedDto[] {
  const { data } = useTransactionByPropertyQuery(propertyId);
  const deeds = linkedPropertyDeeds(data);
  return deeds.length > 0 ? deeds : NO_DEEDS;
}
