import {
  GOVERNMENT_REVIEWER_FAILURE_RAISER,
} from "./failure-party-roles";
import type { FailureRecord } from "./failures-types";
import { countOpenFailures } from "./failures-types";

export { GOVERNMENT_REVIEWER_FAILURE_RAISER };

/** Government reviewers see only failures they raised — not the full case-study queue. */
export function failuresForGovernmentReviewer(
  items: FailureRecord[],
): FailureRecord[] {
  const label = GOVERNMENT_REVIEWER_FAILURE_RAISER;
  return items.filter((failure) => {
    const raisedBy = failure.raisedByRole.trim();
    return raisedBy === label || raisedBy.includes(label);
  });
}

export function countOpenFailuresForGovernmentReviewer(
  items: FailureRecord[],
): number {
  return countOpenFailures(failuresForGovernmentReviewer(items));
}
