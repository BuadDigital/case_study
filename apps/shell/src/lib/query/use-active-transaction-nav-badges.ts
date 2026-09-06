"use client";

import { useCallback, useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { appDataKeys } from "@platform/app-shared/query/app-data-keys";
import { getAuthSession } from "@platform/auth-client";
import type { PageId } from "@platform/types";
import { useAppAccess } from "@platform/app-shared/contexts/AppAccessContext";
import {
  filterTasksForCaseStudy,
  filterTasksForSystemUpload,
} from "@platform/app-shared/app-data/active-transactions";
import {
  filterTasksForDistribution,
  filterTasksForPrimaryData,
} from "@case-study/mfe/lib/app-data/transaction-filters";
import type { FailureRecord } from "@platform/app-shared/failures/failures-types";
import { isTaskOnSuspendedProperty } from "@case-study/mfe/lib/app-data/suspended-transactions-model";
import { listedTasksForPage } from "@case-study/mfe/lib/app-data/active-transaction-page-situation";
import { PARTY_TASK_PAGES } from "@platform/app-shared/app-data/party-task-pages";
import { seesAllCaseStudyWorkflowTasks } from "@case-study/mfe/lib/app-data/viewer-task-access";
import {
  tasksForPartyAssignee,
  tasksForRole,
} from "@case-study/mfe/lib/app-data/tasks-storage";
import type { PoIntakeRecord } from "@case-study/mfe/lib/app-data/po-intake-data";
import {
  useFailuresQuery,
  usePendingBourseItemsQuery,
  usePoRecordsQuery,
  useWorkflowTasksQuery,
} from "@/lib/query/app-data-queries";
import { filterActionablePendingBourseItems } from "@case-study/mfe/lib/app-data/pending-bourse-queue";
import { useStaffUsersQuery } from "@settings/mfe/query/settings-queries";
import { loadInspectorFeesSummary } from "@platform/app-shared/app-data/inspector-fees-api";
import { loadSupervisorEngSurveyPendingAcceptRows } from "@case-study/mfe/components/fees/SupervisorEngSurveyFeeAcceptPanel";

const EMPTY_FAILURES: FailureRecord[] = [];

type InspectorFeesSummary = Awaited<ReturnType<typeof loadInspectorFeesSummary>>;

function poRecordsMap(records: PoIntakeRecord[] | undefined) {
  const map = new Map<string, PoIntakeRecord>();
  for (const r of records ?? []) map.set(r.poNumber.trim(), r);
  return map;
}

type ActiveTransactionNavIndicators = {
  /** Red count badges (open work). */
  badges: Partial<Record<PageId, number>>;
};

/** Red sidebar counts for active transactions. */
export function useActiveTransactionNavBadges(): ActiveTransactionNavIndicators {
  const { role, viewerEmail, distributionAssigneeId, hasCapability } =
    useAppAccess();
  const resolvedViewerEmail = viewerEmail ?? getAuthSession()?.user.email ?? null;
  const { data: tasks } = useWorkflowTasksQuery();
  const { data: poRecords } = usePoRecordsQuery();
  const { data: pendingBourse } = usePendingBourseItemsQuery();
  const { data: failures = EMPTY_FAILURES } = useFailuresQuery();
  const { data: staffResult } = useStaffUsersQuery();
  const staffUsers = useMemo(
    () => staffResult?.users ?? [],
    [staffResult?.users],
  );

  const isPartyFeesRole =
    role === "field-inspector" ||
    role === "engineering-office" ||
    role === "government-reviewer";
  const isFeesSupervisor =
    hasCapability("manage-operations") && !isPartyFeesRole;

  const selectFeeCount = useCallback(
    (summary: InspectorFeesSummary) => {
      const feeRows = summary.rows ?? [];
      if (feeRows.length === 0) return 0;
      return isFeesSupervisor
        ? feeRows.filter(
            (r) =>
              r.billingStatus === "sup-review" ||
              (r.billingStatus === "returned" && r.returnTo === "supervisor") ||
              r.billingStatus === "disputed" ||
              r.billingStatus === "suspended",
          ).length
        : feeRows.filter(
            (r) =>
              r.canSubmitToSupervisor ||
              ((r.billingStatus === "returned" ||
                r.billingStatus === "inquiry") &&
                r.returnTo === "office"),
          ).length;
    },
    [isFeesSupervisor],
  );

  const { data: feeCount } = useQuery({
    queryKey: [...appDataKeys.all, "inspector-fees", "nav-badges", role],
    queryFn: () =>
      loadInspectorFeesSummary({
        assigneeId: hasCapability("manage-financial")
          ? undefined
          : distributionAssigneeId ?? undefined,
        submittedOnly: false,
      }),
    staleTime: 30_000,
    select: selectFeeCount,
  });

  const { data: engAcceptPendingCount = 0 } = useQuery({
    // Share cache with PartyFeesWorkspace (SUPERVISOR_ENG_SURVEY_PENDING_ACCEPT_KEY).
    queryKey: [...appDataKeys.all, "eng-survey-fee-accept-pending"],
    queryFn: () => loadSupervisorEngSurveyPendingAcceptRows(tasks ?? []),
    enabled: isFeesSupervisor && Boolean(tasks && tasks.length > 0),
    staleTime: 15_000,
    select: (rows) => rows.length,
  });

  const badgeSignature = useMemo(() => {
    const poByNumber = poRecordsMap(poRecords);
    const mine = seesAllCaseStudyWorkflowTasks(role)
      ? (tasks ?? [])
      : tasksForRole(role, tasks ?? []);
    const partyMine = tasksForPartyAssignee(
      role,
      tasks ?? [],
      undefined,
      resolvedViewerEmail,
      staffUsers,
      distributionAssigneeId,
    );

    const primaryOpen = filterTasksForPrimaryData(mine, poByNumber).filter(
      (t) =>
        (t.status === "open" || t.status === "blocked") &&
        !isTaskOnSuspendedProperty(t),
    );

    const bourseOpen = filterActionablePendingBourseItems(
      pendingBourse ?? [],
      failures,
    );

    const distributionOpen = filterTasksForDistribution(mine, poByNumber).filter(
      (t) => t.status === "open" || t.status === "blocked",
    );

    const caseStudyOpen = filterTasksForCaseStudy(mine).filter(
      (t) => t.status === "open" || t.status === "blocked",
    );

    const systemUploadOpen = filterTasksForSystemUpload(mine).length;

    const parts: string[] = [];
    const setPage = (pageId: PageId, count: number) => {
      if (count > 0) parts.push(`${pageId}:${count}`);
    };

    setPage("active-primary-data", primaryOpen.length);
    setPage("bourse-inquiry", bourseOpen.length);
    setPage("active-distribution", distributionOpen.length);
    setPage("active-case-study", caseStudyOpen.length);
    setPage("system-upload", systemUploadOpen);

    for (const def of Object.values(PARTY_TASK_PAGES)) {
      if (def.roleId !== role) continue;
      setPage(
        def.pageId,
        listedTasksForPage(def.pageId, partyMine, poByNumber).length,
      );
    }

    setPage("party-fees", (feeCount ?? 0) + engAcceptPendingCount);

    return parts.join("|");
  }, [
    role,
    resolvedViewerEmail,
    distributionAssigneeId,
    tasks,
    poRecords,
    pendingBourse,
    failures,
    staffUsers,
    feeCount,
    engAcceptPendingCount,
  ]);

  const badges = useMemo(() => {
    const result: Partial<Record<PageId, number>> = {};
    if (!badgeSignature) return result;
    for (const part of badgeSignature.split("|")) {
      const sep = part.indexOf(":");
      result[part.slice(0, sep) as PageId] = Number(part.slice(sep + 1));
    }
    return result;
  }, [badgeSignature]);

  return useMemo(() => ({ badges }), [badges]);
}
