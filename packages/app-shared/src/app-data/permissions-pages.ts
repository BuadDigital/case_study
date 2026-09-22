import type { PageId } from "@platform/types";
import { ALL_PROTOTYPE_PAGES } from "@platform/app-shared/app-data/constants";
import { SYSTEM_FIELDS_PAGE_IDS } from "@platform/app-shared/app-data/system-fields-nav";
import { ORPHAN_SCREENS_PAGE_IDS } from "@platform/app-shared/app-data/orphan-screens-nav";
import { defaultLandingPage } from "./page-access";

const ALL_PAGE_SET = new Set<string>([
  ...ALL_PROTOTYPE_PAGES,
  ...SYSTEM_FIELDS_PAGE_IDS,
  ...ORPHAN_SCREENS_PAGE_IDS,
]);

/** Nav row `all-transactions` — CDO plus the case specialist (not party roles). */
export function roleSeesAllTransactionsPage(
  role: string | null | undefined,
): boolean {
  const normalized = role?.trim().toLowerCase();
  return normalized === "cdo" || normalized === "case-specialist";
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
  // Legacy draft screens removed from nav — strip if still granted by API.
  if (role !== "cdo") {
    for (const pageId of ORPHAN_SCREENS_PAGE_IDS) {
      merged.delete(pageId);
    }
  }
  // "All transactions" — CDO and the case specialist.
  if (!roleSeesAllTransactionsPage(role)) {
    merged.delete("all-transactions");
  }

  if (merged.size === 0) merged.add(defaultLandingPage([]));
  return [...merged];
}
