import { getFailureProblemType } from "./failure-types-data";
import type { FailureRecord } from "./failures-types";
import {
  isActiveFailureStatus,
  isBlockingFailureStatus,
  isHistoricalFailureStatus,
} from "./failures-types";

export type FailurePropertyRef = {
  poNumber: string;
  propertyId: string;
  deedNumber?: string;
};

function normalizedIds(values: Array<string | undefined>): string[] {
  return [
    ...new Set(
      values
        .map((value) => value?.trim())
        .filter((value): value is string => Boolean(value)),
    ),
  ];
}

export function failureMatchesProperty(
  failure: FailureRecord,
  ref: FailurePropertyRef,
): boolean {
  if (failure.poNumber.trim() !== ref.poNumber.trim()) return false;

  const refIds = normalizedIds([ref.propertyId, ref.deedNumber]);
  const failureIds = normalizedIds([failure.propertyId, failure.deedNumber]);
  return failureIds.some((id) => refIds.includes(id));
}

export function failuresForProperty(
  failures: FailureRecord[],
  ref: FailurePropertyRef,
): FailureRecord[] {
  return failures
    .filter((failure) => failureMatchesProperty(failure, ref))
    .sort(
      (a, b) =>
        new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime(),
    );
}

export function activeFailureForProperty(
  failures: FailureRecord[],
  ref: FailurePropertyRef,
): FailureRecord | null {
  return (
    failuresForProperty(failures, ref).find((failure) =>
      isActiveFailureStatus(failure.status),
    ) ?? null
  );
}

export function blockingFailureForProperty(
  failures: FailureRecord[],
  ref: FailurePropertyRef,
): FailureRecord | null {
  return (
    failuresForProperty(failures, ref).find((failure) =>
      isBlockingFailureStatus(failure.status),
    ) ?? null
  );
}

export function historicalFailuresForProperty(
  failures: FailureRecord[],
  ref: FailurePropertyRef,
): FailureRecord[] {
  return failuresForProperty(failures, ref).filter((failure) =>
    isHistoricalFailureStatus(failure.status),
  );
}

export function isKeyRelatedFailure(failure: FailureRecord): boolean {
  const type = getFailureProblemType(failure.problemTypeId);
  return type?.categoryId === "access";
}

export function keyFailuresForProperty(
  failures: FailureRecord[],
  ref: FailurePropertyRef,
): FailureRecord[] {
  return failuresForProperty(failures, ref).filter(isKeyRelatedFailure);
}
