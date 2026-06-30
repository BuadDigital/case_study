import { loadEvaluatorSubmission } from "@evaluator/mfe";
import { loadEngineeringSurveySubmission } from "@engineering-office/mfe/lib/engineering-survey-submission-storage";
import type { WorkflowTask } from "./tasks-storage";
import { loadGovernmentReviewSubmission } from "./government-review-work-storage";
import { loadInspectorWorkspace } from "./inspector-workspace-storage";

const PARTY_RECALL_KINDS = new Set([
  "property-appraisal",
  "engineering-survey",
  "field-inspection",
  "government-review",
]);

export function supportsPartyTaskRecall(kind: string): boolean {
  return PARTY_RECALL_KINDS.has(kind);
}

export function isPartyTaskSubmissionSubmitted(task: WorkflowTask): boolean {
  if (!supportsPartyTaskRecall(task.kind)) return false;

  switch (task.kind) {
    case "property-appraisal":
      return loadEvaluatorSubmission(task.id)?.status === "submitted";
    case "engineering-survey":
      return loadEngineeringSurveySubmission(task.id)?.status === "submitted";
    case "field-inspection":
      return loadInspectorWorkspace(task.id)?.status === "submitted";
    case "government-review":
      return loadGovernmentReviewSubmission(task.id)?.status === "submitted";
    default:
      return false;
  }
}
