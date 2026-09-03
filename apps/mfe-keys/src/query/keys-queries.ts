"use client";

import { useQuery, useQueryClient } from "@tanstack/react-query";
import { appDataKeys } from "@platform/app-shared/query/app-data-keys";
import {
  loadKeyEnvelopeFeeReport,
  loadKeyEnvelopes,
} from "../lib/keys-envelope-api";

const STALE_MS = 60_000;
const GC_MS = 10 * 60_000;

export function useKeyEnvelopesQuery() {
  return useQuery({
    queryKey: appDataKeys.keyEnvelopes(),
    queryFn: loadKeyEnvelopes,
    staleTime: STALE_MS,
    gcTime: GC_MS,
  });
}

export function useInvalidateKeyEnvelopes() {
  const queryClient = useQueryClient();
  return () => {
    void queryClient.invalidateQueries({
      queryKey: appDataKeys.keyEnvelopes(),
    });
    void queryClient.invalidateQueries({
      queryKey: appDataKeys.keyEnvelopeFees(),
    });
  };
}

export function useKeyEnvelopeFeesQuery() {
  return useQuery({
    queryKey: appDataKeys.keyEnvelopeFees(),
    queryFn: loadKeyEnvelopeFeeReport,
    staleTime: STALE_MS,
    gcTime: GC_MS,
  });
}
