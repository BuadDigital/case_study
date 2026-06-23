"use client";

import { useQuery } from "@tanstack/react-query";
import { getPropertyTimeline } from "@platform/api-client";
import { prototypeKeys } from "@platform/app-shared/query/prototype-keys";
import { workOrdersApiConfig } from "../lib/work-orders-api-config";
import {
  mapPropertyTimelineDtos,
  type PropertyTimelineEvent,
} from "../lib/prototype/property-detail-timeline";

const STALE_MS = 60_000;
const GC_MS = 10 * 60_000;

export function usePropertyTimelineQuery(
  poNumber: string | null | undefined,
  propertyId: string | null | undefined,
) {
  const po = poNumber?.trim() ?? "";
  const property = propertyId?.trim() ?? "";

  return useQuery<PropertyTimelineEvent[]>({
    queryKey: prototypeKeys.propertyTimeline(po, property),
    queryFn: async () => {
      const config = workOrdersApiConfig();
      if (!config || !po || !property) return [];
      const result = await getPropertyTimeline(config, po, property);
      if (!result.ok) return [];
      return mapPropertyTimelineDtos(result.data);
    },
    enabled: Boolean(po && property),
    staleTime: STALE_MS,
    gcTime: GC_MS,
  });
}
