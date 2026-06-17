"use client";

import { useMemo } from "react";
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
import { countGovernmentReviewOpenPos } from "@case-study/mfe";
import { PARTY_TASK_PAGES } from "@platform/app-shared/prototype/party-task-pages";
import { reviewerScopeForRole } from "@case-study/mfe/lib/prototype/reviewer-coverage";
import {
  tasksForPartyAssignee,
  tasksForRole,
} from "@case-study/mfe";
import type { PoIntakeRecord } from "@case-study/mfe";
import {
  usePendingBourseItemsQuery,
  usePoRecordsQuery,
  useWorkflowTasksQuery,
} from "@/lib/query/prototype-queries";

function poRecordsMap(records: PoIntakeRecord[] | undefined) {
  const map = new Map<string, PoIntakeRecord>();
  for (const r of records ?? []) map.set(r.poNumber.trim(), r);
  return map;
}

/** Red sidebar counts for المعاملات النشطة (open work only). */
export function useActiveTransactionNavBadges(): Partial<Record<PageId, number>> {
  const { role, viewerEmail } = usePrototype();
  const resolvedViewerEmail = viewerEmail ?? getAuthSession()?.user.email ?? null;
  const { data: tasks } = useWorkflowTasksQuery();
  const { data: poRecords } = usePoRecordsQuery();
  const { data: pendingBourse } = usePendingBourseItemsQuery();

  return useMemo(() => {
    const poByNumber = poRecordsMap(poRecords);
    const mine = tasksForRole(role, tasks ?? []);
    const partyMine = tasksForPartyAssignee(role, tasks ?? [], undefined, resolvedViewerEmail);

    const primaryOpen = filterTasksForPrimaryData(mine, poByNumber).filter(
      (t) => t.status === "open" || t.status === "blocked",
    ).length;

    const bourseOpen = pendingBourse?.length ?? 0;

    const distributionOpen = filterTasksForDistribution(mine).filter(
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
          reviewerScopeForRole(role),
        );
        if (open > 0) badges[def.pageId] = open;
        continue;
      }
      const open = partyMine.filter(
        (t) => t.kind === def.kind && t.status === "open",
      ).length;
      if (open > 0) badges[def.pageId] = open;
    }

    return badges;
  }, [role, resolvedViewerEmail, tasks, poRecords, pendingBourse]);
}
