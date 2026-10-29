import type { PageId } from "@platform/types";
import { ALL_PROTOTYPE_PAGES } from "@platform/app-shared/app-data/constants";
import { SYSTEM_FIELDS_PAGE_IDS } from "@platform/app-shared/app-data/system-fields-nav";
import { defaultLandingPage } from "./page-access";

const ALL_PAGE_SET = new Set<string>([
  ...ALL_PROTOTYPE_PAGES,
  ...SYSTEM_FIELDS_PAGE_IDS,
]);

/**
 * Nav row `all-transactions` — hidden from every role, CDO included.
 *
 * How it works: both page lists (API permissions and the role baseline) drop
 * the page when this is false, so the sidebar row and the route go together.
 * Edge cases: the page and its view stay in the code; to bring it back, return
 * true again for "cdo" and "case-specialist".
 */
export function roleSeesAllTransactionsPage(
  _role: string | null | undefined,
): boolean {
  return false;
}

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
  // "All transactions" — hidden from every role.
  if (!roleSeesAllTransactionsPage(role)) {
    merged.delete("all-transactions");
  }

  if (merged.size === 0) merged.add(defaultLandingPage([]));
  return [...merged];
}
