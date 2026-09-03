import type { RoleId } from "@platform/types";
import { isSuperAdmin } from "@platform/app-shared/app-data/role-access";

/** Matches backend isManager for operations tasks. */
export function canManageOperationsTasks(role: RoleId): boolean {
  return (
    isSuperAdmin(role) ||
    role === "case-specialist" ||
    role === "section-supervisor" ||
    role === "general-manager"
  );
}

/** Spec : remind = creator / supervisor (managers). */
export function canRemindOperationsTasks(role: RoleId): boolean {
  return canManageOperationsTasks(role);
}

/**
 * Non-managers work an independent assignee-scoped queue (their tasks only).
 * Managers/admins see the full team inbox.
 */
export function operationsTasksUseAssigneeScope(role: RoleId): boolean {
  return !canManageOperationsTasks(role);
}
