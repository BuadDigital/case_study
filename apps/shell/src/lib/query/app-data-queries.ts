"use client";

import { useQueryClient, type QueryClient } from "@tanstack/react-query";
import type { PageId } from "@platform/types";
import { loadPendingBourseItems } from "@case-study/mfe/lib/app-data/po-intake-reads";
import { loadPoListRows, loadPropertyListItems } from "@platform/app-shared/app-data/work-orders-read";
import { FAILURES_CHANGED_EVENT } from "@failures/mfe/lib/failures-events";
import { loadFailuresQuery } from "@failures/mfe/lib/failures-repository";
import {
  CASE_STUDY_INFO_ROLES_CHANGED_EVENT,
  loadCaseStudyInfoRolesConfig,
} from "@settings/mfe/lib/app-data/case-study-info-roles-storage";
import { loadPoRecordsWithTaskSync, loadWorkflowTasksForQuery, TASKS_CHANGED_EVENT, WORK_ORDERS_CHANGED_EVENT } from "@case-study/mfe/query/case-study-queries";
import { loadSuspendedTransactions } from "@case-study/mfe/lib/app-data/suspended-transactions-storage";
import { loadFailureTypesCatalog } from "@failures/mfe/lib/failure-types-storage";
import { loadReportingDashboard } from "@dashboard/mfe/lib/dashboard-reporting-api";
import { loadKeyEnvelopes } from "@keys/mfe/lib/keys-envelope-api";
import {
  loadPartyFeePricingById,
  loadPartyFeePricingTables,
  partyFeePricingTableQueryKey,
  partyFeePricingTablesQueryKey,
} from "@financial/mfe/lib/financial-api";
import { appDataKeys } from "@platform/app-shared/query/app-data-keys";
import { useEffect } from "react";

const STALE_MS = 60_000;

function prefetchOpts() {
  return { staleTime: STALE_MS };
}

export function prefetchPrototypePage(
  queryClient: QueryClient,
  page: PageId,
): void {
  const opts = prefetchOpts();

  const prefetchTasksAndPos = () => {
    void queryClient.prefetchQuery({
      queryKey: appDataKeys.poRecords(),
      queryFn: loadPoRecordsWithTaskSync,
      ...opts,
    });
    void queryClient.prefetchQuery({
      queryKey: appDataKeys.workflowTasks(),
      queryFn: loadWorkflowTasksForQuery,
      ...opts,
    });
  };

  const prefetchActiveTransactionsSituation = () => {
    prefetchTasksAndPos();
    void queryClient.prefetchQuery({
      queryKey: appDataKeys.poListRows(),
      queryFn: loadPoListRows,
      ...opts,
    });
  };

  switch (page) {
    case "dashboard":
      void queryClient.prefetchQuery({
        queryKey: ["reporting", "dashboard"],
        queryFn: loadReportingDashboard,
        ...opts,
      });
      break;
    case "po":
      void queryClient.prefetchQuery({
        queryKey: appDataKeys.poListRows(),
        queryFn: loadPoListRows,
        ...opts,
      });
      void queryClient.prefetchQuery({
        queryKey: appDataKeys.propertyListItems(),
        queryFn: loadPropertyListItems,
        ...opts,
      });
      prefetchTasksAndPos();
      break;
    case "failures":
      void queryClient.prefetchQuery({
        queryKey: appDataKeys.failures(),
        queryFn: loadFailuresQuery,
        ...opts,
      });
      prefetchTasksAndPos();
      break;
    case "keys":
      // KeysView lists envelopes only (`keyEnvelopes`). Do NOT warm PO/workflow
      // or the legacy property-keys page here — that used to starve the real
      // list request with sync + 4-5 concurrent APIs the screen never shows.
      void queryClient.prefetchQuery({
        queryKey: appDataKeys.keyEnvelopes(),
        queryFn: loadKeyEnvelopes,
        ...opts,
      });
      break;
    case "active-primary-data":
    case "all-transactions":
    case "property-map":
    case "favorites":
    case "active-distribution":
    case "active-case-study":
    case "system-upload":
    case "property-inspection":
    case "active-inspection":
    case "property-appraisal":
    case "active-survey":
    case "party-fees":
    case "valuation-requests":
      prefetchActiveTransactionsSituation();
      break;
    case "bourse-inquiry":
      prefetchActiveTransactionsSituation();
      void queryClient.prefetchQuery({
        queryKey: appDataKeys.pendingBourseItems(),
        queryFn: loadPendingBourseItems,
        ...opts,
      });
      break;
    case "case-study-info-roles":
      void queryClient.prefetchQuery({
        queryKey: appDataKeys.caseStudyInfoRoles(),
        queryFn: loadCaseStudyInfoRolesConfig,
        ...opts,
      });
      break;
    case "suspended-transactions":
      prefetchActiveTransactionsSituation();
      void queryClient.prefetchQuery({
        queryKey: appDataKeys.suspendedTransactions(),
        queryFn: loadSuspendedTransactions,
        ...opts,
      });
      break;
    case "failure-types":
      void queryClient.prefetchQuery({
        queryKey: appDataKeys.failureTypes(),
        queryFn: loadFailureTypesCatalog,
        ...opts,
      });
      break;
    case "fee-pricing": {
      // Default category matches FinancePartyFeePricing initial state.
      const category = "engineering-survey" as const;
      void queryClient
        .prefetchQuery({
          queryKey: partyFeePricingTablesQueryKey(category),
          queryFn: () => loadPartyFeePricingTables(category),
          ...opts,
        })
        .then(() => {
          const list = queryClient.getQueryData(
            partyFeePricingTablesQueryKey(category),
          ) as
            | Awaited<ReturnType<typeof loadPartyFeePricingTables>>
            | undefined;
          const id =
            list?.find((t) => t.isActive)?.id ?? list?.[0]?.id ?? "";
          if (!id) return;
          void queryClient.prefetchQuery({
            queryKey: partyFeePricingTableQueryKey(id),
            queryFn: () => loadPartyFeePricingById(id),
            ...opts,
          });
        });
      break;
    }
    case "financial":
      break;
    default:
      break;
  }
}

/**
 * Warm cache on app boot in two tiers so the most-needed data (work orders,
 * tasks) loads first without competing with the dashboard's reporting call and
 * secondary data.
 */
export function prefetchCorePrototypeData(queryClient: QueryClient): void {
  const opts = prefetchOpts();

  // Tier 1 — data needed by the sidebar badges and most pages.
  void queryClient.prefetchQuery({ queryKey: appDataKeys.poListRows(), queryFn: loadPoListRows, ...opts });
  void queryClient.prefetchQuery({ queryKey: appDataKeys.propertyListItems(), queryFn: loadPropertyListItems, ...opts });
  void queryClient.prefetchQuery({ queryKey: appDataKeys.poRecords(), queryFn: loadPoRecordsWithTaskSync, ...opts });
  void queryClient.prefetchQuery({ queryKey: appDataKeys.workflowTasks(), queryFn: loadWorkflowTasksForQuery, ...opts });
  void queryClient.prefetchQuery({ queryKey: appDataKeys.failures(), queryFn: loadFailuresQuery, ...opts });

  // Tier 2 — secondary data that can wait until the UI has settled.
  setTimeout(() => {
    void queryClient.prefetchQuery({ queryKey: appDataKeys.pendingBourseItems(), queryFn: loadPendingBourseItems, ...opts });
    void queryClient.prefetchQuery({ queryKey: appDataKeys.failureTypes(), queryFn: loadFailureTypesCatalog, ...opts });
    void queryClient.prefetchQuery({ queryKey: ["reporting", "dashboard"], queryFn: loadReportingDashboard, ...opts });
  }, 1_500);
}

export function useAppAccessDataSync(): void {
  const queryClient = useQueryClient();

  useEffect(() => {
    const invalidateWorkOrders = () => {
      // Work-order mutations need PO list / property list + records, not the
      // entire prototype tree (finance badges, fee summaries, timelines…).
      void queryClient.invalidateQueries({
        queryKey: appDataKeys.poListRows(),
      });
      void queryClient.invalidateQueries({
        queryKey: appDataKeys.propertyListItems(),
      });
      void queryClient.invalidateQueries({
        queryKey: appDataKeys.poRecords(),
      });
      void queryClient.invalidateQueries({
        queryKey: appDataKeys.workflowTasks(),
      });
      void queryClient.invalidateQueries({
        queryKey: appDataKeys.pendingBourseItems(),
      });
    };

    const invalidateTasks = () => {
      void queryClient.invalidateQueries({
        queryKey: appDataKeys.workflowTasks(),
      });
      // Phase revert distribution → bourse (and similar) updates ListPendingBourse;
      // badges / bourse query read this key, not workflowTasks alone.
      void queryClient.invalidateQueries({
        queryKey: appDataKeys.pendingBourseItems(),
      });
    };

    const invalidateFailures = () => {
      void queryClient.invalidateQueries({
        queryKey: appDataKeys.failures(),
      });
      // Ops tasks can park/resume when a linked failure opens or clears.
      void queryClient.invalidateQueries({
        queryKey: appDataKeys.operationsTasks(),
      });
    };

    const invalidateInfoRoles = () => {
      void queryClient.invalidateQueries({
        queryKey: appDataKeys.caseStudyInfoRoles(),
      });
    };

    window.addEventListener(WORK_ORDERS_CHANGED_EVENT, invalidateWorkOrders);
    window.addEventListener(TASKS_CHANGED_EVENT, invalidateTasks);
    const onInfoRolesChanged = () => invalidateInfoRoles();

    const onFailuresChanged = () => invalidateFailures();

    window.addEventListener(FAILURES_CHANGED_EVENT, onFailuresChanged);
    window.addEventListener(CASE_STUDY_INFO_ROLES_CHANGED_EVENT, onInfoRolesChanged);

    return () => {
      window.removeEventListener(WORK_ORDERS_CHANGED_EVENT, invalidateWorkOrders);
      window.removeEventListener(TASKS_CHANGED_EVENT, invalidateTasks);
      window.removeEventListener(FAILURES_CHANGED_EVENT, onFailuresChanged);
      window.removeEventListener(
        CASE_STUDY_INFO_ROLES_CHANGED_EVENT,
        onInfoRolesChanged,
      );
    };
  }, [queryClient]);
}

export {
  prefetchPoRecord,
  usePendingBourseItemsQuery,
  usePoRecordQuery,
  usePoRecordsQuery,
  useWorkflowTasksQuery,
} from "@case-study/mfe/query/case-study-queries";

export { useFailuresQuery } from "@failures/mfe/query/failures-queries";

