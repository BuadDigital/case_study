import type { PageId, RoleId } from "@platform/types";
import { hasRuntimeCapability } from "@platform/app-shared/prototype/runtime-access";

/** سليمان (CDO) — super admin with full prototype access. */
export function isSuperAdmin(role: RoleId): boolean {
  if (hasRuntimeCapability("manage-system-config")) return true;
  return role === "cdo";
}
