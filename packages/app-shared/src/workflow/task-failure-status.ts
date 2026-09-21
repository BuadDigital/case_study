import type { WorkflowTask } from "./task-types";

/** Queue pill for a task whose property has a raised failure — same wording for every party. */
export const FAILURE_OBSTRUCTED_LABEL = "متعذر";
export const FAILURE_OBSTRUCTED_BADGE = {
  label: FAILURE_OBSTRUCTED_LABEL,
  className: "b-fail",
} as const;

/**
 * The task's property has a failure that is not resolved or suspended, or the task itself sits in
 * the obstruction phase. A finished task keeps its own status: the failure no longer holds it.
 */
export function isTaskFailureObstructed(
  task: Pick<WorkflowTask, "status" | "phase" | "propertyFailureBlocked">,
): boolean {
  if (task.status === "completed" || task.phase === "done") return false;
  return task.propertyFailureBlocked === true || task.phase === "obstruction";
}
