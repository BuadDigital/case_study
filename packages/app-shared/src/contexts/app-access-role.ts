import type { PageId, RoleId } from "@platform/types";
import { ROLES } from "../app-data/constants";
import {
  filterPagesBySubRoles,
  subRolesFromPermissions,
} from "../app-data/case-specialist-sub-roles";
import { pagesFromPermissions, roleSeesAllTransactionsPage } from "../app-data/permissions-pages";

/** Map server permissions to a known prototype role. Unknown or missing → null (no access). */
export function roleFromPermissions(
  prototypeRole: string | null | undefined,
  identityRoles: readonly string[] | undefined,
): RoleId | null {
  if (
    identityRoles?.some(
      (role) =>
        role.toLowerCase() === "cdo" || role.toLowerCase() === "admin",
    )
  ) {
    return "cdo";
  }

  const apiRole = prototypeRole?.trim().toLowerCase();
  if (apiRole && apiRole in ROLES) return apiRole as RoleId;
  return null;
}

/**
 * The pages a role holds on this screen.
 *
 * How it works: «أعمالي» is the field inspector's entry on a desktop only (Omar 2026-11-12:
 * his screens like the specialists' and the appraiser's, «دون المساس بـ PWA»). On a phone — the
 * installed app, below the `lg` width where the phone shell takes over — the page is dropped, so
 * he lands on his inspection queue, keeps it in the sidebar and works offline exactly as before.
 * Edge cases: every other role keeps its pages on every screen.
 */
export function pagesForViewport(
  role: RoleId | null,
  pages: readonly PageId[],
  desktop: boolean,
): PageId[] {
  if (desktop || role !== "field-inspector") return [...pages];
  return pages.filter((page) => page !== "my-work");
}

/** The part of `/api/permissions` a user's pages are worked out from. */
export type RolePagesSource = {
  pages?: readonly string[] | null;
  prototypeRole?: string | null;
  identityRoles?: readonly string[];
  subRoles?: readonly string[] | null;
};

/**
 * The pages a signed-in user holds: what the server granted, plus his role's baseline in the app.
 *
 * How it works: the role's baseline pages (a case specialist's trimmed to the sub-roles he holds,
 * «المعاملات النشطة» only for the roles that follow it) joined to the server's pages, server first.
 * Edge cases: an unknown role → no page; a server that sent no page → the baseline alone.
 * Fixed 2026-11-11: this lived inside the app's access context only, and the login worked its
 * landing page out of the server's pages alone — so a page the app adds to a role («أعمالي» for the
 * appraiser) showed in the sidebar while the login still landed on the old queue. The login now
 * calls this too.
 * `desktop` (2026-11-12) is the screen the pages are for — see `pagesForViewport`; the app and the
 * login both pass the real one.
 */
export function rolePagesFromPermissions(
  permissions: RolePagesSource | null | undefined,
  desktop = true,
): PageId[] {
  const role = roleFromPermissions(permissions?.prototypeRole, permissions?.identityRoles);
  if (role == null) return [];
  return pagesForViewport(role, pagesBeforeViewport(role, permissions), desktop);
}

function pagesBeforeViewport(role: RoleId, permissions: RolePagesSource | null | undefined): PageId[] {
  // A specialist's baseline keeps only the queue pages of the sub-roles he holds.
  const baseline = filterPagesBySubRoles(
    role,
    subRolesFromPermissions(role, permissions?.subRoles),
    ROLES[role].pages,
  ).filter((page) => page !== "all-transactions" || roleSeesAllTransactionsPage(role));
  if (!permissions?.pages?.length) return baseline;
  const fromApi = pagesFromPermissions(permissions.pages, {
    prototypeRole: permissions.prototypeRole,
  });
  return [...new Set<PageId>([...fromApi, ...baseline])];
}
