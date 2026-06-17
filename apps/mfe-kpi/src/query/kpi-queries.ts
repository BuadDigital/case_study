"use client";

import { useQuery } from "@tanstack/react-query";
import { loadReportingKpi } from "../lib/kpi-api";

const STALE_MS = 60_000;
const GC_MS = 10 * 60_000;

export function useReportingKpiQuery() {
  return useQuery({
    queryKey: ["reporting", "kpi"],
    queryFn: loadReportingKpi,
    staleTime: STALE_MS,
    gcTime: GC_MS,
  });
}
