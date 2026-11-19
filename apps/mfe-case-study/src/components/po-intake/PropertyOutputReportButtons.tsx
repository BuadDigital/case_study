"use client";

import { createElement, useMemo, useState } from "react";
import { AppModal, cn, InlineLoadingSkeleton } from "@platform/ui-kit";
import { useAppAccess } from "@platform/app-shared/contexts/AppAccessContext";
import type { RoleId } from "@platform/types";
import { CaseStudyReportFrame } from "../case-study/CaseStudyReportFrame";
import {
  buildCaseStudyReportModel,
  caseStudyReportDeeds,
} from "../../lib/app-data/case-study-report-document-model";
import { childTasksForCaseStudyParent } from "../../lib/app-data/case-study-party-answers";
import { partyChildTaskForProperty } from "../../lib/app-data/documentary-workflow-gates";
import type { PoIntakeRecord, PoPropertyIntake } from "../../lib/app-data/po-intake-data";
import { isExternalPartyRole } from "../../lib/app-data/po-roles";
import { caseStudyTaskForProperty } from "../../lib/app-data/tasks";
import type { WorkflowTask } from "@platform/app-shared/workflow/task-types";
import { evaluatorValuationReportPreview } from "../../lib/evaluator-bridge";
import { getReportDraftState } from "@platform/app-shared/workflow/report-draft-state";
import { useReportDraftStates } from "@platform/app-shared/workflow/use-report-draft-states";
import {
  useCaseStudyReportBatchQuery,
  useWorkflowTasksQuery,
} from "../../query/case-study-queries";
import { useTransactionQuery } from "../../query/use-transaction-query";
import { HeroIconButton, type HeroIconState } from "./HeroIconButton";
import { EmptyState } from "./PropertyDetailFields";

import { WorkflowTaskKinds, WorkflowTaskStatuses } from "@platform/app-shared/workflow/task-types";
import { CaseStudyReportStatuses } from "@platform/app-shared/app-data/case-study-report-model";
/** A clipboard with a tick — the case study's report. */
const CASE_STUDY_REPORT_ICON =
  "M9 2h6a1 1 0 0 1 1 1v2a1 1 0 0 1-1 1H9a1 1 0 0 1-1-1V3a1 1 0 0 1 1-1zM16 4h2a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2h2M9 14l2 2 4-4";
/** A page with bars — the valuation report. */
const VALUATION_REPORT_ICON =
  "M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8zM14 2v6h6M8 18v-2M12 18v-4M16 18v-6";

/** Whether this role sees the output reports' icons — everyone but the external parties. */
export function seesPropertyOutputReports(role: RoleId): boolean {
  return !isExternalPartyRole(role);
}

/**
 * The property's study task and its appraisal task, as the header can find them.
 *
 * How it works: the study is the transaction's holder deed's (`studyHolderTaskId`) on a linked
 * property, else this deed's own case-study task, else — for the appraiser, whose list holds only
 * his own tasks — his appraisal task's parent. The appraisal task is the study's appraisal child,
 * else the viewer's own appraisal task on this deed.
 * Edge cases: nothing found → empty id / null, and the icon is greyed out.
 */
export function outputReportTasks(input: {
  poNumber: string;
  propertyId: string;
  studyHolderTaskId: string | null | undefined;
  tasks: WorkflowTask[];
}): { studyTaskId: string; appraisalTask: WorkflowTask | null } {
  const { poNumber, propertyId, tasks } = input;
  const ownAppraisal = partyChildTaskForProperty(WorkflowTaskKinds.PropertyAppraisal, poNumber, propertyId, tasks);
  const studyTaskId =
    input.studyHolderTaskId?.trim() ||
    caseStudyTaskForProperty(poNumber, propertyId, tasks)?.id ||
    ownAppraisal?.parentTaskId?.trim() ||
    "";
  const studyAppraisal = studyTaskId
    ? childTasksForCaseStudyParent(studyTaskId, tasks).find((t) => t.kind === WorkflowTaskKinds.PropertyAppraisal)
    : undefined;
  return { studyTaskId, appraisalTask: studyAppraisal ?? ownAppraisal };
}

/** The case study's report in a window — loaded when the window opens. */
function CaseStudyReportWindow({
  record,
  property,
  studyTaskId,
  deeds,
  onClose,
}: {
  record: PoIntakeRecord;
  property: PoPropertyIntake;
  studyTaskId: string;
  deeds: ReturnType<typeof caseStudyReportDeeds>;
  onClose: () => void;
}) {
  // The batch read is the one the appraiser may make too (his summary uses it).
  const { data: reports, isPending, isError } = useCaseStudyReportBatchQuery(studyTaskId);
  const draft = reports?.get(studyTaskId.toLowerCase())?.parent ?? null;
  const model = useMemo(
    () =>
      draft
        ? buildCaseStudyReportModel(draft, property, { poNumber: record.poNumber }, record, undefined, deeds)
        : null,
    [draft, property, record, deeds],
  );
  return (
    <AppModal
      open
      onClose={onClose}
      title={draft?.status === CaseStudyReportStatuses.Issued ? "تقرير دراسة الحالة" : "تقرير دراسة الحالة — مسودة"}
      subtitle="للقراءة — كما هو الآن"
      maxWidthPx={880}
    >
      {isPending ? (
        <InlineLoadingSkeleton />
      ) : isError ? (
        <EmptyState title="تعذّر تحميل تقرير دراسة الحالة" sub="أعد المحاولة بعد قليل." />
      ) : model ? (
        <CaseStudyReportFrame model={model} />
      ) : (
        <EmptyState title="لم يُبدأ تقرير دراسة الحالة بعد" sub="يظهر هنا بعد البدء في تعبئته." />
      )}
    </AppModal>
  );
}

/**
 * Two icons on the header's left, beside the deed's (Omar 2026-11-15): the transaction's outputs —
 * the case study's report and the valuation report — each read in a window, at any stage, a draft
 * titled as one.
 *
 * How it works: the study and appraisal tasks come from `outputReportTasks`; a report loads only
 * when its window opens. The case study's report is the same page the study prints, without a
 * report number (only printing from the study allocates one); the valuation report is the
 * appraiser's, read-only, through the evaluator bridge — as the review's «معاينة التقرير».
 * Edge cases: the external parties (inspector, engineering office, government reviewer) see neither
 * icon; no study task / no appraisal task (or the evaluator not loaded) → that icon is greyed out
 * and says why; a study not started opens a window that says so.
 * Versions (Omar 2026-11-18): each icon opens the newest version; it is shaded with a dashed border
 * until that version is approved (the study issued, the appraisal task completed — the signals the
 * window titles use) and carries the version number in its corner above 1.
 */
export function PropertyOutputReportButtons({
  record,
  property,
  compact,
}: {
  record: PoIntakeRecord;
  property: PoPropertyIntake;
  compact: boolean;
}) {
  const { role } = useAppAccess();
  const { data: tasks = [] } = useWorkflowTasksQuery();
  const { data: transaction } = useTransactionQuery(property.id);
  const [open, setOpen] = useState<"study" | "valuation" | null>(null);
  const { studyTaskId, appraisalTask } = useMemo(
    () =>
      outputReportTasks({
        poNumber: record.poNumber,
        propertyId: property.id,
        studyHolderTaskId: transaction?.studyHolderTaskId,
        tasks,
      }),
    [record.poNumber, property.id, transaction?.studyHolderTaskId, tasks],
  );
  const deeds = useMemo(() => caseStudyReportDeeds(transaction?.deeds), [transaction]);
  const ValuationReport = evaluatorValuationReportPreview();
  const sees = seesPropertyOutputReports(role);
  // The study's status and version, and the valuation draft's version, for the icons' state and badge.
  const { data: studyReports } = useCaseStudyReportBatchQuery(studyTaskId, { enabled: sees });
  const studyDraft = studyReports?.get(studyTaskId.toLowerCase())?.parent ?? null;
  useReportDraftStates([property.id], sees && Boolean(appraisalTask));
  const valuationVersion = getReportDraftState(property.id)?.version;

  if (!sees) return null;

  const valuationReady = Boolean(appraisalTask && ValuationReport);
  const studyState: HeroIconState = !studyTaskId
    ? "none"
    : studyDraft?.status === "issued"
      ? "approved"
      : "draft";
  const valuationState: HeroIconState = !valuationReady
    ? "none"
    : appraisalTask?.status === "completed"
      ? "approved"
      : "draft";
  const draftNote = (state: HeroIconState) => (state === "draft" ? " — مسودة، لم تُعتمد" : "");
  return (
    <div className={cn("flex items-center", compact ? "gap-1" : "gap-1.5")} data-testid="hero-output-reports">
      <HeroIconButton
        iconPath={CASE_STUDY_REPORT_ICON}
        label={studyTaskId ? `مطالعة تقرير دراسة الحالة${draftNote(studyState)}` : "لم تبدأ دراسة الحالة بعد"}
        state={studyState}
        badge={studyDraft?.version}
        compact={compact}
        testId="hero-case-study-report"
        onClick={() => setOpen("study")}
      />
      <HeroIconButton
        iconPath={VALUATION_REPORT_ICON}
        label={valuationReady ? `مطالعة تقرير التقييم${draftNote(valuationState)}` : "لم تُفتح مهمة التقييم بعد"}
        state={valuationState}
        badge={valuationVersion}
        compact={compact}
        testId="hero-valuation-report"
        onClick={() => setOpen("valuation")}
      />
      {open === "study" && studyTaskId ? (
        <CaseStudyReportWindow
          record={record}
          property={property}
          studyTaskId={studyTaskId}
          deeds={deeds}
          onClose={() => setOpen(null)}
        />
      ) : null}
      {open === "valuation" && appraisalTask && ValuationReport ? (
        <AppModal
          open
          onClose={() => setOpen(null)}
          title={appraisalTask.status === WorkflowTaskStatuses.Completed ? "تقرير التقييم" : "تقرير التقييم — مسودة"}
          subtitle="للقراءة — كما هو الآن"
          maxWidthPx={1180}
        >
          {createElement(ValuationReport, { appraisalTask, allTasks: tasks, property })}
        </AppModal>
      ) : null}
    </div>
  );
}
