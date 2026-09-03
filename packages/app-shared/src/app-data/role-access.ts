import type { PageId, RoleId } from "@platform/types";
import { hasRuntimeCapability } from "@platform/app-shared/app-data/runtime-access";

/** CDO — super admin with full system access. */
export function isSuperAdmin(role: RoleId): boolean {
  if (hasRuntimeCapability("manage-system-config")) return true;
  return role === "cdo";
}
