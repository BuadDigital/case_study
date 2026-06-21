import type { PageId } from "@platform/types";
import { ALL_PROTOTYPE_PAGES } from "@platform/app-shared/prototype/constants";
import { SYSTEM_FIELDS_PAGE_IDS } from "@platform/app-shared/prototype/system-fields-nav";

const ALL_PAGE_SET = new Set<string>([
  ...ALL_PROTOTYPE_PAGES,
  ...SYSTEM_FIELDS_PAGE_IDS,
]);

/** Map API permission page ids to shell navigation pages. */
export function pagesFromPermissions(apiPages: readonly string[]): PageId[] {
  const merged = new Set<PageId>();
  for (const page of apiPages) {
    if (ALL_PAGE_SET.has(page)) merged.add(page as PageId);
  }
  if (merged.size === 0) merged.add("dashboard");
  return [...merged];
}
