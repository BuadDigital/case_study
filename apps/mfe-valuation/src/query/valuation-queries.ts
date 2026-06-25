"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { prototypeKeys } from "@platform/app-shared/query/prototype-keys";
import {
  loadValuationRequests,
  submitValuationRequestImpediment,
  submitValuationRequestReport,
} from "../lib/valuation-api";

const STALE_MS = 60_000;
const GC_MS = 10 * 60_000;

function invalidateValuationQueries(queryClient: ReturnType<typeof useQueryClient>) {
  void queryClient.invalidateQueries({
    queryKey: prototypeKeys.valuationRequests(),
  });
  void queryClient.invalidateQueries({
    queryKey: ["reporting", "dashboard"],
  });
}

export function useValuationRequestsQuery() {
  return useQuery({
    queryKey: prototypeKeys.valuationRequests(),
    queryFn: loadValuationRequests,
    staleTime: STALE_MS,
    gcTime: GC_MS,
  });
}

export function useSubmitValuationReportMutation() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: submitValuationRequestReport,
    onSuccess: (result) => {
      if (!result.ok) return;
      invalidateValuationQueries(queryClient);
    },
  });
}

export function useSubmitValuationImpedimentMutation() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ recordId, reason }: { recordId: string; reason: string }) =>
      submitValuationRequestImpediment(recordId, reason),
    onSuccess: (result) => {
      if (!result.ok) return;
      invalidateValuationQueries(queryClient);
    },
  });
}
