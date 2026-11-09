"use client";

/**
 * The coordinator's page (Omar 2026-11-08) — one page per transaction for coordination's whole share,
 * in the work page's design: numbered sections on a rail, each saved and opening the next.
 * - Intake: primary data → bourse → distribution (the step workflow, with no «إحالة» between them).
 * - Follow-up: a section per party — the inspector, the engineering office, external parties, linked
 *   tasks — to read what each sent, return it with a reason, correct it, and receive it with its fees.
 * - Closed by «إرسال المعاملة للدراسة»; the work page takes over from there.
 */
import { useMemo } from "react";
import { useRouter } from "next/navigation";
import { Button, Note, PageShell } from "@platform/ui-kit";
import {
  poPropertyDetailPath,
  poPropertyWorkPath,
} from "@platform/app-shared/domain/po-routes";
import { getReportDraftState } from "@platform/app-shared/workflow/report-draft-state";
import { PropertyDetailHero } from "../components/po-intake/PropertyDetailHero";
import { PropertyDetailReceiptCard } from "../components/po-intake/PropertyDetailReceiptCard";
import { TransactionCancellationBanner } from "../components/po-intake/TransactionCancellationBanner";
import {
  COORDINATION_SECTIONS,
  FOLLOW_UP_STEP,
  coordinationStep,
  type CoordinationSectionId,
} from "../lib/app-data/coordination-page-model";
import { transactionProgress } from "../lib/app-data/my-work-model";
import type { PoIntakeRecord, PoPropertyIntake } from "../lib/app-data/po-intake-data";
import { caseStudyTaskForProperty, type WorkflowTask } from "../lib/app-data/tasks";
import { reviewLockOf } from "../lib/app-data/work-page-model";
import { useWorkflowTasksQuery } from "../query/case-study-queries";
import { useTransactionQuery } from "../query/use-transaction-query";
import { CoordinationIntakeBanner, IntakeScope } from "./CoordinationIntake";
import { PoPropertyRouteGate } from "./PoPropertyRouteGate";
import { useCoordinationSections, useSurveyTask } from "./useCoordinationSections";
import { StepLink, WorkSectionsLayout, useWorkSections } from "./WorkSectionsFrame";

const EMPTY_TASKS: WorkflowTask[] = [];

function CoordinationPageBody({
  record,
  property,
  index,
}: {
  record: PoIntakeRecord;
  property: PoPropertyIntake;
  index: number;
}) {
  const router = useRouter();
  const tasksQuery = useWorkflowTasksQuery();
  const tasks = tasksQuery.data ?? EMPTY_TASKS;
  const { data: transaction } = useTransactionQuery(property.id);

  const task = caseStudyTaskForProperty(record.poNumber, property.id, tasks) ?? null;
  // One study per transaction: a deed folded into another deed's study follows the holder's task.
  const studyTask = useMemo(() => {
    const holderId = transaction?.studyHolderTaskId?.trim();
    return (holderId ? tasks.find((t) => t.id === holderId) : undefined) ?? task;
  }, [transaction?.studyHolderTaskId, tasks, task]);

  const step = coordinationStep(task);
  const progress = studyTask ? transactionProgress(studyTask, tasks, getReportDraftState) : null;
  const reviewLock = reviewLockOf(studyTask, getReportDraftState(property.id));

  const surveyTask = useSurveyTask(studyTask, tasks);
  const sections = useMemo(
    () => COORDINATION_SECTIONS.filter((s) => s.id !== "survey" || Boolean(surveyTask)),
    [surveyTask],
  );
  const state = useWorkSections<CoordinationSectionId>({
    sections,
    step,
    ready: tasksQuery.isFetched,
  });
  const { body, redistributeHost, mayEditData, refreshIntake, intakeActive, sent } = useCoordinationSections({
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
  const detailHref = (tab?: string) => poPropertyDetailPath(record.poNumber, property.id, tab);

  const footer = (
    <div className="flex flex-col gap-2" data-testid="coordination-send">
      <PropertyDetailReceiptCard propertyId={property.id} inCaseStudyPhase={task?.phase === "case-study"} />
      {step < FOLLOW_UP_STEP ? (
        <p className="m-0 text-[12px] text-text-3">يظهر «إرسال المعاملة للدراسة» بعد التوزيع.</p>
      ) : null}
      {sent ? (
        <StepLink
          line="أُرسلت المعاملة للدراسة — تكمل في صفحة العمل."
          label="فتح صفحة العمل"
          href={poPropertyWorkPath(record.poNumber, property.id)}
        />
      ) : null}
    </div>
  );

  return (
    <div id="view-property-coordination" className="flex min-h-0 w-full flex-1 flex-col overflow-clip bg-bg [zoom:0.85]">
      <PageShell variant="canvas" className="gap-0 bg-bg px-[30px] py-[26px] max-sm:px-4 max-sm:py-4">
        <PropertyDetailHero record={record} property={property} propertyIndex={index + 1} />
        <TransactionCancellationBanner propertyId={property.id} />

        <div className="mb-3 flex flex-wrap items-center gap-3 rounded-xl border border-border bg-surface px-4 py-2.5 text-[13px]">
          <span className="font-bold text-heading">صفحة المنسق</span>
          <span className="text-text-2">{progress ? `المرحلة: ${progress.stage}` : sent ? "أُرسلت للدراسة" : "—"}</span>
          {progress ? <span className="font-semibold text-info-text">بانتظار: {progress.waitingOn}</span> : null}
          <span className="flex-1" />
          {sent ? (
            <Button
              type="button"
              size="sm"
              variant="outline"
              onClick={() => router.push(poPropertyWorkPath(record.poNumber, property.id))}
            >
              صفحة العمل
            </Button>
          ) : null}
          <Button type="button" size="sm" variant="default" onClick={() => router.push(detailHref())}>
            تفاصيل العقار (المرجع)
          </Button>
        </div>

        <IntakeScope
          task={task}
          intakeActive={intakeActive}
          mayEditData={mayEditData}
          poNumber={record.poNumber}
          propertyId={property.id}
          onRefresh={refreshIntake}
        >
          <CoordinationIntakeBanner />
          {task?.awaitingExternalParty && !sent ? (
            <Note tone="info" className="mb-3">
              المعاملة بانتظار طرف خارجي — لا تُرسل للدراسة حتى يُستلم منه أو يُلغى انتظاره.
            </Note>
          ) : null}
          <WorkSectionsLayout
            sections={sections}
            step={step}
            state={state}
            railLabel="أقسام صفحة المنسق"
            body={body}
            footer={footer}
          />
        </IntakeScope>
      </PageShell>
      {redistributeHost}
    </div>
  );
}

/** `/po/{po}/property/{id}/coordination` — the transaction's coordinator page. */
export function PoPropertyCoordinationPage({ poNumber, propertyId }: { poNumber: string; propertyId: string }) {
  return (
    <PoPropertyRouteGate poNumber={poNumber} propertyId={propertyId}>
      {(loaded) => <CoordinationPageBody {...loaded} />}
    </PoPropertyRouteGate>
  );
}
