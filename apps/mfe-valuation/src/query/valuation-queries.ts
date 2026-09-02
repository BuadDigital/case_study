"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import type { VrRow } from "@platform/app-shared/app-data/constants";
import {
  optimisticPatchListItem,
  restoreOptimisticPatch,
} from "@platform/app-shared/query/optimistic-list";
import { appDataKeys } from "@platform/app-shared/query/app-data-keys";
import {
  loadValuationRequests,
  submitValuationRequestImpediment,
  submitValuationRequestReport,
} from "../lib/valuation-api";

const STALE_MS = 60_000;
const GC_MS = 10 * 60_000;
const valuationKey = appDataKeys.valuationRequests();

function invalidateValuationQueries(queryClient: ReturnType<typeof useQueryClient>) {
  void queryClient.invalidateQueries({
    queryKey: valuationKey,
  });
  void queryClient.invalidateQueries({
    queryKey: ["reporting", "dashboard"],
  });
}

function patchValuationStatus(
  queryClient: ReturnType<typeof useQueryClient>,
  recordId: string,
  status: VrRow["status"],
) {
  return optimisticPatchListItem<VrRow>(
    queryClient,
    valuationKey,
    (row) => row.recordId === recordId,
    (row) => ({ ...row, status }),
  );
}

export function useValuationRequestsQuery() {
  return useQuery({
    queryKey: valuationKey,
    queryFn: loadValuationRequests,
    staleTime: STALE_MS,
    gcTime: GC_MS,
  });
}

export function useSubmitValuationReportMutation() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: submitValuationRequestReport,
    // Serialize per request so rapid double-submits cannot desync optimistic status.
    scope: { id: "valuation-report" },
    onMutate: async (recordId) => {
      await queryClient.cancelQueries({ queryKey: valuationKey });
      return { snapshot: patchValuationStatus(queryClient, recordId, "done") };
    },
    onSuccess: (result, _recordId, context) => {
      if (!result.ok) {
        restoreOptimisticPatch(queryClient, valuationKey, context?.snapshot);
        return;
      }
      invalidateValuationQueries(queryClient);
    },
    onError: (_err, _recordId, context) => {
      restoreOptimisticPatch(queryClient, valuationKey, context?.snapshot);
    },
  });
}

export function useSubmitValuationImpedimentMutation() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ recordId, reason }: { recordId: string; reason: string }) =>
      submitValuationRequestImpediment(recordId, reason),
    scope: { id: "valuation-impediment" },
    onMutate: async ({ recordId }) => {
      await queryClient.cancelQueries({ queryKey: valuationKey });
      return { snapshot: patchValuationStatus(queryClient, recordId, "fail") };
    },
    onSuccess: (result, _vars, context) => {
      if (!result.ok) {
        restoreOptimisticPatch(queryClient, valuationKey, context?.snapshot);
        return;
      }
      invalidateValuationQueries(queryClient);
    },
    onError: (_err, _vars, context) => {
      restoreOptimisticPatch(queryClient, valuationKey, context?.snapshot);
    },
  });
}
