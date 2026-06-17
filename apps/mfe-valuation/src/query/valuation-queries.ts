"use client";

import { useQuery } from "@tanstack/react-query";
import { prototypeKeys } from "@platform/app-shared/query/prototype-keys";
import { loadValuationRequests } from "../lib/valuation-api";

const STALE_MS = 60_000;
const GC_MS = 10 * 60_000;

export function useValuationRequestsQuery() {
  return useQuery({
    queryKey: prototypeKeys.valuationRequests(),
    queryFn: loadValuationRequests,
    staleTime: STALE_MS,
    gcTime: GC_MS,
  });
}
