/**
 * Runtime bridge so `@case-study/mfe` never imports `@engineering-office/mfe`.
 * Shell registers the impl at app boot; case-study calls through here.
 *
 * Mirrors `../party-appraisal/evaluator-runtime-bridge`.
 */

import type { PartyWorkMutationResult } from "../app-data/party-submission-api";
import type { WorkflowTask } from "../workflow/task-types";

export type EngineeringSurveyDocField = "surveyReport" | "siteLetter";

export type CachedEngineeringSurveyFile = {
  fileName: string;
  mimeType: string;
  dataUrl?: string;
  sizeBytes?: number;
  attachmentId?: string;
};

export type EngineeringSurveyDocumentEntry = {
  id: string;
  field: EngineeringSurveyDocField;
  name: string;
  sub: string;
  attachment: CachedEngineeringSurveyFile;
};

export type EngineeringSurveySubmissionStatusRef =
  | "draft"
  | "submitted"
  | "returned"
  | "accepted"
  | (string & {});

/**
 * Structural view of an engineering-survey submission — only the fields
 * consumers outside `@engineering-office/mfe` read. The full shape stays
 * owned by that MFE.
 */
export type EngineeringSurveySubmissionRef = {
  status: EngineeringSurveySubmissionStatusRef;
  submittedAtUtc?: string;
  acceptedAtUtc?: string;
};

export type EngineeringSurveyRuntimeBridge = {
  loadEngineeringSurveySubmission: (
    taskId: string,
  ) => EngineeringSurveySubmissionRef | null;
  fetchEngineeringSurveySubmission: (
    taskId: string,
    options?: { persistFixes?: boolean },
  ) => Promise<EngineeringSurveySubmissionRef | null>;
  prefetchEngineeringSurveySubmissions: (taskIds: string[]) => Promise<void>;
  acceptEngineeringSurveySubmission: (
    taskId: string,
  ) => Promise<PartyWorkMutationResult<EngineeringSurveySubmissionRef>>;
  reopenEngineeringSurveySubmission: (
    taskId: string,
    returnNote: string,
  ) => Promise<PartyWorkMutationResult<EngineeringSurveySubmissionRef>>;
  isEngineeringSurveyOutputsAccepted: (
    submission: EngineeringSurveySubmissionRef | null | undefined,
  ) => boolean;
  listEngineeringSurveyDocuments: (
    taskId: string | null | undefined,
  ) => EngineeringSurveyDocumentEntry[];
  openEngineeringSurveyDocumentPreview: (
    attachment: CachedEngineeringSurveyFile,
    field?: EngineeringSurveyDocField,
    taskId?: string,
  ) => void;
  downloadEngineeringSurveyDocument: (
    attachment: CachedEngineeringSurveyFile,
    field?: EngineeringSurveyDocField,
    taskId?: string,
  ) => void;
  prefetchEngineeringSurveyDocuments: (
    taskId: string | null | undefined,
  ) => Promise<void>;
  filterEngineeringSurveyListedTasks: (
    tasks: WorkflowTask[],
    options?: { showCompleted?: boolean },
  ) => WorkflowTask[];
};

let bridge: EngineeringSurveyRuntimeBridge | null = null;

export function registerEngineeringSurveyRuntimeBridge(
  next: EngineeringSurveyRuntimeBridge,
): void {
  bridge = next;
}

export function getEngineeringSurveyRuntimeBridge(): EngineeringSurveyRuntimeBridge {
  if (!bridge) {
    throw new Error(
      "Engineering-survey runtime bridge is not registered. Wire it from the shell at boot.",
    );
  }
  return bridge;
}

export function tryGetEngineeringSurveyRuntimeBridge(): EngineeringSurveyRuntimeBridge | null {
  return bridge;
}

/** Soft helper — falls back when the shell has not registered yet (SSR / tests). */
export function withEngineeringSurveyBridge<T>(
  fn: (b: EngineeringSurveyRuntimeBridge) => T,
  fallback: T,
): T {
  return bridge ? fn(bridge) : fallback;
}
