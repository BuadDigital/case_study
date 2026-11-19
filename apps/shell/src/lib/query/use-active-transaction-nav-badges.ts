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
  filterTasksForReceipt,
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
} from "@case-study/mfe/lib/app-data/tasks";
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
import { navBadgeNeeds } from "./nav-badge-needs";
import { Roles, Pages } from "@platform/types";
import { InspectorFeeBillingStatuses } from "@platform/api-client";

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
  const { role, rolePages, viewerUserId, distributionAssigneeId, hasCapability } =
    useAppAccess();
  const resolvedViewerUserId = viewerUserId ?? getAuthSession()?.user.id ?? null;
  const needs = useMemo(() => navBadgeNeeds(rolePages, role), [rolePages, role]);
  const { data: tasks } = useWorkflowTasksQuery({ enabled: needs.tasks });
  const { data: poRecords } = usePoRecordsQuery({ enabled: needs.poRecords });
  const { data: pendingBourse } = usePendingBourseItemsQuery({ enabled: needs.pendingBourse });
  // The failures only narrow the bourse queue.
  const { data: failures = EMPTY_FAILURES } = useFailuresQuery({ enabled: needs.pendingBourse });
  const { data: staffResult } = useStaffUsersQuery({ enabled: needs.staff });
  const staffUsers = useMemo(
    () => staffResult?.users ?? [],
    [staffResult?.users],
  );

  const isPartyFeesRole =
    role === Roles.FieldInspector ||
    role === Roles.EngineeringOffice ||
    role === Roles.GovernmentReviewer;
  const isFeesSupervisor =
    hasCapability("manage-operations") && !isPartyFeesRole;

  // Fees badge: what waits for the viewer. For the supervisor that includes proposed discounts
  // (sup-review); acceptance itself now lives inside the transaction, so it is not counted here.
  const selectFeeCount = useCallback(
    (summary: InspectorFeesSummary) => {
      const feeRows = summary.rows ?? [];
      if (feeRows.length === 0) return 0;
      return isFeesSupervisor
        ? feeRows.filter(
            (r) =>
              r.billingStatus === InspectorFeeBillingStatuses.SupReview ||
              (r.billingStatus === InspectorFeeBillingStatuses.Returned && r.returnTo === "supervisor") ||
              r.billingStatus === InspectorFeeBillingStatuses.Suspended,
          ).length
        : feeRows.filter(
            (r) =>
              r.canSubmitToSupervisor ||
              ((r.billingStatus === InspectorFeeBillingStatuses.Returned ||
                r.billingStatus === InspectorFeeBillingStatuses.Inquiry) &&
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
    enabled: needs.fees,
  });

  const badgeSignature = useMemo(() => {
    const { shown } = needs;
    const poByNumber = poRecordsMap(poRecords);
    const mine = seesAllCaseStudyWorkflowTasks(role)
      ? (tasks ?? [])
      : tasksForRole(role, tasks ?? []);
    const openOrBlocked = (t: { status: string }) => t.status === "open" || t.status === "blocked";

    const parts: string[] = [];
    // Only a count the sidebar shows is worked out.
    const setPage = (pageId: PageId, count: () => number) => {
      if (!shown.has(pageId)) return;
      const n = count();
      if (n > 0) parts.push(`${pageId}:${n}`);
    };

    setPage(
      Pages.ActivePrimaryData,
      () =>
        filterTasksForPrimaryData(mine, poByNumber).filter(
          (t) => openOrBlocked(t) && !isTaskOnSuspendedProperty(t),
        ).length,
    );
    setPage(Pages.BourseInquiry, () => filterActionablePendingBourseItems(pendingBourse ?? [], failures).length);
    setPage(Pages.ActiveDistribution, () => filterTasksForDistribution(mine, poByNumber).filter(openOrBlocked).length);
    // A→Z 2026-11-09: a cancelled transaction was still counted (the other queues filter open/blocked).
    setPage(Pages.ActiveReceipt, () => filterTasksForReceipt(mine).filter(openOrBlocked).length);
    setPage(Pages.ActiveCaseStudy, () => filterTasksForCaseStudy(mine).filter(openOrBlocked).length);
    setPage(Pages.SystemUpload, () => filterTasksForSystemUpload(mine, tasks ?? []).length);

    if (needs.staff) {
      const partyMine = tasksForPartyAssignee(
        role,
        tasks ?? [],
        undefined,
        resolvedViewerUserId,
        staffUsers,
        distributionAssigneeId,
      );
      for (const def of Object.values(PARTY_TASK_PAGES)) {
        if (def.roleId !== role) continue;
        setPage(def.pageId, () => listedTasksForPage(def.pageId, partyMine, poByNumber).length);
      }
    }

    setPage(Pages.PartyFees, () => feeCount ?? 0);

    return parts.join("|");
  }, [
    needs,
    role,
    resolvedViewerUserId,
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
