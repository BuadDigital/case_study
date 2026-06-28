"use client";

import { useQuery } from "@tanstack/react-query";
import { prototypeKeys } from "@platform/app-shared/query/prototype-keys";
import { loadInspectorFeesSummary } from "@platform/app-shared/prototype/inspector-fees-api";
import { loadReadyEnfazPoSummaries } from "@platform/app-shared/prototype/enfaz-billing-api";
import { countFinanceDisburseActions } from "../lib/finance-queue-stats";

export function useFinanceTabCounts() {
  const feesQuery = useQuery({
    queryKey: [...prototypeKeys.all, "inspector-fees", "finance-tab-counts"],
    queryFn: () =>
      loadInspectorFeesSummary({
        submittedOnly: false,
        billingStatus: undefined,
      }),
    staleTime: 30_000,
  });

  const enfazQuery = useQuery({
    queryKey: [...prototypeKeys.all, "enfaz-billing", "ready-summary"],
    queryFn: loadReadyEnfazPoSummaries,
    staleTime: 30_000,
  });

  const disburse = countFinanceDisburseActions(feesQuery.data?.rows ?? []);

  return {
    isPending: feesQuery.isPending || enfazQuery.isPending,
    readyToDisburse: disburse.readyToDisburse,
    waitingOffice: disburse.waitingOffice,
    needsAttention: disburse.needsAttention,
    enfazReady: enfazQuery.data?.length ?? 0,
  };
}
