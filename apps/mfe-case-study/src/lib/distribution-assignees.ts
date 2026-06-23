import type { RoleId } from "@platform/types";
import type { StaffUser } from "@platform/app-shared/prototype/constants";

export type DistributionAssignee = {
  id: string;
  name: string;
  subtitle?: string;
};

const JOB_TITLE_PARTY_ROLE: Record<string, RoleId> = {
  "مراجع حكومي": "government-reviewer",
  "منسق عمليات التقييم": "valuation-coordinator",
  "معاين ميداني": "field-inspector",
  "مقيم عقاري": "real-estate-appraiser",
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
  return JOB_TITLE_PARTY_ROLE[user.role.trim()] ?? null;
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
