"use client";

import type { QueryClient } from "@tanstack/react-query";
import { appDataKeys } from "@platform/app-shared/query/app-data-keys";
import { loadInspectorFeesSummary } from "@platform/app-shared/app-data/inspector-fees-api";
import { loadPartyBillingStatements } from "@platform/app-shared/app-data/party-billing-statements-api";
import type { CostsSection } from "../lib/finance-nav";
import {
  partyBillingDuesPageRequest,
  partyBillingReadyLinesPageOptions,
  partyBillingStatementsPageOptions,
  partyBillingStatementsPageRequest,
} from "./billing-list-page-queries";

/** Fee lines behind the «مستبعدة» tab — excluded or zero-net before entitlement. */
export function financeExcludedFeesOptions() {
  return {
    queryKey: [...appDataKeys.all, "inspector-fees", "finance-excluded"],
    queryFn: () => loadInspectorFeesSummary({ submittedOnly: false }),
  };
}

/** Statements behind the «مستبعدة» tab — the cancelled ones are listed as a log. */
export function financeExcludedStatementsOptions() {
  return {
    queryKey: [...appDataKeys.all, "party-billing", "statements", "excluded"],
    queryFn: () => loadPartyBillingStatements(),
  };
}

/**
 * Warm the first page a payee-account tab shows while the pointer is on it, so
 * the click lands on cached rows instead of «جاري التحميل…». Reads only; a
 * fresh cache entry is left alone.
 */
export function prefetchCostsAccountTab(
  queryClient: QueryClient,
  section: CostsSection,
  assigneeId: string | null,
): void {
  if (section === "excluded") {
    void queryClient.prefetchQuery(financeExcludedFeesOptions());
    void queryClient.prefetchQuery(financeExcludedStatementsOptions());
    return;
  }
  if (section === "dues") {
    void queryClient.prefetchQuery(
      partyBillingReadyLinesPageOptions(
        partyBillingDuesPageRequest({ assigneeId, q: "", page: 1 }),
      ),
    );
    return;
  }
  if (section === "statements" || section === "paid") {
    void queryClient.prefetchQuery(
      partyBillingStatementsPageOptions(
        partyBillingStatementsPageRequest({
          assigneeId,
          mode: section,
          page: 1,
        }),
      ),
    );
  }
}
