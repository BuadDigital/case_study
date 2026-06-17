"use client";

import { useQuery } from "@tanstack/react-query";
import { loadFinancialSummary } from "../lib/financial-api";

const STALE_MS = 60_000;
const GC_MS = 10 * 60_000;

export function useFinancialSummaryQuery() {
  return useQuery({
    queryKey: ["financial", "summary"],
    queryFn: loadFinancialSummary,
    staleTime: STALE_MS,
    gcTime: GC_MS,
  });
}
