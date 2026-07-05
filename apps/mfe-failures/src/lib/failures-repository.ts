import {
  approveFailureAsync,
  createFailureAsync,
  deleteFailuresForPoAsync,
  getPropertyFailureFromCache,
  loadFailuresForQuery,
  loadFailuresFromBackend,
  reportBourseObstructionAsync,
  resolveFailureAsync,
  returnFailureAsync,
  submitFailureForReviewAsync,
  suspendFailureAsync,
  upgradeFailureToInternalAsync,
} from "./failures-api";
import type {
  BourseObstructionInput,
  CreateFailureInput,
  FailureRecord,
  ResolveFailureInput,
} from "./failures-types";

export async function loadFailures(): Promise<FailureRecord[]> {
  return loadFailuresFromBackend();
}

export async function loadFailuresQuery(): Promise<FailureRecord[]> {
  return loadFailuresForQuery();
}

export async function createFailure(
  input: CreateFailureInput,
): Promise<FailureRecord> {
  return createFailureAsync(input);
}

export async function upgradeFailureToInternal(
  id: string,
): Promise<FailureRecord | null> {
  return upgradeFailureToInternalAsync(id);
}

export async function resolveFailure(
  id: string,
  input: ResolveFailureInput,
): Promise<FailureRecord | null> {
  return resolveFailureAsync(id, input);
}

export async function suspendFailure(
  id: string,
  note: string,
): Promise<FailureRecord | null> {
  return suspendFailureAsync(id, note);
}

export async function submitFailureForReview(
  id: string,
): Promise<FailureRecord | null> {
  return submitFailureForReviewAsync(id);
}

export async function approveFailure(
  id: string,
  finalNote: string,
): Promise<FailureRecord | null> {
  return approveFailureAsync(id, finalNote);
}

export async function returnFailure(
  id: string,
  finalNote: string,
): Promise<FailureRecord | null> {
  return returnFailureAsync(id, finalNote);
}

export async function deleteFailuresForPo(poNumber: string): Promise<boolean> {
  return deleteFailuresForPoAsync(poNumber);
}

export function getPropertyFailure(
  poNumber: string,
  propertyId: string,
): FailureRecord | null {
  return getPropertyFailureFromCache(poNumber, propertyId);
}

export async function reportBourseObstructionToSupervisor(
  input: BourseObstructionInput,
): Promise<FailureRecord> {
  return reportBourseObstructionAsync(input);
}
