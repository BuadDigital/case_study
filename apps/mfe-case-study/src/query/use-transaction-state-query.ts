"use client";

import { useQuery, useQueryClient } from "@tanstack/react-query";
import type { TransactionStateDto } from "@platform/api-client";
import { PARTY_CASE_STUDY_REPORT_CHANGED_EVENT } from "@platform/app-shared/app-data/case-study-report-model";
import { useWindowEvents } from "@platform/app-shared/hooks/useWindowEvents";
import { loadTransactionState } from "../lib/app-data/enfaz-handover-commands";
import { WORK_ORDERS_CHANGED_EVENT } from "../lib/work-orders-api-config";
import { TASKS_CHANGED_EVENT } from "./case-study-queries";

const STALE_MS = 30_000;
const GC_MS = 10 * 60_000;

export function transactionStateQueryKey(
  workOrderId: string,
  propertyId: string,
) {
  return ["transaction-state", workOrderId, propertyId] as const;
}

/**
 * The derived transaction status of one property (stages, parties, Enfaz handover gate).
 * Refetches when tasks, work orders or the case-study report change — an issue / reopen / handover
 * anywhere moves the gate.
 */
export function useTransactionStateQuery(
  workOrderId: string | null | undefined,
  propertyId: string | null | undefined,
  options?: { enabled?: boolean },
) {
  const workOrder = workOrderId?.trim() ?? "";
  const property = propertyId?.trim() ?? "";
  const enabled = Boolean(workOrder && property) && options?.enabled !== false;
  const queryClient = useQueryClient();

  const invalidate = () => {
    if (!enabled) return;
    void queryClient.invalidateQueries({
      queryKey: transactionStateQueryKey(workOrder, property),
    });
  };
  useWindowEvents({
    [TASKS_CHANGED_EVENT]: invalidate,
    [WORK_ORDERS_CHANGED_EVENT]: invalidate,
    [PARTY_CASE_STUDY_REPORT_CHANGED_EVENT]: invalidate,
  });

  return useQuery<TransactionStateDto>({
    queryKey: transactionStateQueryKey(workOrder, property),
    queryFn: () => loadTransactionState(workOrder, property),
    enabled,
    staleTime: STALE_MS,
    gcTime: GC_MS,
  });
}
