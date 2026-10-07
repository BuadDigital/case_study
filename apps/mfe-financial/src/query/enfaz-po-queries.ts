"use client";

import { appDataKeys } from "@platform/app-shared/query/app-data-keys";
import {
  loadEnfazFollowups,
  loadPoEnfazBillingForQuery,
} from "@platform/app-shared/app-data/enfaz-billing-api";

/** One work order's Enfaz billing sheet — shared by the work panel and its hover prefetch. */
export function enfazPoBillingOptions(poNumber: string | null) {
  return {
    queryKey: [...appDataKeys.all, "enfaz-billing", poNumber],
    queryFn: () => loadPoEnfazBillingForQuery(poNumber!),
  };
}

/** Collection follow-ups logged on one work order. */
export function enfazFollowupsOptions(poNumber: string) {
  return {
    queryKey: [...appDataKeys.all, "enfaz-billing", "followups", poNumber],
    queryFn: () => loadEnfazFollowups(poNumber),
  };
}
