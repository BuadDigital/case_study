/**
 * Runtime bridge so `@case-study/mfe` never imports `@evaluator/mfe`.
 * Shell registers the impl at app boot; case-study calls through here.
 */

import type { ComponentType } from "react";
import type { PoPropertyIntake } from "../app-data/po-intake-property-model";
import type { WorkflowTask } from "../workflow/task-types";

/** Read-only valuation report as the appraiser sees it, embedded in the property page. */
export type EvaluatorValuationReportPreviewProps = {
  appraisalTask: WorkflowTask;
  allTasks: WorkflowTask[];
  property: PoPropertyIntake;
};

/**
 * The case specialist's workspace for the valuation-report draft: `canEdit` prepares, sends and
 * withdraws it (the study sub-role); `canDeposit` records the deposit and opens a new version
 * (the review sub-role). Read-only when both are false.
 */
export type EvaluatorReportDraftPanelProps = EvaluatorValuationReportPreviewProps & {
  canEdit: boolean;
  canDeposit?: boolean;
  /**
   * Review (Omar 2026-11-05): edits the draft handed to it, sends it to the appraiser (approving it and the
   * study report) or returns it to the study, and pulls a sent draft back.
   */
  canReview?: boolean;
};

type EvaluatorQueueStatusGroup =
  | "open"
  | "in_progress"
  | "submitted"
  | "returned"
  | "completed"
  | "blocked"
  | string;

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
  ValuationReportPreview?: ComponentType<EvaluatorValuationReportPreviewProps>;
  ReportDraftPanel?: ComponentType<EvaluatorReportDraftPanelProps>;
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
