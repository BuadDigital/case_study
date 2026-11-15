import type { PageId } from "@platform/types";
import { ACTIVE_TRANSACTIONS_NAV } from "./active-transactions";
import { NAV } from "./constants";
import { SYSTEM_FIELDS_PAGE_IDS } from "./system-fields-nav";
import { SYSTEM_SETTINGS_PRIMARY_PAGE_IDS } from "./system-settings-nav";

const NAV_PAGE_ORDER: PageId[] = [
  ...NAV.map((item) => item.id),
  ...ACTIVE_TRANSACTIONS_NAV.map((item) => item.id),
  ...SYSTEM_SETTINGS_PRIMARY_PAGE_IDS,
  ...SYSTEM_FIELDS_PAGE_IDS,
];

/** Map shell page id to app route. */
function pagePathFromId(pageId: PageId): string {
  return pageId === "po" ? "/po" : `/${pageId}`;
}

/** Dedicated party work queues — preferred over the generic ops hub after login. */
const PARTY_WORK_QUEUE_PAGES = [
  "property-appraisal",
  "active-inspection",
  "active-survey",
] as const satisfies readonly PageId[];

/**
 * Super-admin home: the shared dashboard is on every role now, but only the
 * CDO catalog (`users`) — or a dashboard-only page list — should land there.
 */
function isDashboardHome(rolePages: readonly PageId[]): boolean {
  if (!rolePages.includes("dashboard")) return false;
  if (rolePages.includes("users")) return true;
  return rolePages.every((page) => page === "dashboard");
}

/**
 * First permitted page in sidebar order — post-login, the site's entry («/») and access-denied redirect.
 *
 * How it works: the super-admin home (the CDO) is the dashboard; then (Omar 2026-11-09) whoever holds
 * «أعمالي» — case specialists, the section supervisor, the general manager — lands on it; then the
 * party work queues, the PO list, the operations hub, and the sidebar order.
 * Edge cases / changed 2026-11-09: the general manager used to land on the PO list.
 */
export function defaultLandingPage(rolePages: readonly PageId[]): PageId {
  if (isDashboardHome(rolePages)) return "dashboard";

  if (rolePages.includes("my-work")) return "my-work";

  // Appraiser / inspector / engineering office → their primary work queue.
  for (const pageId of PARTY_WORK_QUEUE_PAGES) {
    if (rolePages.includes(pageId)) return pageId;
  }

  // Remaining independent executors (e.g. government reviewer) without a
  // dedicated queue — land on the operations-tasks hub. A case specialist holding
  // any case-study queue (any sub-role) is not one of them: he lands on «أعمالي» (first NAV page).
  if (
    rolePages.includes("operations-tasks") &&
    !holdsCaseStudyQueue(rolePages)
  ) {
    return "operations-tasks";
  }

  for (const pageId of NAV_PAGE_ORDER) {
    // «المفضلة» sits near the top of the menu (2026-11-12) but is a list to look things up in,
    // never where a role starts.
    if (pageId === "dashboard" || pageId === "favorites") continue;
    if (rolePages.includes(pageId)) return pageId;
  }
  if (rolePages.includes("financial")) return "financial";
  // No page at all → the profile (open to everyone); «dashboard» would bounce back here forever now
  // that only the CDO holds it (Omar 2026-11-09).
  return rolePages.find((page) => page !== "dashboard") ?? rolePages[0] ?? "profile";
}

export function defaultLandingPath(rolePages: readonly PageId[]): string {
  return pagePathFromId(defaultLandingPage(rolePages));
}

/** Map URL path to sidebar page id for permission checks. */
export function pageIdFromPathname(pathname: string): PageId | null {
  const parts = pathname.split("/").filter(Boolean);
  if (parts.length === 0) return "dashboard";

  switch (parts[0]) {
    case "po":
      return "po";
    case "case-study":
      return "active-case-study";
    case "active-survey":
      return "active-survey";
    case "active-inspection":
      return "active-inspection";
    case "property-appraisal":
      return "property-appraisal";
    case "property-inspection":
      return "property-inspection";
    case "login":
    case "start": // the site's entry: it sends the user to his landing page itself
      return null;
    case "audit-log":
      return "audit-log";
    default:
      return parts[0] as PageId;
  }
}

/** PO property failure registration — allowed without full PO list access. */
function isPoPropertyFailurePath(pathname: string): boolean {
  const parts = pathname.split("/").filter(Boolean);
  return (
    parts.length === 5 &&
    parts[0] === "po" &&
    parts[2] === "property" &&
    parts[4] === "failure"
  );
}

/** Property detail view — `/po/{po}/property/{id}` (not list/edit/failure). */
function isPoPropertyDetailPath(pathname: string): boolean {
  const parts = pathname.split("/").filter(Boolean);
  return (
    parts.length === 4 &&
    parts[0] === "po" &&
    parts[2] === "property"
  );
}

/**
 * Property edit — `/po/{po}/property/{id}/edit` — the work page `…/work` and the coordinator's page
 * `…/coordination` (Omar 2026-11-08) — the same staff.
 */
function isPoPropertyEditPath(pathname: string): boolean {
  const parts = pathname.split("/").filter(Boolean);
  return (
    parts.length === 5 &&
    parts[0] === "po" &&
    parts[2] === "property" &&
    (parts[4] === "edit" || parts[4] === "work" || parts[4] === "coordination")
  );
}

/** Party / queue roles that may open property detail without PO list access. */
  const PROPERTY_DETAIL_WITHOUT_PO_LIST: readonly PageId[] = [
  "property-inspection",
  "active-inspection",
  "property-appraisal",
  "active-survey",
  /** Field inspector works from property detail or the official inspection queue. */
  "all-transactions",
  "property-map",
  "favorites",
  "failures",
  "system-upload",
  "active-case-study",
  "operations-tasks",
  "keys",
];

/** Case-study specialist queues — may open property edit without full PO list. */
const PROPERTY_EDIT_WITHOUT_PO_LIST: readonly PageId[] = [
  "active-primary-data",
  "bourse-inquiry",
  "active-distribution",
  "active-receipt",
  "active-case-study",
  "system-upload",
];

/**
 * True when the role holds at least one case-study specialist queue — i.e. a case specialist of any
 * sub-role, the section supervisor or the CDO.
 *
 * How it works: any page of `PROPERTY_EDIT_WITHOUT_PO_LIST` counts.
 * Edge cases / fixed: a coordination-only specialist (no `active-case-study`) used to fall into the
 * government reviewer's operations-tasks landing, and coordination- or review-only specialists were
 * silently sent away from `/case-study/{task}` links (the deposit lives there for review).
 */
function holdsCaseStudyQueue(rolePages: readonly PageId[]): boolean {
  return PROPERTY_EDIT_WITHOUT_PO_LIST.some((id) => rolePages.includes(id));
}

/** Case-study workspace — `/case-study/{taskId}`. */
function isCaseStudyWorkspacePath(pathname: string): boolean {
  const parts = pathname.split("/").filter(Boolean);
  return parts.length === 2 && parts[0] === "case-study";
}

export function canAccessPage(
  pageId: PageId,
  rolePages: readonly PageId[],
): boolean {
  // Self profile is available to every signed-in role.
  if (pageId === "profile") return true;
  return rolePages.includes(pageId);
}

/** Path-aware permission check for shell routes (incl. PO failure sub-route). */
export function canAccessPathname(
  pathname: string,
  rolePages: readonly PageId[],
): boolean {
  if (isPoPropertyFailurePath(pathname) && rolePages.includes("failures")) {
    return true;
  }
  if (
    isPoPropertyDetailPath(pathname) &&
    PROPERTY_DETAIL_WITHOUT_PO_LIST.some((id) => rolePages.includes(id))
  ) {
    return true;
  }
  if (
    isPoPropertyEditPath(pathname) &&
    PROPERTY_EDIT_WITHOUT_PO_LIST.some((id) => rolePages.includes(id))
  ) {
    return true;
  }
  if (isCaseStudyWorkspacePath(pathname) && holdsCaseStudyQueue(rolePages)) {
    return true;
  }
  const pageId = pageIdFromPathname(pathname);
  if (pageId === null) return true;
  return canAccessPage(pageId, rolePages);
}
