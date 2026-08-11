import {
  blockingFailureForProperty,
  type FailureRecord,
} from "@failures/mfe";
import type { OperationsTask } from "./operations-tasks-storage";
import type { PoIntakeRecord } from "./po-intake-data";
import {
  failureTargetsForOperationsTask,
} from "./operations-task-failure-targets";

/**
 * Pause reason when a party (e.g. government reviewer) raises an active
 * property failure — ops task leaves the active queue until the failure is
 * cleared by case staff.
 */
export const OPS_TASK_FAILURE_PAUSE_REASON =
  "تعذر نشط — بانتظار حل الأخصائي/المشرف";

export function isOpsTaskFailurePauseReason(
  reason: string | null | undefined,
): boolean {
  const r = (reason ?? "").trim();
  if (!r) return false;
  return (
    r === OPS_TASK_FAILURE_PAUSE_REASON ||
    r.startsWith("تعذر نشط")
  );
}

/** Task is linked to at least one property that still has a blocking failure. */
export function isOperationsTaskBlockedByFailure(
  task: OperationsTask,
  failures: FailureRecord[],
  poRecords: PoIntakeRecord[],
): boolean {
  const targets = failureTargetsForOperationsTask(task, poRecords);
  if (targets.length === 0) return false;
  return targets.some(
    (target) => blockingFailureForProperty(failures, target) != null,
  );
}
