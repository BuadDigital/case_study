import type { PageId } from "@platform/types";
import { ALL_PROTOTYPE_PAGES } from "@platform/app-shared/app-data/constants";
import { SYSTEM_FIELDS_PAGE_IDS } from "@platform/app-shared/app-data/system-fields-nav";
import { defaultLandingPage } from "./page-access";

const ALL_PAGE_SET = new Set<string>([
  ...ALL_PROTOTYPE_PAGES,
  ...SYSTEM_FIELDS_PAGE_IDS,
]);

/** Roles that follow every live transaction on «المعاملات النشطة». */
const ACTIVE_TRANSACTIONS_PAGE_ROLES = new Set([
  "cdo",
  "general-manager",
  "section-supervisor",
  "case-specialist",
]);

/**
 * Nav row `all-transactions` — «المعاملات النشطة»: every live transaction, its stage and who it
 * waits for.
 *
 * How it works: both page lists (API permissions and the role baseline) drop the page when this is
 * false, so the sidebar row and the route go together.
 * Edge cases / changed 2026-11-05 (Omar): the page was hidden from every role as «جميع المعاملات»;
 * it is back for the case-study staff as the follow-up page that replaced «أعمالي»'s «تنتظر غيرك».
 * Party roles keep their own queues.
 */
export function roleSeesAllTransactionsPage(
  role: string | null | undefined,
): boolean {
  return ACTIVE_TRANSACTIONS_PAGE_ROLES.has(role?.trim().toLowerCase() ?? "");
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
