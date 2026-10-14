import type { PageId, RoleId } from "@platform/types";
import { hasRuntimeCapability } from "@platform/app-shared/app-data/runtime-access";

/** CDO — super admin with full system access. */
export function isSuperAdmin(role: RoleId): boolean {
  if (hasRuntimeCapability("manage-system-config")) return true;
  return role === "cdo";
}

/**
 * Finance and management read the billing-aware PO status («مفوتر جزئي» / «مفوتر بالكامل»).
 * Everyone else — the case specialist first — sees the study status only; billing is not their
 * concern and starts after the Enfaz handover.
 */
export function canSeeBillingStatuses(role: RoleId): boolean {
  return (
    isSuperAdmin(role) ||
    role === "financial-officer" ||
    role === "section-supervisor" ||
    role === "general-manager"
  );
}
