import { getFailureProblemType } from "./failure-types-data";
import type { FailureRecord } from "@platform/app-shared/failures/failures-types";
import {
  isActiveFailureStatus,
  isBlockingFailureStatus,
  isHistoricalFailureStatus,
} from "@platform/app-shared/failures/failures-types";

export type FailurePropertyRef = {
  poNumber: string;
  propertyId: string;
  deedNumber?: string;
};

// Match without allocating objects — called for every (property × failure) when loading property lists,
// and used to allocate Set + two arrays per comparison (js-perf).
export function failureMatchesProperty(
  failure: FailureRecord,
  ref: FailurePropertyRef,
): boolean {
  if (failure.poNumber.trim() !== ref.poNumber.trim()) return false;

  const refProp = ref.propertyId?.trim() ?? "";
  const refDeed = ref.deedNumber?.trim() ?? "";
  const failureProp = failure.propertyId?.trim() ?? "";
  const failureDeed = failure.deedNumber?.trim() ?? "";
  if (failureProp && (failureProp === refProp || failureProp === refDeed)) {
    return true;
  }
  return Boolean(
    failureDeed && (failureDeed === refProp || failureDeed === refDeed),
  );
}

export function failuresForProperty(
  failures: FailureRecord[],
  ref: FailurePropertyRef,
): FailureRecord[] {
  const matched: FailureRecord[] = [];
  for (const failure of failures) {
    if (failureMatchesProperty(failure, ref)) matched.push(failure);
  }
  if (matched.length > 1) {
    matched.sort((a, b) => Date.parse(b.updatedAt) - Date.parse(a.updatedAt));
  }
  return matched;
}

/** Latest matching failure that meets the predicate — one pass, no filter/sort (js-min-max-loop). */
function newestMatchingFailure(
  failures: FailureRecord[],
  ref: FailurePropertyRef,
  matchesStatus: (status: FailureRecord["status"]) => boolean,
): FailureRecord | null {
  let best: FailureRecord | null = null;
  let bestTime = Number.NEGATIVE_INFINITY;
  for (const failure of failures) {
    if (!matchesStatus(failure.status)) continue;
    if (!failureMatchesProperty(failure, ref)) continue;
    const parsed = Date.parse(failure.updatedAt);
    const time = Number.isNaN(parsed) ? Number.NEGATIVE_INFINITY : parsed;
    if (best === null || time > bestTime) {
      best = failure;
      bestTime = time;
    }
  }
  return best;
}

export function activeFailureForProperty(
  failures: FailureRecord[],
  ref: FailurePropertyRef,
): FailureRecord | null {
  return newestMatchingFailure(failures, ref, isActiveFailureStatus);
}

export function blockingFailureForProperty(
  failures: FailureRecord[],
  ref: FailurePropertyRef,
): FailureRecord | null {
  return newestMatchingFailure(failures, ref, isBlockingFailureStatus);
}

export function historicalFailuresForProperty(
  failures: FailureRecord[],
  ref: FailurePropertyRef,
): FailureRecord[] {
  return failuresForProperty(failures, ref).filter((failure) =>
    isHistoricalFailureStatus(failure.status),
  );
}

function isKeyRelatedFailure(failure: FailureRecord): boolean {
  const type = getFailureProblemType(failure.problemTypeId);
  return type?.categoryId === "access";
}

export function keyFailuresForProperty(
  failures: FailureRecord[],
  ref: FailurePropertyRef,
): FailureRecord[] {
  return failuresForProperty(failures, ref).filter(isKeyRelatedFailure);
}
