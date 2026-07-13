import type { WorkflowTask } from "@case-study/mfe";
import {
  isVisibleInEngineeringSurveyQueue,
  loadEngineeringSurveySubmission,
} from "./engineering-survey-submission-storage";

export function filterEngineeringSurveyListedTasks(
  tasks: WorkflowTask[],
): WorkflowTask[] {
  return tasks.filter(
    (t) =>
      t.kind === "engineering-survey" &&
      isVisibleInEngineeringSurveyQueue(t.id, t.status),
  );
}

export function engineeringSurveyTaskStatusBadge(
  taskId: string,
  taskStatus?: string,
): { label: string; className: string } | null {
  if (taskStatus === "completed") {
    return { label: "مكتملة", className: "b-done" };
  }
  const sub = loadEngineeringSurveySubmission(taskId);
  if (sub?.status === "submitted") {
    return { label: "مُرسَل للأخصائي", className: "b-new" };
  }
  if (sub?.status === "reopened") {
    return { label: "مُعاد للتصحيح", className: "b-returned" };
  }
  if (sub && sub.latitude && sub.surveyReportFileName) {
    return { label: "قيد التنفيذ", className: "b-prog" };
  }
  return { label: "جديدة", className: "b-new" };
}
