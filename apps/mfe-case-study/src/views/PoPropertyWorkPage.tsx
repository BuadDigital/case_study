"use client";

/**
 * Work page — one vertical page per transaction for its input and its actions, with the numbered
 * sections on a rail (plan 2026-11-05, phase 2). Omar 2026-11-08: it keeps every section — the
 * coordination ones (intake, the parties' follow-up) first, from the same code as the coordinator's
 * page (`useCoordinationSections`), then the study (deed match and components, the study report),
 * then review (valuation, draft, deposit), then the upload — because the study and the review study
 * every detail and edit the data at the same level. The coordinator's page shows coordination's share
 * only and closes with «إرسال المعاملة للدراسة». The property details page stays the reference.
 */
import { useEffect, useMemo, type ReactNode } from "react";
import { useRouter } from "next/navigation";
import { Button, Note, PageShell, WorkSectionsLayout, useWorkSections } from "@platform/ui-kit";
import { useAppAccess } from "@platform/app-shared/contexts/AppAccessContext";
import { CASE_STUDY_WORKSPACE_OPEN_APPRAISAL_EVENT } from "@platform/app-shared/events/app-events";
import {
  poPropertyCoordinationPath,
  poPropertyDetailPath,
} from "@platform/app-shared/domain/po-routes";
import { getReportDraftState } from "@platform/app-shared/workflow/report-draft-state";
import { useReportDraftStates } from "@platform/app-shared/workflow/use-report-draft-states";
import { CaseStudyReportEditor } from "../components/case-study/CaseStudyReportEditor";
import { CaseStudyAppraisalDeedsPanel } from "../components/case-study/CaseStudyAppraisalDeedsPanel";
import { CaseStudyValuationPanel } from "../components/case-study/CaseStudyValuationPanel";
import { PropertyDetailHero } from "../components/po-intake/PropertyDetailHero";
import { TransactionCancellationBanner } from "../components/po-intake/TransactionCancellationBanner";
import { caseStudyReportDeeds } from "../lib/app-data/case-study-report-document-model";
import { transactionProgress } from "../lib/app-data/my-work-model";
import type {
  PoIntakeRecord,
  PoPropertyIntake,
} from "../lib/app-data/po-intake-data";
import {
  canReviewTransaction,
  canHandOverToEnfaz,
} from "../lib/app-data/po-roles";
import {
  COORDINATION_SECTIONS,
  type CoordinationSectionId,
} from "../lib/app-data/coordination-page-model";
import {
  caseStudyTaskForProperty,
  type WorkflowTask,
} from "../lib/app-data/tasks";
import {
  WORK_PAGE_FIRST_STEP,
  WORK_SECTIONS,
  reviewLockOf,
  workPageStep,
  type WorkSectionId,
} from "../lib/app-data/work-page-model";
import { useWorkflowTasksQuery } from "../query/case-study-queries";
import { useTransactionQuery } from "../query/use-transaction-query";
import { PoPropertyRouteGate } from "./PoPropertyRouteGate";
import { CoordinationIntakeBanner, IntakeScope } from "./CoordinationIntake";
import { useCoordinationSections, useSurveyTask } from "./useCoordinationSections";
import { WorkPhotosSection } from "./WorkPhotosSection";
import { WorkUploadSection } from "./WorkUploadSection";

const EMPTY_TASKS: WorkflowTask[] = [];
const COORDINATION_IDS = new Set<string>(COORDINATION_SECTIONS.map((s) => s.id));

function WorkPageBody({
  record,
  property,
  index,
}: {
  record: PoIntakeRecord;
  property: PoPropertyIntake;
  index: number;
}) {
  const router = useRouter();
  const { access } = useAppAccess();
  const tasksQuery = useWorkflowTasksQuery();
  const tasks = tasksQuery.data ?? EMPTY_TASKS;
  const { data: transaction } = useTransactionQuery(property.id);

  const task =
    caseStudyTaskForProperty(record.poNumber, property.id, tasks) ?? null;
  // One study per transaction: a deed folded into another deed's study works on the holder's task.
  const studyTask = useMemo(() => {
    const holderId = transaction?.studyHolderTaskId?.trim();
    return (
      (holderId ? tasks.find((t) => t.id === holderId) : undefined) ?? task
    );
  }, [transaction?.studyHolderTaskId, tasks, task]);

  const draftVersion = useReportDraftStates(
    [property.id],
    Boolean(studyTask?.studyReportIssued),
  );
  const { step, progress, reviewLock } = useMemo(() => {
    void draftVersion;
    return {
      step: workPageStep(studyTask, tasks, getReportDraftState),
      progress: studyTask
        ? transactionProgress(studyTask, tasks, getReportDraftState)
        : null,
      reviewLock: reviewLockOf(studyTask, getReportDraftState(property.id)),
    };
  }, [studyTask, tasks, draftVersion, property.id]);

  const surveyTask = useSurveyTask(studyTask, tasks);
  const sections = useMemo(
    () => WORK_SECTIONS.filter((s) => s.id !== "survey" || Boolean(surveyTask)),
    [surveyTask],
  );
  const state = useWorkSections<WorkSectionId>({
    sections,
    step,
    ready: tasksQuery.isFetched,
  });
  const { openSection } = state;
  // Omar 2026-11-09: once coordination accepted the inspection, section 4
  // no longer repeats the inspector's cards — section 7 «المطابقة والمكوّنات» shows them.
  const inspectionAccepted = useMemo(
    () =>
      Boolean(studyTask) &&
      tasks.some(
        (t) =>
          t.parentTaskId === studyTask?.id &&
          t.kind === "field-inspection" &&
          t.status !== "cancelled" &&
          t.packageAccepted === true,
      ),
    [studyTask, tasks],
  );
  const coordination = useCoordinationSections({
    record,
    property,
    tasks,
    task,
    studyTask,
    surveyTask,
    transaction,
    step,
    reviewLock,
    surveyMounted: state.mounted.has("survey"),
  });

  // The study report's deed-match hint asks for the inspection section (the workspace's appraisal tab).
  useEffect(() => {
    const onOpen = () => openSection("inspection", true);
    window.addEventListener(CASE_STUDY_WORKSPACE_OPEN_APPRAISAL_EVENT, onOpen);
    return () =>
      window.removeEventListener(
        CASE_STUDY_WORKSPACE_OPEN_APPRAISAL_EVENT,
        onOpen,
      );
  }, [openSection]);

  const detailHref = (tab?: string) =>
    poPropertyDetailPath(record.poNumber, property.id, tab);
  const coordinationHref = poPropertyCoordinationPath(record.poNumber, property.id);
  const atCoordination = step < WORK_PAGE_FIRST_STEP;
  const noTask = (
    <Note tone="info" className="mt-3">
      لا توجد مهمة دراسة حالة لهذا الصك بعد.
    </Note>
  );

  const body = (id: WorkSectionId): ReactNode => {
    if (id === "inspector" && inspectionAccepted) {
      return (
        <div className="flex flex-wrap items-center gap-3 pt-3">
          <span className="flex-1 text-[12.5px] text-text-2">
            قُبلت مخرجات المعاين — تفاصيلها في قسم «المطابقة والمكوّنات».
          </span>
          <Button type="button" size="sm" variant="outline" onClick={() => openSection("inspection", true)}>
            عرض المخرجات
          </Button>
        </div>
      );
    }
    if (COORDINATION_IDS.has(id)) return coordination.body(id as CoordinationSectionId);
    if (atCoordination) {
      return (
        <p className="m-0 pt-3 text-[12.5px] text-text-3">
          يبدأ بعد أن يُرسل التنسيق المعاملة للدراسة.
        </p>
      );
    }
    switch (id) {
      case "inspection":
        if (!studyTask) return noTask;
        return (
          <CaseStudyAppraisalDeedsPanel
            property={property}
            poNumber={record.poNumber}
            tasks={tasks}
            caseStudyTask={studyTask}
            documentsEnabled
            transaction={transaction}
            stage="study"
          />
        );
      case "study":
        return studyTask ? (
          <div className="pt-3">
            <CaseStudyReportEditor
              taskId={studyTask.id}
              task={studyTask}
              property={property}
              poRecord={record}
              requestDateSeed={record.receivedFromEnfathAt}
              workOrderId={record.id}
              deeds={caseStudyReportDeeds(transaction?.deeds)}
            />
          </div>
        ) : (
          noTask
        );
      case "photos":
        return (
          <WorkPhotosSection
            record={record}
            property={property}
            task={task}
            studyTask={studyTask}
            tasks={tasks}
          />
        );
      case "valuation":
        return studyTask ? (
          <CaseStudyValuationPanel
            property={property}
            tasks={tasks}
            caseStudyTask={studyTask}
          />
        ) : (
          noTask
        );
      default:
        // Omar 2026-11-08: the package check («تجهيز المعاملة للرفع») and the upload happen here.
        return (
          <WorkUploadSection
            record={record}
            property={property}
            task={task}
            studyTask={studyTask}
            tasks={tasks}
            reportDeeds={caseStudyReportDeeds(transaction?.deeds)}
            showHandoverCard={canHandOverToEnfaz(access)}
          />
        );
    }
  };

  return (
    <div
      id="view-property-work"
      className="flex min-h-0 w-full flex-1 flex-col overflow-clip bg-bg [zoom:0.85]"
    >
      <PageShell
        variant="canvas"
        className="gap-0 bg-bg px-[30px] py-[26px] max-sm:px-4 max-sm:py-4"
      >
        <PropertyDetailHero
          record={record}
          property={property}
          propertyIndex={index + 1}
        />
        <TransactionCancellationBanner propertyId={property.id} />

        <div className="mb-3 flex flex-wrap items-center gap-3 rounded-xl border border-border bg-surface px-4 py-2.5 text-[13px]">
          <span className="font-bold text-heading">
            {progress
              ? `المرحلة: ${progress.stage}`
              : step >= 7
                ? "اكتملت المعاملة"
                : "—"}
          </span>
          {progress ? (
            <span className="font-semibold text-info-text">
              بانتظار: {progress.waitingOn}
            </span>
          ) : null}
          <span className="flex-1" />
          <Button
            type="button"
            size="sm"
            variant="outline"
            onClick={() => router.push(coordinationHref)}
          >
            صفحة المنسق
          </Button>
          <Button
            type="button"
            size="sm"
            variant="default"
            onClick={() => router.push(detailHref())}
          >
            تفاصيل العقار (المرجع)
          </Button>
        </div>

        {atCoordination && tasksQuery.isFetched ? (
          <Note tone="info" className="mb-3" data-testid="work-at-coordination">
            المعاملة لدى التنسيق — لم تُرسل للدراسة بعد. أقسامها أدناه، و«إرسال المعاملة للدراسة» في «صفحة المنسق».
          </Note>
        ) : null}

        {reviewLock ? (
          <Note tone="warn" className="mb-3" data-testid="work-review-lock">
            {reviewLock === "report-approved"
              ? "اعتمد المقيّم تقرير التقييم اعتمادًا نهائيًا — المعاملة مقفلة على الجميع، ولا تُفتح إلا بإعادة فتح المعاملة مع سبب."
              : canReviewTransaction(access)
                ? "اعتمدتَ الدراسة — بياناتها مقفلة على الجميع. لتعديلها اضغط «إرجاع للدراسة» في قسم «تقرير دراسة الحالة» مع السبب."
                : "اعتمد المراجع الدراسة — بياناتها مقفلة على الجميع، ولا تُفتح إلا بإرجاع المراجع لها للدراسة."}
          </Note>
        ) : null}

        <IntakeScope
          task={task}
          intakeActive={coordination.intakeActive}
          mayEditData={coordination.mayEditData}
          poNumber={record.poNumber}
          propertyId={property.id}
          onRefresh={coordination.refreshIntake}
        >
          <CoordinationIntakeBanner />
          <WorkSectionsLayout
            sections={sections}
            step={step}
            state={state}
            railLabel="أقسام المعاملة"
            body={body}
          />
        </IntakeScope>
      </PageShell>
      {coordination.redistributeHost}
    </div>
  );
}

/** `/po/{po}/property/{id}/work` — the transaction's work page. */
export function PoPropertyWorkPage({
  poNumber,
  propertyId,
}: {
  poNumber: string;
  propertyId: string;
}) {
  return (
    <PoPropertyRouteGate poNumber={poNumber} propertyId={propertyId}>
      {(loaded) => <WorkPageBody {...loaded} />}
    </PoPropertyRouteGate>
  );
}
