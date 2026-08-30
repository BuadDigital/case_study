import type { RoleId } from "@platform/types";
import { isSuperAdmin } from "@platform/app-shared/prototype/prototype-role-access";

export function canReceivePo(role: RoleId): boolean {
  return (
    isSuperAdmin(role) ||
    role === "section-supervisor" ||
    role === "case-specialist"
  );
}

export function canEditPoHeader(role: RoleId): boolean {
  return isSuperAdmin(role) || role === "section-supervisor";
}

export function canEditProperty(role: RoleId): boolean {
  return isSuperAdmin(role) || role === "case-specialist";
}

export function isCaseStudySpecialist(role: RoleId): boolean {
  return role === "case-specialist";
}

/** View details via the eye button — not for the case-study specialist (opens from the row or edit). */
export function canViewPoEye(role: RoleId): boolean {
  return isSuperAdmin(role) || !isCaseStudySpecialist(role);
}

export function isPoViewOnly(role: RoleId): boolean {
  return !isSuperAdmin(role) && role === "general-manager";
}

export function canDeletePo(role: RoleId): boolean {
  return isSuperAdmin(role) || role === "section-supervisor";
}

export function canDeleteProperty(role: RoleId): boolean {
  return isSuperAdmin(role) || role === "section-supervisor";
}

/** Delete a transaction from primary-data / bourse / distribution queues — supervisor or admin only. */
export function canDeleteTransaction(role: RoleId): boolean {
  return canDeleteProperty(role);
}

/** Supervisor and specialist may raise a failure from the property screen. */
export function canRaisePropertyFailure(role: RoleId): boolean {
  return canEditProperty(role) || canEditPoHeader(role);
}

/** Timeline and party status on property detail — case-study specialist, section supervisor, and system admin (not the appraiser). */
export function canViewPropertyTimelineRail(role: RoleId): boolean {
  return canRaisePropertyFailure(role);
}

/** Reassign case-study parties — section-supervisor+ permission. */
export function canRedistributeParties(role: RoleId): boolean {
  return (
    isSuperAdmin(role) ||
    role === "section-supervisor" ||
    role === "general-manager"
  );
}
