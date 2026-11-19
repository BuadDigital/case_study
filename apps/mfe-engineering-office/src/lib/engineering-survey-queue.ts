import type { WorkflowTask } from "@case-study/mfe/lib/app-data/tasks";
import {
  isVisibleInEngineeringSurveyQueue,
  loadEngineeringSurveySubmission,
} from "./engineering-survey-submission-model";
import { WorkflowTaskKinds, SubmissionStatuses } from "@platform/app-shared/workflow/task-types";

export function filterEngineeringSurveyListedTasks(
  tasks: WorkflowTask[],
  options?: { showCompleted?: boolean },
): WorkflowTask[] {
  return tasks.filter(
    (t) =>
      t.kind === WorkflowTaskKinds.EngineeringSurvey &&
      isVisibleInEngineeringSurveyQueue(t.id, t.status, options),
  );
}

/** Matches Case Study.html `ENG_ST` labels/classes for queue pills. */
export function engineeringSurveyTaskStatusBadge(
  taskId: string,
  taskStatus?: string,
): { label: string; className: string } | null {
  if (taskStatus === "blocked") {
    return { label: "متعذّر", className: "b-fail" };
  }
  if (taskStatus === "completed") {
    return { label: "مكتمل", className: "b-done" };
  }
  const sub = loadEngineeringSurveySubmission(taskId);
  if (sub?.status === SubmissionStatuses.Submitted) {
    return { label: "مكتمل", className: "b-done" };
  }
  if (sub?.status === SubmissionStatuses.Reopened) {
    return { label: "معادة للتصحيح", className: "b-returned" };
  }
  if (sub && sub.latitude && sub.surveyReportFileName) {
    return { label: "قيد التنفيذ", className: "b-prog" };
  }
  return { label: "جديد", className: "b-new" };
}
