import type { RoleId } from "@platform/types";
import { ROLES } from "../prototype/constants";

/** Operational roles the CDO can assign — mirrors backend CreatableStaffRoleIds. */
export const ADMIN_CREATABLE_STAFF_ROLE_IDS: RoleId[] = [
  "cdo",
  "general-manager",
  "section-supervisor",
  "case-specialist",
  "government-reviewer",
  "valuation-coordinator",
  "real-estate-appraiser",
  "field-inspector",
  "financial-officer",
];

export function adminStaffRoleOptions(): { value: RoleId; label: string }[] {
  return ADMIN_CREATABLE_STAFF_ROLE_IDS.map((roleId) => ({
    value: roleId,
    label: ROLES[roleId]?.dept ?? roleId,
  }));
}
