import type { PageId } from "@platform/types";
import { ALL_PROTOTYPE_PAGES } from "@platform/app-shared/prototype/constants";
import { SYSTEM_FIELDS_PAGE_IDS } from "@platform/app-shared/prototype/system-fields-nav";
import { defaultLandingPage } from "./page-access";

const ALL_PAGE_SET = new Set<string>([
  ...ALL_PROTOTYPE_PAGES,
  ...SYSTEM_FIELDS_PAGE_IDS,
]);

/** Map API permission page ids to shell navigation pages. */
export function pagesFromPermissions(
  apiPages: readonly string[],
  options?: { prototypeRole?: string | null },
): PageId[] {
  const merged = new Set<PageId>();
  for (const page of apiPages) {
    if (ALL_PAGE_SET.has(page)) merged.add(page as PageId);
  }

  const role = options?.prototypeRole?.trim().toLowerCase();
  const dashboardAllowed = role === "cdo";
  if (!dashboardAllowed) {
    merged.delete("dashboard");
  }
  // أخصائي/مشرف دراسة الحالة والمراجع الحكومي — بدون «جميع المعاملات»
  if (
    role === "case-specialist" ||
    role === "section-supervisor" ||
    role === "government-reviewer"
  ) {
    merged.delete("all-transactions");
  }

  if (merged.size === 0) merged.add(defaultLandingPage([]));
  return [...merged];
}
