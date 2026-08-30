"use client";

import {
  useCallback,
  useMemo,
  useRef,
  useState,
} from "react";
import { useRouter } from "next/navigation";
import { TaskCompletionSuccess } from "../components/party-tasks/TaskCompletionSuccess";
import { TaskWorkChrome } from "../components/primary-data/TaskWorkChrome";
import { FieldInspectionMobileShell } from "../components/field-inspection/FieldInspectionMobileShell";
import {
  type FieldInspectionWorkHostRef,
} from "../components/field-inspection/FieldInspectionWorkBody";
import { PartyCaseStudyFormTab } from "../components/case-study/PartyCaseStudyFormTab";
import { PropertyDetailInspectionTab } from "../components/po-intake/PropertyDetailInspectionTab";
import type { PropertyDetailPartyCard } from "../lib/prototype/property-detail-parties";
import { useFieldInspectionWorkspacesQuery } from "../query/field-inspection-workspaces-queries";
import { isFieldInspectionLocked } from "../lib/prototype/field-inspection-work-queue";
import type { PartyTaskPageDef } from "@platform/app-shared/prototype/party-task-pages";
import { partyTaskPath } from "../lib/my-task-routes";
import {
  formatPoDisplay,
  formatPropertyDeedDisplay,
  requiresAssignmentDecree,
} from "../lib/prototype/po-intake-data";
import {
  completeChildTask,
  taskDisplayPropertyLabel,
  type WorkflowTask,
} from "../lib/prototype/tasks-storage";
import { usePoRecordQuery, useWorkflowTasksQuery } from "../query/case-study-queries";
import {
  findSiblingInspectionTask,
  findSiblingSurveyTask,
} from "../lib/evaluator-bridge";
import type {
  PartyActiveTaskWorkHostRefObject,
} from "../lib/party-active-task-work-host";
import type {
  PartyAppraisalExtensions,
  PartyEvaluatorWorkHostRef,
} from "../lib/party-appraisal-extensions";
import type {
  PartyEngineeringSurveyExtensions,
  PartyEngineeringSurveyWorkHostRef,
} from "../lib/party-engineering-survey-extensions";
import {
  cn,
  InlineLoadingSkeleton,
  Note,
  PageShell,
  PanelSkeleton,
  useToast,
} from "@platform/ui-kit";
import { PropertyDetailHero } from "../components/po-intake/PropertyDetailHero";
import { PropertyTransactionTimeline } from "../components/po-intake/PropertyTransactionTimeline";
import { FailureRaisePanel } from "@failures/mfe/components/failures/FailureRaisePanel";
import { failureRaiserRoleForParty } from "@failures/mfe/lib/failure-party-roles";

const PARTY_FAILURE_RAISE_KINDS = new Set([
  "field-inspection",
  "property-appraisal",
  "engineering-survey",
]);

const LOADING_TEXT = "text-xs text-text-3";
const TAB_CONTENT = "min-w-0 flex-1 overflow-y-auto px-4 py-4 sm:p-5";

function PartyWorkTabs({
  workTab,
  workTitle,
  onSelect,
}: {
  workTab: "task" | "case-study";
  workTitle: string;
  onSelect: (tab: "task" | "case-study") => void;
}) {
  return (
    <nav
      className="mb-3 overflow-hidden rounded-xl border border-border"
      aria-label="أقسام المهمة"
      role="tablist"
    >
      <div className="flex flex-wrap border-b border-border bg-surface">
        <button
          type="button"
          className={cn(
            "cursor-pointer border-none bg-transparent px-3.5 py-2.5 text-xs font-medium transition-colors",
            workTab === "task"
              ? "-mb-px border-b-2 border-b-primary font-semibold text-primary"
              : "text-text-2 hover:text-text",
          )}
          onClick={() => onSelect("task")}
        >
          {workTitle}
        </button>
        <button
          type="button"
          className={cn(
            "cursor-pointer border-none bg-transparent px-3.5 py-2.5 text-xs font-medium transition-colors",
            workTab === "case-study"
              ? "-mb-px border-b-2 border-b-primary font-semibold text-primary"
              : "text-text-2 hover:text-text",
          )}
          onClick={() => onSelect("case-study")}
        >
          نموذج الدراسة
        </button>
      </div>
    </nav>
  );
}

function PartyTaskFailureRaise({
  def,
  task,
  deedNumber,
  onSubmitted,
}: {
  def: PartyTaskPageDef;
  task: WorkflowTask;
  deedNumber: string;
  onSubmitted?: () => void;
}) {
  if (!task.propertyId || !PARTY_FAILURE_RAISE_KINDS.has(task.kind)) {
    return null;
  }
  return (
    <FailureRaisePanel
      poNumber={task.poNumber}
      propertyId={task.propertyId}
      deedNumber={deedNumber}
      specialist={task.assigneeName || def.assigneeSubtitle}
      raisedByRole={failureRaiserRoleForParty(def)}
      onSubmitted={onSubmitted}
    />
  );
}

export function PartyActiveTaskWork({
  def,
  task,
  hostRef,
  layout = "panel",
  appraisalExtensions,
  engineeringSurveyExtensions,
  engineeringSurveyEntry = false,
}: {
  def: PartyTaskPageDef;
  task: WorkflowTask;
  hostRef: PartyActiveTaskWorkHostRefObject;
  layout?: "page" | "panel";
  appraisalExtensions?: PartyAppraisalExtensions;
  engineeringSurveyExtensions?: PartyEngineeringSurveyExtensions;
  engineeringSurveyEntry?: boolean;
}) {
  const router = useRouter();
  const { showToast } = useToast();

  const exit = useCallback(() => {
    if (hostRef.current?.onClose) {
      hostRef.current.onClose();
      return;
    }
    // Party queues under active transactions:
    // active-inspection → property inspection
    // property-appraisal → property valuation
    // active-survey → engineering survey
    router.push(partyTaskPath(def.pageId));
  }, [def.pageId, hostRef, router]);

  const refresh = useCallback(() => {
    hostRef.current?.onRefresh?.();
  }, [hostRef]);

  /**
   * After successful party submit → queue for that role
   * (property inspection / property valuation / engineering survey).
   */
  const completePartyTaskSubmit = useCallback(
    (
      toastMessage: string = def.completeMessage,
      options?: { showToast?: boolean },
    ) => {
      if (options?.showToast !== false) {
        showToast(toastMessage, "success");
      }
      setSubmitSuccess(true);
      refresh();
      // Let the success toast paint, then leave the workspace for the role queue.
      window.setTimeout(() => exit(), 900);
    },
    [def.completeMessage, exit, refresh, showToast],
  );

  const { data: record, isPending: recordLoading } = usePoRecordQuery(
    task.poNumber,
  );
  const { data: allWorkflowTasks = [] } = useWorkflowTasksQuery();
  const [saving, setSaving] = useState(false);
  const [submitSuccess, setSubmitSuccess] = useState(false);
  const [workTab, setWorkTab] = useState<"task" | "case-study">("task");

  const isAppraisal = def.kind === "property-appraisal";
  const isEngineeringSurvey = def.kind === "engineering-survey";
  const isFieldInspection = def.kind === "field-inspection";

  const evaluatorHostRef = useRef<PartyEvaluatorWorkHostRef>({});
  const surveyHostRef = useRef<PartyEngineeringSurveyWorkHostRef>({});
  const fieldInspectionHostRef = useRef<FieldInspectionWorkHostRef>({});

  // Form UIs often already toast; avoid double toast for those paths.
  evaluatorHostRef.current.onSubmitted = () =>
    completePartyTaskSubmit(def.completeMessage, { showToast: false });
  evaluatorHostRef.current.onSavingChange = setSaving;
  // Engineering survey form does not toast on success — show completeMessage here.
  surveyHostRef.current.onSubmitted = () =>
    completePartyTaskSubmit(def.completeMessage, { showToast: true });
  surveyHostRef.current.onSavingChange = setSaving;
  fieldInspectionHostRef.current.onSubmitted = () =>
    completePartyTaskSubmit(def.completeMessage, { showToast: false });
  fieldInspectionHostRef.current.onSavingChange = setSaving;

  const isFieldInspectionPage = def.kind === "field-inspection";
  const { data: inspectionWorkspaces = [] } = useFieldInspectionWorkspacesQuery(
    isFieldInspectionPage,
  );
  const fieldInspectionWorkspace = useMemo(
    () =>
      inspectionWorkspaces.find((w) => w.workflowTaskId === task.id) ?? null,
    [inspectionWorkspaces, task.id],
  );

  const fieldInspectionLocked = useMemo(
    () => isFieldInspectionLocked(task.id, fieldInspectionWorkspace, task.status),
    [task.id, fieldInspectionWorkspace, task.status],
  );

  const { deedLabel, location } = useMemo(() => {
    const property = record?.properties.find((p) => p.id === task.propertyId);

    if (property) {
      return {
        deedLabel:
          formatPropertyDeedDisplay(property) ||
          `خانة ${task.propertyOrdinal}`,
        location: property.district
          ? `${property.city} · ${property.district}`
          : property.city || "—",
      };
    }

    return {
      deedLabel: taskDisplayPropertyLabel(task),
      location: "—",
    };
  }, [record, task]);

  async function submitWork() {
    setSaving(true);
    const updated = await completeChildTask(task.id);
    setSaving(false);
    if (updated) {
      completePartyTaskSubmit();
      return;
    }
    showToast("تعذّر إتمام المهمة — حاول مرة أخرى", "error");
  }

  const surveyProperty = useMemo(
    () => record?.properties.find((p) => p.id === task.propertyId) ?? null,
    [record, task.propertyId],
  );
  const surveyPropertyIndex = useMemo(
    () =>
      record && surveyProperty
        ? record.properties.findIndex((p) => p.id === surveyProperty.id)
        : -1,
    [record, surveyProperty],
  );

  if (isFieldInspection && layout === "page") {
    const inspectionReadOnly = fieldInspectionLocked || submitSuccess;
    const inspectorCard: PropertyDetailPartyCard = {
      roleKey: "inspection",
      role: "المعاين",
      name: task.assigneeName?.trim() || def.assigneeSubtitle || "المعاين",
      unassigned: false,
      state: inspectionReadOnly ? "done" : "progress",
      enabled: true,
    };

    const desktopStandalone =
      record && surveyProperty && surveyPropertyIndex >= 0 ? (
        <div
          id="view-active-inspection-workspace"
          className="flex min-h-0 w-full flex-1 flex-col overflow-hidden bg-[#f5f3ee]"
        >
          <PageShell
            variant="canvas"
            className="gap-0 overflow-x-hidden overflow-y-auto bg-[#f5f3ee] px-[30px] py-[26px] max-sm:px-4 max-sm:py-4"
          >
            <PropertyDetailHero
              record={record}
              property={surveyProperty}
              propertyIndex={surveyPropertyIndex + 1}
              hideOpenCaseStudy
            />
            <div className="grid min-h-0 flex-1 grid-cols-1 items-start gap-3.5 lg:grid-cols-[minmax(0,1fr)_250px]">
              <div className="min-w-0 overflow-hidden rounded-[12px] border border-border bg-surface px-5 pb-5 shadow-[0_1px_2px_rgba(18,40,76,0.03),0_6px_16px_-18px_rgba(18,40,76,0.10)]">
                <PropertyDetailInspectionTab
                  property={surveyProperty}
                  inspectionTask={task}
                  inspectionCard={inspectorCard}
                  editMode={!inspectionReadOnly}
                  lockEditMode={!inspectionReadOnly}
                  onEditModeChange={(edit) => {
                    if (!edit) exit();
                  }}
                  onSubmitted={() =>
                    completePartyTaskSubmit(def.completeMessage, {
                      showToast: false,
                    })
                  }
                />
              </div>
              <PropertyTransactionTimeline record={record} property={surveyProperty} />
            </div>
          </PageShell>
        </div>
      ) : (
        <InlineLoadingSkeleton className={LOADING_TEXT} />
      );

    return (
      <>
        <div className="hidden min-h-0 w-full flex-1 flex-col overflow-hidden lg:flex">
          {desktopStandalone}
        </div>
        <div className="flex h-full min-h-0 w-full flex-1 flex-col overflow-hidden lg:hidden">
          {record && surveyProperty ? (
            <FieldInspectionMobileShell
              def={def}
              task={task}
              hostRef={fieldInspectionHostRef}
              deedLabel={deedLabel}
              locationLabel={location}
              submitting={saving}
              onClose={exit}
              onFailureSubmitted={refresh}
            />
          ) : (
            <InlineLoadingSkeleton className={LOADING_TEXT} />
          )}
        </div>
      </>
    );
  }

  if (isEngineeringSurvey) {
    const surveyLocked =
      Boolean(engineeringSurveyExtensions?.isSurveyLocked(task.id, saving)) ||
      task.status === "completed" ||
      submitSuccess;

    const surveyWork = engineeringSurveyExtensions ? (
      engineeringSurveyExtensions.renderSurveyWork({
        def,
        childTask: task,
        hostRef: surveyHostRef,
        deedNumber: deedLabel,
        onBack: exit,
        onFailureSubmitted: refresh,
        variant: engineeringSurveyEntry ? "entry" : "workspace",
        forceReadOnly: surveyLocked,
      })
    ) : (
      <InlineLoadingSkeleton className={LOADING_TEXT} />
    );

    if (
      layout === "page" &&
      !engineeringSurveyEntry &&
      record &&
      surveyProperty &&
      surveyPropertyIndex >= 0
    ) {
      return (
        <div
          id="view-engineering-survey-workspace"
          className="flex min-h-0 w-full flex-1 flex-col overflow-hidden bg-[#f5f3ee]"
        >
          <PageShell
            variant="canvas"
            className="gap-0 overflow-x-hidden overflow-y-auto bg-[#f5f3ee] px-[30px] py-[26px] max-sm:px-4 max-sm:py-4"
          >
            <PropertyDetailHero
              record={record}
              property={surveyProperty}
              propertyIndex={surveyPropertyIndex + 1}
              hideOpenCaseStudy
            />
            <div className="grid min-h-0 flex-1 grid-cols-1 items-start gap-3.5 lg:grid-cols-[minmax(0,1fr)_250px]">
              <div className="min-w-0 overflow-hidden rounded-[12px] border border-border bg-surface px-5 pb-5 shadow-[0_1px_2px_rgba(18,40,76,0.03),0_6px_16px_-18px_rgba(18,40,76,0.10)]">
                {surveyWork}
              </div>
              <PropertyTransactionTimeline record={record} property={surveyProperty} />
            </div>
          </PageShell>
        </div>
      );
    }

    return (
      <TaskWorkChrome
        layout={layout}
        title="المكتب الهندسي — الرفع المساحي"
        saving={saving}
        onClose={exit}
        onSave={exit}
        saveLabel="رجوع"
        showHeader={false}
        showFooter={false}
        scrollMode="document"
      >
        {surveyWork}
      </TaskWorkChrome>
    );
  }

  if (recordLoading && !record) {
    if (isAppraisal && layout === "page") {
      return (
        <div className="flex min-h-0 w-full flex-1 flex-col overflow-hidden bg-[#f5f3ee]">
          <PanelSkeleton />
        </div>
      );
    }
    return (
      <TaskWorkChrome
        layout={layout}
        title={def.workTitle}
        onClose={exit}
        onSave={exit}
        saveLabel="رجوع"
        showFooter={false}
      >
        <InlineLoadingSkeleton className={LOADING_TEXT} />
      </TaskWorkChrome>
    );
  }

  if (
    task.status === "completed" &&
    !isAppraisal &&
    !isFieldInspection
  ) {
    return (
      <TaskWorkChrome
        layout={layout}
        title={`${def.completeTitle} — ${deedLabel}`}
        subtitle={`${def.assigneeSubtitle} · ${formatPoDisplay(task.poNumber)}`}
        deedBadge={deedLabel}
        onClose={exit}
        onSave={exit}
        saveLabel="رجوع"
        variant="detail"
        showFooter={false}
      >
        <TaskCompletionSuccess
          title={def.completeTitle}
          message={def.completeMessage}
        />
      </TaskWorkChrome>
    );
  }

  if (isAppraisal) {
    const property = record?.properties.find((p) => p.id === task.propertyId);
    const assignedRaw = task.createdAt || record?.receivedFromEnfathAt || "";
    let assignedLabel = "—";
    if (assignedRaw) {
      const d = new Date(assignedRaw);
      if (!Number.isNaN(d.getTime())) {
        const y = d.getFullYear();
        const m = String(d.getMonth() + 1).padStart(2, "0");
        const day = String(d.getDate()).padStart(2, "0");
        assignedLabel = `${y}/${m}/${day}`;
      }
    }
    const cityDistrict = property
      ? [property.city, property.district].filter(Boolean).join(" — ") || "—"
      : location !== "—"
        ? location.replace(" · ", " — ")
        : "—";
    const classification =
      property?.propertyType?.trim() ||
      property?.classification?.trim() ||
      "—";
    const surveyTaskId =
      findSiblingSurveyTask(task, allWorkflowTasks)?.id ?? null;
    const inspectionTaskId =
      task.fieldInspectionTaskId?.trim() ||
      findSiblingInspectionTask(task, allWorkflowTasks)?.id ||
      null;
    const showDecree = record
      ? requiresAssignmentDecree(record.assignmentType)
      : false;

    const propertyIndex = record && property
      ? record.properties.findIndex((p) => p.id === property.id)
      : -1;
    const appraisalWork = appraisalExtensions ? (
      appraisalExtensions.renderAppraisalWork({
        def,
        childTask: task,
        hostRef: evaluatorHostRef,
        deedLabel,
        onBack: exit,
        embeddedInPropertyChrome: layout === "page" && Boolean(record && property),
        propertySummary: {
          deedNumber: deedLabel,
          poNumber: formatPoDisplay(task.poNumber),
          classification,
          cityDistrict,
          assignedAt: assignedLabel,
          inspectionDone: false,
          property: property ?? null,
          showDecree,
          surveyTaskId,
          inspectionTaskId,
          appraisalTaskId: task.id,
        },
      })
    ) : (
      <InlineLoadingSkeleton className={LOADING_TEXT} />
    );

    if (layout === "page" && record && property && propertyIndex >= 0) {
      return (
        <div
          id="view-property-appraisal-workspace"
          className="flex min-h-0 w-full flex-1 flex-col overflow-hidden bg-[#f5f3ee]"
        >
          <PageShell
            variant="canvas"
            className="gap-0 overflow-x-hidden overflow-y-auto bg-[#f5f3ee] px-[30px] py-[26px] max-sm:px-4 max-sm:py-4"
          >
            <PropertyDetailHero
              record={record}
              property={property}
              propertyIndex={propertyIndex + 1}
              hideOpenCaseStudy
            />
            <div className="min-w-0 overflow-hidden rounded-[12px] border border-border bg-surface px-5 pb-5 shadow-[0_1px_2px_rgba(18,40,76,0.03),0_6px_16px_-18px_rgba(18,40,76,0.10)]">
              {appraisalWork}
            </div>
          </PageShell>
        </div>
      );
    }

    return (
      <TaskWorkChrome
        layout={layout}
        title="المقيم العقاري — نافذة التقييم"
        saving={saving}
        onClose={exit}
        onSave={exit}
        saveLabel="رجوع"
        showHeader={false}
        showFooter={false}
        scrollMode="document"
      >
        {appraisalWork}
      </TaskWorkChrome>
    );
  }

  if (isFieldInspection) {
    const inspectionReadOnly = fieldInspectionLocked || submitSuccess;
    const inspectorCard: PropertyDetailPartyCard = {
      roleKey: "inspection",
      role: "المعاين",
      name: task.assigneeName?.trim() || def.assigneeSubtitle || "المعاين",
      unassigned: false,
      state: inspectionReadOnly ? "done" : "progress",
      enabled: true,
    };

    return (
      <>
        <div className="hidden min-h-0 w-full flex-1 flex-col lg:flex">
          <TaskWorkChrome
            layout={layout}
            title={`${def.workTitle} — ${deedLabel}`}
            subtitle={`${def.assigneeSubtitle} · ${formatPoDisplay(task.poNumber)} · ${location}`}
            deedBadge={deedLabel}
            saving={saving}
            onClose={exit}
            onSave={exit}
            saveLabel={inspectionReadOnly ? "رجوع" : def.saveLabel}
            showFooter={false}
          >
            {/* Case Study.html pdInspectionHtml — same surface as property-detail edit */}
            <div className="mx-auto max-w-[920px]">
              {surveyProperty ? (
                <PropertyDetailInspectionTab
                  property={surveyProperty}
                  inspectionTask={task}
                  inspectionCard={inspectorCard}
                  editMode={!inspectionReadOnly}
                  lockEditMode={!inspectionReadOnly}
                  onEditModeChange={(edit) => {
                    if (!edit) exit();
                  }}
                  onSubmitted={() =>
                    completePartyTaskSubmit(def.completeMessage, {
                      showToast: false,
                    })
                  }
                />
              ) : (
                <InlineLoadingSkeleton className={LOADING_TEXT} />
              )}
              <div>
                <PartyTaskFailureRaise
                  def={def}
                  task={task}
                  deedNumber={deedLabel}
                  onSubmitted={refresh}
                />
              </div>
            </div>
          </TaskWorkChrome>
        </div>
        <div className="flex h-full min-h-0 w-full flex-1 flex-col overflow-hidden lg:hidden">
          <FieldInspectionMobileShell
            def={def}
            task={task}
            hostRef={fieldInspectionHostRef}
            deedLabel={deedLabel}
            locationLabel={location}
            submitting={saving}
            onClose={exit}
            onFailureSubmitted={refresh}
          />
        </div>
      </>
    );
  }

  return (
    <TaskWorkChrome
      layout={layout}
      title={`${def.workTitle} — ${deedLabel}`}
      subtitle={`${def.assigneeSubtitle} · ${formatPoDisplay(task.poNumber)} · ${location}`}
      deedBadge={deedLabel}
      saving={saving}
      onClose={exit}
      onSave={submitWork}
      saveLabel={def.saveLabel}
    >
      <PartyWorkTabs
        workTab={workTab}
        workTitle={def.workTitle}
        onSelect={setWorkTab}
      />

      {workTab === "task" ? (
        <>
          <Note tone="info">{def.workIntro}</Note>
          <PartyTaskFailureRaise
            def={def}
            task={task}
            deedNumber={deedLabel}
            onSubmitted={refresh}
          />
        </>
      ) : (
        <PartyCaseStudyFormTab def={def} childTask={task} />
      )}
    </TaskWorkChrome>
  );
}
