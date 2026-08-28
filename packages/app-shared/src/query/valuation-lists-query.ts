"use client";

import { useQuery } from "@tanstack/react-query";
import {
  getValuationLists,
  type ValuationListsDto,
} from "@platform/api-client";
import { apiConfig } from "../auth/api-config";

/**
 * قوائم التقييم عبر react-query — كانت تُجلب مرتين على شاشة المراجعة النهائية
 * (تبويب المراجعة + قسم الرأي النهائي) بلا أي تخزين مؤقت (client-swr-dedup).
 */
export function useValuationListsQuery() {
  return useQuery({
    queryKey: ["valuation-lists"],
    queryFn: async (): Promise<ValuationListsDto | null> => {
      const config = apiConfig();
      if (!config) return null;
      const res = await getValuationLists(config);
      return res.ok ? res.data : null;
    },
    staleTime: 5 * 60_000,
    gcTime: 30 * 60_000,
  });
}
