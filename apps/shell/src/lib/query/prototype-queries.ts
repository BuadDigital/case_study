"use client";

import { useQueryClient, type QueryClient } from "@tanstack/react-query";
import type { PageId } from "@platform/types";
import {
  loadPendingBourseItems,
} from "@case-study/mfe";
import {
  loadPoListRows,
  loadPropertyListItems,
} from "@platform/app-shared/prototype/work-orders-read";
import {
  FAILURES_CHANGED_EVENT,
  FAILURES_STORAGE_KEY,
  loadFailures,
} from "@failures/mfe";
import {
  CASE_STUDY_INFO_ROLES_CHANGED_EVENT,
  loadCaseStudyInfoRolesConfig,
  loadCourtsCatalog,
  fetchOrganization,
  fetchStaffUsers,
} from "@settings/mfe";
import {
  loadPoRecordsWithTaskSync,
  loadWorkflowTasksForQuery,
  TASKS_CHANGED_EVENT,
  TASKS_STORAGE_KEY,
  WORK_ORDERS_CHANGED_EVENT,
} from "@case-study/mfe/query/case-study-queries";
import { loadSuspendedTransactions } from "@case-study/mfe/lib/prototype/suspended-transactions-storage";
import { loadFailureTypesCatalog } from "@failures/mfe/lib/failure-types-storage";
import { loadReportingDashboard } from "@dashboard/mfe/lib/dashboard-reporting-api";
import { loadSurveyOffices } from "@survey/mfe/lib/survey-api";
import { loadSurveyRequestStats } from "@survey/mfe/lib/survey-request-stats";
import { loadPropertyKeysPage } from "@keys/mfe/lib/keys-api";
import { prototypeKeys } from "@platform/app-shared/query/prototype-keys";
import { useEffect } from "react";

const STALE_MS = 60_000;
const GC_MS = 10 * 60_000;

const queryDefaults = { staleTime: STALE_MS, gcTime: GC_MS };

function prefetchOpts(queryClient: QueryClient) {
  return { staleTime: STALE_MS };
}

export function prefetchPrototypePage(
  queryClient: QueryClient,
  page: PageId,
): void {
  const opts = prefetchOpts(queryClient);

  const prefetchTasksAndPos = () => {
    void queryClient.prefetchQuery({
      queryKey: prototypeKeys.poRecords(),
      queryFn: loadPoRecordsWithTaskSync,
      ...opts,
    });
    void queryClient.prefetchQuery({
      queryKey: prototypeKeys.workflowTasks(),
      queryFn: loadWorkflowTasksForQuery,
      ...opts,
    });
  };

  const prefetchActiveTransactionsSituation = () => {
    prefetchTasksAndPos();
    void queryClient.prefetchQuery({
      queryKey: prototypeKeys.poListRows(),
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
    case "po":
      void queryClient.prefetchQuery({
        queryKey: prototypeKeys.poListRows(),
        queryFn: loadPoListRows,
        ...opts,
      });
      void queryClient.prefetchQuery({
        queryKey: prototypeKeys.propertyListItems(),
        queryFn: loadPropertyListItems,
        ...opts,
      });
      prefetchTasksAndPos();
      break;
    case "failures":
      void queryClient.prefetchQuery({
        queryKey: prototypeKeys.failures(),
        queryFn: loadFailures,
        ...opts,
      });
      prefetchTasksAndPos();
      break;
    case "keys":
      prefetchActiveTransactionsSituation();
      void queryClient.prefetchQuery({
        queryKey: prototypeKeys.propertyKeys(),
        queryFn: loadPropertyKeysPage,
        ...opts,
      });
      break;
    case "active-primary-data":
    case "all-transactions":
    case "active-distribution":
    case "active-case-study":
    case "property-inspection":
    case "government-review":
    case "valuation-coordination":
    case "property-appraisal":
    case "active-survey":
    case "party-fees":
    case "valuation-requests":
      prefetchActiveTransactionsSituation();
      break;
    case "survey":
      prefetchActiveTransactionsSituation();
      void queryClient.prefetchQuery({
        queryKey: prototypeKeys.surveyOffices(),
        queryFn: loadSurveyOffices,
        ...opts,
      });
      void queryClient.prefetchQuery({
        queryKey: [...prototypeKeys.surveyOffices(), "request-stats"] as const,
        queryFn: loadSurveyRequestStats,
        ...opts,
      });
      break;
    case "bourse-inquiry":
      prefetchActiveTransactionsSituation();
      void queryClient.prefetchQuery({
        queryKey: prototypeKeys.pendingBourseItems(),
        queryFn: loadPendingBourseItems,
        ...opts,
      });
      break;
    case "users":
      void queryClient.prefetchQuery({
        queryKey: prototypeKeys.staffUsers(),
        queryFn: fetchStaffUsers,
        ...opts,
      });
      void queryClient.prefetchQuery({
        queryKey: prototypeKeys.organization(),
        queryFn: fetchOrganization,
        ...opts,
      });
      break;
    case "courts":
      void queryClient.prefetchQuery({
        queryKey: prototypeKeys.courtsCatalog(),
        queryFn: loadCourtsCatalog,
        ...opts,
      });
      break;
    case "case-study-info-roles":
      void queryClient.prefetchQuery({
        queryKey: prototypeKeys.caseStudyInfoRoles(),
        queryFn: loadCaseStudyInfoRolesConfig,
        ...opts,
      });
      break;
    case "suspended-transactions":
      prefetchActiveTransactionsSituation();
      void queryClient.prefetchQuery({
        queryKey: prototypeKeys.suspendedTransactions(),
        queryFn: loadSuspendedTransactions,
        ...opts,
      });
      break;
    case "failure-types":
      void queryClient.prefetchQuery({
        queryKey: prototypeKeys.failureTypes(),
        queryFn: loadFailureTypesCatalog,
        ...opts,
      });
      break;
    case "financial":
    case "kpi":
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
  const opts = prefetchOpts(queryClient);

  // Tier 1 — data needed by the sidebar badges and most pages.
  void queryClient.prefetchQuery({ queryKey: prototypeKeys.poListRows(), queryFn: loadPoListRows, ...opts });
  void queryClient.prefetchQuery({ queryKey: prototypeKeys.propertyListItems(), queryFn: loadPropertyListItems, ...opts });
  void queryClient.prefetchQuery({ queryKey: prototypeKeys.poRecords(), queryFn: loadPoRecordsWithTaskSync, ...opts });
  void queryClient.prefetchQuery({ queryKey: prototypeKeys.workflowTasks(), queryFn: loadWorkflowTasksForQuery, ...opts });
  void queryClient.prefetchQuery({ queryKey: prototypeKeys.failures(), queryFn: loadFailures, ...opts });

  // Tier 2 — secondary data that can wait until the UI has settled.
  setTimeout(() => {
    void queryClient.prefetchQuery({ queryKey: prototypeKeys.pendingBourseItems(), queryFn: loadPendingBourseItems, ...opts });
    void queryClient.prefetchQuery({ queryKey: prototypeKeys.failureTypes(), queryFn: loadFailureTypesCatalog, ...opts });
    void queryClient.prefetchQuery({ queryKey: ["reporting", "dashboard"], queryFn: loadReportingDashboard, ...opts });
  }, 1_500);
}

export function usePrototypeDataSync(): void {
  const queryClient = useQueryClient();

  useEffect(() => {
    const invalidateWorkOrders = () => {
      void queryClient.invalidateQueries({ queryKey: prototypeKeys.all });
    };

    const invalidateTasks = () => {
      void queryClient.invalidateQueries({
        queryKey: prototypeKeys.workflowTasks(),
      });
    };

    const invalidateFailures = () => {
      void queryClient.invalidateQueries({
        queryKey: prototypeKeys.failures(),
      });
    };

    const invalidateCourts = () => {
      void queryClient.invalidateQueries({
        queryKey: prototypeKeys.courtsCatalog(),
      });
    };

    const invalidateInfoRoles = () => {
      void queryClient.invalidateQueries({
        queryKey: prototypeKeys.caseStudyInfoRoles(),
      });
    };

    window.addEventListener(WORK_ORDERS_CHANGED_EVENT, invalidateWorkOrders);
    window.addEventListener(TASKS_CHANGED_EVENT, invalidateTasks);
    const onInfoRolesChanged = () => invalidateInfoRoles();

    const onFailuresChanged = () => invalidateFailures();

    const onStorage = (e: StorageEvent) => {
      if (e.key === FAILURES_STORAGE_KEY) invalidateFailures();
      if (e.key === TASKS_STORAGE_KEY) invalidateTasks();
    };
    window.addEventListener("storage", onStorage);
    window.addEventListener(FAILURES_CHANGED_EVENT, onFailuresChanged);
    window.addEventListener(CASE_STUDY_INFO_ROLES_CHANGED_EVENT, onInfoRolesChanged);

    return () => {
      window.removeEventListener(WORK_ORDERS_CHANGED_EVENT, invalidateWorkOrders);
      window.removeEventListener(TASKS_CHANGED_EVENT, invalidateTasks);
      window.removeEventListener("storage", onStorage);
      window.removeEventListener(FAILURES_CHANGED_EVENT, onFailuresChanged);
      window.removeEventListener(
        CASE_STUDY_INFO_ROLES_CHANGED_EVENT,
        onInfoRolesChanged,
      );
    };
  }, [queryClient]);
}

export {
  loadPoRecordsWithTaskSync,
  prefetchPoRecord,
  TASKS_CHANGED_EVENT,
  TASKS_STORAGE_KEY,
  WORK_ORDERS_CHANGED_EVENT,
  usePendingBourseItemsQuery,
  usePoListRowsQuery,
  usePoRecordQuery,
  usePoRecordsQuery,
  useWorkflowTasksQuery,
} from "@case-study/mfe/query/case-study-queries";

export { usePropertyListItemsQuery } from "@dashboard/mfe/query/dashboard-queries";

export {
  useCourtsCatalogQuery,
  useCaseStudyInfoRolesQuery,
  useStaffUsersQuery,
  useOrganizationQuery,
  setCaseStudyInfoRolesCache,
} from "@settings/mfe/query/settings-queries";

export { useFailuresQuery } from "@failures/mfe/query/failures-queries";

