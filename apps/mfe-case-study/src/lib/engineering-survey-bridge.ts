/**
 * Case-study access to engineering-survey helpers.
 * Shell registers the bridge at boot via `ensureEngineeringSurveyBridgeRegistered`.
 */

import {
  getEngineeringSurveyRuntimeBridge,
  withEngineeringSurveyBridge,
  type CachedEngineeringSurveyFile,
  type EngineeringSurveyDocField,
  type EngineeringSurveyDocumentEntry,
  type EngineeringSurveySubmissionRef,
} from "@platform/app-shared/engineering-survey/runtime-bridge";
import type { WorkflowTask } from "@platform/app-shared/workflow/task-types";

export type {
  CachedEngineeringSurveyFile,
  EngineeringSurveyDocField,
  EngineeringSurveyDocumentEntry,
  EngineeringSurveySubmissionRef,
};

export function loadEngineeringSurveySubmission(taskId: string) {
  return withEngineeringSurveyBridge(
    (b) => b.loadEngineeringSurveySubmission(taskId),
    null,
  );
}

export function fetchEngineeringSurveySubmission(
  taskId: string,
  options?: { persistFixes?: boolean },
) {
  return getEngineeringSurveyRuntimeBridge().fetchEngineeringSurveySubmission(
    taskId,
    options,
  );
}

export function prefetchEngineeringSurveySubmissions(taskIds: string[]) {
  return withEngineeringSurveyBridge(
    (b) => b.prefetchEngineeringSurveySubmissions(taskIds),
    Promise.resolve(),
  );
}

export function acceptEngineeringSurveySubmission(taskId: string) {
  return getEngineeringSurveyRuntimeBridge().acceptEngineeringSurveySubmission(
    taskId,
  );
}

export function reopenEngineeringSurveySubmission(
  taskId: string,
  returnNote: string,
) {
  return getEngineeringSurveyRuntimeBridge().reopenEngineeringSurveySubmission(
    taskId,
    returnNote,
  );
}

export function isEngineeringSurveyOutputsAccepted(
  submission: EngineeringSurveySubmissionRef | null | undefined,
): boolean {
  return withEngineeringSurveyBridge(
    (b) => b.isEngineeringSurveyOutputsAccepted(submission),
    false,
  );
}

export function listEngineeringSurveyDocuments(
  taskId: string | null | undefined,
): EngineeringSurveyDocumentEntry[] {
  return withEngineeringSurveyBridge(
    (b) => b.listEngineeringSurveyDocuments(taskId),
    [],
  );
}

export function openEngineeringSurveyDocumentPreview(
  attachment: CachedEngineeringSurveyFile,
  field?: EngineeringSurveyDocField,
  taskId?: string,
): void {
  withEngineeringSurveyBridge(
    (b) => b.openEngineeringSurveyDocumentPreview(attachment, field, taskId),
    undefined,
  );
}

export function downloadEngineeringSurveyDocument(
  attachment: CachedEngineeringSurveyFile,
  field?: EngineeringSurveyDocField,
  taskId?: string,
): void {
  withEngineeringSurveyBridge(
    (b) => b.downloadEngineeringSurveyDocument(attachment, field, taskId),
    undefined,
  );
}

export function prefetchEngineeringSurveyDocuments(
  taskId: string | null | undefined,
) {
  return withEngineeringSurveyBridge(
    (b) => b.prefetchEngineeringSurveyDocuments(taskId),
    Promise.resolve(),
  );
}

export function filterEngineeringSurveyListedTasks(
  tasks: WorkflowTask[],
  options?: { showCompleted?: boolean },
): WorkflowTask[] {
  return withEngineeringSurveyBridge(
    (b) => b.filterEngineeringSurveyListedTasks(tasks, options),
    tasks,
  );
}
