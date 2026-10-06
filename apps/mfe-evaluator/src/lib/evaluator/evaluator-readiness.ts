import type { WorkflowTask } from "@platform/app-shared/workflow/task-types";
import {
  FAILURE_OBSTRUCTED_BADGE,
  isTaskFailureObstructed,
} from "@platform/app-shared/workflow/task-failure-status";
import {
  appraisalStageLabel,
  getReportDraftState,
} from "@platform/app-shared/workflow/report-draft-state";
import { findSiblingInspectionTask } from "./evaluator-inspection-gate";
import { loadEvaluatorSubmission } from "./evaluator-submission-model";
import { getPartyTaskRecall } from "@platform/app-shared/app-data/party-task-recall-model";

/**
 * Readiness buckets. The appraiser drafts from the start (no inspection gate): `drafting` until the
 * specialist issues the study report, `ready` once it is issued (the submit is open).
 */
export type AppraiserReadiness = "drafting" | "ready";

export const APPRAISER_DRAFTING_LABEL = "قيد التقييم — بانتظار إصدار الدراسة";
export const APPRAISER_READY_LABEL = "جاهزة للتسليم";

export function findSiblingSurveyTask(
  appraisalTask: WorkflowTask,
  tasks: WorkflowTask[],
): WorkflowTask | null {
  if (!appraisalTask.parentTaskId) return null;
  return (
    tasks.find(
      (t) =>
        t.parentTaskId === appraisalTask.parentTaskId &&
        t.propertyId === appraisalTask.propertyId &&
        t.kind === "engineering-survey",
    ) ?? null
  );
}

/**
 * Whether the field inspection is COMPLETED (informational only — it no longer gates the
 * appraiser). Prefer server `fieldInspectionCompleted` — party appraiser lists hide sibling
 * inspection tasks (same pattern as EO surveyWorkGate).
 */
export function appraiserInspectionDone(
  appraisalTask: WorkflowTask,
  tasks: WorkflowTask[],
): boolean {
  if (typeof appraisalTask.fieldInspectionCompleted === "boolean") {
    return appraisalTask.fieldInspectionCompleted;
  }
  const inspection = findSiblingInspectionTask(appraisalTask, tasks);
  return inspection?.status === "completed";
}

export function appraiserSurveyDone(
  appraisalTask: WorkflowTask,
  tasks: WorkflowTask[],
): boolean {
  const survey = findSiblingSurveyTask(appraisalTask, tasks);
  if (!survey) return true;
  return survey.status === "completed";
}

export function appraiserNeedsSurvey(
  appraisalTask: WorkflowTask,
  tasks: WorkflowTask[],
): boolean {
  return Boolean(findSiblingSurveyTask(appraisalTask, tasks));
}

/**
 * @deprecated Specialist no longer gates appraisal start via inspection accept.
 * Kept for callers that still surface the server stamp; always prefer
 * {@link appraiserInspectionDone} for readiness.
 */
export function appraiserInspectionAccepted(
  appraisalTask: WorkflowTask,
  tasks: WorkflowTask[],
): boolean {
  void tasks;
  if (typeof appraisalTask.fieldInspectionAccepted === "boolean") {
    return appraisalTask.fieldInspectionAccepted;
  }
  return false;
}

export function appraiserReadiness(
  appraisalTask: WorkflowTask,
  tasks: WorkflowTask[],
): AppraiserReadiness {
  void tasks;
  return appraisalTask.studyReportIssued === true ? "ready" : "drafting";
}

/**
 * Case Study.html queue status pill for property valuation.
 * className maps to StatusPill colors (same vocabulary as eng survey).
 */
/** The package status: the server's word (handed over to the specialist) first, then the local draft. */
function submissionStatus(task: WorkflowTask): string {
  if (task.appraisalPackageStatus === "submitted") return "submitted";
  return loadEvaluatorSubmission(task.id)?.status ?? "draft";
}

export function appraiserQueueStatusBadge(
  task: WorkflowTask,
  tasks: WorkflowTask[],
): { label: string; className: string } {
  if (task.status === "completed") {
    return { label: "صدر التقرير النهائي", className: "b-done" };
  }
  if (isTaskFailureObstructed(task)) return { ...FAILURE_OBSTRUCTED_BADGE };
  const st = submissionStatus(task);
  if (st === "submitted") {
    const recall = getPartyTaskRecall(task.id);
    if (recall?.status === "pending") {
      return { label: "بانتظار موافقة الاسترجاع", className: "b-prog" };
    }
    if (recall?.status === "rejected") {
      return { label: "مُرسَل — رُفِض الاستدعاء", className: "b-fail" };
    }
    const stage = appraisalStageLabel(getReportDraftState(task.propertyId));
    if (stage) return { label: stage.label, className: stage.className };
    return { label: "مُسلَّمة — بانتظار مسودة التقرير", className: "b-navy" };
  }
  if (st === "reopened") {
    return { label: "معادة للتصحيح", className: "b-returned" };
  }
  if (appraiserReadiness(task, tasks) === "ready") {
    return { label: APPRAISER_READY_LABEL, className: "b-gold" };
  }
  return { label: APPRAISER_DRAFTING_LABEL, className: "b-prog" };
}

export function appraiserQueueStatusGroup(
  task: WorkflowTask,
  tasks: WorkflowTask[],
): string {
  if (task.status === "completed") return "closed";
  const st = submissionStatus(task);
  if (st === "submitted") {
    return appraisalStageLabel(getReportDraftState(task.propertyId))?.group ?? "submitted";
  }
  if (st === "reopened") return "reopened";
  return appraiserReadiness(task, tasks);
}
