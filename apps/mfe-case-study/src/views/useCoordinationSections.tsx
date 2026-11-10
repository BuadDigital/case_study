"use client";

/**
 * The coordination sections' bodies — intake (primary data, bourse, distribution) and the parties'
 * follow-up (inspector, engineering office, external parties, linked tasks) — shared by the two frame
 * pages (Omar 2026-11-08): the coordinator's page shows only these; the work page shows them too,
 * before the study's and review's sections, because the study and the review study every detail and
 * edit the data at the same level as coordination.
 */
import { useCallback, useMemo, useState, type ReactNode } from "react";
import { useQueryClient } from "@tanstack/react-query";
import type { TransactionDetailDto } from "@platform/api-client";
import { Button } from "@platform/ui-kit";
import { useAppAccess } from "@platform/app-shared/contexts/AppAccessContext";
import { poPropertyDetailPath } from "@platform/app-shared/domain/po-routes";
import { appDataKeys } from "@platform/app-shared/query/app-data-keys";
import { useStaffUsersQuery } from "@settings/mfe/query/settings-queries";
import { CaseStudyAppraisalDeedsPanel } from "../components/case-study/CaseStudyAppraisalDeedsPanel";
import { ExternalReceiptsSection } from "../components/coordination/ExternalReceiptsSection";
import { LinkedTasksSection } from "../components/coordination/LinkedTasksSection";
import { DistributionPartiesForm } from "../components/distribution/DistributionPartiesForm";
import { RedistributePartiesHost } from "../components/distribution/RedistributePartiesHost";
import { SurveyPackageReviewSection } from "../components/po-intake/SurveyPackageReviewSection";
import { childTasksForCaseStudyParent } from "../lib/app-data/case-study-party-answers";
import {
  FOLLOW_UP_STEP,
  type CoordinationSectionId,
} from "../lib/app-data/coordination-page-model";
import { canManageOperationsTasks } from "../lib/app-data/operations-task-roles";
import type { PoIntakeRecord, PoPropertyIntake } from "../lib/app-data/po-intake-data";
import {
  canEditPropertyData,
  canFormallyReceive,
  canRedistributeParties,
} from "../lib/app-data/po-roles";
import { buildPropertyDetailPartyCards } from "../lib/app-data/property-detail-parties";
import { migrateDistribution, type WorkflowTask } from "../lib/app-data/tasks";
import type { ReviewLock } from "../lib/app-data/work-page-model";
import { usePropertyDetailPartySubmissionsQuery } from "../query/property-detail-party-submissions-queries";
import { CoordinationIntakeBody } from "./CoordinationIntake";
import { StepLink } from "./WorkSectionsFrame";

/** The transaction's engineering-survey task, if one was distributed (its section shows only then). */
export function useSurveyTask(
  studyTask: WorkflowTask | null,
  tasks: readonly WorkflowTask[],
): WorkflowTask | undefined {
  return useMemo(
    () =>
      studyTask
        ? childTasksForCaseStudyParent(studyTask.id, [...tasks]).find((t) => t.kind === "engineering-survey")
        : undefined,
    [studyTask, tasks],
  );
}

/**
 * Everything the coordination sections need, and their bodies.
 *
 * How it works: the intake sections are the step workflow while in intake (through `IntakeScope`, which
 * the page mounts with `intakeActive` / `mayEditData` / `refreshIntake` from here), the in-place editor
 * after; the distribution after intake is read-only with «تعديل إسناد الأطراف»; the inspector is the
 * review panel's coordination share; the survey its acceptance block (loaded once the section mounts);
 * external parties and linked tasks their own sections. `redistributeHost` is the dialog to render once.
 * Edge cases: the party sections wait for the distribution («يبدأ بعد التوزيع»); the review lock keeps
 * the data read-only for everyone but the review while handed, for everyone once approved.
 */
export function useCoordinationSections({
  record,
  property,
  tasks,
  task,
  studyTask,
  surveyTask,
  transaction,
  step,
  reviewLock,
  surveyMounted,
}: {
  record: PoIntakeRecord;
  property: PoPropertyIntake;
  tasks: WorkflowTask[];
  task: WorkflowTask | null;
  studyTask: WorkflowTask | null;
  surveyTask: WorkflowTask | undefined;
  transaction: TransactionDetailDto | null | undefined;
  /** The page's step on the coordination scale (0 primary data … 3 follow-up, 4+ sent). */
  step: number;
  reviewLock: ReviewLock;
  surveyMounted: boolean;
}) {
  const queryClient = useQueryClient();
  const { role, access } = useAppAccess();
  const { data: staffResult } = useStaffUsersQuery();
  const [redistributeTask, setRedistributeTask] = useState<WorkflowTask | null>(null);

  const partySubmissions = usePropertyDetailPartySubmissionsQuery({
    parentTask: studyTask,
    allTasks: tasks,
    enabled: surveyMounted,
  });
  const surveyCard = useMemo(
    () =>
      studyTask
        ? buildPropertyDetailPartyCards({
            task: studyTask,
            allTasks: tasks,
            staffUsers: staffResult?.users ?? [],
          }).find((c) => c.roleKey === "survey")
        : undefined,
    [studyTask, tasks, staffResult?.users],
  );

  // The lock is the same for everyone (Omar 2026-11-08): open until review approves the study.
  const mayEditData = canEditPropertyData(role) && reviewLock === null;
  // Each intake section's save refreshes the task list, so the page's step follows the workflow's.
  const refreshIntake = useCallback(() => {
    for (const queryKey of [
      appDataKeys.workflowTasks(),
      appDataKeys.poRecord(record.poNumber),
      appDataKeys.pendingBourseItems(),
    ]) {
      void queryClient.invalidateQueries({ queryKey });
    }
  }, [queryClient, record.poNumber]);
  const intakeActive = step <= 2 && task?.status !== "cancelled";
  const sent = task?.transactionReceived === true;

  const detailHref = (tab?: string) => poPropertyDetailPath(record.poNumber, property.id, tab);
  const notYet = (line: string) => <p className="m-0 pt-3 text-[12.5px] text-text-3">{line}</p>;

  const body = (id: CoordinationSectionId): ReactNode => {
    switch (id) {
      case "intake":
        return (
          <CoordinationIntakeBody
            step="enfath"
            fallback={
              <StepLink line="بيانات الأمر والصك في «تفاصيل العقار»." label="عرض التفاصيل" href={detailHref("basic")} />
            }
          />
        );
      case "bourse":
        return (
          <CoordinationIntakeBody
            step="bourse"
            fallback={
              <StepLink line="بيانات البورصة والملاك في «تفاصيل العقار»." label="عرض التفاصيل" href={detailHref("basic")} />
            }
          />
        );
      case "distribution": {
        if (intakeActive) {
          return <CoordinationIntakeBody step="distribution" fallback={null} />;
        }
        if (!task) return notYet("لا توجد مهمة دراسة حالة لهذا الصك بعد.");
        // Past the distribution: who was assigned, read-only; changing a party is «تعديل إسناد الأطراف».
        const distribution = migrateDistribution(task.distribution);
        return (
          <div className="flex flex-col gap-3 pt-3">
            <DistributionPartiesForm
              distribution={distribution}
              onPatch={() => undefined}
              showEngineering={Boolean(distribution.engineeringOffice)}
              readOnly
            />
            {task.phase === "case-study" && canRedistributeParties(access) ? (
              <div>
                <Button type="button" size="sm" variant="outline" onClick={() => setRedistributeTask(task)}>
                  تعديل إسناد الأطراف
                </Button>
              </div>
            ) : null}
          </div>
        );
      }
      case "inspector":
        if (step < FOLLOW_UP_STEP || !studyTask) return notYet("يبدأ بعد التوزيع.");
        return (
          <CaseStudyAppraisalDeedsPanel
            property={property}
            poNumber={record.poNumber}
            tasks={tasks}
            caseStudyTask={studyTask}
            documentsEnabled
            transaction={transaction}
            stage="follow"
          />
        );
      case "survey":
        if (step < FOLLOW_UP_STEP) return notYet("يبدأ بعد التوزيع.");
        return (
          <div className="pt-3">
            <SurveyPackageReviewSection
              surveyTask={surveyTask}
              surveyCard={surveyCard}
              submission={partySubmissions.data?.survey}
              loading={partySubmissions.isPending}
              onChanged={() => void partySubmissions.refetch()}
            />
          </div>
        );
      case "external":
        return <ExternalReceiptsSection propertyId={property.id} canManage={canFormallyReceive(access)} sent={sent} />;
      case "linked":
        return (
          <LinkedTasksSection
            poNumber={record.poNumber}
            deedNumber={property.deedNumber}
            canCreate={canManageOperationsTasks(access)}
          />
        );
    }
  };

  const redistributeHost = (
    <RedistributePartiesHost task={redistributeTask} onClose={() => setRedistributeTask(null)} />
  );

  return { body, redistributeHost, mayEditData, refreshIntake, intakeActive, sent };
}
