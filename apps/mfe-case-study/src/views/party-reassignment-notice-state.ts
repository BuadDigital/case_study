/**
 * Pure rules behind `PartyReassignmentNotice`: which pushed notification means
 * "this exact task was just taken from me", and where each reassignable party
 * role lands afterward. No React, no I/O.
 */
import type { PageId, RoleId } from "@platform/types";

/** The party's own queue — «تعديل إسناد الأطراف» redistributes only these
 * three kinds, so only these three roles can ever be walked off a task. */
const ROLE_HOME_PAGE_ID: Partial<Record<RoleId, PageId>> = {
  "field-inspector": "active-inspection",
  "engineering-office": "active-survey",
  "real-estate-appraiser": "property-appraisal",
};

export function homePageIdForRole(roleId: RoleId): PageId | null {
  return ROLE_HOME_PAGE_ID[roleId] ?? null;
}

/** True when a pushed notification is the «distribution-replaced» notice for this exact task. */
export function isTaskReassignedAwayNotice(
  taskId: string,
  item: {
    entityType?: string;
    entityId?: string;
    sourceEvent?: string;
  } | null,
): boolean {
  if (!item) return false;
  if (item.entityType !== "task" || item.entityId !== taskId) return false;
  return Boolean(item.sourceEvent?.startsWith("distribution-replaced:"));
}
