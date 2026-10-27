import {
  isFoldedAppraisalTask,
  type WorkflowTask,
} from "@platform/app-shared/workflow/task-types";
import { isVisibleInAppraiserQueue } from "./evaluator-submission-model";
import { appraiserQueueStatusBadge } from "./evaluator-readiness";

/**
 * The rows of the appraiser queue — Case Study.html `renderValOrders`.
 *
 * How it works: keeps only `property-appraisal` tasks, drops folded ones
 * (`isFoldedAppraisalTask`), then applies `isVisibleInAppraiserQueue`: completed (final
 * issuance) rows hidden by default; "Show all" (`showCompleted`) restores them. A submitted
 * package is only handed over, so its task stays listed.
 *
 * Edge cases: phase 5 — one valuation per transaction, so a deed folded
 * into another deed's valuation is not a row; the holder deed's task is the one listed, and a
 * deed whose holder is itself stays.
 */
export function filterAppraiserListedTasks(
  tasks: WorkflowTask[],
  options?: { showCompleted?: boolean },
): WorkflowTask[] {
  return tasks.filter((t) => {
    if (t.kind !== "property-appraisal") return false;
    // Phase 5: one valuation per transaction — a deed folded into another deed's valuation is not a row.
    if (isFoldedAppraisalTask(t)) return false;
    return isVisibleInAppraiserQueue(t.id, t.status, {
      showSubmitted: options?.showCompleted,
    });
  });
}

export function canAppraiserOpenTask(taskId: string, taskStatus: string): boolean {
  return isVisibleInAppraiserQueue(taskId, taskStatus, { showSubmitted: true });
}

/** @deprecated Prefer appraiserQueueStatusBadge with full task+tasks context. */
export function appraiserTaskStatusBadge(
  taskId: string,
  taskStatus?: string,
): { label: string; className: string } | null {
  const stub = {
    id: taskId,
    status: (taskStatus ?? "open") as WorkflowTask["status"],
  } as WorkflowTask;
  return appraiserQueueStatusBadge(stub, []);
}

export {
  appraiserQueueStatusBadge,
  appraiserReadiness,
  appraiserQueueStatusGroup,
  findSiblingSurveyTask,
  appraiserInspectionDone,
  appraiserInspectionAccepted,
  appraiserSurveyDone,
  appraiserNeedsSurvey,
} from "./evaluator-readiness";
