"use client";

import { useEffect, useMemo, useState } from "react";
import { usePrototype } from "@platform/app-shared/contexts/PrototypeContext";
import { getAuthSession } from "@platform/auth-client";
import { prefetchPartySubmissionsForTasks } from "@platform/app-shared/prototype/party-submission-api";
import { useStaffUsersQuery } from "@settings/mfe/query/settings-queries";
import type { PageId } from "@platform/types";
import {
  computePageSituationValues,
  pageSituationCards,
  type PageSituationCardDef,
  type PageSituationValues,
} from "../lib/prototype/active-transaction-page-situation";
import { resolveQueueTasksForViewer } from "../lib/prototype/viewer-task-access";
import {
  partyTaskPageDef,
  PARTY_TASK_PAGES,
} from "@platform/app-shared/prototype/party-task-pages";
import { useFailuresQuery } from "@failures/mfe/query/failures-queries";
import { useFieldInspectionWorkspacesQuery } from "./field-inspection-workspaces-queries";
import {
  usePendingBourseItemsQuery,
  usePoRecordsQuery,
  useWorkflowTasksQuery,
} from "./case-study-queries";

const PARTY_PAGE_IDS = new Set(
  Object.values(PARTY_TASK_PAGES).map((def) => def.pageId),
);

export type ActiveTransactionPageSituation = {
  cards: PageSituationCardDef[];
  values: PageSituationValues;
  ready: boolean;
};

export function useActiveTransactionPageSituation(
  pageId: PageId | undefined,
): ActiveTransactionPageSituation | null {
  const { role, viewerEmail } = usePrototype();
  const { data: staffResult } = useStaffUsersQuery();
  const staffUsers = staffResult?.users ?? [];
  const cards = pageId ? pageSituationCards(pageId) : null;

  const needsTasks = Boolean(cards);
  const needsPo = Boolean(cards && pageId !== "bourse-inquiry");
  const needsBourse = pageId === "bourse-inquiry";
  const needsFailures = pageId === "bourse-inquiry";
  const needsInspectionWorkspaces = pageId === "property-inspection";
  const needsPartyPrefetch = Boolean(pageId && PARTY_PAGE_IDS.has(pageId));

  const { data: tasks, isFetched: tasksFetched } = useWorkflowTasksQuery();
  const { data: poRecords = [], isFetched: poRecordsFetched } =
    usePoRecordsQuery();
  const { data: pendingBourse = [], isFetched: bourseFetched } =
    usePendingBourseItemsQuery();
  const { data: failures = [], isFetched: failuresFetched } =
    useFailuresQuery();
  const { data: inspectionWorkspaces = [], isFetched: workspacesFetched } =
    useFieldInspectionWorkspacesQuery(needsInspectionWorkspaces);

  const [, bump] = useState(0);

  useEffect(() => {
    if (!needsPartyPrefetch || !tasksFetched || !pageId) return;
    const partyDef = partyTaskPageDef(pageId);
    const mine = resolveQueueTasksForViewer({
      role,
      tasks: tasks ?? [],
      pageId,
      partyAssignee: Boolean(partyDef),
      assigneeRole: partyDef?.roleId,
      viewerEmail: viewerEmail ?? getAuthSession()?.user.email,
      staffUsers,
    });
    void prefetchPartySubmissionsForTasks(mine.map((t) => t.id)).then(() =>
      bump((n) => n + 1),
    );
  }, [
    needsPartyPrefetch,
    tasksFetched,
    tasks,
    role,
    pageId,
    viewerEmail,
    staffUsers,
  ]);

  const ready =
    (!needsTasks || tasksFetched) &&
    (!needsPo || poRecordsFetched) &&
    (!needsBourse || bourseFetched) &&
    (!needsFailures || failuresFetched) &&
    (!needsInspectionWorkspaces || workspacesFetched);

  return useMemo(() => {
    if (!pageId || !cards) return null;

    const poByNumber = new Map(
      (poRecords ?? []).map((record) => [record.poNumber.trim(), record]),
    );

    const partyDef = pageId ? partyTaskPageDef(pageId) : null;
    const mine = resolveQueueTasksForViewer({
      role,
      tasks: tasks ?? [],
      pageId,
      partyAssignee: Boolean(partyDef),
      assigneeRole: partyDef?.roleId,
      viewerEmail: viewerEmail ?? getAuthSession()?.user.email,
      staffUsers,
    });

    const obstructedCount =
      pageId === "bourse-inquiry"
        ? pendingBourse.filter((item) => {
            const failure = failures.find(
              (f) =>
                f.poNumber === item.poNumber &&
                f.propertyId === item.propertyId,
            );
            return (
              failure &&
              failure.status !== "returned" &&
              failure.status !== "resolved"
            );
          }).length
        : 0;

    const visiblePendingBourse =
      pageId === "bourse-inquiry"
        ? pendingBourse.filter((item) => {
            const failure = failures.find(
              (f) =>
                f.poNumber === item.poNumber &&
                f.propertyId === item.propertyId,
            );
            return (
              !failure ||
              failure.status === "returned" ||
              failure.status === "resolved"
            );
          })
        : pendingBourse;

    const inspectionWorkspaceByTaskId = new Map(
      inspectionWorkspaces.map((row) => [row.workflowTaskId, row]),
    );

    const values = ready
      ? (computePageSituationValues(pageId, {
          tasks: mine,
          poByNumber,
          pendingBourse: visiblePendingBourse,
          obstructedCount,
          inspectionWorkspaces: inspectionWorkspaceByTaskId,
        }) ?? {})
      : Object.fromEntries(cards.map((card) => [card.key, undefined]));

    return { cards, values, ready };
  }, [
    pageId,
    cards,
    ready,
    role,
    tasks,
    poRecords,
    pendingBourse,
    failures,
    inspectionWorkspaces,
    viewerEmail,
    staffUsers,
  ]);
}
