/**
 * Case-study access to evaluator runtime — never import `@evaluator/mfe` here.
 * Shell registers the bridge at boot via `ensureEvaluatorRuntimeBridgeRegistered`.
 */

import {
  getEvaluatorRuntimeBridge,
  tryGetEvaluatorRuntimeBridge,
  withEvaluatorBridge,
} from "@platform/app-shared/party-appraisal/evaluator-runtime-bridge";
import type { WorkflowTask } from "@platform/app-shared/workflow/task-types";

export function filterAppraiserListedTasks(
  tasks: WorkflowTask[],
  options?: { showCompleted?: boolean },
): WorkflowTask[] {
  return withEvaluatorBridge(
    (b) => b.filterAppraiserListedTasks(tasks, options),
    tasks.filter((t) => t.kind === "property-appraisal"),
  );
}

export function appraiserQueueStatusGroup(
  task: WorkflowTask,
  allTasks: WorkflowTask[],
): string {
  return withEvaluatorBridge(
    (b) => b.appraiserQueueStatusGroup(task, allTasks),
    task.status === "completed" ? "closed" : "new",
  );
}

export function appraiserQueueStatusBadge(
  task: WorkflowTask,
  allTasks: WorkflowTask[],
): { label: string; className: string } | null {
  return withEvaluatorBridge(
    (b) => b.appraiserQueueStatusBadge(task, allTasks),
    null,
  );
}

export function appraiserInspectionDone(
  task: WorkflowTask,
  allTasks: WorkflowTask[],
): boolean {
  return withEvaluatorBridge(
    (b) => b.appraiserInspectionDone(task, allTasks),
    Boolean(task.fieldInspectionCompleted),
  );
}

export function appraiserSurveyDone(
  task: WorkflowTask,
  allTasks: WorkflowTask[],
): boolean {
  return withEvaluatorBridge((b) => b.appraiserSurveyDone(task, allTasks), true);
}

export function appraiserNeedsSurvey(
  task: WorkflowTask,
  allTasks: WorkflowTask[],
): boolean {
  return withEvaluatorBridge(
    (b) => b.appraiserNeedsSurvey(task, allTasks),
    false,
  );
}

export function findSiblingInspectionTask(
  appraisalTask: WorkflowTask,
  allTasks: WorkflowTask[],
): WorkflowTask | null {
  return withEvaluatorBridge(
    (b) => b.findSiblingInspectionTask(appraisalTask, allTasks),
    null,
  );
}

export function findSiblingSurveyTask(
  appraisalTask: WorkflowTask,
  allTasks: WorkflowTask[],
): WorkflowTask | null {
  return withEvaluatorBridge(
    (b) => b.findSiblingSurveyTask(appraisalTask, allTasks),
    null,
  );
}

export function loadEvaluatorSubmission(taskId: string): unknown | null {
  return withEvaluatorBridge((b) => b.loadEvaluatorSubmission(taskId), null);
}

export async function fetchEvaluatorSubmission(
  taskId: string,
): Promise<unknown | null> {
  const b = tryGetEvaluatorRuntimeBridge();
  if (!b) return null;
  return b.fetchEvaluatorSubmission(taskId);
}

export function prefetchEvaluatorReport(taskId: string): void {
  withEvaluatorBridge((b) => {
    void b.prefetchEvaluatorReport(taskId);
  }, undefined);
}

export function getCachedEvaluatorReport(
  taskId: string,
): {
  fileName: string;
  mimeType?: string;
  dataUrl?: string;
  attachmentId?: string;
} | null {
  return withEvaluatorBridge((b) => b.getCachedEvaluatorReport(taskId), null);
}

export function getCachedEvaluatorDepositCertificate(
  taskId: string,
): {
  fileName: string;
  mimeType?: string;
  dataUrl?: string;
  attachmentId?: string;
} | null {
  return withEvaluatorBridge(
    (b) => b.getCachedEvaluatorDepositCertificate(taskId),
    null,
  );
}

export function mergeEvaluatorChecklistFromCaseStudy(
  checklist: unknown,
  answers: unknown,
  remarks?: unknown,
  options?: { overwriteLinked?: boolean },
): unknown {
  return getEvaluatorRuntimeBridge().mergeEvaluatorChecklistFromCaseStudy(
    checklist,
    answers,
    remarks,
    options,
  );
}

export function appraiserOnlyCaseStudyChecklistItems(
  roles: unknown,
): Array<{ caseStudyKey: string; label: string }> {
  return withEvaluatorBridge(
    (b) => b.appraiserOnlyCaseStudyChecklistItems(roles),
    [],
  );
}

export function caseStudyAnswerDisplayLabel(answer: unknown): string {
  return withEvaluatorBridge(
    (b) => b.caseStudyAnswerDisplayLabel(answer),
    "—",
  );
}

export function isEvaluatorChecklistQuestionAssignedToAppraiser(
  roles: unknown,
  key: string,
): boolean {
  return withEvaluatorBridge(
    (b) => b.isEvaluatorChecklistQuestionAssignedToAppraiser(roles, key),
    false,
  );
}

export function syncEvaluatorChecklistFromPartyCaseStudy(
  taskId: string,
  options?: { overwriteLinked?: boolean },
): void {
  withEvaluatorBridge((b) => {
    void b.syncEvaluatorChecklistFromPartyCaseStudy(taskId, options);
  }, undefined);
}

/** Local checklist boolean keys — mirrors evaluator link keys without importing MFE. */
export type EvaluatorChecklistBooleanKey =
  | "q_plan_match"
  | "q_excess_zoning"
  | "q_land_waqf"
  | "q_property_waqf"
  | "q_expropriation"
  | "q_property_use_verified"
  | "q_agriculture_inquiry"
  | "q_overlap"
  | "q_shared_building"
  | "q_environmental_factors"
  | "q_unregistered_additions"
  | "q_shared_deed"
  | "q_lease_exists"
  | "q_lease_active"
  | "q_technical_notes_exists";
