"use client";

import {
  Activity,
  useCallback,
  useInsertionEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import { useRouter } from "next/navigation";
import { TaskCompletionSuccess } from "../components/party-tasks/TaskCompletionSuccess";
import { PartyTaskSubmitDialog, type PartyTaskSubmitState } from "./PartyTaskSubmitDialog";
import { PartyTaskFailureRaise, PartyWorkTabs } from "./PartyActiveTaskWorkTabs";
import { TaskWorkChrome } from "../components/primary-data/TaskWorkChrome";
import { FieldInspectionMobileShell } from "../components/field-inspection/FieldInspectionMobileShell";
import {
  type FieldInspectionWorkHostRef,
} from "../components/field-inspection/FieldInspectionWorkBody";
import { PartyCaseStudyReportTab } from "../components/case-study/PartyCaseStudyReportTab";
import { PropertyDetailInspectionTab } from "../components/po-intake/PropertyDetailInspectionTab";
import type { PropertyDetailPartyCard } from "../lib/app-data/property-detail-parties";
import { useFieldInspectionWorkspacesQuery } from "../query/field-inspection-workspaces-queries";
import { isFieldInspectionLocked } from "../lib/app-data/field-inspection-work-queue";
import type { PartyTaskPageDef } from "@platform/app-shared/app-data/party-task-pages";
import { partyTaskPath } from "../lib/my-task-routes";
import {
  formatPoDisplay,
  formatPropertyDeedDisplay,
  requiresAssignmentDecree,
} from "../lib/app-data/po-intake-data";
import {
  completeChildTask,
  taskDisplayPropertyLabel,
  type WorkflowTask,
} from "../lib/app-data/tasks";
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
  InlineLoadingSkeleton,
  Note,
  PageShell,
  PanelSkeleton,
  opsContentPanel,
  useSwapAnimation,
  useToast,
} from "@platform/ui-kit";
import { PropertyDetailHero } from "../components/po-intake/PropertyDetailHero";
import { PropertyTransactionTimeline } from "../components/po-intake/PropertyTransactionTimeline";

const LOADING_TEXT = "text-xs text-text-3";
const TAB_CONTENT = "min-w-0 flex-1 overflow-y-auto px-4 py-4 sm:p-5";

/** The injected work forms as elements, so their host refs are passed as props, not into a call during render. */
function SurveyWorkSlot({
  extensions,
  ...work
}: Parameters<PartyEngineeringSurveyExtensions["renderSurveyWork"]>[0] & {
  extensions: PartyEngineeringSurveyExtensions;
}) {
  return extensions.renderSurveyWork(work);
}

function AppraisalWorkSlot({
  extensions,
  ...work
}: Parameters<PartyAppraisalExtensions["renderAppraisalWork"]>[0] & {
  extensions: PartyAppraisalExtensions;
}) {
  return extensions.renderAppraisalWork(work);
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

  const [submitSuccess, setSubmitSuccess] = useState(false);

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
  const [workTab, setWorkTab] = useState<"task" | "case-study">("task");
  // The case-study tab stays mounted once opened, so coming back skips its reload skeleton.
  const [caseStudyTabOpened, setCaseStudyTabOpened] = useState(false);
  if (workTab === "case-study" && !caseStudyTabOpened) setCaseStudyTabOpened(true);
  const workTabPanelRef = useRef<HTMLDivElement>(null);
  useSwapAnimation(workTabPanelRef, workTab);

  const isAppraisal = def.kind === "property-appraisal";
  const isEngineeringSurvey = def.kind === "engineering-survey";
  const isFieldInspection = def.kind === "field-inspection";

  const evaluatorHostRef = useRef<PartyEvaluatorWorkHostRef>({});
  const surveyHostRef = useRef<PartyEngineeringSurveyWorkHostRef>({});
  const fieldInspectionHostRef = useRef<FieldInspectionWorkHostRef>({});

  // The sending dialog of the inspector and the appraiser.
  // States: idle (hidden) → sending (spinner, cannot be dismissed) → sent / queued (result text + one button back
  // to the queue). The work forms drive it through the host callbacks wired below: `onSubmitStarted` once their own
  // checks passed, then exactly one of `onSubmitted`, `onSubmitQueued` (inspector, offline) or `onSubmitFailed`.
  // A failure returns to idle: the reason is already on screen as a toast and the form stays editable.
  // The old behaviour (a success toast, a read-only form for 900 ms, then a redirect) showed half-finished screens.
  const [submitState, setSubmitState] = useState<PartyTaskSubmitState>("idle");
  const sendingHost = {
    onSubmitStarted: () => setSubmitState("sending"),
    onSubmitFailed: () => setSubmitState("idle"),
  };
  const sentHost = () => {
    setSubmitState("sent");
    refresh();
  };
  // Wired after every render (as useLatestRef does), not during it; the work forms keep their
  // own fields (e.g. `submit`) on the same host objects.
  useInsertionEffect(() => {
    evaluatorHostRef.current.onSubmitted = sentHost;
    evaluatorHostRef.current.onSubmitStarted = sendingHost.onSubmitStarted;
    evaluatorHostRef.current.onSubmitFailed = sendingHost.onSubmitFailed;
    evaluatorHostRef.current.onSavingChange = setSaving;
    // Engineering survey form does not toast on success — show completeMessage here.
    surveyHostRef.current.onSubmitted = () =>
      completePartyTaskSubmit(def.completeMessage, { showToast: true });
    surveyHostRef.current.onSavingChange = setSaving;
    fieldInspectionHostRef.current.onSubmitted = sentHost;
    fieldInspectionHostRef.current.onSubmitStarted = sendingHost.onSubmitStarted;
    fieldInspectionHostRef.current.onSubmitFailed = sendingHost.onSubmitFailed;
    // Offline: the inspection is saved on the device and sent when the connection is back — the dialog says so.
    fieldInspectionHostRef.current.onSubmitQueued = () => {
      setSubmitState("queued");
      refresh();
    };
    fieldInspectionHostRef.current.onSavingChange = setSaving;
  });
  const submitDialog = (
    <PartyTaskSubmitDialog
      state={submitState}
      sendingText={isAppraisal ? "جاري اعتماد التقييم وإرساله للأخصائي…" : "جاري إرسال المعاينة…"}
      sentText={
        isAppraisal
          ? "تم اعتماد التقييم وإرساله لأخصائي دراسة الحالة."
          : "تم حفظ بيانات المعاينة وإرسالها."
      }
      onBack={exit}
    />
  );

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

    const inspectionForm =
      surveyProperty ? (
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
          steps
          caseStudyDef={def}
        />
      ) : (
        <InlineLoadingSkeleton className={LOADING_TEXT} />
      );

    const desktopStandalone =
      record && surveyProperty && surveyPropertyIndex >= 0 ? (
        <div
          id="view-active-inspection-workspace"
          className="flex h-full min-h-0 w-full flex-1 flex-col overflow-hidden bg-bg"
        >
          {/* Own scrollport — #content is overflow-hidden for this route; PageShell canvas uses h-fit. */}
          <div className="min-h-0 flex-1 overflow-x-hidden overflow-y-auto px-[30px] py-[26px] max-sm:px-4 max-sm:py-4">
            <PropertyDetailHero
              record={record}
              property={surveyProperty}
              propertyIndex={surveyPropertyIndex + 1}
              hideOpenCaseStudy
              stickyCompact
            />
            <div className="mt-3.5 grid grid-cols-1 items-start gap-3.5 pb-8 lg:grid-cols-[minmax(0,1fr)_252px]">
              <div className={opsContentPanel}>
                {inspectionForm}
              </div>
              <PropertyTransactionTimeline
                record={record}
                property={surveyProperty}
              />
            </div>
          </div>
        </div>
      ) : recordLoading && !record ? (
        <div className="flex h-full min-h-0 w-full flex-1 flex-col overflow-hidden bg-bg">
          <PanelSkeleton />
        </div>
      ) : (
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
          <div className="mx-auto max-w-[920px]">{inspectionForm}</div>
        </TaskWorkChrome>
      );

    return (
      <>
        {submitDialog}
        <div className="hidden h-full min-h-0 w-full flex-1 flex-col overflow-hidden lg:flex">
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
      <SurveyWorkSlot
        extensions={engineeringSurveyExtensions}
        def={def}
        childTask={task}
        hostRef={surveyHostRef}
        deedNumber={deedLabel}
        onBack={exit}
        onFailureSubmitted={refresh}
        variant={engineeringSurveyEntry ? "entry" : "workspace"}
        forceReadOnly={surveyLocked}
      />
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
          className="flex min-h-0 w-full flex-1 flex-col overflow-hidden bg-bg"
        >
          <PageShell
            variant="canvas"
            className="gap-0 overflow-x-hidden overflow-y-auto bg-bg px-[30px] py-[26px] max-sm:px-4 max-sm:py-4"
          >
            <PropertyDetailHero
              record={record}
              property={surveyProperty}
              propertyIndex={surveyPropertyIndex + 1}
              hideOpenCaseStudy
            />
            <div className="grid min-h-0 flex-1 grid-cols-1 items-start gap-3.5 lg:grid-cols-[minmax(0,1fr)_250px]">
              {/* The survey panel draws its own card; a second bordered panel here showed as
                  a double edge line down both sides of the workspace. */}
              <div className="min-w-0">
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
        <div className="flex min-h-0 w-full flex-1 flex-col overflow-hidden bg-bg">
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
      <AppraisalWorkSlot
        extensions={appraisalExtensions}
        def={def}
        childTask={task}
        hostRef={evaluatorHostRef}
        deedLabel={deedLabel}
        onBack={exit}
        embeddedInPropertyChrome={layout === "page" && Boolean(record && property)}
        propertySummary={{
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
        }}
      />
    ) : (
      <InlineLoadingSkeleton className={LOADING_TEXT} />
    );

    if (layout === "page" && record && property && propertyIndex >= 0) {
      return (
        <div
          id="view-property-appraisal-workspace"
          className="flex min-h-0 w-full flex-1 flex-col overflow-hidden bg-bg"
        >
          <PageShell
            variant="canvas"
            className="gap-0 overflow-x-hidden overflow-y-auto bg-bg px-[30px] py-[26px] max-sm:px-4 max-sm:py-4"
          >
            <PropertyDetailHero
              record={record}
              property={property}
              propertyIndex={propertyIndex + 1}
              hideOpenCaseStudy
            />
            <div className="grid min-h-0 flex-1 grid-cols-1 items-start gap-3.5 lg:grid-cols-[minmax(0,1fr)_250px]">
              <div className={opsContentPanel}>
                {submitDialog}
                {appraisalWork}
              </div>
              <PropertyTransactionTimeline
                record={record}
                property={property}
              />
            </div>
          </PageShell>
        </div>
      );
    }

    return (
      <TaskWorkChrome
        layout={layout}
        title="المقيّم العقاري — نافذة التقييم"
        saving={saving}
        onClose={exit}
        onSave={exit}
        saveLabel="رجوع"
        showHeader={false}
        showFooter={false}
        scrollMode="document"
      >
        {submitDialog}
        {appraisalWork}
      </TaskWorkChrome>
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

      <div ref={workTabPanelRef}>
        <Activity mode={workTab === "task" ? "visible" : "hidden"}>
          <Note tone="info">{def.workIntro}</Note>
          <PartyTaskFailureRaise
            def={def}
            task={task}
            deedNumber={deedLabel}
            onSubmitted={refresh}
          />
        </Activity>
        {caseStudyTabOpened ? (
          <Activity mode={workTab === "case-study" ? "visible" : "hidden"}>
            <PartyCaseStudyReportTab def={def} childTask={task} />
          </Activity>
        ) : null}
      </div>
    </TaskWorkChrome>
  );
}
