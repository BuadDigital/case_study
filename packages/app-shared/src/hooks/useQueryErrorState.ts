"use client";

import type { UseQueryResult } from "@tanstack/react-query";
import { apiErrorMessage } from "../prototype/work-orders-api-config";

export type QueryErrorState = {
  isError: boolean;
  message: string;
  retry: (() => void) | null;
  isRetrying: boolean;
};

export function useQueryErrorState(
  query: Pick<
    UseQueryResult<unknown, Error>,
    "isError" | "error" | "refetch" | "isFetching" | "failureReason"
  >,
  fallback = "تعذّر تحميل البيانات",
): QueryErrorState {
  const kind =
    query.error && "kind" in query.error
      ? String((query.error as { kind?: string }).kind)
      : "network";

  return {
    isError: query.isError,
    message:
      query.error?.message?.trim() ||
      apiErrorMessage(kind, fallback),
    retry: query.isError ? () => void query.refetch() : null,
    isRetrying: query.isFetching && query.isError,
  };
}
