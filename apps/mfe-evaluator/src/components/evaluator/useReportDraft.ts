"use client";

import { useMemo } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import {
  getReportDraftByProperty,
  type ValuationReportDraftDto,
} from "@platform/api-client";
import { putReportDraftStates } from "@platform/app-shared/workflow/report-draft-state";
import { apiConfig } from "./valuation-work/lib/shell-utils";

/** The queues' status labels read the same state from a shared cache; keep it as fresh as this page's own read. */
function shareState(propertyId: string, dto: ValuationReportDraftDto) {
  putReportDraftStates([{ propertyId, status: dto.status, reportStage: dto.reportStage }]);
}

export const reportDraftKey = (propertyId: string) => ["report-draft", propertyId] as const;

/**
 * The valuation-report draft of a property's latest request. Null: the property has no request yet.
 * Refetches on focus so a send / withdraw / approval by the other party shows up without a reload.
 */
export function useReportDraftByProperty(propertyId: string | null | undefined, enabled = true) {
  const id = (propertyId ?? "").trim();
  return useQuery({
    queryKey: reportDraftKey(id),
    enabled: enabled && id.length > 0,
    staleTime: 15_000,
    refetchOnWindowFocus: true,
    queryFn: async (): Promise<ValuationReportDraftDto | null> => {
      const config = apiConfig();
      if (!config) return null;
      const res = await getReportDraftByProperty(config, id);
      if (res.ok) {
        shareState(id, res.data);
        return res.data;
      }
      if (res.kind === "not_found") return null;
      throw new Error("تعذّر تحميل مسودة التقرير");
    },
  });
}

/** Writes the fresh draft DTO into the cache so every mounted reader updates at once. */
export function useSetReportDraft(propertyId: string | null | undefined) {
  const queryClient = useQueryClient();
  const id = (propertyId ?? "").trim();
  return useMemo(
    () => (dto: ValuationReportDraftDto) => {
      queryClient.setQueryData(reportDraftKey(id), dto);
      shareState(id, dto);
    },
    [queryClient, id],
  );
}
