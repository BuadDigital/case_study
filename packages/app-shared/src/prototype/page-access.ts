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
export function pagePathFromId(pageId: PageId): string {
  return pageId === "po" ? "/po" : `/${pageId}`;
}

/** First permitted page in sidebar order — post-login and access-denied redirect. */
export function defaultLandingPage(rolePages: readonly PageId[]): PageId {
  if (rolePages.includes("dashboard")) return "dashboard";
  for (const pageId of NAV_PAGE_ORDER) {
    if (rolePages.includes(pageId)) return pageId;
  }
  return rolePages[0] ?? "system-screen-catalog";
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
    case "property-appraisal":
      return "property-appraisal";
    case "property-inspection":
      return "property-inspection";
    case "government-review":
      return "government-review";
    case "valuation-coordination":
      return "valuation-coordination";
    case "login":
      return null;
    case "audit-log":
      return "audit-log";
    default:
      return parts[0] as PageId;
  }
}

/** PO property failure registration — allowed without full PO list access. */
export function isPoPropertyFailurePath(pathname: string): boolean {
  const parts = pathname.split("/").filter(Boolean);
  return (
    parts.length === 5 &&
    parts[0] === "po" &&
    parts[2] === "property" &&
    parts[4] === "failure"
  );
}

/** Property detail view — `/po/{po}/property/{id}` (not list/edit/failure). */
export function isPoPropertyDetailPath(pathname: string): boolean {
  const parts = pathname.split("/").filter(Boolean);
  return (
    parts.length === 4 &&
    parts[0] === "po" &&
    parts[2] === "property"
  );
}

/** Property edit — `/po/{po}/property/{id}/edit`. */
export function isPoPropertyEditPath(pathname: string): boolean {
  const parts = pathname.split("/").filter(Boolean);
  return (
    parts.length === 5 &&
    parts[0] === "po" &&
    parts[2] === "property" &&
    parts[4] === "edit"
  );
}

/** Party / queue roles that may open property detail without PO list access. */
const PROPERTY_DETAIL_WITHOUT_PO_LIST: readonly PageId[] = [
  "government-review",
  "property-inspection",
  "property-appraisal",
  "active-survey",
  "valuation-coordination",
  // "all-transactions",
  "failures",
];

/** Case-study specialist queues — may open property edit without full PO list. */
const PROPERTY_EDIT_WITHOUT_PO_LIST: readonly PageId[] = [
  "active-primary-data",
  "bourse-inquiry",
  "active-distribution",
  "active-case-study",
];

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
  const pageId = pageIdFromPathname(pathname);
  if (pageId === null) return true;
  return canAccessPage(pageId, rolePages);
}
