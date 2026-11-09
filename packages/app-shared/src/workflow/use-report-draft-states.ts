"use client";

import { useEffect } from "react";
import { useQuery, type QueryClient } from "@tanstack/react-query";
import { listReportDraftStates, type ReportDraftStateDto } from "@platform/api-client";
import { apiConfig } from "../auth/api-config";
import { putReportDraftStates, useReportDraftStateVersion } from "./report-draft-state";

const MAX_IDS = 200;

/** Query-key root of the batch reads below — one cache entry per id set. */
export const REPORT_DRAFT_STATES_KEY = "report-draft-states";

/**
 * Writes one property's fresh draft state into every cached batch read that holds it.
 *
 * How it works: walks the cached `[REPORT_DRAFT_STATES_KEY, …]` entries and replaces that property's row
 * (status and stage; the server's progress figure is kept), leaving the other rows as they were.
 *
 * Edge cases: fixed A→Z 2026-11-02 #88 — after «اعتماد التقرير» a component that mounted again (the parties
 * rail on a tab switch) re-put its cached batch row («sent») into the shared state on mount, so the screen
 * said «بانتظار اعتماد المقيّم» until a reload. A batch that never held the property is left alone.
 */
export function patchReportDraftStatesCache(
  queryClient: QueryClient,
  row: Pick<ReportDraftStateDto, "propertyId" | "status" | "reportStage">,
): void {
  queryClient.setQueriesData<ReportDraftStateDto[]>({ queryKey: [REPORT_DRAFT_STATES_KEY] }, (rows) => {
    if (!rows?.some((r) => r.propertyId === row.propertyId)) return rows;
    return rows.map((r) =>
      r.propertyId === row.propertyId ? { ...r, status: row.status, reportStage: row.reportStage } : r,
    );
  });
}

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
    queryKey: [REPORT_DRAFT_STATES_KEY, key],
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
