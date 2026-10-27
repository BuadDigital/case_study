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

/**
 * Whether the property's valuation report is deposited — the second half of «جاهز للرفع» beside
 * the issued case-study report (the study is issued before the valuation since 2026-10-05).
 *
 * How it works: takes the property the valuation lives on (the holder deed for a deed folded into
 * another deed's transaction, else the task's own property), finds its latest appraisal task that
 * is not cancelled, and is true only when that task is completed — which happens at the final
 * issuance with the deposit certificate, never at the appraiser's submit.
 *
 * Edge cases: no appraisal task for that property (not distributed yet, or the list does not carry
 * it) → false; a new valuation version reopens the holder's task → false again.
 */
export function isValuationDepositedForTask(
  task: Pick<WorkflowTask, "propertyId" | "transactionStudyHolderPropertyId">,
  tasks: readonly WorkflowTask[],
): boolean {
  const propertyId =
    task.transactionStudyHolderPropertyId?.trim() || task.propertyId?.trim();
  if (!propertyId) return false;
  let latest: WorkflowTask | undefined;
  for (const t of tasks) {
    if (t.kind !== "property-appraisal" || t.status === "cancelled") continue;
    if (t.propertyId !== propertyId) continue;
    if (!latest || t.createdAt.localeCompare(latest.createdAt) > 0) latest = t;
  }
  return latest?.status === "completed";
}
