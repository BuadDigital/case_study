import type { RoleId } from "@platform/types";
import { isSuperAdmin } from "@platform/app-shared/prototype/prototype-role-access";

/** Matches backend isManager for operations tasks. */
export function canManageOperationsTasks(role: RoleId): boolean {
  return (
    isSuperAdmin(role) ||
    role === "case-specialist" ||
    role === "section-supervisor" ||
    role === "general-manager"
  );
}

/** Spec §8: remind = creator / supervisor (managers). */
export function canRemindOperationsTasks(role: RoleId): boolean {
  return canManageOperationsTasks(role);
}
