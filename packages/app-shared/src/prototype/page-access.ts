import type { PageId } from "@platform/types";
import { ACTIVE_TRANSACTIONS_NAV } from "./active-transactions";
import { NAV } from "./constants";
import { SETTINGS_NAV } from "./settings-nav";
import { SYSTEM_FIELDS_PAGE_IDS } from "./system-fields-nav";

const NAV_PAGE_ORDER: PageId[] = [
  ...NAV.map((item) => item.id),
  ...ACTIVE_TRANSACTIONS_NAV.map((item) => item.id),
  ...SETTINGS_NAV.map((item) => item.id),
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
  return rolePages[0] ?? "users";
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

export function canAccessPage(
  pageId: PageId,
  rolePages: readonly PageId[],
): boolean {
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
  const pageId = pageIdFromPathname(pathname);
  if (pageId === null) return true;
  return canAccessPage(pageId, rolePages);
}
