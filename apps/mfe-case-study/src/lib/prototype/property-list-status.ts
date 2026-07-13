import type { PropertyWorkflowStage } from "@platform/app-shared/prototype/constants";
import type { WorkflowTask } from "./tasks-storage";

/**
 * Derive list-row workflow status from tasks for one property.
 * Returns null when there are no tasks (caller keeps intake/failure rules).
 */
export function resolvePropertyStatusFromTasks(
  poNumber: string,
  propertyId: string,
  tasks: WorkflowTask[],
): PropertyWorkflowStage | null {
  const po = poNumber.trim();
  const propertyTasks = tasks.filter(
    (t) => t.poNumber.trim() === po && t.propertyId === propertyId,
  );
  if (propertyTasks.length === 0) return null;

  const active = propertyTasks.filter((t) => t.status !== "cancelled");
  if (active.length === 0) return "fail";

  const parent = active.find((t) => t.kind === "case-study-property");
  if (
    parent?.status === "completed" ||
    parent?.phase === "done" ||
    active.every((t) => t.status === "completed")
  ) {
    return "done";
  }

  const started = active.some(
    (t) =>
      t.status === "completed" ||
      t.phase === "distribution" ||
      t.phase === "case-study" ||
      t.phase === "done" ||
      t.kind !== "case-study-property",
  );
  return started ? "progress" : "new";
}

export function resolvePropertyTrackStagesFromTasks(
  poNumber: string,
  propertyId: string,
  tasks: WorkflowTask[],
): Partial<{
  survey: PropertyWorkflowStage;
  val: PropertyWorkflowStage;
  study: PropertyWorkflowStage;
}> {
  const po = poNumber.trim();
  const propertyTasks = tasks.filter(
    (t) => t.poNumber.trim() === po && t.propertyId === propertyId,
  );
  if (propertyTasks.length === 0) return {};

  const stage = (kind: WorkflowTask["kind"]): PropertyWorkflowStage => {
    const task = propertyTasks.find((t) => t.kind === kind);
    if (!task || task.status === "cancelled") return "new";
    if (task.status === "completed") return "done";
    return "progress";
  };

  const parent = propertyTasks.find((t) => t.kind === "case-study-property");
  let study: PropertyWorkflowStage = "new";
  if (parent) {
    if (parent.status === "completed" || parent.phase === "done") study = "done";
    else if (
      parent.phase === "case-study" ||
      parent.phase === "distribution" ||
      parent.status === "open" ||
      parent.status === "blocked"
    ) {
      study = "progress";
    }
  }

  return {
    survey: stage("engineering-survey"),
    val: stage("property-appraisal"),
    study,
  };
}
