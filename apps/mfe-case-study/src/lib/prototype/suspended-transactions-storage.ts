import { listSuspendedTransactions } from "@platform/api-client";
import {
  requirePrototypeModulesApiConfig,
  unwrapApiResult,
} from "@platform/app-shared/prototype/prototype-modules-api-config";
import { getPropertyFailureFromCache } from "@failures/mfe";

export const SUSPENDED_TRANSACTIONS_CHANGED_EVENT =
  "suspended-transactions-changed";

export type SuspendedTransaction = {
  id: string;
  poNumber: string;
  propertyId: string;
  failureId: string;
  deedNumber: string;
  title: string;
  internalNote: string;
  raisedByRole: string;
  specialist: string;
  supervisorNote: string;
  suspendedAt: string;
  suspendedBy: string;
};

let memoryList: SuspendedTransaction[] = [];

function notifyChanged(): void {
  if (typeof window === "undefined") return;
  window.dispatchEvent(new CustomEvent(SUSPENDED_TRANSACTIONS_CHANGED_EVENT));
}

function mapDto(row: {
  id: string;
  poNumber: string;
  propertyId: string;
  failureId: string;
  deedNumber: string;
  title: string;
  internalNote: string;
  raisedByRole: string;
  specialist: string;
  supervisorNote: string;
  suspendedAt: string;
  suspendedBy: string;
}): SuspendedTransaction {
  return {
    id: row.id,
    poNumber: row.poNumber,
    propertyId: row.propertyId,
    failureId: row.failureId,
    deedNumber: row.deedNumber,
    title: row.title,
    internalNote: row.internalNote,
    raisedByRole: row.raisedByRole,
    specialist: row.specialist,
    supervisorNote: row.supervisorNote,
    suspendedAt:
      typeof row.suspendedAt === "string"
        ? row.suspendedAt
        : new Date(row.suspendedAt).toISOString(),
    suspendedBy: row.suspendedBy,
  };
}

export async function loadSuspendedTransactions(): Promise<
  SuspendedTransaction[]
> {
  const config = requirePrototypeModulesApiConfig();
  const result = await listSuspendedTransactions(config);
  memoryList = unwrapApiResult(
    result,
    "تعذّر تحميل المعاملات المعلّقة",
  ).map(mapDto);
  return memoryList;
}

export function propertySuspensionKey(poNumber: string, propertyId: string): string {
  return `${poNumber.trim()}:${propertyId}`;
}

export function isPropertySuspended(
  poNumber: string,
  propertyId: string | undefined,
): boolean {
  if (!propertyId) return false;
  const failure = getPropertyFailureFromCache(poNumber, propertyId);
  if (failure?.status === "suspended") return true;
  const key = propertySuspensionKey(poNumber, propertyId);
  return memoryList.some(
    (item) => propertySuspensionKey(item.poNumber, item.propertyId) === key,
  );
}

export function isTaskOnSuspendedProperty(task: {
  poNumber: string;
  propertyId?: string;
}): boolean {
  if (!task.propertyId) return false;
  return isPropertySuspended(task.poNumber, task.propertyId);
}

export function getSuspendedTransaction(
  poNumber: string,
  propertyId: string,
): SuspendedTransaction | null {
  const key = propertySuspensionKey(poNumber, propertyId);
  return (
    memoryList.find(
      (item) => propertySuspensionKey(item.poNumber, item.propertyId) === key,
    ) ?? null
  );
}

/** Notifies listeners after `suspendFailure` updates the API. */
export function notifySuspendedTransactionsChanged(): void {
  notifyChanged();
}

export function countSuspendedTransactions(): number {
  return memoryList.length;
}
