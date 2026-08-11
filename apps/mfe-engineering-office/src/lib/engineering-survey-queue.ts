import type { WorkflowTask } from "@case-study/mfe";
import {
  isVisibleInEngineeringSurveyQueue,
  loadEngineeringSurveySubmission,
} from "./engineering-survey-submission-storage";

export function filterEngineeringSurveyListedTasks(
  tasks: WorkflowTask[],
  options?: { showCompleted?: boolean },
): WorkflowTask[] {
  return tasks.filter(
    (t) =>
      t.kind === "engineering-survey" &&
      isVisibleInEngineeringSurveyQueue(t.id, t.status, options),
  );
}

/** Matches Case Study.html `ENG_ST` labels/classes for queue pills. */
export function engineeringSurveyTaskStatusBadge(
  taskId: string,
  taskStatus?: string,
): { label: string; className: string } | null {
  if (taskStatus === "blocked") {
    return { label: "متعذر", className: "b-fail" };
  }
  if (taskStatus === "completed") {
    return { label: "مكتمل", className: "b-done" };
  }
  const sub = loadEngineeringSurveySubmission(taskId);
  if (sub?.status === "submitted") {
    return { label: "مكتمل", className: "b-done" };
  }
  if (sub?.status === "reopened") {
    return { label: "معادة للتصحيح", className: "b-returned" };
  }
  if (sub && sub.latitude && sub.surveyReportFileName) {
    return { label: "قيد التنفيذ", className: "b-prog" };
  }
  return { label: "جديد", className: "b-new" };
}
