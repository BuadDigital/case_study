import type { RoleId } from "@platform/types";
import type { StaffUser } from "@platform/app-shared/prototype/constants";

export type DistributionAssignee = {
  id: string;
  name: string;
  subtitle?: string;
};

/**
 * Exact JobTitle values from seeded prototype users → English RoleId.
 * No fuzzy / contains matching.
 */
const EXACT_JOB_TITLE_TO_ROLE: Record<string, RoleId> = {
  "مسؤول التحول الرقمي (CDO)": "cdo",
  "أخصائية موارد بشرية": "hr-admin",
  "مدير المالية والعقود": "proc-admin",
  "مدير علاقات العملاء": "crm-admin",
  "مدير إدارة التقييم العقاري": "general-manager",
  "مشرف قسم دراسة الحالة": "section-supervisor",
  "أخصائي دراسة حالة": "case-specialist",
  "مراجع حكومي": "government-reviewer",
  "منسق عمليات التقييم": "valuation-coordinator",
  "مقيم عقاري": "real-estate-appraiser",
  "معاين ميداني": "field-inspector",
  "موظف الشؤون المالية": "financial-officer",
  "مقدم خدمة — جهة": "engineering-office",
};

function employmentSubtitle(user: StaffUser): string | undefined {
  const employment = user.details?.find(
    (d) => d.section === "بيانات التوظيف" && d.label === "نوع التوظيف",
  )?.value;
  if (employment?.trim()) return `${user.role} — ${employment.trim()}`;
  if (user.source === "proc") return user.role;
  return user.role;
}

export function partyRoleForStaffUser(user: StaffUser): RoleId | null {
  if (user.distributionAssigneeId?.startsWith("eo-")) {
    return "engineering-office";
  }
  const t = user.role.trim();
  if (!t) return null;
  return EXACT_JOB_TITLE_TO_ROLE[t] ?? null;
}

export function staffUsersForPartyRole(
  users: StaffUser[],
  roleId: RoleId,
): DistributionAssignee[] {
  return users
    .filter(
      (u) =>
        u.status !== "Inactive" &&
        u.distributionAssigneeId?.trim() &&
        partyRoleForStaffUser(u) === roleId,
    )
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
    (u) =>
      u.distributionAssigneeId?.trim() &&
      partyRoleForStaffUser(u) === roleId,
  );
}

export function getGovernmentAuditors(users: StaffUser[]): DistributionAssignee[] {
  return staffUsersForPartyRole(users, "government-reviewer");
}

export function getValuationCoordinators(
  users: StaffUser[],
): DistributionAssignee[] {
  return staffUsersForPartyRole(users, "valuation-coordinator");
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

export function getPrototypeRoleAssigneeId(
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
