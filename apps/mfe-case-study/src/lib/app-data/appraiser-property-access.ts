import type { RoleId } from "@platform/types";
import type { WorkflowTask } from "./tasks";

/**
 * What: whether a role edits property data and documents only on the transactions assigned to it.
 * How it works: true for the appraiser only. Mirrors `PoRoleMatrixRules.EditsOnlyAssignedProperties`.
 * Edge cases: added 2026-11-17. Omar gave the appraiser «جميع العقارات» to read every property, but he
 * edits only his own.
 */
export function editsOnlyAssignedProperties(role: RoleId): boolean {
  return role === "real-estate-appraiser";
}

/**
 * What: whether the viewer's own tasks hold the appraisal of this property's transaction.
 * How it works: looks for a non-cancelled `property-appraisal` task on the property itself, or on any
 * deed of the same transaction (after a merge the deeds share the target transaction). Mirrors
 * `ICaseStudyLookup.IsAssignedAppraiserAsync`.
 * Edge cases: `tasks` must be the viewer's own list. The server sends the appraiser only his tasks
 * outside «جميع العقارات». No property id and no transaction id means not assigned.
 */
export function appraiserAssignedToProperty(
  tasks: readonly WorkflowTask[] | undefined,
  propertyId: string | null | undefined,
  transactionId: string | null | undefined,
): boolean {
  const property = propertyId?.trim();
  const transaction = transactionId?.trim();
  if (!property && !transaction) return false;
  return (tasks ?? []).some(
    (t) =>
      t.kind === "property-appraisal" &&
      t.status !== "cancelled" &&
      ((property && t.propertyId === property) ||
        (transaction && t.transactionId === transaction)),
  );
}
