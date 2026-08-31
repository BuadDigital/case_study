import { suspendFailure } from "@failures/mfe/lib/failures-repository";
import type { FailureRecord } from "@platform/app-shared/failures/failures-types";
import {
  isPropertySuspended,
  notifySuspendedTransactionsChanged,
} from "./suspended-transactions-storage";
import { suspendWorkflowTasksForProperty } from "./tasks-storage";

export type SuspendPropertyResult =
  | { ok: true }
  | { ok: false; error: string };

/**
 * Suspends the failure, then blocks related workflow tasks.
 * Failure suspend must succeed before any task is patched — a failed
 * failure-API call must not leave work blocked under a still-open failure.
 */
export async function suspendPropertyTransaction(input: {
  failure: FailureRecord;
  supervisorNote: string;
}): Promise<SuspendPropertyResult> {
  const { failure } = input;
  if (isPropertySuspended(failure.poNumber, failure.propertyId)) {
    return { ok: false, error: "المعاملة معلّقة مسبقاً" };
  }

  const suspended = await suspendFailure(
    failure.id,
    input.supervisorNote.trim(),
  );
  if (!suspended.ok) {
    return {
      ok: false,
      error: suspended.error || "تعذّر تعليق التعذر على الخادم",
    };
  }

  const tasksBlocked = await suspendWorkflowTasksForProperty(
    failure.poNumber,
    failure.propertyId,
    input.supervisorNote.trim() || failure.title,
  );
  if (!tasksBlocked) {
    return {
      ok: false,
      error:
        "تم تعليق التعذر لكن تعذّر إيقاف مهام سير العمل المرتبطة — أعد المحاولة",
    };
  }

  notifySuspendedTransactionsChanged();
  return { ok: true };
}
