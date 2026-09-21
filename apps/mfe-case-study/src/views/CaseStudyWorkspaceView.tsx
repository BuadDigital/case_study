"use client";

import { useRouter } from "next/navigation";
import { useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import {
  Button,
  Note,
  PageShell,
  PanelSkeleton,
  cn,
  opsContentPanel,
} from "@platform/ui-kit";
import { CaseStudyForm } from "../components/case-study/CaseStudyForm";
import { CaseStudyAppraisalPanel } from "../components/case-study/CaseStudyAppraisalPanel";
import { CaseStudyWorkspaceStepNav, type CaseStudyWorkspaceTab } from "../components/case-study/CaseStudyWorkspaceStepNav";
import { PropertyDetailAppraisalTab } from "../components/po-intake/PropertyDetailTabChunks";
import { PropertyDetailHero } from "../components/po-intake/PropertyDetailHero";
import { PropertyTransactionTimeline } from "../components/po-intake/PropertyTransactionTimeline";
import { useAppAccess } from "@platform/app-shared/contexts/AppAccessContext";
import { activeCaseStudyPath } from "../lib/my-task-routes";
import { poPropertiesPath, poPropertyPath } from "@platform/app-shared/domain/po-routes";
import { findPropertyForTask } from "../lib/app-data/my-task-row";
import { canOpenCaseStudyWorkspace } from "../lib/app-data/viewer-task-access";
import type { WorkflowTask } from "../lib/app-data/tasks";
import { childTasksForCaseStudyParent } from "../lib/app-data/case-study-party-answers";
import { buildPropertyDetailPartyCards, type PropertyDetailPartyCard } from "../lib/app-data/property-detail-parties";
import { usePoRecordQuery, useWorkflowTasksQuery } from "../query/case-study-queries";
import { usePropertyDetailPartySubmissionsQuery } from "../query/property-detail-party-submissions-queries";
import { useStaffUsersQuery } from "@settings/mfe/query/settings-queries";
import { resolveAssigneeDisplayName } from "@platform/app-shared/fees/party-fee-meta";
import { CASE_STUDY_WORKSPACE_OPEN_APPRAISAL_EVENT, CASE_STUDY_WORKSPACE_OPEN_VALUATION_EVENT } from "../lib/case-study-workspace-events";

export type CaseStudyWorkspacePartiesExtrasProps = {
  task: WorkflowTask;
  property: ReturnType<typeof findPropertyForTask>;
  tasks: WorkflowTask[];
};

function caseStudyWorkspaceFallbackPath(task: WorkflowTask | null): string {
  if (task?.propertyId) {
    return poPropertyPath(task.poNumber.trim(), task.propertyId);
  }
  if (task?.poNumber.trim()) {
    return poPropertiesPath(task.poNumber.trim());
  }
  return activeCaseStudyPath();
}


/**
 * Step 3 — specialist reviews the appraiser's valuation report package.
 * Accept stamps the package (valuation path ends); reopen stays available so
 * the case is not permanently locked (future edit flow comes later).
 */
function CaseStudyValuationPanel({
  property,
  tasks,
  caseStudyTask,
}: {
  property: NonNullable<ReturnType<typeof findPropertyForTask>>;
  tasks: WorkflowTask[];
  caseStudyTask: WorkflowTask;
}) {
  const { data: staffResult } = useStaffUsersQuery();
  const staffUsers = staffResult?.users ?? [];

  const appraisalTask = useMemo(() => {
    const fromParent = childTasksForCaseStudyParent(
      caseStudyTask.id,
      tasks,
    ).find((t) => t.kind === "property-appraisal");
    if (fromParent) return fromParent;
    return (
      tasks.find(
        (t) =>
          t.kind === "property-appraisal" &&
          t.poNumber.trim() === caseStudyTask.poNumber.trim() &&
          t.propertyId === property.id,
      ) ?? null
    );
  }, [caseStudyTask.id, caseStudyTask.poNumber, tasks, property.id]);

  const appraisalCard = useMemo((): PropertyDetailPartyCard | null => {
    const fromParties = buildPropertyDetailPartyCards({
      task: caseStudyTask,
      allTasks: tasks,
      staffUsers,
    }).find((c) => c.roleKey === "appraisal");
    if (fromParties?.enabled) return fromParties;
    if (!appraisalTask) return null;
    return {
      roleKey: "appraisal",
      role: "المقيم العقاري",
      name:
        resolveAssigneeDisplayName({
          assigneeName: appraisalTask.assigneeName,
          assigneeId: appraisalTask.assigneeId,
          staffUsers,
          fallback: "المقيم",
        }) || "المقيم",
      unassigned: false,
      state: "progress",
      enabled: true,
    };
  }, [caseStudyTask, tasks, staffUsers, appraisalTask]);

  const partySubmissionsQuery = usePropertyDetailPartySubmissionsQuery({
    parentTask: caseStudyTask,
    allTasks: tasks,
    enabled: true,
  });

  return (
    <div className="pt-5">
      <div className="mb-3 flex flex-wrap items-center gap-2.5">
        <span className="h-[17px] w-[3px] rounded-full bg-gold" aria-hidden />
        <h3 className="m-0 text-[14px] font-extrabold text-heading">
          تقرير التقييم — مراجعة الأخصائي
        </h3>
        <span className="min-w-[1rem] flex-1 border-t border-border" aria-hidden />
      </div>
      <p className="mb-3 text-[11.5px] leading-relaxed text-text-3">
        يصل التقرير هنا بعد إرسال المقيّم. اعتمد التقرير لإتمام مسار التقييم، أو
        أعده للتصحيح. الاعتماد لا يقفل المعاملة نهائيًا — يمكن إعادة فتحها لاحقًا.
      </p>
      <PropertyDetailAppraisalTab
        property={property}
        appraisalTask={appraisalTask}
        tasks={tasks}
        appraisalCard={appraisalCard}
        submission={partySubmissionsQuery.data?.appraisal ?? null}
        onReviewChanged={() => {
          void partySubmissionsQuery.refetch();
        }}
      />
    </div>
  );
}

export function CaseStudyWorkspaceView({
  taskId,
  renderPartiesExtras,
}: {
  taskId: string;
  renderPartiesExtras?: (
    props: CaseStudyWorkspacePartiesExtrasProps,
  ) => ReactNode;
}) {
  const [workspaceTab, setWorkspaceTab] =
    useState<CaseStudyWorkspaceTab>("study");
  useEffect(() => {
    const openAppraisal = () => setWorkspaceTab("appraisal");
    const openValuation = () => setWorkspaceTab("valuation");
    window.addEventListener(
      CASE_STUDY_WORKSPACE_OPEN_APPRAISAL_EVENT,
      openAppraisal,
    );
    window.addEventListener(
      CASE_STUDY_WORKSPACE_OPEN_VALUATION_EVENT,
      openValuation,
    );
    return () => {
      window.removeEventListener(
        CASE_STUDY_WORKSPACE_OPEN_APPRAISAL_EVENT,
        openAppraisal,
      );
      window.removeEventListener(
        CASE_STUDY_WORKSPACE_OPEN_VALUATION_EVENT,
        openValuation,
      );
    };
  }, []);
  /**
   * Documents and photos load only once a tab that shows them has been opened —
   * the study form never triggers the attachment fan-out. A visited tab stays
   * recorded, so the gate never flips back (same pattern as the property tabs).
   */
  const visitedTabsRef = useRef<Set<CaseStudyWorkspaceTab>>(new Set());
  visitedTabsRef.current.add(workspaceTab);
  const propertyMediaVisited = visitedTabsRef.current.has("appraisal");
  const router = useRouter();
  const { role } = useAppAccess();
  const {
    data: tasks,
    isFetched: tasksFetched,
    isPending: tasksPending,
    isError: tasksError,
    error: tasksQueryError,
    refetch: refetchTasks,
  } = useWorkflowTasksQuery();

  const task = useMemo((): WorkflowTask | null => {
    return tasks?.find((t) => t.id === taskId) ?? null;
  }, [tasks, taskId]);

  const canAccess = useMemo(() => {
    if (!task) return false;
    return canOpenCaseStudyWorkspace(role, task, tasks ?? []);
  }, [task, role, tasks]);

  const {
    data: record,
    isPending: recordLoading,
    isFetched: recordFetched,
    isError: recordError,
    error: recordQueryError,
    refetch: refetchRecord,
  } = usePoRecordQuery(task?.poNumber ?? null);

  const property = useMemo(
    () => (task && record ? findPropertyForTask(record, task) : null),
    [task, record],
  );

  const propertyIndex = useMemo(() => {
    if (!record || !property) return -1;
    return record.properties.findIndex((p) => p.id === property.id);
  }, [record, property]);

  /** Deep-link from party-submit notification: open valuation when a report awaits review. */
  const partySubmissionsForGate = usePropertyDetailPartySubmissionsQuery({
    parentTask: task,
    allTasks: tasks ?? [],
    enabled: Boolean(task && property),
  });
  const autoOpenedValuationRef = useRef(false);
  useEffect(() => {
    if (autoOpenedValuationRef.current) return;
    const appraisal = partySubmissionsForGate.data?.appraisal;
    if (!appraisal) return;
    const status = (appraisal.packageStatus ?? "").toLowerCase();
    const accepted =
      typeof appraisal.acceptedAtUtc === "string" &&
      appraisal.acceptedAtUtc.trim().length > 0;
    if (status === "submitted" && !accepted) {
      autoOpenedValuationRef.current = true;
      setWorkspaceTab("valuation");
    }
  }, [partySubmissionsForGate.data?.appraisal]);

  const loading =
    (!tasksFetched && tasksPending) ||
    (Boolean(task?.poNumber) && recordLoading && !record);

  const loadErrorMessage =
    (tasksQueryError instanceof Error ? tasksQueryError.message : null) ??
    (recordQueryError instanceof Error ? recordQueryError.message : null) ??
    "تعذّر تحميل بيانات دراسة الحالة";

  const hasLoadError =
    (tasksFetched && tasksError) ||
    (Boolean(task?.poNumber) && recordFetched && recordError);

  const shouldRedirect =
    !loading &&
    !hasLoadError &&
    tasksFetched &&
    (!task || !canAccess || (recordFetched && (!record || !property)));

  const waitingForWorkspace =
    !hasLoadError &&
    (loading ||
      shouldRedirect ||
      !task ||
      !record ||
      !property ||
      propertyIndex < 0);

  useEffect(() => {
    if (!shouldRedirect) return;
    router.replace(caseStudyWorkspaceFallbackPath(task));
  }, [shouldRedirect, task, router]);

  if (hasLoadError) {
    return (
      <div className="flex min-h-0 w-full flex-1 flex-col overflow-hidden bg-[#f5f3ee] p-4">
        <Note tone="warn">{loadErrorMessage}</Note>
        <div className="mt-3">
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={() => {
              void refetchTasks();
              if (task?.poNumber) void refetchRecord();
            }}
          >
            إعادة المحاولة
          </Button>
        </div>
      </div>
    );
  }

  if (waitingForWorkspace || !task || !record || !property) {
    return (
      <div
        className="flex min-h-0 w-full flex-1 flex-col overflow-hidden bg-[#f5f3ee]"
        aria-busy
      >
        <PanelSkeleton />
      </div>
    );
  }

  return (
    <div
      id="view-case-study-workspace"
      className="flex min-h-0 w-full flex-1 flex-col overflow-hidden bg-[#f5f3ee] [zoom:0.85]"
    >
      <PageShell
        variant="canvas"
        className="gap-0 overflow-y-auto bg-[#f5f3ee] px-[30px] py-[26px] max-sm:px-4 max-sm:py-4"
      >
        <PropertyDetailHero
          record={record}
          property={property}
          propertyIndex={propertyIndex + 1}
          hideOpenCaseStudy
        />

        <div className="grid min-h-0 flex-1 grid-cols-1 items-start gap-3.5 lg:grid-cols-[minmax(0,1fr)_250px]">
          <div className={cn(opsContentPanel, "pt-5")}>
            <CaseStudyWorkspaceStepNav
              active={workspaceTab}
              onSelect={setWorkspaceTab}
            />
            {workspaceTab === "study" ? (
              <CaseStudyForm
                taskId={taskId}
                task={task}
                property={property}
                poRecord={record}
                requestDateSeed={record.receivedFromEnfathAt}
              />
            ) : workspaceTab === "appraisal" ? (
              <CaseStudyAppraisalPanel
                property={property}
                poNumber={record.poNumber}
                tasks={tasks ?? []}
                caseStudyTask={task}
                documentsEnabled={propertyMediaVisited}
              />
            ) : (
              <CaseStudyValuationPanel
                property={property}
                tasks={tasks ?? []}
                caseStudyTask={task}
              />
            )}
            {renderPartiesExtras ? (
              <div className="mt-4 border-t border-border pt-4">
                {renderPartiesExtras({
                  task,
                  property,
                  tasks: tasks ?? [],
                })}
              </div>
            ) : null}
          </div>
          <PropertyTransactionTimeline record={record} property={property} />
        </div>
      </PageShell>
    </div>
  );
}
