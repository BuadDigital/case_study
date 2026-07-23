"use client";

import { useEffect, useMemo, useState } from "react";
import { usePrototype } from "@platform/app-shared/contexts/PrototypeContext";
import { getAuthSession } from "@platform/auth-client";
import { prefetchPartySubmissionsForTasks, partySubmissionTaskIdsKey } from "@platform/app-shared/prototype/party-submission-api";
import { useStaffUsersQuery } from "@settings/mfe/query/settings-queries";
import type { PageId, RoleId } from "@platform/types";
import {
  computeFeesPageSituation,
  computePageSituationValues,
  computeUnbilledFeeCount,
  pageSituationCards,
  type PageSituationCardDef,
  type PageSituationValues,
} from "../lib/prototype/active-transaction-page-situation";
import { filterActionablePendingBourseItems } from "../lib/prototype/pending-bourse-queue";
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
import { useInspectorFeesQuery } from "./inspector-fees-queries";

function feesTaskKindForRole(role: RoleId): string | undefined {
  if (role === "field-inspector") return "field-inspection";
  if (role === "engineering-office") return "engineering-survey";
  if (role === "government-reviewer") return "government-review";
  return undefined;
}

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
  const { role, viewerEmail, distributionAssigneeId } = usePrototype();
  const { data: staffResult } = useStaffUsersQuery();
  const staffUsers = staffResult?.users ?? [];
  const cards = pageId ? pageSituationCards(pageId) : null;

  const isFeesPage = pageId === "party-fees";
  const isSurveyPage = pageId === "active-survey";
  const needsTasks = Boolean(cards && !isFeesPage);
  const needsPo = Boolean(cards && pageId !== "bourse-inquiry" && !isFeesPage);
  const needsBourse = pageId === "bourse-inquiry";
  const needsFailures = pageId === "bourse-inquiry";
  const needsInspectionWorkspaces = pageId === "property-inspection";
  const needsPartyPrefetch = Boolean(pageId && PARTY_PAGE_IDS.has(pageId));

  const isSupervisorFees =
    isFeesPage && (role === "section-supervisor" || role === "cdo" || role === "general-manager");
  const feesTaskKind =
    isFeesPage && !isSupervisorFees
      ? feesTaskKindForRole(role)
      : isSurveyPage
        ? "engineering-survey"
        : undefined;
  const feesAssigneeId =
    (isFeesPage && !isSupervisorFees) || isSurveyPage
      ? distributionAssigneeId ?? undefined
      : undefined;

  const { data: feesSummary, isFetched: feesFetched } = useInspectorFeesQuery(
    {
      assigneeId: feesAssigneeId,
      submittedOnly: false,
      taskKind: feesTaskKind,
    },
    {
      enabled:
        Boolean(cards) &&
        (isFeesPage
          ? isSupervisorFees || Boolean(feesTaskKind && feesAssigneeId)
          : isSurveyPage && Boolean(feesAssigneeId)),
    },
  );

  const { data: tasks, isFetched: tasksFetched } = useWorkflowTasksQuery();
  const { data: poRecords = [], isFetched: poRecordsFetched } =
    usePoRecordsQuery();
  const { data: pendingBourse = [], isFetched: bourseFetched } =
    usePendingBourseItemsQuery();
  const { data: failures = [], isFetched: failuresFetched } =
    useFailuresQuery();
  const { data: inspectionWorkspaces = [], isFetched: workspacesFetched } =
    useFieldInspectionWorkspacesQuery(needsInspectionWorkspaces);

  const [partySubmissionGen, setPartySubmissionGen] = useState(0);

  const viewerTaskIdsKey = useMemo(() => {
    if (!needsPartyPrefetch || !tasksFetched || !pageId) return "";
    const partyDef = partyTaskPageDef(pageId);
    const mine = resolveQueueTasksForViewer({
      role,
      tasks: tasks ?? [],
      pageId,
      partyAssignee: Boolean(partyDef),
      assigneeRole: partyDef?.roleId,
      viewerEmail: viewerEmail ?? getAuthSession()?.user.email,
      viewerAssigneeId: distributionAssigneeId,
      staffUsers,
    });
    return partySubmissionTaskIdsKey(mine.map((t) => t.id));
  }, [
    needsPartyPrefetch,
    tasksFetched,
    pageId,
    role,
    tasks,
    viewerEmail,
    distributionAssigneeId,
    staffUsers,
  ]);

  useEffect(() => {
    if (!needsPartyPrefetch || !pageId) return;
    const events = [
      "evaluator-submission-changed",
      "evaluator-recall-changed",
      "evaluator-recall-hydrated",
      "party-task-recall-changed",
      "party-task-recall-hydrated",
      "field-inspection-submission-changed",
      "government-review-submission-changed",
      "valuation-coordination-submission-changed",
    ];
    const handler = () => setPartySubmissionGen((n) => n + 1);
    for (const ev of events) window.addEventListener(ev, handler);
    return () => {
      for (const ev of events) window.removeEventListener(ev, handler);
    };
  }, [needsPartyPrefetch, pageId]);

  useEffect(() => {
    if (!viewerTaskIdsKey) return;
    const ids = viewerTaskIdsKey.split("\0");
    void prefetchPartySubmissionsForTasks(ids).then(() =>
      setPartySubmissionGen((n) => n + 1),
    ).catch((err: unknown) => {
      console.warn("Party submission prefetch failed:", err);
    });
  }, [viewerTaskIdsKey]);

  const ready =
    (isFeesPage || isSurveyPage ? feesFetched : true) &&
    (!needsTasks || tasksFetched) &&
    (!needsPo || poRecordsFetched) &&
    (!needsBourse || bourseFetched) &&
    (!needsFailures || failuresFetched) &&
    (!needsInspectionWorkspaces || workspacesFetched);

  return useMemo(() => {
    if (!pageId || !cards) return null;

    if (isFeesPage) {
      const values = ready
        ? computeFeesPageSituation(feesSummary?.rows ?? [])
        : Object.fromEntries(cards.map((card) => [card.key, undefined]));
      return { cards, values, ready };
    }

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
      viewerAssigneeId: distributionAssigneeId,
      staffUsers,
    });

    const obstructedCount =
      pageId === "bourse-inquiry"
        ? pendingBourse.length -
          filterActionablePendingBourseItems(pendingBourse, failures).length
        : 0;

    const visiblePendingBourse =
      pageId === "bourse-inquiry"
        ? filterActionablePendingBourseItems(pendingBourse, failures)
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
          unbilledFeeCount: isSurveyPage
            ? computeUnbilledFeeCount(feesSummary?.rows ?? [])
            : undefined,
        }) ?? {})
      : Object.fromEntries(cards.map((card) => [card.key, undefined]));

    return { cards, values, ready };
  }, [
    pageId,
    cards,
    isFeesPage,
    isSurveyPage,
    ready,
    feesSummary,
    role,
    tasks,
    poRecords,
    pendingBourse,
    failures,
    inspectionWorkspaces,
    viewerEmail,
    distributionAssigneeId,
    staffUsers,
    partySubmissionGen,
  ]);
}
