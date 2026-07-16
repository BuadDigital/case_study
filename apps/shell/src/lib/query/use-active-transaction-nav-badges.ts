"use client";

import { useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { prototypeKeys } from "@platform/app-shared/query/prototype-keys";
import { getAuthSession } from "@platform/auth-client";
import type { PageId } from "@platform/types";
import { usePrototype } from "@platform/app-shared/contexts/PrototypeContext";
import {
  filterTasksForCaseStudy,
} from "@platform/app-shared/prototype/active-transactions";
import {
  filterTasksForDistribution,
  filterTasksForPrimaryData,
} from "@case-study/mfe";
import { isTaskOnSuspendedProperty } from "@case-study/mfe/lib/prototype/suspended-transactions-storage";
import { listedTasksForPage } from "@case-study/mfe/lib/prototype/active-transaction-page-situation";
import { countGovernmentReviewOpenPos } from "@case-study/mfe";
import { PARTY_TASK_PAGES } from "@platform/app-shared/prototype/party-task-pages";
import { reviewerScopeForRole } from "@case-study/mfe/lib/prototype/reviewer-coverage";
import {
  seesAllCaseStudyWorkflowTasks,
  tasksForPartyAssignee,
  tasksForRole,
} from "@case-study/mfe";
import type { PoIntakeRecord } from "@case-study/mfe";
import {
  usePendingBourseItemsQuery,
  usePoRecordsQuery,
  useWorkflowTasksQuery,
} from "@/lib/query/prototype-queries";
import { useFailuresQuery } from "@/lib/query/prototype-queries";
import { filterActionablePendingBourseItems } from "@case-study/mfe/lib/prototype/pending-bourse-queue";
import { useStaffUsersQuery } from "@settings/mfe/query/settings-queries";
import { loadInspectorFeesSummary } from "@platform/app-shared/prototype/inspector-fees-api";

function poRecordsMap(records: PoIntakeRecord[] | undefined) {
  const map = new Map<string, PoIntakeRecord>();
  for (const r of records ?? []) map.set(r.poNumber.trim(), r);
  return map;
}

/** Red sidebar counts for المعاملات النشطة (open work only). */
export function useActiveTransactionNavBadges(): Partial<Record<PageId, number>> {
  const { role, viewerEmail, distributionAssigneeId, hasCapability } =
    usePrototype();
  const resolvedViewerEmail = viewerEmail ?? getAuthSession()?.user.email ?? null;
  const { data: tasks } = useWorkflowTasksQuery();
  const { data: poRecords } = usePoRecordsQuery();
  const { data: pendingBourse } = usePendingBourseItemsQuery();
  const { data: failures = [] } = useFailuresQuery();
  const { data: staffResult } = useStaffUsersQuery();
  const staffUsers = useMemo(
    () => staffResult?.users ?? [],
    [staffResult?.users],
  );

  const { data: feeSummary } = useQuery({
    queryKey: [...prototypeKeys.all, "inspector-fees", "nav-badges", role],
    queryFn: () =>
      loadInspectorFeesSummary({
        assigneeId: hasCapability("manage-financial")
          ? undefined
          : distributionAssigneeId ?? undefined,
        submittedOnly: false,
      }),
    staleTime: 30_000,
  });

  return useMemo(() => {
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
    ).length;

    const bourseOpen = filterActionablePendingBourseItems(
      pendingBourse ?? [],
      failures,
    ).length;

    const distributionOpen = filterTasksForDistribution(mine, poByNumber).filter(
      (t) => t.status === "open" || t.status === "blocked",
    ).length;

    const caseStudyOpen = filterTasksForCaseStudy(mine).filter(
      (t) => t.status === "open" || t.status === "blocked",
    ).length;

    const badges: Partial<Record<PageId, number>> = {};
    if (primaryOpen > 0) badges["active-primary-data"] = primaryOpen;
    if (bourseOpen > 0) badges["bourse-inquiry"] = bourseOpen;
    if (distributionOpen > 0) badges["active-distribution"] = distributionOpen;
    if (caseStudyOpen > 0) badges["active-case-study"] = caseStudyOpen;

    for (const def of Object.values(PARTY_TASK_PAGES)) {
      if (def.roleId !== role) continue;
      if (def.pageId === "government-review") {
        const open = countGovernmentReviewOpenPos(
          partyMine,
          poByNumber,
          reviewerScopeForRole(role, staffUsers),
        );
        if (open > 0) badges[def.pageId] = open;
        continue;
      }
      const open = listedTasksForPage(def.pageId, partyMine, poByNumber).length;
      if (open > 0) badges[def.pageId] = open;
    }

    const feeRows = feeSummary?.rows ?? [];
    if (feeRows.length > 0) {
      const isPartyFeesRole =
        role === "field-inspector" ||
        role === "engineering-office" ||
        role === "government-reviewer";
      const isSupervisor =
        hasCapability("manage-operations") && !isPartyFeesRole;
      const feeCount = isSupervisor
        ? feeRows.filter(
            (r) =>
              r.billingStatus === "sup-review" ||
              (r.billingStatus === "returned" && r.returnTo === "supervisor"),
          ).length
        : feeRows.filter(
            (r) =>
              r.canSubmitToSupervisor ||
              r.canCreateDisbursementRequest ||
              ((r.billingStatus === "returned" ||
                r.billingStatus === "inquiry") &&
                r.returnTo === "office"),
          ).length;
      if (feeCount > 0) badges["party-fees"] = feeCount;
    }

    return badges;
  }, [
    role,
    resolvedViewerEmail,
    distributionAssigneeId,
    tasks,
    poRecords,
    pendingBourse,
    failures,
    staffUsers,
    feeSummary?.rows,
    hasCapability,
  ]);
}
