"use client";

import { useQuery, useQueryClient } from "@tanstack/react-query";
import { prototypeKeys } from "@platform/app-shared/query/prototype-keys";
import {
  loadKeyEnvelopeFeeReport,
  loadKeyEnvelopes,
  loadPropertyCourtAccess,
} from "../lib/keys-envelope-api";
import { loadPropertyKeysPage } from "../lib/keys-api";
import { useEffect } from "react";
import { FAILURES_CHANGED_EVENT } from "@failures/mfe/lib/failures-events";

const STALE_MS = 60_000;
const GC_MS = 10 * 60_000;

export function usePropertyKeysQuery() {
  const queryClient = useQueryClient();

  useEffect(() => {
    const refresh = () => {
      void queryClient.invalidateQueries({
        queryKey: prototypeKeys.propertyKeys(),
      });
    };
    window.addEventListener(FAILURES_CHANGED_EVENT, refresh);
    return () => window.removeEventListener(FAILURES_CHANGED_EVENT, refresh);
  }, [queryClient]);

  return useQuery({
    queryKey: prototypeKeys.propertyKeys(),
    queryFn: loadPropertyKeysPage,
    staleTime: STALE_MS,
    gcTime: GC_MS,
  });
}

export function useInvalidatePropertyKeys() {
  const queryClient = useQueryClient();
  return () =>
    void queryClient.invalidateQueries({
      queryKey: prototypeKeys.propertyKeys(),
    });
}

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
    void queryClient.invalidateQueries({
      queryKey: prototypeKeys.propertyCourtAccess(),
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

export function usePropertyCourtAccessQuery() {
  return useQuery({
    queryKey: prototypeKeys.propertyCourtAccess(),
    queryFn: () => loadPropertyCourtAccess(),
    staleTime: STALE_MS,
    gcTime: GC_MS,
  });
}
