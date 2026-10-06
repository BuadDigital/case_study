"use client";

import { useEffect } from "react";
import { useQuery } from "@tanstack/react-query";
import { listReportDraftStates } from "@platform/api-client";
import { apiConfig } from "../auth/api-config";
import { putReportDraftStates, useReportDraftStateVersion } from "./report-draft-state";

const MAX_IDS = 200;

/**
 * Fills the draft-state cache for the given properties (the appraiser queue's rows) and returns a
 * version that changes when it does, so memoised lists can depend on it. Quiet on failure: the rows
 * simply keep the coarser «handed over» label.
 */
export function useReportDraftStates(
  propertyIds: readonly (string | null | undefined)[],
  enabled = true,
): number {
  const ids = [...new Set(propertyIds.filter((x): x is string => Boolean(x)))].sort().slice(0, MAX_IDS);
  const key = ids.join(",");
  const query = useQuery({
    queryKey: ["report-draft-states", key],
    enabled: enabled && ids.length > 0,
    staleTime: 15_000,
    refetchOnWindowFocus: true,
    queryFn: async () => {
      const config = apiConfig();
      if (!config) return [];
      const res = await listReportDraftStates(config, ids);
      return res.ok ? res.data : [];
    },
  });
  useEffect(() => {
    if (query.data) putReportDraftStates(query.data);
  }, [query.data]);
  return useReportDraftStateVersion();
}
