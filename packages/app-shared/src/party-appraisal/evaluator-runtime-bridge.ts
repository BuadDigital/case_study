/**
 * Runtime bridge so `@case-study/mfe` never imports `@evaluator/mfe`.
 * Shell registers the impl at app boot; case-study calls through here.
 */

import type { WorkflowTask } from "../workflow/task-types";

export type EvaluatorQueueStatusGroup =
  | "open"
  | "in_progress"
  | "submitted"
  | "returned"
  | "completed"
  | "blocked"
  | string;

export type EvaluatorChecklistAnswersBridge = Record<string, unknown>;

export type EvaluatorRuntimeBridge = {
  filterAppraiserListedTasks: (
    tasks: WorkflowTask[],
    options?: { showCompleted?: boolean },
  ) => WorkflowTask[];
  appraiserQueueStatusGroup: (
    task: WorkflowTask,
    allTasks: WorkflowTask[],
  ) => EvaluatorQueueStatusGroup;
  appraiserQueueStatusBadge: (
    task: WorkflowTask,
    allTasks: WorkflowTask[],
  ) => { label: string; className: string } | null;
  appraiserInspectionDone: (
    task: WorkflowTask,
    allTasks: WorkflowTask[],
  ) => boolean;
  appraiserSurveyDone: (
    task: WorkflowTask,
    allTasks: WorkflowTask[],
  ) => boolean;
  appraiserNeedsSurvey: (
    task: WorkflowTask,
    allTasks: WorkflowTask[],
  ) => boolean;
  findSiblingInspectionTask: (
    appraisalTask: WorkflowTask,
    allTasks: WorkflowTask[],
  ) => WorkflowTask | null;
  findSiblingSurveyTask: (
    appraisalTask: WorkflowTask,
    allTasks: WorkflowTask[],
  ) => WorkflowTask | null;
  loadEvaluatorSubmission: (taskId: string) => unknown | null;
  fetchEvaluatorSubmission: (taskId: string) => Promise<unknown | null>;
  prefetchEvaluatorReport: (taskId: string) => Promise<void> | void;
  getCachedEvaluatorReport: (
    taskId: string,
  ) => {
    fileName: string;
    mimeType?: string;
    dataUrl?: string;
    attachmentId?: string;
  } | null;
  getCachedEvaluatorDepositCertificate: (
    taskId: string,
  ) => {
    fileName: string;
    mimeType?: string;
    dataUrl?: string;
    attachmentId?: string;
  } | null;
  mergeEvaluatorChecklistFromCaseStudy: (
    checklist: unknown,
    answers: unknown,
    remarks?: unknown,
    options?: { overwriteLinked?: boolean },
  ) => unknown;
  appraiserOnlyCaseStudyChecklistItems: (
    roles: unknown,
  ) => Array<{ caseStudyKey: string; label: string }>;
  caseStudyAnswerDisplayLabel: (answer: unknown) => string;
  isEvaluatorChecklistQuestionAssignedToAppraiser: (
    roles: unknown,
    key: string,
  ) => boolean;
  syncEvaluatorChecklistFromPartyCaseStudy: (
    taskId: string,
    options?: { overwriteLinked?: boolean },
  ) => Promise<void> | void;
};

let bridge: EvaluatorRuntimeBridge | null = null;

export function registerEvaluatorRuntimeBridge(
  next: EvaluatorRuntimeBridge,
): void {
  bridge = next;
}

export function getEvaluatorRuntimeBridge(): EvaluatorRuntimeBridge {
  if (!bridge) {
    throw new Error(
      "Evaluator runtime bridge is not registered. Wire it from the shell at boot.",
    );
  }
  return bridge;
}

export function tryGetEvaluatorRuntimeBridge(): EvaluatorRuntimeBridge | null {
  return bridge;
}

/** Soft helpers — no-op / empty when shell has not registered yet (SSR / tests). */
export function withEvaluatorBridge<T>(
  fn: (b: EvaluatorRuntimeBridge) => T,
  fallback: T,
): T {
  return bridge ? fn(bridge) : fallback;
}
