import type { WorkflowTask } from "./prototype/tasks-storage";

export function findGovernmentReviewChildForParent(
  parentTaskId: string,
  propertyId: string,
  tasks: WorkflowTask[],
): WorkflowTask | null {
  const children = tasks.filter(
    (t) => t.parentTaskId === parentTaskId && t.kind === "government-review",
  );
  if (!children.length) return null;
  if (propertyId) {
    return children.find((t) => t.propertyId === propertyId) ?? children[0]!;
  }
  return children[0]!;
}
