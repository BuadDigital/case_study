"use client";

import { useQuery } from "@tanstack/react-query";
import {
  getTransactionByProperty,
  type TransactionDetailDto,
} from "@platform/api-client";
import { appDataKeys } from "./app-data-keys";
import {
  requireWorkOrdersApiConfig,
  unwrapApiResult,
} from "../app-data/work-orders-api-config";

/**
 * The transaction (المعاملة) a deed belongs to, with every deed in it. `null` when the deed
 * has none (older rows). One cache entry shared by the case-study page and the evaluator window.
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
    staleTime: 60_000,
    gcTime: 10 * 60_000,
  });
}
