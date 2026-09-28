import type { RoleId } from "@platform/types";
import { ROLES } from "../app-data/constants";

/** Map server permissions to a known prototype role. Unknown or missing → null (no access). */
export function roleFromPermissions(
  prototypeRole: string | null | undefined,
  identityRoles: readonly string[] | undefined,
): RoleId | null {
  if (
    identityRoles?.some(
      (role) =>
        role.toLowerCase() === "cdo" || role.toLowerCase() === "admin",
    )
  ) {
    return "cdo";
  }

  const apiRole = prototypeRole?.trim().toLowerCase();
  if (apiRole && apiRole in ROLES) return apiRole as RoleId;
  return null;
}
