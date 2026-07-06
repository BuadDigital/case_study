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
  type FailureMutationResult,
} from "./failures-api";
import type {
  BourseObstructionInput,
  CreateFailureInput,
  FailureRecord,
  ResolveFailureInput,
} from "./failures-types";

export type { FailureMutationResult } from "./failures-api";

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
): Promise<FailureMutationResult> {
  return upgradeFailureToInternalAsync(id);
}

export async function resolveFailure(
  id: string,
  input: ResolveFailureInput,
): Promise<FailureMutationResult> {
  return resolveFailureAsync(id, input);
}

export async function suspendFailure(
  id: string,
  note: string,
): Promise<FailureMutationResult> {
  return suspendFailureAsync(id, note);
}

export async function submitFailureForReview(
  id: string,
): Promise<FailureMutationResult> {
  return submitFailureForReviewAsync(id);
}

export async function approveFailure(
  id: string,
  finalNote: string,
): Promise<FailureMutationResult> {
  return approveFailureAsync(id, finalNote);
}

export async function returnFailure(
  id: string,
  finalNote: string,
): Promise<FailureMutationResult> {
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
