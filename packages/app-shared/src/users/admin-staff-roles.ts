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
  "engineering-office",
];

/** Canonical department codes a section supervisor may supervise. */
export const SUPERVISOR_DEPARTMENT_OPTIONS = [
  { value: "case_study", label: "قسم دراسة الحالة" },
  { value: "valuation", label: "قسم تقييم الأفراد" },
] as const;

const DEPARTMENT_LABELS: Record<string, string> = {
  case_study: "قسم دراسة الحالة",
  valuation: "قسم تقييم الأفراد",
  finance_dept: "قسم المحاسبة",
  external: "الجهات الخارجية",
};

export function adminStaffRoleOptions(): { value: RoleId; label: string }[] {
  return ADMIN_CREATABLE_STAFF_ROLE_IDS.map((roleId) => ({
    value: roleId,
    label: ROLES[roleId]?.dept ?? roleId,
  }));
}

export function supervisingDepartmentLabel(code: string | null | undefined): string {
  if (!code) return "";
  return DEPARTMENT_LABELS[code] ?? code;
}

export function isSectionSupervisorRole(roleId: string | null | undefined): boolean {
  return roleId === "section-supervisor";
}
