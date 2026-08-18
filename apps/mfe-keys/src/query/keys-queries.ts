"use client";

import { useQuery, useQueryClient } from "@tanstack/react-query";
import { prototypeKeys } from "@platform/app-shared/query/prototype-keys";
import {
  loadKeyEnvelopeFeeReport,
  loadKeyEnvelopes,
} from "../lib/keys-envelope-api";

const STALE_MS = 60_000;
const GC_MS = 10 * 60_000;

export function useKeyEnvelopesQuery() {
  return useQuery({
    queryKey: prototypeKeys.keyEnvelopes(),
    queryFn: loadKeyEnvelopes,
    staleTime: STALE_MS,
    gcTime: GC_MS,
  });
}

export function useInvalidateKeyEnvelopes() {
  const queryClient = useQueryClient();
  return () => {
    void queryClient.invalidateQueries({
      queryKey: prototypeKeys.keyEnvelopes(),
    });
    void queryClient.invalidateQueries({
      queryKey: prototypeKeys.keyEnvelopeFees(),
    });
  };
}

export function useKeyEnvelopeFeesQuery() {
  return useQuery({
    queryKey: prototypeKeys.keyEnvelopeFees(),
    queryFn: loadKeyEnvelopeFeeReport,
    staleTime: STALE_MS,
    gcTime: GC_MS,
  });
}
