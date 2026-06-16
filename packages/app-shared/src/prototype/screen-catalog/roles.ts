import type { RoleId } from "@platform/types";
import { ROLES } from "../constants";

/** كل أدوار النظام — بما فيها الإدارية. */
export function screenCatalogRoleIds(): RoleId[] {
  return Object.keys(ROLES) as RoleId[];
}

export function screenCatalogRoleLabel(roleId: RoleId): string {
  return ROLES[roleId]?.dept ?? roleId;
}

export function screenCatalogRoleGroup(roleId: RoleId): string {
  const opt = ROLES[roleId];
  if (!opt) return roleId;
  if (roleId === "cdo") return "التحول الرقمي";
  if (roleId === "hr-admin" || roleId === "proc-admin" || roleId === "crm-admin")
    return "إدارة المنظمة";
  if (
    roleId === "general-manager" ||
    roleId === "valuation-coordinator" ||
    roleId === "real-estate-appraiser" ||
    roleId === "field-inspector" ||
    roleId === "engineering-office" ||
    roleId === "financial-officer"
  ) {
    if (roleId === "financial-officer") return "المالية والعقود";
    if (
      roleId === "valuation-coordinator" ||
      roleId === "real-estate-appraiser" ||
      roleId === "field-inspector" ||
      roleId === "engineering-office"
    )
      return "قسم التقييم العقاري";
    return "إدارة التقييم العقاري";
  }
  return "قسم دراسة الحالة";
}

export function rolesWithPageAccess(pageId: string): RoleId[] {
  return screenCatalogRoleIds().filter((roleId) =>
    ROLES[roleId].pages.includes(pageId as never),
  );
}
