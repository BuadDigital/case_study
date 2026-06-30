import type { RoleId } from "@platform/types";
import { FAILURE_RAISER_LABEL_BY_KIND } from "./failure-party-roles";
import type { FailureRecord } from "./failures-types";
import { countOpenFailures } from "./failures-types";

/** Roles that see only failures they raised from their party workspace. */
const PARTY_SCOPED_FAILURE_RAISER: Partial<Record<RoleId, string>> = {
  "government-reviewer":
    FAILURE_RAISER_LABEL_BY_KIND["government-review"] ?? "المراجع الحكومي",
  "engineering-office":
    FAILURE_RAISER_LABEL_BY_KIND["engineering-survey"] ?? "المكتب الهندسي",
  "field-inspector": FAILURE_RAISER_LABEL_BY_KIND["field-inspection"] ?? "المعاين",
  "real-estate-appraiser":
    FAILURE_RAISER_LABEL_BY_KIND["property-appraisal"] ?? "المقيم",
};

export function isPartyScopedFailuresRole(role: RoleId): boolean {
  return role in PARTY_SCOPED_FAILURE_RAISER;
}

export function failureRaiserLabelForPartyRole(role: RoleId): string | null {
  return PARTY_SCOPED_FAILURE_RAISER[role] ?? null;
}

export function failuresForRaiserLabel(
  items: FailureRecord[],
  label: string,
): FailureRecord[] {
  const expected = label.trim();
  return items.filter((failure) => {
    const raisedBy = failure.raisedByRole.trim();
    return raisedBy === expected || raisedBy.includes(expected);
  });
}

export function failuresForPartyRole(
  role: RoleId,
  items: FailureRecord[],
): FailureRecord[] | null {
  const label = failureRaiserLabelForPartyRole(role);
  if (!label) return null;
  return failuresForRaiserLabel(items, label);
}

export function countOpenFailuresForRaiserLabel(
  items: FailureRecord[],
  label: string,
): number {
  return countOpenFailures(failuresForRaiserLabel(items, label));
}

export function countOpenFailuresForPartyRole(
  role: RoleId,
  items: FailureRecord[],
): number {
  const scoped = failuresForPartyRole(role, items);
  if (!scoped) return countOpenFailures(items);
  return countOpenFailures(scoped);
}
