import type { RoleId } from "@platform/types";
import type { StaffUser } from "@platform/app-shared/app-data/constants";
import { Roles } from "@platform/types";

export type DistributionAssignee = {
  id: string;
  name: string;
  subtitle?: string;
};

/**
 * Exact JobTitle values from seeded prototype users → English RoleId.
 * No fuzzy / contains matching (except soft fallbacks below).
 */
const EXACT_JOB_TITLE_TO_ROLE: Record<string, RoleId> = {
  "مسؤول التحول الرقمي (CDO)": Roles.Cdo,
  "المدير التنفيذي": Roles.Cdo,
  "مدير إدارة التقييم العقاري": Roles.GeneralManager,
  "مشرف قسم دراسة الحالة": Roles.SectionSupervisor,
  "أخصائي دراسة حالة": Roles.CaseSpecialist,
  "مراجع حكومي": Roles.GovernmentReviewer,
  "مقيم عقاري": Roles.RealEstateAppraiser,
  "معاين ميداني": Roles.FieldInspector,
  "موظف الشؤون المالية": Roles.FinancialOfficer,
  "مقدم خدمة — جهة": Roles.EngineeringOffice,
  // en-dash / hyphen variants from HR import
  "مقدم خدمة - جهة": Roles.EngineeringOffice,
  "مقدم خدمة – جهة": Roles.EngineeringOffice,
};

/** Roles that can appear in distribution / ops assignment pickers. */
const KNOWN_ROLE_IDS = new Set<string>([
  ...Object.values(EXACT_JOB_TITLE_TO_ROLE),
  "government-reviewer",
  "field-inspector",
  "real-estate-appraiser",
  "engineering-office",
  "case-specialist",
  "section-supervisor",
  "general-manager",
  "financial-officer",
  "cdo",
]);

/** Active enough to assign work (API may send casing variants). */
export function isStaffAssignable(user: StaffUser): boolean {
  if (!user.distributionAssigneeId?.trim()) return false;
  const s = String(user.status ?? "Active").trim().toLowerCase();
  // Accept Active / active / numeric 0 / empty (treat as active)
  return s === "" || s === "active" || s === "0" || user.status === "Active";
}

function employmentSubtitle(user: StaffUser): string | undefined {
  const employment = user.details?.find(
    (d) => d.section === "بيانات التوظيف" && d.label === "نوع التوظيف",
  )?.value;
  if (employment?.trim()) return `${user.role} — ${employment.trim()}`;
  if (user.roleId === "engineering-office") return user.role;
  return user.role;
}

export function partyRoleForStaffUser(user: StaffUser): RoleId | null {
  if (user.distributionAssigneeId?.startsWith("eo-")) {
    return Roles.EngineeringOffice;
  }
  // Prefer RoleId (source of truth); job title is display metadata only.
  const roleId = user.roleId?.trim();
  if (roleId && KNOWN_ROLE_IDS.has(roleId)) {
    return roleId as RoleId;
  }
  const t = user.role.trim();
  if (!t) return null;
  if (EXACT_JOB_TITLE_TO_ROLE[t]) return EXACT_JOB_TITLE_TO_ROLE[t];
  // Soft match common labels (API/job title drift)
  if (t.includes("معاين")) return Roles.FieldInspector;
  if (t.includes("مراجع")) return Roles.GovernmentReviewer;
  if (t.includes("مقيم")) return Roles.RealEstateAppraiser;
  if (t.includes("مكتب") || t.includes("مساح") || t.includes("جهة")) {
    return Roles.EngineeringOffice;
  }
  return null;
}

function staffUsersForPartyRole(
  users: StaffUser[],
  roleId: RoleId,
): DistributionAssignee[] {
  return users
    .filter((u) => isStaffAssignable(u) && partyRoleForStaffUser(u) === roleId)
    .map((u) => ({
      id: u.distributionAssigneeId!.trim(),
      name: u.name,
      subtitle: employmentSubtitle(u),
    }))
    .sort((a, b) => a.name.localeCompare(b.name, "ar"));
}

export function staffUserForViewer(
  users: StaffUser[],
  roleId: RoleId,
  viewerUserId?: string | null,
): StaffUser | undefined {
  const id = viewerUserId?.trim();
  if (id) {
    const byId = users.find(
      (u) => u.id === id && partyRoleForStaffUser(u) === roleId,
    );
    if (byId) return byId;
  }
  return users.find(
    (u) => isStaffAssignable(u) && partyRoleForStaffUser(u) === roleId,
  );
}

export function getGovernmentAuditors(users: StaffUser[]): DistributionAssignee[] {
  return staffUsersForPartyRole(users, Roles.GovernmentReviewer);
}

export function getFieldInspectors(users: StaffUser[]): DistributionAssignee[] {
  return staffUsersForPartyRole(users, Roles.FieldInspector);
}

export function getValuators(users: StaffUser[]): DistributionAssignee[] {
  return staffUsersForPartyRole(users, Roles.RealEstateAppraiser);
}

export function getEngineeringOffices(
  users: StaffUser[],
): DistributionAssignee[] {
  return staffUsersForPartyRole(users, Roles.EngineeringOffice);
}

/** Normal case specialists only — supervisors are never listed. */
export function getCaseSpecialists(users: StaffUser[]): DistributionAssignee[] {
  return staffUsersForPartyRole(users, Roles.CaseSpecialist);
}

export function getRoleAssigneeId(
  users: StaffUser[],
): Partial<Record<RoleId, string>> {
  const map: Partial<Record<RoleId, string>> = {};
  for (const user of users) {
    const role = partyRoleForStaffUser(user);
    const id = user.distributionAssigneeId?.trim();
    if (role && id && !map[role]) map[role] = id;
  }
  return map;
}
