"use client";

import { useEffect } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { appDataKeys } from "@platform/app-shared/query/app-data-keys";
import {
  SUSPENDED_TRANSACTIONS_CHANGED_EVENT,
  loadSuspendedTransactions,
} from "../lib/app-data/suspended-transactions-storage";

const STALE_MS = 30_000;
const GC_MS = 10 * 60_000;

export function useSuspendedTransactionsQuery() {
  const queryClient = useQueryClient();

  useEffect(() => {
    const onChange = () => {
      void queryClient.invalidateQueries({
        queryKey: appDataKeys.suspendedTransactions(),
      });
    };
    window.addEventListener(SUSPENDED_TRANSACTIONS_CHANGED_EVENT, onChange);
    return () =>
      window.removeEventListener(SUSPENDED_TRANSACTIONS_CHANGED_EVENT, onChange);
  }, [queryClient]);

  return useQuery({
    queryKey: appDataKeys.suspendedTransactions(),
    queryFn: loadSuspendedTransactions,
    staleTime: STALE_MS,
    gcTime: GC_MS,
  });
}
