"use client";

import { useCallback, useMemo } from "react";
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
} from "@case-study/mfe/lib/prototype/transaction-filters";
import type { FailureRecord } from "@failures/mfe/lib/failures-types";
import { isTaskOnSuspendedProperty } from "@case-study/mfe/lib/prototype/suspended-transactions-storage";
import { listedTasksForPage } from "@case-study/mfe/lib/prototype/active-transaction-page-situation";
import { PARTY_TASK_PAGES } from "@platform/app-shared/prototype/party-task-pages";
import { seesAllCaseStudyWorkflowTasks } from "@case-study/mfe/lib/prototype/viewer-task-access";
import {
  tasksForPartyAssignee,
  tasksForRole,
} from "@case-study/mfe/lib/prototype/tasks-storage";
import type { PoIntakeRecord } from "@case-study/mfe/lib/prototype/po-intake-data";
import {
  useFailuresQuery,
  usePendingBourseItemsQuery,
  usePoRecordsQuery,
  useWorkflowTasksQuery,
} from "@/lib/query/prototype-queries";
import { filterActionablePendingBourseItems } from "@case-study/mfe/lib/prototype/pending-bourse-queue";
import { useStaffUsersQuery } from "@settings/mfe/query/settings-queries";
import { loadInspectorFeesSummary } from "@platform/app-shared/prototype/inspector-fees-api";

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

/** Red sidebar counts for المعاملات النشطة. */
export function useActiveTransactionNavBadges(): ActiveTransactionNavIndicators {
  const { role, viewerEmail, distributionAssigneeId, hasCapability } =
    usePrototype();
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

  const selectFeeCount = useCallback(
    (summary: InspectorFeesSummary) => {
      const feeRows = summary.rows ?? [];
      if (feeRows.length === 0) return 0;
      const isPartyFeesRole =
        role === "field-inspector" ||
        role === "engineering-office" ||
        role === "government-reviewer";
      const isSupervisor = hasCapability("manage-operations") && !isPartyFeesRole;
      return isSupervisor
        ? feeRows.filter(
            (r) =>
              r.billingStatus === "sup-review" ||
              (r.billingStatus === "returned" && r.returnTo === "supervisor"),
          ).length
        : feeRows.filter(
            (r) =>
              r.canSubmitToSupervisor ||
              ((r.billingStatus === "returned" ||
                r.billingStatus === "inquiry") &&
                r.returnTo === "office"),
          ).length;
    },
    [role, hasCapability],
  );

  const { data: feeCount } = useQuery({
    queryKey: [...prototypeKeys.all, "inspector-fees", "nav-badges", role],
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

    const parts: string[] = [];
    const setPage = (pageId: PageId, count: number) => {
      if (count > 0) parts.push(`${pageId}:${count}`);
    };

    setPage("active-primary-data", primaryOpen.length);
    setPage("bourse-inquiry", bourseOpen.length);
    setPage("active-distribution", distributionOpen.length);
    setPage("active-case-study", caseStudyOpen.length);

    for (const def of Object.values(PARTY_TASK_PAGES)) {
      if (def.roleId !== role) continue;
      setPage(
        def.pageId,
        listedTasksForPage(def.pageId, partyMine, poByNumber).length,
      );
    }

    setPage("party-fees", feeCount ?? 0);

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
