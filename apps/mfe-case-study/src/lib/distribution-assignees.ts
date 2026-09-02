import type { RoleId } from "@platform/types";
import type { StaffUser } from "@platform/app-shared/app-data/constants";

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
  "مسؤول التحول الرقمي (CDO)": "cdo",
  "مدير إدارة التقييم العقاري": "general-manager",
  "مشرف قسم دراسة الحالة": "section-supervisor",
  "أخصائي دراسة حالة": "case-specialist",
  "مراجع حكومي": "government-reviewer",
  "مقيم عقاري": "real-estate-appraiser",
  "معاين ميداني": "field-inspector",
  "موظف الشؤون المالية": "financial-officer",
  "مقدم خدمة — جهة": "engineering-office",
  // en-dash / hyphen variants from HR import
  "مقدم خدمة - جهة": "engineering-office",
  "مقدم خدمة – جهة": "engineering-office",
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
    return "engineering-office";
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
  if (t.includes("معاين")) return "field-inspector";
  if (t.includes("مراجع")) return "government-reviewer";
  if (t.includes("مقيم")) return "real-estate-appraiser";
  if (t.includes("مكتب") || t.includes("مساح") || t.includes("جهة")) {
    return "engineering-office";
  }
  return null;
}

export function staffUsersForPartyRole(
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
  viewerEmail?: string | null,
): StaffUser | undefined {
  const email = viewerEmail?.trim().toLowerCase();
  if (email) {
    const byEmail = users.find(
      (u) =>
        u.email.trim().toLowerCase() === email &&
        partyRoleForStaffUser(u) === roleId,
    );
    if (byEmail) return byEmail;
  }
  return users.find(
    (u) => isStaffAssignable(u) && partyRoleForStaffUser(u) === roleId,
  );
}

export function getGovernmentAuditors(users: StaffUser[]): DistributionAssignee[] {
  return staffUsersForPartyRole(users, "government-reviewer");
}

export function getFieldInspectors(users: StaffUser[]): DistributionAssignee[] {
  return staffUsersForPartyRole(users, "field-inspector");
}

export function getValuators(users: StaffUser[]): DistributionAssignee[] {
  return staffUsersForPartyRole(users, "real-estate-appraiser");
}

export function getEngineeringOffices(
  users: StaffUser[],
): DistributionAssignee[] {
  return staffUsersForPartyRole(users, "engineering-office");
}

/** Normal case specialists only — supervisors are never listed. */
export function getCaseSpecialists(users: StaffUser[]): DistributionAssignee[] {
  return staffUsersForPartyRole(users, "case-specialist");
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
