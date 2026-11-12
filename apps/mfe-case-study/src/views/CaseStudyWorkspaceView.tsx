"use client";

import { useRouter } from "next/navigation";
import { Activity, useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import {
  Button,
  FormDensityProvider,
  Note,
  PageShell,
  PanelSkeleton,
  cn,
  opsContentPanel,
  useSwapAnimation,
} from "@platform/ui-kit";
import { CaseStudyReportEditor } from "../components/case-study/CaseStudyReportEditor";
import { CaseStudyAppraisalDeedsPanel } from "../components/case-study/CaseStudyAppraisalDeedsPanel";
import { caseStudyReportDeeds } from "../lib/app-data/case-study-report-document-model";
import { useTransactionQuery } from "../query/use-transaction-query";
import { CaseStudyWorkspaceStepNav, type CaseStudyWorkspaceTab } from "../components/case-study/CaseStudyWorkspaceStepNav";
import {
  preloadValuationPanel,
  usePreloadWorkspacePanels,
} from "../components/case-study/lazy-workspace-panels";
import { CaseStudyValuationPanel } from "../components/case-study/CaseStudyValuationPanel";
import { PropertyDetailHero } from "../components/po-intake/PropertyDetailHero";
import { PropertyDetailEnfazHandoverCard } from "../components/po-intake/PropertyDetailEnfazHandoverCard";
import { PropertyTransactionTimeline } from "../components/po-intake/PropertyTransactionTimeline";
import { canHandOverToEnfaz } from "../lib/app-data/po-roles";
import { useAppAccess } from "@platform/app-shared/contexts/AppAccessContext";
import { activeCaseStudyPath, caseStudyWorkspacePath } from "../lib/my-task-routes";
import { poPropertiesPath, poPropertyPath } from "@platform/app-shared/domain/po-routes";
import { findPropertyForTask } from "../lib/app-data/my-task-row";
import { canOpenCaseStudyWorkspace } from "../lib/app-data/viewer-task-access";
import type { WorkflowTask } from "../lib/app-data/tasks";
import { usePoRecordQuery, useWorkflowTasksQuery } from "../query/case-study-queries";
import { usePropertyDetailPartySubmissionsQuery } from "../query/property-detail-party-submissions-queries";
import { CASE_STUDY_WORKSPACE_OPEN_APPRAISAL_EVENT } from "@platform/app-shared/events/app-events";

type CaseStudyWorkspacePartiesExtrasProps = {
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
 * The case specialist's study workspace for one case-study task: study, appraisal and valuation
 * tabs, with the Enfaz handover card and the timeline beside them.
 *
 * How it works: 1) finds the task, its work order and the deed; a missing task, no access or a
 * missing deed sends the user to the fallback path; 2) reads the deed's transaction — when its
 * `studyHolderTaskId` is another task, replaces the route with the holder's workspace; 3) shows a
 * skeleton until the task, record, deed and transaction are loaded; 4) builds the report's deeds
 * block (`caseStudyReportDeeds`) and passes it and the transaction to the study and appraisal tabs.
 *
 * Edge cases: phase 4 — one study per transaction, so a folded deed never
 * opens its own study; the server resolves writes to the holder the same way. A failed
 * transaction read still counts as fetched, so it never blocks the page.
 */
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
    window.addEventListener(
      CASE_STUDY_WORKSPACE_OPEN_APPRAISAL_EVENT,
      openAppraisal,
    );
    return () => {
      window.removeEventListener(
        CASE_STUDY_WORKSPACE_OPEN_APPRAISAL_EVENT,
        openAppraisal,
      );
    };
  }, []);
  /**
   * Documents and photos load only once a tab that shows them has been opened —
   * the study form never triggers the attachment fan-out. A visited tab stays
   * recorded, so the gate never flips back (same pattern as the property tabs).
   * Visited tabs also stay mounted (hidden in an <Activity>), so switching back
   * keeps their step, open sections and input instead of reloading.
   */
  const [visitedTabs, setVisitedTabs] = useState<ReadonlySet<CaseStudyWorkspaceTab>>(
    () => new Set([workspaceTab]),
  );
  if (!visitedTabs.has(workspaceTab)) {
    setVisitedTabs(new Set(visitedTabs).add(workspaceTab));
  }
  const propertyMediaVisited = visitedTabs.has("appraisal");
  const panelRef = useRef<HTMLDivElement>(null);
  useSwapAnimation(panelRef, workspaceTab);
  const router = useRouter();
  const { role, access } = useAppAccess();
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

  // Phase 4: one study per transaction. A deed folded into another
  // deed's study opens that deed's workspace — the server resolves writes the same way.
  const { data: transaction, isFetched: transactionFetched } = useTransactionQuery(property?.id);
  const holderTaskId = transaction?.studyHolderTaskId?.trim() || null;
  const redirectToHolder = Boolean(holderTaskId && holderTaskId !== taskId);
  useEffect(() => {
    if (!redirectToHolder || !holderTaskId) return;
    router.replace(caseStudyWorkspacePath(holderTaskId));
  }, [redirectToHolder, holderTaskId, router]);
  const reportDeeds = useMemo(() => caseStudyReportDeeds(transaction?.deeds), [transaction]);

  /** Deep-link from party-submit notification: open valuation when a report awaits review. */
  const partySubmissionsForGate = usePropertyDetailPartySubmissionsQuery({
    parentTask: task,
    allTasks: tasks ?? [],
    enabled: Boolean(task && property),
  });
  // A submitted, not yet accepted appraisal opens the valuation tab once.
  const gateAppraisal = partySubmissionsForGate.data?.appraisal;
  const awaitingAppraisalReview =
    (gateAppraisal?.packageStatus ?? "").toLowerCase() === "submitted" &&
    !(
      typeof gateAppraisal?.acceptedAtUtc === "string" &&
      gateAppraisal.acceptedAtUtc.trim().length > 0
    );
  const [autoOpenedValuation, setAutoOpenedValuation] = useState(false);
  if (!autoOpenedValuation && gateAppraisal && awaitingAppraisalReview) {
    setAutoOpenedValuation(true);
    setWorkspaceTab("valuation");
  }

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
      redirectToHolder ||
      !task ||
      !record ||
      !property ||
      propertyIndex < 0 ||
      // The deeds table and the holder redirect both wait for the transaction (not for a failure).
      (Boolean(property) && !transactionFetched));

  usePreloadWorkspacePanels(!waitingForWorkspace);

  useEffect(() => {
    if (!shouldRedirect) return;
    router.replace(caseStudyWorkspaceFallbackPath(task));
  }, [shouldRedirect, task, router]);

  if (hasLoadError) {
    return (
      <div className="flex min-h-0 w-full flex-1 flex-col overflow-hidden bg-bg p-4">
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
        className="flex min-h-0 w-full flex-1 flex-col overflow-hidden bg-bg"
        aria-busy
      >
        <PanelSkeleton />
      </div>
    );
  }

  return (
    <div
      id="view-case-study-workspace"
      className="flex min-h-0 w-full flex-1 flex-col overflow-hidden bg-bg [zoom:0.85]"
    >
      <PageShell
        variant="canvas"
        className="gap-0 overflow-y-auto bg-bg px-[30px] py-[26px] max-sm:px-4 max-sm:py-4"
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
              onIntent={(tab) => {
                if (tab === "valuation") preloadValuationPanel();
              }}
            />
            <div ref={panelRef}>
              {visitedTabs.has("study") ? (
                <Activity mode={workspaceTab === "study" ? "visible" : "hidden"}>
                  <CaseStudyReportEditor
                    taskId={taskId}
                    task={task}
                    property={property}
                    poRecord={record}
                    requestDateSeed={record.receivedFromEnfathAt}
                    workOrderId={record.id}
                    deeds={reportDeeds}
                  />
                </Activity>
              ) : null}
              {visitedTabs.has("appraisal") ? (
                <Activity mode={workspaceTab === "appraisal" ? "visible" : "hidden"}>
                  {/* Phase 4: one study covers the transaction, so the appraisal tab lists every deed. */}
                  {/* Omar 2026-11-12: «مدخلات المعاين» takes the work page's look — fields four a
                      row, one card title style — instead of two fields stretched across the screen. */}
                  <FormDensityProvider value="work">
                    <CaseStudyAppraisalDeedsPanel
                      property={property}
                      poNumber={record.poNumber}
                      tasks={tasks ?? []}
                      caseStudyTask={task}
                      documentsEnabled={propertyMediaVisited}
                      transaction={transaction}
                    />
                  </FormDensityProvider>
                </Activity>
              ) : null}
              {visitedTabs.has("valuation") ? (
                <Activity mode={workspaceTab === "valuation" ? "visible" : "hidden"}>
                  <CaseStudyValuationPanel
                    property={property}
                    tasks={tasks ?? []}
                    caseStudyTask={task}
                  />
                </Activity>
              ) : null}
            </div>
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
          <div className="flex min-w-0 flex-col gap-3">
            {canHandOverToEnfaz(access) ? (
              <PropertyDetailEnfazHandoverCard
                workOrderId={record.id}
                propertyId={property.id}
              />
            ) : null}
            <PropertyTransactionTimeline record={record} property={property} />
          </div>
        </div>
      </PageShell>
    </div>
  );
}
