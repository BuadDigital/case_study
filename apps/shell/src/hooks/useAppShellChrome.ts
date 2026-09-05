"use client";

import { useCallback, useEffect, useMemo } from "react";
import { useQuery, type QueryClient } from "@tanstack/react-query";
import type { RoleId } from "@platform/types";
import type { FinanceNavArea } from "@platform/app-shared/app-data/financial-nav";
import { appDataKeys } from "@platform/app-shared/query/app-data-keys";
import {
  loadWorkflowTasksForQuery,
  type WorkflowTask,
} from "@case-study/mfe/lib/app-data/tasks-storage";
import { loadOperationsTasks } from "@case-study/mfe/lib/app-data/operations-tasks-reads";
import {
  prefetchPoRecord,
  prefetchPrototypePage,
  usePoRecordQuery,
} from "@/lib/query/app-data-queries";
import { resolvePoChrome } from "@/lib/po-chrome";
import { resolveMyTasksChrome } from "@/lib/my-tasks-chrome";
import type { ShellRoute } from "@/components/views/app-shell-nav-state";
import {
  isOnTaskWork,
  pickWorkspaceTaskRef,
  propertyWorkspaceDeedLabel,
  resolveKeysChrome,
  resolveMyTasksTaskId,
  resolveOpsTaskTitle,
  resolveOrgSettingsChrome,
  resolvePageChrome,
  resolvePropertyWorkspaceBreadcrumb,
  type PageChrome,
} from "@/components/views/app-shell-chrome-state";

export type AppShellChrome = PageChrome & {
  poChrome: ReturnType<typeof resolvePoChrome>;
  /** True while inside a task — highlights the active-transactions dropdown. */
  onTaskWork: boolean;
};

/**
 * Topbar breadcrumb + title for the current route. Reads the workflow /
 * operations task queries the workspace routes need and prefetches the PO
 * record behind them; every decision is a pure function in
 * `app-shell-chrome-state`.
 */
export function useAppShellChrome({
  pathname,
  route,
  searchParams,
  role,
  financeArea,
  queryClient,
}: {
  pathname: string | null;
  route: ShellRoute;
  searchParams: URLSearchParams;
  role: RoleId;
  financeArea: FinanceNavArea;
  queryClient: QueryClient;
}): AppShellChrome {
  const {
    currentPage,
    onCaseStudyWorkspace,
    onPropertyAppraisalWorkspace,
    caseStudyTaskId,
    propertyAppraisalTaskId,
  } = route;

  const selectWorkspaceTasks = useCallback(
    (tasks: WorkflowTask[]) => ({
      caseStudy: pickWorkspaceTaskRef(tasks, caseStudyTaskId),
      appraisal: pickWorkspaceTaskRef(tasks, propertyAppraisalTaskId),
    }),
    [caseStudyTaskId, propertyAppraisalTaskId],
  );

  const { data: workspaceTasks } = useQuery({
    queryKey: appDataKeys.workflowTasks(),
    queryFn: () => loadWorkflowTasksForQuery(),
    staleTime: 60_000,
    gcTime: 10 * 60_000,
    select: selectWorkspaceTasks,
  });

  const caseStudyTask = workspaceTasks?.caseStudy ?? null;
  const appraisalWorkspaceTask = workspaceTasks?.appraisal ?? null;

  const propertyWorkspaceTask = onCaseStudyWorkspace
    ? caseStudyTask
    : onPropertyAppraisalWorkspace
      ? appraisalWorkspaceTask
      : null;

  const { data: propertyWorkspacePo } = usePoRecordQuery(
    propertyWorkspaceTask?.poNumber ?? null,
  );

  useEffect(() => {
    if (caseStudyTask?.poNumber) {
      prefetchPrototypePage(queryClient, "active-case-study");
      prefetchPoRecord(queryClient, caseStudyTask.poNumber);
    }
  }, [queryClient, caseStudyTask?.poNumber]);

  useEffect(() => {
    if (appraisalWorkspaceTask?.poNumber) {
      prefetchPoRecord(queryClient, appraisalWorkspaceTask.poNumber);
    }
  }, [queryClient, appraisalWorkspaceTask?.poNumber]);

  const deedLabel = useMemo(
    () => propertyWorkspaceDeedLabel(propertyWorkspaceTask, propertyWorkspacePo),
    [propertyWorkspaceTask, propertyWorkspacePo],
  );

  const propertyWorkspaceBreadcrumb = useMemo(
    () => resolvePropertyWorkspaceBreadcrumb(route, propertyWorkspaceTask, deedLabel),
    [route, propertyWorkspaceTask, deedLabel],
  );

  const poChrome = useMemo(
    () => (pathname ? resolvePoChrome(pathname) : null),
    [pathname],
  );

  const taskQuery = searchParams.get("task");
  const opsTaskDeepLink =
    currentPage === "operations-tasks" ? taskQuery?.trim() || null : null;
  const { data: operationsTasks } = useQuery({
    queryKey: appDataKeys.operationsTasks(),
    queryFn: () => loadOperationsTasks(),
    enabled: Boolean(opsTaskDeepLink),
    staleTime: 30_000,
  });
  const opsTaskTitle = useMemo(
    () => resolveOpsTaskTitle(opsTaskDeepLink, operationsTasks),
    [opsTaskDeepLink, operationsTasks],
  );

  const myTasksChrome = useMemo(
    () =>
      pathname
        ? resolveMyTasksChrome(pathname, resolveMyTasksTaskId(route, taskQuery), {
            ...(onCaseStudyWorkspace || onPropertyAppraisalWorkspace
              ? { deedLabel }
              : {}),
            ...(opsTaskDeepLink ? { opsTaskTitle } : {}),
          })
        : null,
    [
      pathname,
      route,
      taskQuery,
      onCaseStudyWorkspace,
      onPropertyAppraisalWorkspace,
      deedLabel,
      opsTaskDeepLink,
      opsTaskTitle,
    ],
  );

  const keysChrome = useMemo(
    () => resolveKeysChrome(currentPage, searchParams),
    [currentPage, searchParams],
  );
  const orgSettingsChrome = useMemo(
    () => resolveOrgSettingsChrome(currentPage, searchParams),
    [currentPage, searchParams],
  );

  const chrome = resolvePageChrome({
    currentPage,
    role,
    financeArea,
    poChrome,
    propertyWorkspaceBreadcrumb,
    myTasksChrome,
    keysChrome,
    orgSettingsChrome,
  });

  return {
    ...chrome,
    poChrome,
    onTaskWork: isOnTaskWork(route, pathname, taskQuery),
  };
}
