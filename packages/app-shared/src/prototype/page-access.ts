import type { PageId } from "@platform/types";

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
    default:
      return parts[0] as PageId;
  }
}

export function canAccessPage(
  pageId: PageId,
  rolePages: readonly PageId[],
): boolean {
  if (pageId === "dashboard") return true;
  return rolePages.includes(pageId);
}
