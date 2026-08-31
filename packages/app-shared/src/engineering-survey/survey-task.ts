import type { WorkflowTask } from "../workflow/task-types";

export function findSurveyChildForParent(
  parentTaskId: string,
  propertyId: string,
  tasks: WorkflowTask[],
): WorkflowTask | null {
  const children = tasks.filter(
    (t) => t.parentTaskId === parentTaskId && t.kind === "engineering-survey",
  );
  if (!children.length) return null;
  if (propertyId) {
    return children.find((t) => t.propertyId === propertyId) ?? children[0]!;
  }
  return children[0]!;
}
