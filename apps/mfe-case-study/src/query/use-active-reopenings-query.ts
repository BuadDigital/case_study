"use client";

import { useQuery } from "@tanstack/react-query";
import { listActiveReopenings, type TransactionReopeningDto } from "@platform/api-client";
import {
  requireWorkOrdersApiConfig,
  unwrapApiResult,
} from "@platform/app-shared/app-data/work-orders-api-config";

const EMPTY: TransactionReopeningDto[] = [];

/**
 * The reopenings not closed yet (Omar 2026-11-05) — «أعمالي» shows coordination's «الرد على إنفاذ» rows
 * and the «معادة للدراسة» chip from them.
 *
 * How it works: one list read, kept 30 s and refetched on window focus.
 * Edge cases: a failed read leaves the list empty (the rows simply do not show); disabled → empty.
 */
export function useActiveReopeningsQuery(enabled = true): TransactionReopeningDto[] {
  const query = useQuery({
    queryKey: ["transaction-reopenings", "active"],
    enabled,
    staleTime: 30_000,
    refetchOnWindowFocus: true,
    queryFn: async () =>
      unwrapApiResult(
        await listActiveReopenings(requireWorkOrdersApiConfig()),
        "تعذّر تحميل المعاملات المعادة للدراسة",
      ),
  });
  return query.data ?? EMPTY;
}
