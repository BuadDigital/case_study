import type { WorkflowTask } from "./task-types";

/**
 * Whether a task is finished. A party child (inspection / survey / appraisal) is created in phase
 * "done" and stays there, so its phase says nothing: it is done only when its status is completed.
 * For the appraiser that happens at the final issuance of the valuation report — after he submits,
 * the task stays open (his package handed to the specialist, data locked). Only the case-study
 * parent uses phase "done" as a finished marker.
 */
export function isPartyTaskDone(
  task: Pick<WorkflowTask, "kind" | "status" | "phase">,
): boolean {
  if (task.status === "completed") return true;
  return task.kind === "case-study-property" && task.phase === "done";
}
