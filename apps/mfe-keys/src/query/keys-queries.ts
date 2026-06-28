"use client";

import { useEffect } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { FAILURES_CHANGED_EVENT } from "@failures/mfe/lib/failures-events";
import { prototypeKeys } from "@platform/app-shared/query/prototype-keys";
import { loadPropertyKeysPage } from "../lib/keys-api";

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
