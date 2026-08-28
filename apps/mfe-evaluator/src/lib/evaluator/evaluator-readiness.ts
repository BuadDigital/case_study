import type { WorkflowTask } from "@case-study/mfe/lib/prototype/tasks-storage";
import { findSiblingInspectionTask } from "./evaluator-inspection-gate";
import { loadEvaluatorSubmission } from "./evaluator-submission-storage";
import { getPartyTaskRecall } from "@platform/app-shared/prototype/party-task-recall-storage";

/** Case Study.html `valReadiness` buckets. */
export type AppraiserReadiness =
  | "new"
  | "wait_inspection"
  | "wait_specialist"
  | "ready";

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
 * Prefer server `fieldInspectionCompleted` — party appraiser lists hide sibling
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

export function appraiserInspectionAccepted(
  appraisalTask: WorkflowTask,
  tasks: WorkflowTask[],
): boolean {
  if (typeof appraisalTask.fieldInspectionAccepted === "boolean") {
    return appraisalTask.fieldInspectionAccepted;
  }
  return false;
}

export function appraiserReadiness(
  appraisalTask: WorkflowTask,
  tasks: WorkflowTask[],
): AppraiserReadiness {
  const inspected = appraiserInspectionDone(appraisalTask, tasks);
  const accepted = appraiserInspectionAccepted(appraisalTask, tasks);
  if (accepted) return "ready";
  if (inspected) return "wait_specialist";
  return "wait_inspection";
}

/**
 * Case Study.html queue status pill for تقييم العقار.
 * className maps to StatusPill colors (same vocabulary as eng survey).
 */
export function appraiserQueueStatusBadge(
  task: WorkflowTask,
  tasks: WorkflowTask[],
): { label: string; className: string } {
  if (task.status === "completed") {
    return { label: "مكتملة على النظام", className: "b-done" };
  }
  const sub = loadEvaluatorSubmission(task.id);
  const st = sub?.status ?? "draft";
  if (st === "submitted") {
    const recall = getPartyTaskRecall(task.id);
    if (recall?.status === "pending") {
      return { label: "بانتظار موافقة الاسترجاع", className: "b-prog" };
    }
    if (recall?.status === "rejected") {
      return { label: "مُرسَل — رُفِض الاستدعاء", className: "b-fail" };
    }
    return { label: "مُرسَلة للأخصائي", className: "b-navy" };
  }
  if (st === "reopened") {
    return { label: "معادة للتصحيح", className: "b-returned" };
  }
  const rd = appraiserReadiness(task, tasks);
  if (rd === "ready") return { label: "جاهزة للتقييم", className: "b-gold" };
  if (rd === "wait_specialist") {
    return { label: "بانتظار اعتماد بيانات معاينة العقار", className: "b-prog" };
  }
  if (rd === "wait_inspection") {
    return { label: "تراقب تقدم الأطراف", className: "b-new" };
  }
  return { label: "جديدة", className: "b-new" };
}

export function appraiserQueueStatusGroup(
  task: WorkflowTask,
  tasks: WorkflowTask[],
): string {
  if (task.status === "completed") return "closed";
  const sub = loadEvaluatorSubmission(task.id);
  const st = sub?.status ?? "draft";
  if (st === "submitted") return "submitted";
  if (st === "reopened") return "reopened";
  return appraiserReadiness(task, tasks);
}
