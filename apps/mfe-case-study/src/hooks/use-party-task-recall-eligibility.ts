import { useEffect, useMemo, useState } from "react";
import { EVALUATOR_SUBMISSION_CHANGED_EVENT } from "@evaluator/mfe";
import { ENGINEERING_SURVEY_SUBMISSION_CHANGED_EVENT } from "@engineering-office/mfe";
import { PARTY_TASK_RECALL_CHANGED_EVENT } from "@platform/app-shared/prototype/party-task-recall-storage";
import type { WorkflowTask } from "../lib/prototype/tasks-storage";
import { GOVERNMENT_REVIEW_SUBMISSION_CHANGED_EVENT } from "../lib/prototype/government-review-work-storage";
import { FIELD_INSPECTION_SUBMISSION_CHANGED_EVENT } from "../lib/prototype/inspector-workspace-storage";
import {
  isPartyTaskSubmissionSubmitted,
  supportsPartyTaskRecall,
} from "../lib/prototype/party-task-recall";

function submissionEventsForKind(kind: string): string[] {
  switch (kind) {
    case "property-appraisal":
      return [EVALUATOR_SUBMISSION_CHANGED_EVENT];
    case "engineering-survey":
      return [ENGINEERING_SURVEY_SUBMISSION_CHANGED_EVENT];
    case "field-inspection":
      return [FIELD_INSPECTION_SUBMISSION_CHANGED_EVENT];
    case "government-review":
      return [GOVERNMENT_REVIEW_SUBMISSION_CHANGED_EVENT];
    default:
      return [];
  }
}

export function usePartyTaskRecallEligibility(task: WorkflowTask): boolean {
  const [refreshKey, setRefreshKey] = useState(0);

  useEffect(() => {
    if (!supportsPartyTaskRecall(task.kind)) return;
    const bump = () => setRefreshKey((k) => k + 1);
    const events = [
      PARTY_TASK_RECALL_CHANGED_EVENT,
      ...submissionEventsForKind(task.kind),
    ];
    for (const eventName of events) {
      window.addEventListener(eventName, bump);
    }
    return () => {
      for (const eventName of events) {
        window.removeEventListener(eventName, bump);
      }
    };
  }, [task.id, task.kind]);

  return useMemo(() => {
    void refreshKey;
    return isPartyTaskSubmissionSubmitted(task);
  }, [refreshKey, task]);
}
