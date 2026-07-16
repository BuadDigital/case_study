import { getPropertyFailure, isBlockingFailureStatus } from "@failures/mfe";
import type { PoIntakeRecord } from "./po-intake-data";
import { findPropertyForTask } from "./my-task-row";
import type { WorkflowTask } from "./tasks-storage";

function hasActiveFailureOnTask(task: WorkflowTask): boolean {
  const propertyId = task.propertyId?.trim();
  if (!propertyId) return false;
  const failure = getPropertyFailure(task.poNumber, propertyId);
  if (!failure) return false;
  return isBlockingFailureStatus(failure.status);
}

function isLinkedToRemovedProperty(
  task: WorkflowTask,
  poByNumber?: Map<string, PoIntakeRecord>,
): boolean {
  if (!poByNumber || !task.propertyId?.trim()) return false;
  const record = poByNumber.get(task.poNumber.trim());
  const property = findPropertyForTask(record, task);
  return Boolean(property?.isRemoved);
}

export function taskMatchesPrimaryData(
  task: WorkflowTask,
  poByNumber?: Map<string, PoIntakeRecord>,
): boolean {
  if (task.kind !== "case-study-property") return false;
  if (isLinkedToRemovedProperty(task, poByNumber)) return false;
  return task.phase === "enfath";
}

export function taskMatchesDistribution(
  task: WorkflowTask,
  poByNumber?: Map<string, PoIntakeRecord>,
): boolean {
  if (task.kind !== "case-study-property") return false;
  if (isLinkedToRemovedProperty(task, poByNumber)) return false;
  if (task.phase === "obstruction") return false;
  if (task.phase !== "distribution") return false;
  if (hasActiveFailureOnTask(task)) return false;
  return true;
}

export function filterTasksForDistribution(
  tasks: WorkflowTask[],
  poByNumber?: Map<string, PoIntakeRecord>,
): WorkflowTask[] {
  return tasks.filter((t) => taskMatchesDistribution(t, poByNumber));
}

export function taskMatchesBourseInquiry(
  task: WorkflowTask,
  record: PoIntakeRecord | undefined,
): boolean {
  if (task.kind !== "case-study-property") return false;
  const property = findPropertyForTask(record, task);
  if (property?.isRemoved) return false;
  // Revert to enfath must leave استعلام البورصة — do not keep enfath rows here
  // even for identifierType = bourse_inquiry (those are edited from البيانات الأولية).
  return task.phase === "bourse";
}

export function filterTasksForPrimaryData(
  tasks: WorkflowTask[],
  poByNumber: Map<string, PoIntakeRecord>,
): WorkflowTask[] {
  return tasks.filter((t) => taskMatchesPrimaryData(t, poByNumber));
}

export function filterTasksForBourseInquiry(
  tasks: WorkflowTask[],
  poByNumber: Map<string, PoIntakeRecord>,
): WorkflowTask[] {
  return tasks.filter((t) =>
    taskMatchesBourseInquiry(t, poByNumber.get(t.poNumber.trim())),
  );
}
