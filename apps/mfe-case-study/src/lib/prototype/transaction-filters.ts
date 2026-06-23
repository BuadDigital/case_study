import { getPropertyFailure } from "@failures/mfe";
import type { PoIntakeRecord } from "./po-intake-data";
import { isBourseInquiryIdentifier } from "./po-intake-data";
import { findPropertyForTask } from "./my-task-row";
import type { WorkflowTask } from "./tasks-storage";

function hasActiveFailureOnTask(task: WorkflowTask): boolean {
  const propertyId = task.propertyId?.trim();
  if (!propertyId) return false;
  const failure = getPropertyFailure(task.poNumber, propertyId);
  if (!failure) return false;
  return failure.status !== "returned" && failure.status !== "resolved";
}

export function taskMatchesPrimaryData(task: WorkflowTask): boolean {
  if (task.kind !== "case-study-property") return false;
  return task.phase === "enfath";
}

export function taskMatchesDistribution(task: WorkflowTask): boolean {
  if (task.kind !== "case-study-property") return false;
  if (task.phase === "obstruction") return false;
  if (task.phase !== "distribution") return false;
  if (hasActiveFailureOnTask(task)) return false;
  return true;
}

export function filterTasksForDistribution(tasks: WorkflowTask[]): WorkflowTask[] {
  return tasks.filter((t) => taskMatchesDistribution(t));
}

export function taskMatchesBourseInquiry(
  task: WorkflowTask,
  record: PoIntakeRecord | undefined,
): boolean {
  if (task.kind !== "case-study-property") return false;
  const property = findPropertyForTask(record, task);
  if (property && isBourseInquiryIdentifier(property.identifierType)) {
    return task.phase === "bourse" || task.phase === "enfath";
  }
  return task.phase === "bourse";
}

export function filterTasksForPrimaryData(
  tasks: WorkflowTask[],
  _poByNumber: Map<string, PoIntakeRecord>,
): WorkflowTask[] {
  return tasks.filter((t) => taskMatchesPrimaryData(t));
}

export function filterTasksForBourseInquiry(
  tasks: WorkflowTask[],
  poByNumber: Map<string, PoIntakeRecord>,
): WorkflowTask[] {
  return tasks.filter((t) =>
    taskMatchesBourseInquiry(t, poByNumber.get(t.poNumber.trim())),
  );
}
