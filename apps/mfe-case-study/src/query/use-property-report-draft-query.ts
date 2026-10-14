"use client";

import { useQuery } from "@tanstack/react-query";
import { getReportDraftByProperty, type ValuationReportDraftDto } from "@platform/api-client";
import { apiConfig } from "@platform/app-shared/auth/api-config";

/**
 * The valuation-report draft / issuance state of a property's latest request — where the deposit code and
 * the deposit certificate are recorded (the issuance is their only source). Same cache key as the evaluator's
 * own read, so a recorded code shows up in both at once. Null: no request yet.
 */
export function usePropertyReportDraftQuery(propertyId: string | null | undefined, enabled = true) {
  const id = (propertyId ?? "").trim();
  return useQuery({
    queryKey: ["report-draft", id],
    enabled: enabled && id.length > 0,
    staleTime: 15_000,
    queryFn: async (): Promise<ValuationReportDraftDto | null> => {
      const config = apiConfig();
      if (!config) return null;
      const res = await getReportDraftByProperty(config, id);
      if (res.ok) return res.data;
      if (res.kind === "not_found") return null;
      throw new Error("تعذّر تحميل حالة تقرير التقييم");
    },
  });
}
