"use client";

import { useQuery } from "@tanstack/react-query";
import { loadReportingDashboard } from "../lib/dashboard-reporting-api";

const STALE_MS = 60_000;
const GC_MS = 10 * 60_000;

export function useReportingDashboardQuery() {
  return useQuery({
    queryKey: ["reporting", "dashboard"],
    queryFn: loadReportingDashboard,
    staleTime: STALE_MS,
    gcTime: GC_MS,
  });
}
