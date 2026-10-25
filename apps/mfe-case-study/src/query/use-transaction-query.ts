"use client";

import { useQuery } from "@tanstack/react-query";
import { getTransactionTimeline } from "@platform/api-client";
import { appDataKeys } from "@platform/app-shared/query/app-data-keys";
import { useTransactionByPropertyQuery } from "@platform/app-shared/query/transaction-by-property-query";
import {
  requireWorkOrdersApiConfig,
  unwrapApiResult,
} from "../lib/work-orders-api-config";
import {
  mapTransactionTimelineDtos,
  type PropertyTimelineEvent,
} from "../lib/app-data/property-detail-timeline";
import { usePropertyTimelineQuery } from "./use-property-timeline-query";

const STALE_MS = 60_000;
const GC_MS = 10 * 60_000;

/** The transaction (المعاملة) a deed belongs to, with every deed in it. `null` when the deed has none (older rows). */
export const useTransactionQuery = useTransactionByPropertyQuery;

/**
 * The timeline a property page shows: the transaction's merged timeline when it has several
 * deeds (every event names its deed), else the deed's own. Both are read-only queries.
 */
export function usePropertyOrTransactionTimeline(
  poNumber: string,
  property: { id: string; transactionId?: string | null; transactionDeedCount?: number },
) {
  const transactionQuery = useTransactionQuery(property.id);
  const deedCount = transactionQuery.data?.deedCount ?? property.transactionDeedCount ?? 1;
  const transactionId = transactionQuery.data?.id ?? property.transactionId ?? null;
  const multi = deedCount > 1 && Boolean(transactionId);
  const own = usePropertyTimelineQuery(multi ? null : poNumber, multi ? null : property.id);
  const merged = useTransactionTimelineQuery(transactionId, { enabled: multi });
  return {
    query: multi ? merged : own,
    multi,
    transactionId,
    invalidationKey: multi && transactionId
      ? appDataKeys.transactionTimeline(transactionId)
      : appDataKeys.propertyTimeline(poNumber, property.id),
  };
}

/** One timeline for every deed of the transaction, oldest first; each event names its deed. */
export function useTransactionTimelineQuery(
  transactionId: string | null | undefined,
  options: { enabled?: boolean } = {},
) {
  const id = transactionId?.trim() ?? "";
  return useQuery<PropertyTimelineEvent[]>({
    queryKey: appDataKeys.transactionTimeline(id),
    queryFn: async () => {
      const config = requireWorkOrdersApiConfig();
      if (!id) return [];
      const result = await getTransactionTimeline(config, id);
      return mapTransactionTimelineDtos(
        unwrapApiResult(result, "تعذّر تحميل الجدول الزمني للمعاملة"),
      );
    },
    enabled: Boolean(id) && (options.enabled ?? true),
    staleTime: STALE_MS,
    gcTime: GC_MS,
  });
}
