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

export function canAccessPage(
  pageId: PageId,
  rolePages: readonly PageId[],
): boolean {
  return rolePages.includes(pageId);
}
