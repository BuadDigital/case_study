"use client";

/**
 * All non-rendering workflow behind `PoPropertyDetailTabs`: tab selection and
 * its URL sync, the per-property queries (tasks, documents, parties, timeline,
 * fees, keys) and the "new since last visit" bookkeeping. The component
 * consumes the returned bag and keeps JSX only.
 */
import { useRouter, useSearchParams } from "next/navigation";
import { useEffect, useMemo, useRef, useState } from "react";
import { findSurveyChildForParent } from "@platform/app-shared/engineering-survey/survey-task";
import { failuresForProperty } from "@failures/mfe/lib/failure-property-match";
import { useFailuresQuery } from "@failures/mfe/query/failures-queries";
import { useAppAccess } from "@platform/app-shared/contexts/AppAccessContext";
import { canViewPropertyTimelineRail } from "../../lib/app-data/po-roles";
import { buildPartyRemarksSections } from "./PropertyDetailSurveyNotesTab";
import {
  formatPropertyDeedDisplay,
  type PoIntakeRecord,
  type PoPropertyIntake,
} from "../../lib/app-data/po-intake-data";
import { useStaffUsersQuery } from "@settings/mfe/query/settings-queries";
import { resolveAssigneeDisplayName } from "@platform/app-shared/fees/party-fee-meta";
import {
  buildPropertyDetailPartyCards,
  type PropertyDetailPartyCard,
} from "../../lib/app-data/property-detail-parties";
import { buildPropertyDetailTimeline } from "../../lib/app-data/property-detail-timeline";
import { usePropertyTimelineQuery } from "../../query/use-property-timeline-query";
import { caseStudyTaskForProperty } from "../../lib/app-data/tasks-storage";
import { childTasksForCaseStudyParent } from "../../lib/app-data/case-study-party-answers";
import {
  listPropertyDetailPhotos,
  pickPrimaryPropertyDetailPhoto,
} from "../../lib/app-data/property-detail-documents";
import { usePropertyDetailDocuments } from "../../query/property-detail-documents-query";
import { useWorkflowTasksQuery } from "../../query/case-study-queries";
import { useInspectorFeesQuery } from "../../query/inspector-fees-queries";
import { usePropertyDetailPartySubmissionsQuery } from "../../query/property-detail-party-submissions-queries";
import { poPropertyPath, poPropertyDetailPath } from "@platform/app-shared/domain/po-routes";
import { usePropertyOperationsTasks } from "../../query/use-property-operations-tasks";
import { keysStatusLabelAr, usePropertyKeyGateQuery } from "../../query/use-property-key-gate-query";
import {
  loadSeenPropertyTabFingerprints,
  markPropertyTabSeen,
  type SeenPropertyTabMap,
} from "../../lib/app-data/property-detail-local-ui";
import { buildPropertyDetailTabActivity } from "../../lib/app-data/property-detail-tab-activity";
import {
  isAllowedPropertyTab,
  propertyDetailTabsForRole,
  type TabId,
} from "./po-property-detail-tabs-state";
import type { PoPropertyDetailInspectorWorkspace } from "./PoPropertyDetailTabs";

export function usePoPropertyDetailTabsWorkflow({
  record,
  property,
  showDecree,
  inspectorWorkspace,
}: {
  record: PoIntakeRecord;
  property: PoPropertyIntake;
  showDecree: boolean;
  inspectorWorkspace?: PoPropertyDetailInspectorWorkspace;
}) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { role } = useAppAccess();
  const visibleTabs = useMemo(() => propertyDetailTabsForRole(role), [role]);
  const showCaseStudySideRail = canViewPropertyTimelineRail(role);
  const initialTab = searchParams.get("tab");
  const inspectParam = searchParams.get("inspect");
  const workspaceForced = Boolean(inspectorWorkspace);
  const [tab, setTab] = useState<TabId>(() => {
    if (workspaceForced) return "inspection";
    if (isAllowedPropertyTab(role, initialTab)) return initialTab;
    return visibleTabs[0]?.id ?? "basic";
  });
  const [inspectEdit, setInspectEdit] = useState(() => {
    if (workspaceForced) return inspectorWorkspace?.forceEdit !== false;
    return inspectParam === "edit";
  });
  const [seenTabs, setSeenTabs] = useState<SeenPropertyTabMap>(() => ({}));
  const { data: tasks = [] } = useWorkflowTasksQuery();
  const { data: staffResult } = useStaffUsersQuery();
  const staffUsers = staffResult?.users ?? [];
  const poNumber = record.poNumber.trim();

  const replaceInspectQuery = (inspect: "edit" | null) => {
    /* Inspector workspace stays on /active-inspection — do not jump to PO property URL. */
    if (workspaceForced) return;
    const base = poPropertyPath(poNumber, property.id);
    if (inspect === "edit") {
      router.replace(`${base}?tab=inspection&inspect=edit`, { scroll: false });
      return;
    }
    router.replace(`${base}?tab=inspection`, { scroll: false });
  };

  const selectTab = (next: TabId) => {
    setTab(next);
    if (workspaceForced) return;
    router.replace(poPropertyDetailPath(poNumber, property.id, next), {
      scroll: false,
    });
  };

  useEffect(() => {
    if (workspaceForced) {
      setTab("inspection");
      setInspectEdit(inspectorWorkspace?.forceEdit !== false);
      return;
    }
    const nextTab = searchParams.get("tab");
    if (isAllowedPropertyTab(role, nextTab)) {
      setTab(nextTab);
    }
    const nextInspect = searchParams.get("inspect");
    /* Input mode only when ?inspect=edit (from the button) — not merely opening the tab. */
    setInspectEdit(nextInspect === "edit");
  }, [searchParams, workspaceForced, inspectorWorkspace?.forceEdit, role]);

  /** Active tab is derived during render — a role change moves the selection immediately without an extra pass. */
  const effectiveTab: TabId =
    workspaceForced || visibleTabs.some((t) => t.id === tab)
      ? tab
      : visibleTabs[0]?.id ?? "basic";

  /** Tab mounts only after first visit — then stays mounted but hidden so its state is kept. */
  const visitedTabsRef = useRef<Set<TabId>>(new Set());
  visitedTabsRef.current.add(effectiveTab);
  const tabMode = (id: TabId) => (effectiveTab === id ? "visible" : "hidden");

  useEffect(() => {
    setSeenTabs(loadSeenPropertyTabFingerprints(property.id));
  }, [property.id]);

  const task = useMemo(
    () => caseStudyTaskForProperty(poNumber, property.id, tasks),
    [poNumber, property.id, tasks],
  );

  const { data: failures = [] } = useFailuresQuery();
  const propertyFailures = useMemo(
    () =>
      failuresForProperty(failures, {
        poNumber,
        propertyId: property.id,
        deedNumber: property.deedNumber,
      }),
    [failures, poNumber, property.id, property.deedNumber],
  );

  const surveyTask = useMemo(
    () =>
      task
        ? findSurveyChildForParent(task.id, property.id, tasks)
        : null,
    [task, property.id, tasks],
  );

  const appraisalTask = useMemo(() => {
    if (!task) return null;
    return (
      childTasksForCaseStudyParent(task.id, tasks).find(
        (t) => t.kind === "property-appraisal",
      ) ?? null
    );
  }, [task, tasks]);

  const inspectionTask = useMemo(() => {
    if (inspectorWorkspace?.task) return inspectorWorkspace.task;
    const fromParent = task
      ? childTasksForCaseStudyParent(task.id, tasks).find(
          (t) => t.kind === "field-inspection",
        )
      : null;
    if (fromParent) return fromParent;
    return (
      tasks.find(
        (t) =>
          t.kind === "field-inspection" &&
          t.poNumber.trim() === poNumber &&
          t.propertyId === property.id,
      ) ?? null
    );
  }, [inspectorWorkspace?.task, task, tasks, poNumber, property.id]);

  const propertyDocumentSections = usePropertyDetailDocuments({
    property,
    showDecree,
    poNumber,
    surveyTaskId: surveyTask?.id ?? null,
    appraisalTaskId: appraisalTask?.id ?? null,
    inspectionTaskId: inspectionTask?.id ?? null,
  });

  const propertyPhotos = useMemo(
    () => listPropertyDetailPhotos(propertyDocumentSections),
    [propertyDocumentSections],
  );
  const primaryPhoto = useMemo(() => {
    return pickPrimaryPropertyDetailPhoto(propertyPhotos);
  }, [propertyPhotos]);
  const partyCards = buildPropertyDetailPartyCards({
    task: task ?? null,
    allTasks: tasks,
    staffUsers,
  });
  const appraisalCard = partyCards.find((c) => c.roleKey === "appraisal") ?? null;
  const inspectionCardFromParties =
    partyCards.find((c) => c.roleKey === "inspection") ?? null;
  const inspectionCard: PropertyDetailPartyCard | null =
    inspectionCardFromParties ??
    (inspectionTask
      ? {
          roleKey: "inspection",
          role: "المعاين",
          name:
            resolveAssigneeDisplayName({
              assigneeName: inspectionTask.assigneeName,
              assigneeId: inspectionTask.assigneeId,
              staffUsers,
              fallback: "المعاين",
            }) || "المعاين",
          unassigned: false,
          state: "progress",
          enabled: true,
        }
      : null);
  const surveyCard = partyCards.find((c) => c.roleKey === "survey") ?? null;

  const partySubmissionsQuery = usePropertyDetailPartySubmissionsQuery({
    parentTask: task ?? null,
    allTasks: tasks,
    enabled: true,
  });

  const partyRemarksSections = useMemo(
    () =>
      buildPartyRemarksSections({
        survey: partySubmissionsQuery.data?.survey ?? null,
        inspection: partySubmissionsQuery.data?.inspection ?? null,
        appraisal: partySubmissionsQuery.data?.appraisal ?? null,
      }),
    [partySubmissionsQuery.data],
  );

  const logEventsQuery = usePropertyTimelineQuery(poNumber, property.id);
  const fallbackLogEvents = useMemo(
    () =>
      [...buildPropertyDetailTimeline({ record, property, tasks })].reverse(),
    [record, property, tasks, propertyFailures],
  );
  const logEvents =
    logEventsQuery.data && logEventsQuery.data.length > 0
      ? [...logEventsQuery.data].reverse()
      : fallbackLogEvents;

  const propertyFeeTasks = useMemo(
    () =>
      tasks.filter(
        (t) =>
          t.poNumber.trim() === poNumber &&
          t.propertyId === property.id &&
          (t.kind === "field-inspection" || t.kind === "engineering-survey"),
      ),
    [tasks, poNumber, property.id],
  );

  const propertyFeeTaskIds = useMemo(
    () => new Set(propertyFeeTasks.map((t) => t.id)),
    [propertyFeeTasks],
  );

  const { data: propertyFeesSummary } = useInspectorFeesQuery(
    { submittedOnly: false },
    { enabled: propertyFeeTaskIds.size > 0 },
  );

  const propertyFeeRows = useMemo(
    () =>
      (propertyFeesSummary?.rows ?? []).filter((row) =>
        propertyFeeTaskIds.has(row.workflowTaskId),
      ),
    [propertyFeesSummary?.rows, propertyFeeTaskIds],
  );

  const deedDisplay =
    formatPropertyDeedDisplay(property) || property.deedNumber.trim();
  const { primaryCourtVisit } = usePropertyOperationsTasks(
    {
      poNumber,
      deedNumber: property.deedNumber.trim(),
      deedDisplay,
    },
    { live: true },
  );
  const { data: keyGate } = usePropertyKeyGateQuery({
    propertyId: property.id,
    poNumber,
    deedNumber: property.deedNumber.trim(),
    requestNumber: property.requestNumber.trim() || undefined,
  });
  const keysStatus = keysStatusLabelAr(keyGate?.keysStatus ?? "");
  const keysHasData = Boolean(
    keyGate?.keysStatus ||
      keyGate?.envelopeId ||
      primaryCourtVisit?.linkedEnvelopeId ||
      primaryCourtVisit,
  );

  const governmentTask = useMemo(() => {
    if (!task) return null;
    return (
      childTasksForCaseStudyParent(task.id, tasks).find(
        (t) => t.kind === "government-review",
      ) ??
      tasks.find(
        (t) =>
          t.kind === "government-review" &&
          t.poNumber.trim() === poNumber &&
          t.propertyId === property.id,
      ) ??
      null
    );
  }, [task, tasks, poNumber, property.id]);

  const tabActivity = useMemo(
    () =>
      buildPropertyDetailTabActivity({
        parties: partySubmissionsQuery.data ?? null,
        failures: propertyFailures.map((f) => ({
          id: f.id,
          status: f.status,
          updatedAt: f.updatedAt,
        })),
        feeRows: propertyFeeRows.map((r) => ({
          workflowTaskId: r.workflowTaskId,
          billingStatus: r.billingStatus,
          updatedAtUtc: r.updatedAtUtc ?? null,
        })),
        logEvents: logEvents.map((e) => ({ id: e.id, at: e.at })),
        keysStatus: keyGate?.keysStatus ?? keysStatus,
        governmentReviewTaskStatus: governmentTask?.status ?? null,
        governmentReviewUpdatedAt: governmentTask?.updatedAt ?? null,
      }),
    [
      partySubmissionsQuery.data,
      propertyFailures,
      propertyFeeRows,
      logEvents,
      keyGate?.keysStatus,
      keysStatus,
      governmentTask,
    ],
  );

  useEffect(() => {
    const fingerprint = tabActivity[effectiveTab] ?? null;
    if (!fingerprint) return;
    markPropertyTabSeen(property.id, effectiveTab, fingerprint);
    setSeenTabs((prev) => {
      if (prev[effectiveTab] === fingerprint) return prev;
      return { ...prev, [effectiveTab]: fingerprint };
    });
  }, [property.id, effectiveTab, tabActivity]);

  return {
    role,
    router,
    visibleTabs,
    showCaseStudySideRail,
    workspaceForced,
    effectiveTab,
    tabMode,
    visitedTabsRef,
    selectTab,
    replaceInspectQuery,
    inspectEdit,
    setInspectEdit,
    seenTabs,
    tabActivity,
    tasks,
    poNumber,
    task,
    failures,
    propertyFailures,
    surveyTask,
    appraisalTask,
    inspectionTask,
    propertyDocumentSections,
    propertyPhotos,
    primaryPhoto,
    appraisalCard,
    inspectionCard,
    surveyCard,
    partySubmissionsQuery,
    partyRemarksSections,
    logEvents,
    propertyFeeRows,
    keysStatus,
    keysHasData,
  };
}
