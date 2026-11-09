import type { CaseSpecialistSubRole, PageId, RoleId } from "@platform/types";

/**
 * The case specialist's sub-roles (Omar's ruling 2026-11-02) — mirrors `CaseSpecialistSubRoles`
 * in Shared.Contracts. A specialist holds one or more; every other role holds none.
 */
export const CASE_SPECIALIST_SUB_ROLES: readonly CaseSpecialistSubRole[] = [
  "coordination",
  "study",
  "review",
];

export const CASE_SPECIALIST_SUB_ROLE_LABELS: Record<CaseSpecialistSubRole, string> = {
  coordination: "التنسيق",
  study: "دراسة العقار",
  review: "المراجعة والاعتماد والرفع",
};

/** The role plus the sub-roles it holds, as the role helpers (`po-roles.ts`) take them. */
export type StaffAccess = {
  role: RoleId;
  subRoles: readonly CaseSpecialistSubRole[];
};

export function isCaseSpecialistSubRole(value: string): value is CaseSpecialistSubRole {
  return (CASE_SPECIALIST_SUB_ROLES as readonly string[]).includes(value);
}

/**
 * The sub-roles of the signed-in user from `/api/permissions`.
 *
 * How it works: known words only, in the fixed coordination, study, review order.
 * Edge cases: a case specialist whose permissions carry no sub-role (a server older than the split)
 * holds all three, as the server reads such a token; any other role holds none.
 */
export function subRolesFromPermissions(
  role: RoleId | null,
  raw: readonly string[] | null | undefined,
): readonly CaseSpecialistSubRole[] {
  if (role !== "case-specialist") return [];
  const held = new Set((raw ?? []).map((s) => s.trim().toLowerCase()));
  const known = CASE_SPECIALIST_SUB_ROLES.filter((s) => held.has(s));
  return known.length > 0 ? known : CASE_SPECIALIST_SUB_ROLES;
}

/** True only for a case specialist holding that sub-role. */
export function holdsSubRole(access: StaffAccess, subRole: CaseSpecialistSubRole): boolean {
  return access.role === "case-specialist" && access.subRoles.includes(subRole);
}

/**
 * The queue pages each sub-role opens — mirrors `PlatformPermissionCatalog.CaseSpecialistSubRolePages`.
 * The specialist's other pages (dashboard, po, map, favorites, failures…) are common to all.
 */
const SUB_ROLE_PAGES: Record<CaseSpecialistSubRole, readonly PageId[]> = {
  coordination: [
    "active-primary-data",
    "bourse-inquiry",
    "active-distribution",
    "active-receipt",
    "operations-tasks",
    "keys",
    "field-sync-board",
    "suspended-transactions",
    "failure-types",
  ],
  study: ["active-case-study"],
  review: ["system-upload"],
};

const SUB_ROLE_PAGE_SET = new Set<PageId>(Object.values(SUB_ROLE_PAGES).flat());

/**
 * Drops from a case specialist's baseline pages the queue pages of the sub-roles he does not hold,
 * so the baseline never adds back a page the server left out.
 *
 * How it works: a page owned by some sub-role stays only when a held sub-role owns it; pages owned
 * by none stay. Edge cases: other roles are returned unchanged.
 */
export function filterPagesBySubRoles(
  role: RoleId,
  subRoles: readonly CaseSpecialistSubRole[],
  pages: readonly PageId[],
): PageId[] {
  if (role !== "case-specialist") return [...pages];
  const allowed = new Set<PageId>(subRoles.flatMap((s) => SUB_ROLE_PAGES[s]));
  return pages.filter((page) => !SUB_ROLE_PAGE_SET.has(page) || allowed.has(page));
}

/**
 * A `StaffAccess` from a role and optional sub-roles. A case specialist given none holds all three
 * (the launch state of 2026-11-02); other roles hold none. Used by tests and by role-only callers.
 */
export function staffAccessOf(
  role: RoleId,
  subRoles?: readonly CaseSpecialistSubRole[],
): StaffAccess {
  if (role !== "case-specialist") return { role, subRoles: [] };
  return { role, subRoles: subRoles ?? CASE_SPECIALIST_SUB_ROLES };
}
