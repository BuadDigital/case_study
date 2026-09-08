/**
 * Thin helpers over the evaluator←case-study runtime bridge.
 * Prefer these over importing `@case-study/mfe` from evaluator code.
 */

import { getEvaluatorCaseStudyBridge } from "@platform/app-shared/evaluator/case-study-bridge";
import type { CaseStudyFormDraft } from "@platform/app-shared/app-data/case-study-form-model";
import type { InspectorWorkspaceDraft } from "@platform/app-shared/app-data/inspector-workspace-data";
import type { PoPropertyIntake } from "@platform/app-shared/app-data/po-intake-data";
import type { PropertyDetailDocumentEntry } from "@platform/app-shared/app-data/property-detail-document-types";

export function fetchInspectorWorkspace(taskId: string) {
  return getEvaluatorCaseStudyBridge().fetchInspectorWorkspace(taskId);
}

export function prefetchInspectorWorkspacePhotos(
  draft: InspectorWorkspaceDraft,
) {
  return getEvaluatorCaseStudyBridge().prefetchInspectorWorkspacePhotos(draft);
}

export function usePoRecordQuery(poNumber: string | null) {
  return getEvaluatorCaseStudyBridge().usePoRecordQuery(poNumber);
}

export function useWorkflowTasksQuery(options?: { live?: boolean }) {
  return getEvaluatorCaseStudyBridge().useWorkflowTasksQuery(options);
}

export function usePropertyDetailDocuments(input: {
  property: PoPropertyIntake;
  showDecree: boolean;
  poNumber: string;
  surveyTaskId: string | null;
  appraisalTaskId: string | null;
  inspectionTaskId: string | null;
  enabled?: boolean;
}) {
  return getEvaluatorCaseStudyBridge().usePropertyDetailDocuments(input);
}

export function loadPartyCaseStudyFormDraft(childTaskId: string) {
  return getEvaluatorCaseStudyBridge().loadPartyCaseStudyFormDraft(childTaskId);
}

export function savePartyCaseStudyFormDraft(draft: CaseStudyFormDraft) {
  return getEvaluatorCaseStudyBridge().savePartyCaseStudyFormDraft(draft);
}

export function collectFieldInspectionDocumentsFromSubmission(
  submission: InspectorWorkspaceDraft,
) {
  return getEvaluatorCaseStudyBridge().collectFieldInspectionDocumentsFromSubmission(
    submission,
  );
}

export function downloadPropertyDetailDocument(
  entry: PropertyDetailDocumentEntry,
) {
  return getEvaluatorCaseStudyBridge().downloadPropertyDetailDocument(entry);
}
