/** Distribution party assignees — sourced from staff users API. */
import type { RoleId } from "@platform/types";
import type { StaffUser } from "@platform/app-shared/prototype/constants";
import {
  getEngineeringOffices as apiEngineeringOffices,
  getFieldInspectors as apiFieldInspectors,
  getGovernmentAuditors as apiGovernmentAuditors,
  getCaseSpecialists as apiCaseSpecialists,
  getPrototypeRoleAssigneeId as apiPrototypeRoleAssigneeId,
  getValuators as apiValuators,
  staffUserForViewer,
  type DistributionAssignee,
} from "../distribution-assignees";

export type DistributionPartyAccount = {
  assigneeId: string;
  name: string;
  subtitle: string;
  roleId: RoleId;
  email: string;
  password: string;
  roleOptionGroup: string;
  roleOptionLabel: string;
  enabled?: boolean;
};

export type { DistributionAssignee };

export function assigneeLabel(
  list: DistributionAssignee[],
  id: string,
): string {
  if (!id.trim()) return "";
  return list.find((a) => a.id === id)?.name ?? "";
}

export function getGovernmentAuditors(users: StaffUser[] = []): DistributionAssignee[] {
  return apiGovernmentAuditors(users);
}

export function getFieldInspectors(users: StaffUser[] = []): DistributionAssignee[] {
  return apiFieldInspectors(users);
}

export function getValuators(users: StaffUser[] = []): DistributionAssignee[] {
  return apiValuators(users);
}

export function getEngineeringOffices(users: StaffUser[] = []): DistributionAssignee[] {
  return apiEngineeringOffices(users);
}

export function getCaseSpecialists(users: StaffUser[] = []): DistributionAssignee[] {
  return apiCaseSpecialists(users);
}

export function getPrototypeRoleAssigneeId(
  users: StaffUser[] = [],
): Partial<Record<RoleId, string>> {
  return apiPrototypeRoleAssigneeId(users);
}

function staffToPartyAccount(
  staff: StaffUser,
  roleId: RoleId,
): DistributionPartyAccount | undefined {
  if (!staff.distributionAssigneeId?.trim()) return undefined;
  return {
    assigneeId: staff.distributionAssigneeId.trim(),
    name: staff.name,
    subtitle: staff.role,
    roleId,
    email: staff.email,
    password: "",
    roleOptionGroup: "",
    roleOptionLabel: staff.name,
  };
}

export function partyAccountForRole(
  roleId: RoleId,
  users: StaffUser[] = [],
): DistributionPartyAccount | undefined {
  const expectedId = getPrototypeRoleAssigneeId(users)[roleId];
  if (expectedId) {
    const fromStaff = users.find((u) => u.distributionAssigneeId === expectedId);
    if (fromStaff) return staffToPartyAccount(fromStaff, roleId);
  }
  return undefined;
}

export function partyAccountForViewer(
  roleId: RoleId,
  viewerEmail?: string | null,
  users: StaffUser[] = [],
): DistributionPartyAccount | undefined {
  const staff = staffUserForViewer(users, roleId, viewerEmail);
  if (staff) return staffToPartyAccount(staff, roleId);
  return undefined;
}
