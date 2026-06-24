"use client";

import {
  useCallback,
  useMemo,
  useRef,
  useState,
  useEffect,
  type ReactNode,
  type RefObject,
} from "react";
import { useRouter } from "next/navigation";
import { PartyCaseStudyFormTab } from "../components/case-study/PartyCaseStudyFormTab";
import { PropertyDetailHero } from "../components/po-intake/PropertyDetailHero";
import {
  GovernmentReviewWorkBody,
  type GovernmentReviewWorkHostRef,
} from "../components/government-review/GovernmentReviewWorkBody";
import { TaskWorkChrome } from "../components/primary-data/TaskWorkChrome";
import {
  ValuationCoordinationWorkBody,
  type ValuationCoordinationWorkHostRef,
} from "../components/valuation-coordination/ValuationCoordinationWorkBody";
import {
  FieldInspectionWorkPanel,
} from "../components/field-inspection/FieldInspectionWorkPanel";
import {
  FieldInspectionWorkBody,
  type FieldInspectionWorkHostRef,
} from "../components/field-inspection/FieldInspectionWorkBody";
import { useFieldInspectionWorkspacesQuery } from "../query/field-inspection-workspaces-queries";
import { isFieldInspectionLocked } from "../lib/prototype/field-inspection-work-queue";
import { RegistrationFormCard } from "@platform/app-shared/registration/RegistrationFormCard";
import { isGovernmentReviewLocked } from "../lib/prototype/government-review-work-queue";
import { isValuationCoordinationLocked } from "../lib/prototype/valuation-coordination-work-queue";
import type { PartyTaskPageDef } from "@platform/app-shared/prototype/party-task-pages";
import { partyTaskPath } from "../lib/my-task-routes";
import {
  formatPoDisplay,
  formatPropertyDeedDisplay,
} from "../lib/prototype/po-intake-data";
import {
  completeChildTask,
  taskDisplayPropertyLabel,
  type WorkflowTask,
} from "../lib/prototype/tasks-storage";
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
} from "@platform/design-system";
import { FailureRaisePanel } from "@failures/mfe";
import { failureRaiserRoleForParty } from "@failures/mfe/lib/failure-party-roles";
import { setSurveyWorkTopbarState } from "@platform/app-shared/prototype/survey-work-topbar-bridge";
import { usePoRecordQuery } from "../query/case-study-queries";

const PARTY_FAILURE_RAISE_KINDS = new Set([
  "field-inspection",
  "property-appraisal",
  "government-review",
  "engineering-survey",
]);

const LOADING_TEXT = "text-xs text-text-3";
const PAGE_WRAP =
  "flex min-h-0 w-full flex-1 flex-col overflow-hidden bg-bg";
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
}: {
  def: PartyTaskPageDef;
  task: WorkflowTask;
  hostRef: PartyActiveTaskWorkHostRefObject;
  layout?: "page" | "panel";
  appraisalExtensions?: PartyAppraisalExtensions;
  engineeringSurveyExtensions?: PartyEngineeringSurveyExtensions;
}) {
  const router = useRouter();
  const { showToast } = useToast();

  const exit = () => {
    if (hostRef.current?.onClose) {
      hostRef.current.onClose();
      return;
    }
    router.push(partyTaskPath(def.pageId));
  };

  const refresh = () => {
    hostRef.current?.onRefresh?.();
  };

  const completePartyTaskSubmit = useCallback(
    (toastMessage: string = def.completeMessage) => {
      showToast(toastMessage, "success");
      setSubmitSuccess(true);
      refresh();
      if (layout === "panel") {
        window.setTimeout(() => exit(), 1800);
      }
    },
    [def.completeMessage, layout, showToast],
  );

  const APPRAISAL_SUCCESS_MESSAGE =
    "تم إرسال التقييم وإجابات الاستدلال لأخصائي دراسة الحالة.";

  const { data: record, isPending: recordLoading } = usePoRecordQuery(
    task.poNumber,
  );
  const [saving, setSaving] = useState(false);
  const [submitSuccess, setSubmitSuccess] = useState(false);
  const [workTab, setWorkTab] = useState<"task" | "case-study">("task");

  const isAppraisal = def.kind === "property-appraisal";
  const isEngineeringSurvey = def.kind === "engineering-survey";
  const isFieldInspection = def.kind === "field-inspection";
  const isGovernmentReview = def.kind === "government-review";
  const isValuationCoordination = def.kind === "valuation-coordination";
  const usesStructuredWorkForm =
    isGovernmentReview || isValuationCoordination;

  const evaluatorHostRef = useRef<PartyEvaluatorWorkHostRef>({});
  const surveyHostRef = useRef<PartyEngineeringSurveyWorkHostRef>({});
  const governmentHostRef = useRef<GovernmentReviewWorkHostRef>({});
  const coordinationHostRef = useRef<ValuationCoordinationWorkHostRef>({});
  const fieldInspectionHostRef = useRef<FieldInspectionWorkHostRef>({});
  evaluatorHostRef.current.onSubmitted = () =>
    completePartyTaskSubmit(APPRAISAL_SUCCESS_MESSAGE);
  evaluatorHostRef.current.onSavingChange = setSaving;
  surveyHostRef.current.onSubmitted = () => completePartyTaskSubmit();
  surveyHostRef.current.onSavingChange = setSaving;
  governmentHostRef.current.onSubmitted = () => completePartyTaskSubmit();
  governmentHostRef.current.onSavingChange = setSaving;
  coordinationHostRef.current.onSubmitted = () => completePartyTaskSubmit();
  coordinationHostRef.current.onSavingChange = setSaving;
  fieldInspectionHostRef.current.onSubmitted = () => completePartyTaskSubmit();
  fieldInspectionHostRef.current.onSavingChange = setSaving;

  const evaluatorLocked = useMemo(() => {
    if (!appraisalExtensions) return false;
    return appraisalExtensions.isEvaluatorLocked(task.id, saving);
  }, [appraisalExtensions, task.id, saving]);

  const surveyLocked = useMemo(() => {
    if (!engineeringSurveyExtensions) return false;
    return engineeringSurveyExtensions.isSurveyLocked(task.id, saving);
  }, [engineeringSurveyExtensions, task.id, saving]);

  const governmentLocked = useMemo(
    () => isGovernmentReviewLocked(task.id, task.status),
    [task.id, task.status],
  );

  const coordinationLocked = useMemo(
    () => isValuationCoordinationLocked(task.id),
    [task.id],
  );

  const isFieldInspectionPage = def.pageId === "property-inspection";
  const { data: inspectionWorkspaces = [] } = useFieldInspectionWorkspacesQuery(
    isFieldInspectionPage,
  );
  const fieldInspectionWorkspace = useMemo(
    () =>
      inspectionWorkspaces.find((w) => w.workflowTaskId === task.id) ?? null,
    [inspectionWorkspaces, task.id],
  );

  const fieldInspectionLocked = useMemo(
    () => isFieldInspectionLocked(task.id, fieldInspectionWorkspace),
    [task.id, fieldInspectionWorkspace],
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

  async function runHostSubmit(
    locked: boolean,
    submitHostRef: RefObject<{ submit?: () => Promise<boolean> } | null>,
  ) {
    if (locked) {
      exit();
      return;
    }
    setSaving(true);
    await submitHostRef.current?.submit?.();
    setSaving(false);
  }

  async function submitStructuredWork(
    locked: boolean,
    submitHostRef: RefObject<{ submit?: () => Promise<boolean> } | null>,
  ) {
    await runHostSubmit(locked, submitHostRef);
  }

  async function submitGovernmentReview() {
    await submitStructuredWork(governmentLocked, governmentHostRef);
  }

  async function submitValuationCoordination() {
    await submitStructuredWork(coordinationLocked, coordinationHostRef);
  }

  async function submitWork() {
    setSaving(true);
    const updated = await completeChildTask(task.id);
    setSaving(false);
    if (updated) {
      completePartyTaskSubmit();
    }
  }

  async function submitAppraisal() {
    await runHostSubmit(evaluatorLocked, evaluatorHostRef);
  }

  async function submitSurvey() {
    await runHostSubmit(surveyLocked, surveyHostRef);
  }

  async function submitFieldInspection() {
    await runHostSubmit(fieldInspectionLocked, fieldInspectionHostRef);
  }

  const surveyProperty = useMemo(
    () => record?.properties.find((p) => p.id === task.propertyId) ?? null,
    [record, task.propertyId],
  );
  const surveyPropertyIndex = useMemo(() => {
    if (!record || !surveyProperty) return -1;
    return record.properties.findIndex((p) => p.id === surveyProperty.id);
  }, [record, surveyProperty]);

  useEffect(() => {
    if (!isEngineeringSurvey || !record || !surveyProperty || surveyLocked) {
      setSurveyWorkTopbarState(null);
      return;
    }
    setSurveyWorkTopbarState({
      saving,
      saveLabel: def.saveLabel,
      onSave: () => {
        void submitSurvey();
      },
    });
    return () => setSurveyWorkTopbarState(null);
  }, [
    isEngineeringSurvey,
    record,
    surveyProperty,
    saving,
    surveyLocked,
    def.saveLabel,
  ]);

  function renderPropertyTaskShell(body: ReactNode) {
    if (recordLoading && !record) {
      return (
        <div className={PAGE_WRAP}>
          <PanelSkeleton />
        </div>
      );
    }

    if (!record || !surveyProperty || surveyPropertyIndex < 0) {
      return (
        <div className={PAGE_WRAP}>
          <Note tone="warn" className="m-6">
            لم تُعثر على بيانات العقار.
          </Note>
        </div>
      );
    }

    return (
      <div className={PAGE_WRAP}>
        <PageShell>
          <PropertyDetailHero
            record={record}
            property={surveyProperty}
            propertyIndex={surveyPropertyIndex + 1}
          />
          {body}
        </PageShell>
      </div>
    );
  }

  function renderSurveyPropertyShell(body: ReactNode) {
    return renderPropertyTaskShell(body);
  }

  if (isFieldInspection && layout === "page") {
    if (task.status === "completed" || submitSuccess) {
      return renderPropertyTaskShell(
        <div className="flex min-h-0 flex-1 flex-col overflow-hidden">
          <div className={TAB_CONTENT}>
            <RegistrationFormCard title={submitSuccess ? "تم الإرسال" : def.completeTitle}>
              <Note tone="success">{def.completeMessage}</Note>
            </RegistrationFormCard>
          </div>
        </div>,
      );
    }

    return renderPropertyTaskShell(
      record && surveyProperty ? (
        <FieldInspectionWorkPanel
          def={def}
          task={task}
          hostRef={fieldInspectionHostRef}
          record={record}
          property={surveyProperty}
          deedNumber={deedLabel}
          submitting={saving}
          onFailureSubmitted={refresh}
        />
      ) : (
        <InlineLoadingSkeleton className={LOADING_TEXT} />
      ),
    );
  }

  if (isEngineeringSurvey) {
    if (task.status === "completed" || submitSuccess) {
      return renderSurveyPropertyShell(
        <div className="flex min-h-0 flex-1 flex-col overflow-hidden">
          <div className={TAB_CONTENT}>
            <Note tone="success">{def.completeMessage}</Note>
          </div>
        </div>,
      );
    }

    return renderSurveyPropertyShell(
      engineeringSurveyExtensions ? (
        engineeringSurveyExtensions.renderSurveyWork({
          def,
          childTask: task,
          hostRef: surveyHostRef,
          deedNumber: deedLabel,
          onFailureSubmitted: refresh,
        })
      ) : (
        <InlineLoadingSkeleton className={LOADING_TEXT} />
      ),
    );
  }

  if (recordLoading && !record) {
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

  if (task.status === "completed") {
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
        <RegistrationFormCard title={def.completeTitle}>
          <Note tone="success">{def.completeMessage}</Note>
        </RegistrationFormCard>
      </TaskWorkChrome>
    );
  }

  if (isAppraisal) {
    if (submitSuccess) {
      return (
        <TaskWorkChrome
          layout={layout}
          title={`رفع التقييم — ${deedLabel}`}
          subtitle={`${def.assigneeSubtitle} · ${formatPoDisplay(task.poNumber)} · ${location}`}
          deedBadge={deedLabel}
          onClose={exit}
          onSave={exit}
          saveLabel="رجوع للقائمة"
          showFooter
        >
          <RegistrationFormCard title="تم الإرسال">
            <Note tone="success">
              تم إرسال التقييم وإجابات الاستدلال لأخصائي دراسة الحالة.
            </Note>
          </RegistrationFormCard>
        </TaskWorkChrome>
      );
    }

    return (
      <TaskWorkChrome
        layout={layout}
        title={`رفع التقييم — ${deedLabel}`}
        subtitle={`${def.assigneeSubtitle} · ${formatPoDisplay(task.poNumber)} · ${location}`}
        deedBadge={deedLabel}
        saving={saving}
        onClose={exit}
        onSave={submitAppraisal}
        saveLabel={
          evaluatorLocked ? "رجوع" : "إرسال للأخصائي"
        }
        showFooter
      >
        {appraisalExtensions ? (
          appraisalExtensions.renderAppraisalWork({
            def,
            childTask: task,
            hostRef: evaluatorHostRef,
          })
        ) : (
          <InlineLoadingSkeleton className={LOADING_TEXT} />
        )}
        <PartyTaskFailureRaise
          def={def}
          task={task}
          deedNumber={deedLabel}
          onSubmitted={refresh}
        />
      </TaskWorkChrome>
    );
  }

  if (isFieldInspection) {
    if (submitSuccess) {
      return (
        <TaskWorkChrome
          layout={layout}
          title={`${def.workTitle} — ${deedLabel}`}
          subtitle={`${def.assigneeSubtitle} · ${formatPoDisplay(task.poNumber)} · ${location}`}
          deedBadge={deedLabel}
          onClose={exit}
          onSave={exit}
          saveLabel="رجوع للقائمة"
          showFooter
        >
          <RegistrationFormCard title="تم الإرسال">
            <Note tone="success">{def.completeMessage}</Note>
          </RegistrationFormCard>
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
        onSave={submitFieldInspection}
        saveLabel={fieldInspectionLocked ? "رجوع" : def.saveLabel}
        showFooter={false}
        scrollMode="viewport"
      >
        <Note tone="info" className="mb-4">
          {def.workIntro}
        </Note>
        <FieldInspectionWorkBody
          def={def}
          task={task}
          hostRef={fieldInspectionHostRef}
          submitting={saving}
          beforeSubmitFooter={
            <div id="inspector-failure-raise" className="scroll-mt-4">
              <PartyTaskFailureRaise
                def={def}
                task={task}
                deedNumber={deedLabel}
                onSubmitted={refresh}
              />
            </div>
          }
        />
      </TaskWorkChrome>
    );
  }

  if (usesStructuredWorkForm) {
    const locked = isGovernmentReview ? governmentLocked : coordinationLocked;
    const onSave = isGovernmentReview
      ? submitGovernmentReview
      : submitValuationCoordination;

    if (submitSuccess) {
      return (
        <TaskWorkChrome
          layout={layout}
          title={`${def.workTitle} — ${deedLabel}`}
          subtitle={`${def.assigneeSubtitle} · ${formatPoDisplay(task.poNumber)} · ${location}`}
          deedBadge={deedLabel}
          onClose={exit}
          onSave={exit}
          saveLabel="رجوع للقائمة"
          showFooter
        >
          <RegistrationFormCard title="تم الإرسال">
            <Note tone="success">{def.completeMessage}</Note>
          </RegistrationFormCard>
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
        onSave={onSave}
        saveLabel={locked ? "رجوع" : def.saveLabel}
        showFooter
      >
        <PartyWorkTabs
          workTab={workTab}
          workTitle={def.workTitle}
          onSelect={setWorkTab}
        />

        {workTab === "task" ? (
          <>
            <Note tone="info">{def.workIntro}</Note>
            {isGovernmentReview ? (
              <GovernmentReviewWorkBody
                def={def}
                task={task}
                hostRef={governmentHostRef}
              />
            ) : (
              <ValuationCoordinationWorkBody
                def={def}
                task={task}
                hostRef={coordinationHostRef}
              />
            )}
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
