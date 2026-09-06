import {
  approveFailureAsync,
  createFailureAsync,
  deleteFailuresForPoAsync,
  getPropertyFailureFromCache,
  loadFailuresForQuery,
  loadFailuresPageForQuery,
  reportBourseObstructionAsync,
  resolveFailureAsync,
  returnFailureAsync,
  submitFailureForReviewAsync,
  suspendFailureAsync,
  upgradeFailureToInternalAsync,
  type FailureMutationResult,
} from "./failures-api";
import type { FailureListQuery, PagedResultDto } from "@platform/api-client";
import type {
  BourseObstructionInput,
  CreateFailureInput,
  FailureRecord,
  ResolveFailureInput,
} from "@platform/app-shared/failures/failures-types";

export type { FailureMutationResult } from "./failures-api";

export async function loadFailuresQuery(): Promise<FailureRecord[]> {
  return loadFailuresForQuery();
}

/** One server page of the failures queue — pagination-contract §5. */
export async function loadFailuresPageQuery(
  query: FailureListQuery,
): Promise<PagedResultDto<FailureRecord>> {
  return loadFailuresPageForQuery(query);
}

export async function createFailure(
  input: CreateFailureInput,
  idempotencyKey?: string,
): Promise<FailureRecord> {
  return createFailureAsync(input, idempotencyKey);
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
