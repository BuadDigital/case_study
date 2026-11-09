import { isSuperAdmin } from "@platform/app-shared/app-data/role-access";
import {
  holdsSubRole,
  type StaffAccess,
} from "@platform/app-shared/app-data/case-specialist-sub-roles";

/**
 * Matches backend `OperationsTaskLifecycleRules.IsManager`: management, the appraiser and the
 * coordination sub-role of the case specialist (operational work is coordination's, ruling 2026-11-02).
 */
export function canManageOperationsTasks(access: StaffAccess): boolean {
  const { role } = access;
  return (
    isSuperAdmin(role) ||
    role === "section-supervisor" ||
    role === "general-manager" ||
    role === "real-estate-appraiser" ||
    holdsSubRole(access, "coordination")
  );
}

/** Spec : remind = creator / supervisor (managers). */
export function canRemindOperationsTasks(access: StaffAccess): boolean {
  return canManageOperationsTasks(access);
}

/**
 * Non-managers work an independent assignee-scoped queue (their tasks only).
 * Managers/admins see the full team inbox.
 */
export function operationsTasksUseAssigneeScope(access: StaffAccess): boolean {
  return !canManageOperationsTasks(access);
}
