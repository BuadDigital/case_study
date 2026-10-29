"use client";

import { useQuery, type QueryClient } from "@tanstack/react-query";
import {
  getTransactionCancellationState,
  type TransactionCancellationStateDto,
} from "@platform/api-client";
import { appDataKeys } from "@platform/app-shared/query/app-data-keys";
import {
  requireWorkOrdersApiConfig,
  unwrapApiResult,
} from "@platform/app-shared/app-data/work-orders-api-config";

/**
 * «إلغاء المعاملة» state of one deed: the pending request (the supervisor decides it) and the
 * approved cancellation (the deed is cancelled). `{}` when there is neither.
 */
export function useTransactionCancellationQuery(propertyId: string | null | undefined) {
  const property = propertyId?.trim() ?? "";
  return useQuery<TransactionCancellationStateDto>({
    queryKey: appDataKeys.transactionCancellation(property),
    queryFn: async () => {
      const result = await getTransactionCancellationState(requireWorkOrdersApiConfig(), property);
      return unwrapApiResult(result, "تعذّر تحميل حالة إلغاء المعاملة");
    },
    enabled: Boolean(property),
    staleTime: 30_000,
  });
}

/**
 * Everything a cancellation, its decision or a reactivation changes on screen: the cancellation
 * state, the work-order rows and records (deed status, PO «ملغى»), the task queues and badges.
 *
 * How it works: invalidates the whole app-data tree — the cancellation touches tasks, deeds and
 * orders across work orders, so a narrower set would leave a stale queue somewhere.
 */
export async function invalidateAfterTransactionCancellation(queryClient: QueryClient) {
  await queryClient.invalidateQueries({ queryKey: appDataKeys.all });
}
