import type { WorkflowTask } from "@case-study/mfe";
import {
  isVisibleInAppraiserQueue,
  loadEvaluatorSubmission,
} from "./evaluator-submission-storage";
import { getPartyTaskRecall } from "@platform/app-shared/prototype/party-task-recall-storage";

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

/** قائمة المقيم: مهام قيد العمل فقط (المُرسَلة للأخصائي تُدار من عقارات أمر العمل). */
export function filterAppraiserListedTasks(
  tasks: WorkflowTask[],
): WorkflowTask[] {
  return filterAppraiserQueueTasks(tasks);
}

export function canAppraiserOpenTask(taskId: string, taskStatus: string): boolean {
  return isVisibleInAppraiserQueue(taskId, taskStatus);
}

export function appraiserTaskStatusBadge(
  taskId: string,
): { label: string; className: string } | null {
  const sub = loadEvaluatorSubmission(taskId);
  if (sub?.status === "submitted") {
    const recall = getPartyTaskRecall(taskId);
    if (recall?.status === "pending") {
      return { label: "بانتظار موافقة الاستدعاء", className: "b-prog" };
    }
    if (recall?.status === "rejected") {
      return { label: "مُرسَل — رُفِض الاستدعاء", className: "b-fail" };
    }
    return { label: "مُرسَل للأخصائي", className: "b-new" };
  }
  if (sub?.status === "reopened") {
    return { label: "مُعاد للتعديل", className: "b-done" };
  }
  return null;
}
