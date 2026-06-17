import { suspendFailure } from "@failures/mfe";
import type { FailureRecord } from "@failures/mfe";
import {
  isPropertySuspended,
  notifySuspendedTransactionsChanged,
} from "./suspended-transactions-storage";
import { suspendWorkflowTasksForProperty } from "./tasks-storage";

export async function suspendPropertyTransaction(input: {
  failure: FailureRecord;
  supervisorNote: string;
  suspendedBy: string;
}): Promise<boolean> {
  const { failure } = input;
  if (isPropertySuspended(failure.poNumber, failure.propertyId)) return false;

  const suspended = await suspendFailure(
    failure.id,
    input.supervisorNote.trim(),
  );
  if (!suspended) return false;

  await suspendWorkflowTasksForProperty(
    failure.poNumber,
    failure.propertyId,
    input.supervisorNote.trim() || failure.title,
  );

  notifySuspendedTransactionsChanged();
  return true;
}
