import { FAILURE_RAISER_LABEL_BY_KIND } from "./failure-party-roles";
import type { FailureRecord } from "./failures-types";
import { countOpenFailures } from "./failures-types";

/** Label stored on failures raised from the engineering-survey workspace. */
export const ENGINEERING_OFFICE_FAILURE_RAISER =
  FAILURE_RAISER_LABEL_BY_KIND["engineering-survey"] ?? "المكتب الهندسي";

/** Engineering offices see only failures they raised — not the full case-study queue. */
export function failuresForEngineeringOffice(
  items: FailureRecord[],
): FailureRecord[] {
  const label = ENGINEERING_OFFICE_FAILURE_RAISER;
  return items.filter((failure) => {
    const raisedBy = failure.raisedByRole.trim();
    return raisedBy === label || raisedBy.includes(label);
  });
}

export function countOpenFailuresForEngineeringOffice(
  items: FailureRecord[],
): number {
  return countOpenFailures(failuresForEngineeringOffice(items));
}
