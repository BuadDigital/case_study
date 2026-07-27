import type { WorkflowTask } from "@case-study/mfe";
import {
  isVisibleInAppraiserQueue,
  loadEvaluatorSubmission,
} from "./evaluator-submission-storage";
import { appraiserQueueStatusBadge } from "./evaluator-readiness";

export function filterAppraiserQueueTasks(tasks: WorkflowTask[]): WorkflowTask[] {
  return tasks.filter(
    (t) =>
      t.kind === "property-appraisal" &&
      isVisibleInAppraiserQueue(t.id, t.status),
  );
}

/** مُرسَلة للأخصائي ولم تُكتمل بعد (مهمة مفتوحة + حالة submitted). */
export function filterAppraiserSubmittedTasks(
  tasks: WorkflowTask[],
): WorkflowTask[] {
  return tasks.filter((t) => {
    if (t.kind !== "property-appraisal") return false;
    if (t.status === "completed") return false;
    const sub = loadEvaluatorSubmission(t.id);
    return sub?.status === "submitted";
  });
}

/**
 * قائمة المقيم — Case Study.html `renderValOrders`:
 * افتراضياً تُخفى المُرسَلة؛ «إظهار الكل» يعيدها.
 */
export function filterAppraiserListedTasks(
  tasks: WorkflowTask[],
  options?: { showCompleted?: boolean },
): WorkflowTask[] {
  return tasks.filter((t) => {
    if (t.kind !== "property-appraisal") return false;
    return isVisibleInAppraiserQueue(t.id, t.status, {
      showSubmitted: options?.showCompleted,
    });
  });
}

export function canAppraiserOpenTask(taskId: string, taskStatus: string): boolean {
  return isVisibleInAppraiserQueue(taskId, taskStatus, { showSubmitted: true });
}

/** @deprecated Prefer appraiserQueueStatusBadge with full task+tasks context. */
export function appraiserTaskStatusBadge(
  taskId: string,
  taskStatus?: string,
): { label: string; className: string } | null {
  const stub = {
    id: taskId,
    status: (taskStatus ?? "open") as WorkflowTask["status"],
  } as WorkflowTask;
  return appraiserQueueStatusBadge(stub, []);
}

export {
  appraiserQueueStatusBadge,
  appraiserReadiness,
  appraiserQueueStatusGroup,
  findSiblingSurveyTask,
  appraiserInspectionDone,
  appraiserSurveyDone,
  appraiserNeedsSurvey,
} from "./evaluator-readiness";
