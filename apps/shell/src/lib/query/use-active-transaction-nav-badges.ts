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
import { PARTY_TASK_PAGES } from "@platform/app-shared/prototype/party-task-pages";
import {
  seesAllCaseStudyWorkflowTasks,
  tasksForPartyAssignee,
  tasksForRole,
} from "@case-study/mfe";
import type { PoIntakeRecord, WorkflowTask } from "@case-study/mfe";
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

export type ActiveTransactionNavIndicators = {
  /** Red count badges (open work). */
  badges: Partial<Record<PageId, number>>;
};

/** Red sidebar counts for المعاملات النشطة. */
export function useActiveTransactionNavBadges(): ActiveTransactionNavIndicators {
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

  const indicators = useMemo(() => {
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

    const badges: Partial<Record<PageId, number>> = {};

    const setPage = (
      pageId: PageId,
      openTasks: WorkflowTask[],
      count?: number,
    ) => {
      const n = count ?? openTasks.length;
      if (n > 0) badges[pageId] = n;
    };

    setPage("active-primary-data", primaryOpen);
    if (bourseOpen.length > 0) badges["bourse-inquiry"] = bourseOpen.length;

    setPage("active-distribution", distributionOpen);
    setPage("active-case-study", caseStudyOpen);

    for (const def of Object.values(PARTY_TASK_PAGES)) {
      if (def.roleId !== role) continue;
      const listed = listedTasksForPage(def.pageId, partyMine, poByNumber);
      if (listed.length > 0) badges[def.pageId] = listed.length;
    }

    const feeRows = feeSummary?.rows ?? [];
    if (feeRows.length > 0) {
      const isPartyFeesRole =
        role === "field-inspector" ||
        role === "engineering-office" ||
        role === "government-reviewer";
      const isSupervisor =
        hasCapability("manage-operations") && !isPartyFeesRole;
      const feeHits = isSupervisor
        ? feeRows.filter(
            (r) =>
              r.billingStatus === "sup-review" ||
              (r.billingStatus === "returned" && r.returnTo === "supervisor"),
          )
        : feeRows.filter(
            (r) =>
              r.canSubmitToSupervisor ||
              ((r.billingStatus === "returned" ||
                r.billingStatus === "inquiry") &&
                r.returnTo === "office"),
          );
      if (feeHits.length > 0) {
        badges["party-fees"] = feeHits.length;
      }
    }

    return { badges };
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

  return indicators;
}
