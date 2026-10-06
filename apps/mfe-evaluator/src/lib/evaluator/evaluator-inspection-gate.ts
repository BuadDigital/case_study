import type { WorkflowTask } from "@platform/app-shared/workflow/task-types";

export type InspectionGateState =
  | { ready: true }
  | { ready: false; reason: string };

export function findSiblingInspectionTask(
  appraisalTask: WorkflowTask,
  tasks: WorkflowTask[],
): WorkflowTask | null {
  if (!appraisalTask.parentTaskId) return null;
  return (
    tasks.find(
      (t) =>
        t.parentTaskId === appraisalTask.parentTaskId &&
        t.propertyId === appraisalTask.propertyId &&
        t.kind === "field-inspection",
    ) ?? null
  );
}

// There is no START gate any more: the appraiser drafts from the moment the task exists and reads
// the inspector's draft package read-only. Only the SUBMIT waits (study report, below).

/** Shown as the notice, the toast and the submit error while the study report is not issued. */
export const STUDY_REPORT_NOT_ISSUED_MESSAGE =
  "لا يمكن تسليم التقييم قبل أن يصدر الأخصائي تقرير دراسة الحالة";

/** Server field-error key returned by the submit endpoint for the same rule. */
export const STUDY_REPORT_ERROR_KEY = "studyReport";

/**
 * Appraiser SUBMISSION gate: the specialist's study report must be issued first.
 * Works on the workflow task or the party submission (both carry `studyReportIssued`).
 * Anything other than an explicit `true` (missing, null, unknown) stays closed.
 */
export function studyReportGateForSubmission(
  source: { studyReportIssued?: boolean | null } | null | undefined,
): InspectionGateState {
  return source?.studyReportIssued === true
    ? { ready: true }
    : { ready: false, reason: STUDY_REPORT_NOT_ISSUED_MESSAGE };
}

/** True for the study-report rule's message, however it reached us (client gate or server field error). */
export function isStudyReportBlockMessage(message: string | null | undefined): boolean {
  return Boolean(message?.includes("قبل أن يصدر الأخصائي تقرير دراسة الحالة"));
}

export function findAppraisalChildForParent(
  parentTaskId: string,
  propertyId: string,
  tasks: WorkflowTask[],
): WorkflowTask | null {
  return (
    tasks.find(
      (t) =>
        t.parentTaskId === parentTaskId &&
        t.propertyId === propertyId &&
        t.kind === "property-appraisal",
    ) ?? null
  );
}
