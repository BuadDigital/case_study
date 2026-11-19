import type { PageId, RoleId } from "@platform/types";
import { hasRuntimeCapability } from "@platform/app-shared/app-data/runtime-access";
import { Roles } from "@platform/types";

/** CDO — super admin with full system access. */
export function isSuperAdmin(role: RoleId): boolean {
  if (hasRuntimeCapability("manage-system-config")) return true;
  return role === Roles.Cdo;
}

/**
 * Marking a deed «جاهز للفوترة» (its financial data appeared on Enfaz) is the accountant's call —
 * the financial officer alone. Mirrors `PoRoleMatrixRules.CanMarkBillingReady`.
 *
 * How it works: a plain role comparison used only to show or hide the «تعليم جاهز للفوترة» button; the
 * server checks the role again, so hiding the button is a convenience, not the security boundary.
 * Edge cases: the CDO, the general manager, the supervisor and the case specialist get false on purpose.
 */
export function canMarkBillingReady(role: RoleId): boolean {
  return role === Roles.FinancialOfficer;
}

/**
 * Finance and management read the billing-aware PO status («مفوتر جزئي» / «مفوتر بالكامل»).
 * Everyone else — the case specialist first — sees the study status only; billing is not their
 * concern and starts after the Enfaz handover.
 */
export function canSeeBillingStatuses(role: RoleId): boolean {
  return (
    isSuperAdmin(role) ||
    role === Roles.FinancialOfficer ||
    role === Roles.SectionSupervisor ||
    role === Roles.GeneralManager
  );
}
