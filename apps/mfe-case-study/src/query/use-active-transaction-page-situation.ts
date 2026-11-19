"use client";

import { useEffect, useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { useAppAccess } from "@platform/app-shared/contexts/AppAccessContext";
import { getAuthSession } from "@platform/auth-client";
import { prefetchPartySubmissionsForTasks, partySubmissionTaskIdsKey } from "@platform/app-shared/app-data/party-submission-api";
import { loadPartyBillingStatements } from "@platform/app-shared/app-data/party-billing-statements-api";
import { appDataKeys } from "@platform/app-shared/query/app-data-keys";
import { useStaffUsersQuery } from "@settings/mfe/query/settings-queries";
import type { PageId, RoleId } from "@platform/types";
import {
  computeFeesPageSituation,
  computeEngineeringFeesSituation,
  computePageSituationValues,
  computeUnbilledFeeCount,
  pageSituationCards,
  ENGINEERING_FEES_SITUATION_CARDS,
  type PageSituationCardDef,
  type PageSituationValues,
} from "../lib/app-data/active-transaction-page-situation";
import { filterActionablePendingBourseItems } from "../lib/app-data/pending-bourse-queue";
import { resolveQueueTasksForViewer } from "../lib/app-data/viewer-task-access";
import {
  partyTaskPageDef,
  PARTY_TASK_PAGES,
} from "@platform/app-shared/app-data/party-task-pages";
import { useFailuresQuery } from "@failures/mfe/query/failures-queries";
import { useFieldInspectionWorkspacesQuery } from "./field-inspection-workspaces-queries";
import {
  usePendingBourseItemsQuery,
  usePoRecordsQuery,
  useWorkflowTasksQuery,
} from "./case-study-queries";
import { useInspectorFeesQuery } from "./inspector-fees-queries";
import {
  ENGINEERING_SURVEY_SUBMISSION_CHANGED_EVENT,
  EVALUATOR_RECALL_CHANGED_EVENT,
  EVALUATOR_RECALL_HYDRATED_EVENT,
  EVALUATOR_SUBMISSION_CHANGED_EVENT,
  FIELD_INSPECTION_SUBMISSION_CHANGED_EVENT,
  PARTY_TASK_RECALL_CHANGED_EVENT,
  PARTY_TASK_RECALL_HYDRATED_EVENT,
} from "@platform/app-shared/events/app-events";
import { Roles, Pages } from "@platform/types";
import { PartyBillingStatementStatuses } from "@platform/api-client";

function feesTaskKindForRole(role: RoleId): string | undefined {
  if (role === Roles.FieldInspector) return "field-inspection";
  if (role === Roles.EngineeringOffice) return "engineering-survey";
  // Court-visit charges (no workflow task kind) — reviewer fees use visit ledger.
  if (role === Roles.GovernmentReviewer) return "court-visit";
  return undefined;
}

const PARTY_PAGE_IDS = new Set(
  Object.values(PARTY_TASK_PAGES).map((def) => def.pageId),
);

type ActiveTransactionPageSituation = {
  cards: PageSituationCardDef[];
  values: PageSituationValues;
  ready: boolean;
};

export function useActiveTransactionPageSituation(
  pageId: PageId | undefined,
): ActiveTransactionPageSituation | null {
  const { role, viewerUserId, distributionAssigneeId } = useAppAccess();
  const { data: staffResult } = useStaffUsersQuery();
  const staffUsers = useMemo(() => staffResult?.users ?? [], [staffResult]);
  const cardsBase = pageId ? pageSituationCards(pageId) : null;
  const cards =
    pageId === Pages.PartyFees && role === Roles.EngineeringOffice
      ? ENGINEERING_FEES_SITUATION_CARDS
      : cardsBase;

  const isFeesPage = pageId === Pages.PartyFees;
  const isSurveyPage = pageId === Pages.ActiveSurvey;
  const needsTasks = Boolean(cards && !isFeesPage);
  const needsPo = Boolean(cards && pageId !== Pages.BourseInquiry && !isFeesPage);
  const needsBourse = pageId === Pages.BourseInquiry;
  const needsFailures = pageId === Pages.BourseInquiry;
  const needsInspectionWorkspaces = pageId === Pages.ActiveInspection;
  const needsPartyPrefetch = Boolean(pageId && PARTY_PAGE_IDS.has(pageId));

  const isSupervisorFees =
    isFeesPage &&
    (role === Roles.SectionSupervisor ||
      role === Roles.CaseSpecialist ||
      role === Roles.Cdo ||
      role === Roles.GeneralManager);
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

  const feesQueryEnabled =
    Boolean(cards) &&
    (isFeesPage
      ? isSupervisorFees || Boolean(feesTaskKind && feesAssigneeId)
      : isSurveyPage && Boolean(feesAssigneeId));

  const { data: feesSummary, isFetched: feesFetched } = useInspectorFeesQuery(
    {
      assigneeId: feesAssigneeId,
      submittedOnly: false,
      taskKind: feesTaskKind,
    },
    {
      enabled: feesQueryEnabled,
    },
  );

  const engFeesStatementsEnabled =
    isFeesPage && role === Roles.EngineeringOffice && Boolean(feesAssigneeId);
  const { data: engFeeStatements = [], isFetched: engFeeStatementsFetched } =
    useQuery({
      queryKey: [
        ...appDataKeys.all,
        "party-billing",
        "statements",
        feesAssigneeId ?? "none",
        "issued+",
        "eng-kpi",
      ],
      queryFn: () =>
        loadPartyBillingStatements({
          assigneeId: feesAssigneeId,
          issuedOrLaterOnly: true,
        }),
      enabled: engFeesStatementsEnabled,
    });

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
      viewerUserId: viewerUserId ?? getAuthSession()?.user.id,
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
    viewerUserId,
    distributionAssigneeId,
    staffUsers,
  ]);

  useEffect(() => {
    if (!needsPartyPrefetch || !pageId) return;
    const events = [
      EVALUATOR_SUBMISSION_CHANGED_EVENT,
      EVALUATOR_RECALL_CHANGED_EVENT,
      EVALUATOR_RECALL_HYDRATED_EVENT,
      PARTY_TASK_RECALL_CHANGED_EVENT,
      PARTY_TASK_RECALL_HYDRATED_EVENT,
      FIELD_INSPECTION_SUBMISSION_CHANGED_EVENT,
      ENGINEERING_SURVEY_SUBMISSION_CHANGED_EVENT,
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

  // Survey KPIs must not wait on fees when the fees query is disabled
  // (no assigneeId) — otherwise every card stays "—" forever.
  const feesReadyForSituation =
    isFeesPage
      ? feesFetched &&
        (!engFeesStatementsEnabled || engFeeStatementsFetched)
      : isSurveyPage
        ? !feesQueryEnabled || feesFetched
        : true;

  const ready =
    feesReadyForSituation &&
    (!needsTasks || tasksFetched) &&
    (!needsPo || poRecordsFetched) &&
    (!needsBourse || bourseFetched) &&
    (!needsFailures || failuresFetched) &&
    (!needsInspectionWorkspaces || workspacesFetched);

  return useMemo(() => {
    if (!pageId || !cards) return null;

    if (isFeesPage) {
      const closedStatementsPaidSar = engFeeStatements
        .filter((s) => s.status === PartyBillingStatementStatuses.Closed)
        .reduce((sum, s) => sum + (Number(s.totalNetSar) || 0), 0);
      const values = ready
        ? role === Roles.EngineeringOffice
          ? computeEngineeringFeesSituation(feesSummary?.rows ?? [], {
              closedStatementsPaidSar,
            })
          : computeFeesPageSituation(feesSummary?.rows ?? [])
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
      viewerUserId: viewerUserId ?? getAuthSession()?.user.id,
      viewerAssigneeId: distributionAssigneeId,
      staffUsers,
    });

    const obstructedCount =
      pageId === Pages.BourseInquiry
        ? pendingBourse.length -
          filterActionablePendingBourseItems(pendingBourse, failures).length
        : 0;

    const visiblePendingBourse =
      pageId === Pages.BourseInquiry
        ? filterActionablePendingBourseItems(pendingBourse, failures)
        : pendingBourse;

    const inspectionWorkspaceByTaskId = new Map(
      inspectionWorkspaces.map((row) => [row.workflowTaskId, row]),
    );

    const values = ready
      ? (computePageSituationValues(pageId, {
          tasks: mine,
          allTasks: tasks ?? [],
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
    // `computePageSituationValues` reads the party-submission cache, so the
    // counter below is an invalidation key rather than an input.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [
    pageId,
    cards,
    isFeesPage,
    isSurveyPage,
    ready,
    feesSummary,
    engFeeStatements,
    role,
    tasks,
    poRecords,
    pendingBourse,
    failures,
    inspectionWorkspaces,
    viewerUserId,
    distributionAssigneeId,
    staffUsers,
    partySubmissionGen,
  ]);
}
