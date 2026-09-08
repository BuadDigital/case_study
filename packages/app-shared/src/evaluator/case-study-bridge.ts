/**
 * Runtime bridge so `@evaluator/mfe` never imports `@case-study/mfe`.
 * Shell registers the impl at app boot; evaluator calls through here.
 *
 * Mirrors `../failures/case-study-bridge`.
 */

import type { UseQueryResult } from "@tanstack/react-query";
import type {
  CaseStudyFormDraft,
  SaveCaseStudyFormDraftResult,
} from "../app-data/case-study-form-model";
import type {
  PropertyDetailDocumentEntry,
  PropertyDetailDocumentSection,
} from "../app-data/property-detail-document-types";
import type {
  InspectorWorkspaceDraft,
  PoIntakeRecord,
  PoPropertyIntake,
} from "./case-study-types";
import type { WorkflowTask } from "../workflow/task-types";

export type EvaluatorCaseStudyBridge = {
  fetchInspectorWorkspace: (
    taskId: string,
  ) => Promise<InspectorWorkspaceDraft | null>;
  prefetchInspectorWorkspacePhotos: (
    draft: InspectorWorkspaceDraft,
  ) => Promise<void>;
  usePoRecordQuery: (
    poNumber: string | null,
  ) => UseQueryResult<PoIntakeRecord | null | undefined>;
  useWorkflowTasksQuery: (options?: {
    live?: boolean;
  }) => UseQueryResult<WorkflowTask[] | undefined>;
  usePropertyDetailDocuments: (input: {
    property: PoPropertyIntake;
    showDecree: boolean;
    poNumber: string;
    surveyTaskId: string | null;
    appraisalTaskId: string | null;
    inspectionTaskId: string | null;
    enabled?: boolean;
  }) => PropertyDetailDocumentSection[];
  loadPartyCaseStudyFormDraft: (
    childTaskId: string,
  ) => Promise<CaseStudyFormDraft | null>;
  savePartyCaseStudyFormDraft: (
    draft: CaseStudyFormDraft,
  ) => Promise<SaveCaseStudyFormDraftResult>;
  collectFieldInspectionDocumentsFromSubmission: (
    submission: InspectorWorkspaceDraft,
  ) => PropertyDetailDocumentEntry[];
  downloadPropertyDetailDocument: (entry: PropertyDetailDocumentEntry) => void;
};

let bridge: EvaluatorCaseStudyBridge | null = null;

export function registerEvaluatorCaseStudyBridge(
  next: EvaluatorCaseStudyBridge,
): void {
  bridge = next;
}

export function getEvaluatorCaseStudyBridge(): EvaluatorCaseStudyBridge {
  if (!bridge) {
    throw new Error(
      "Evaluator/case-study bridge is not registered. Wire it from the shell at boot.",
    );
  }
  return bridge;
}

export function tryGetEvaluatorCaseStudyBridge(): EvaluatorCaseStudyBridge | null {
  return bridge;
}
