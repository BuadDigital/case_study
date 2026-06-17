import type { UserListItem } from "@platform/types";
import type { StaffUser } from "../prototype/constants";

export function contractTypeToStaffType(
  t: UserListItem["contractType"],
): StaffUser["type"] {
  if (t === "Internal") return "internal";
  if (t === "Freelance") return "freelance";
  return "external";
}

export function userListItemToStaff(u: UserListItem): StaffUser {
  return {
    id: u.id,
    name: u.displayName,
    role: u.jobTitle,
    email: u.email,
    userName: u.userName,
    type: contractTypeToStaffType(u.contractType),
    source:
      u.registrationSource === "Hr"
        ? "hr"
        : u.registrationSource === "Proc"
          ? "proc"
          : "crm",
    phone: u.phoneNumber,
    createdAt: u.createdAtUtc,
    status: u.status,
    systemRoles: u.systemRoles ?? [],
    details: (u.details ?? []).map((d) => ({
      section: d.section,
      label: d.label,
      value: d.value,
    })),
  };
}
