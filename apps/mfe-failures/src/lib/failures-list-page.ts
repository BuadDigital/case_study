import type { FailureListQuery } from "@platform/api-client";
import type {
  FailureRecord,
  FailureStatus,
} from "@platform/app-shared/failures/failures-types";
import type { RoleId } from "@platform/types";
import { failureListStatusLabel, failureRecordTitle } from "./failures-labels";

/** Same window as the PO list — the pagination contract pages the failures queue. */
export const FAILURES_PAGE_SIZE = 10;

/** The queue's two tabs: «تحتاج إجراء» (open work) and «التعذّرات» (final failures). */
export type FailuresTab = "action" | "final";

/**
 * The statuses a tab lists for a role.
 *
 * How it works: «التعذّرات» is the final failure — approved by the supervisor after the
 * assignment specialist's direction, nothing to do after it. «تحتاج إجراء» is the open work:
 * the possible / internal failure, the one returned to the specialist, and the escalated one.
 * The section supervisor works only on what the specialist escalated, so their «تحتاج إجراء»
 * is `review` alone; the specialist keeps `review` on view (no buttons) so an escalation does
 * not vanish before the supervisor decides.
 *
 * Edge cases: `resolved` and `suspended` are on neither tab — a resolved failure is over, a
 * suspended one lives on the suspended-transactions screen.
 */
export function failuresTabStatuses(
  tab: FailuresTab,
  role: RoleId,
): readonly FailureStatus[] {
  if (tab === "final") return ["approved"];
  if (role === "section-supervisor") return ["review"];
  return ["internal", "returned", "review"];
}

/**
 * The tab a failure shows on for a role, or null when it is on neither.
 *
 * How it works: «التعذّرات» is checked first, then «تحتاج إجراء», against `failuresTabStatuses`.
 *
 * Edge cases: the same failure can sit on a tab for one role and on none for another — an
 * `internal` failure is the specialist's work but not the supervisor's, so it is null for him.
 * The queue uses this to open a deep link (`?highlight=`) on the tab that holds the failure.
 */
export function failuresTabOf(status: FailureStatus, role: RoleId): FailuresTab | null {
  if (failuresTabStatuses("final", role).includes(status)) return "final";
  if (failuresTabStatuses("action", role).includes(status)) return "action";
  return null;
}

/**
 * The server request for one queue page. `q` is the contract's substring
 * search over PO number, deed number, title and specialist; newest raised first
 * (`created desc`), matching the table's «تاريخ تسجيل التعذّر» column.
 *
 * How it works: the tab's statuses travel as the `status` filter, so each tab is its own
 * server-paged list and its pager counts only its rows.
 *
 * Edge cases: the order used to be `updated desc`; with a date column that read as unsorted, so
 * it follows the registration date now — an acted-on failure no longer jumps to the top. A blank
 * search sends no `q`, keeping the cache key of the unfiltered page stable.
 */
export function failuresListServerQuery(input: {
  search: string;
  page: number;
  statuses: readonly FailureStatus[];
}): FailureListQuery {
  const q = input.search.trim();
  return {
    page: Math.max(1, input.page),
    pageSize: FAILURES_PAGE_SIZE,
    sort: "created",
    dir: "desc",
    status: input.statuses,
    ...(q ? { q } : {}),
  };
}

export type FailuresPagination = {
  totalCount: number;
  totalPages: number;
  safePage: number;
  rangeStart: number;
  rangeEnd: number;
};

/** Pager numbers from the server envelope — the actor's real totals. */
export function failuresServerPagination(input: {
  totalCount: number;
  page: number;
  pageSize: number;
  totalPages: number;
}): FailuresPagination {
  const pageSize = input.pageSize > 0 ? input.pageSize : FAILURES_PAGE_SIZE;
  const totalPages = Math.max(1, input.totalPages);
  const safePage = Math.min(Math.max(1, input.page), totalPages);
  return {
    totalCount: input.totalCount,
    totalPages,
    safePage,
    rangeStart: input.totalCount === 0 ? 0 : (safePage - 1) * pageSize + 1,
    rangeEnd: Math.min(safePage * pageSize, input.totalCount),
  };
}

/** The local search the queue ran before the server took `q` — kept for the party window. */
function matchesFailureSearch(f: FailureRecord, search: string): boolean {
  const q = search.trim().toLowerCase();
  if (!q) return true;
  const hay = [
    f.deedNumber,
    f.poNumber,
    failureRecordTitle(f),
    failureListStatusLabel(f.status, f.severity),
    f.raisedByRole,
    f.specialist,
  ]
    .join(" ")
    .toLowerCase();
  return hay.includes(q);
}

/**
 * Client-side window over rows the server cannot narrow. Party-scoped roles
 * are filtered by the raiser label (`failuresForPartyRole`), which is not a
 * `GET /api/failures` filter, so their queue is cut here from the whole set
 * (already in cache for the KPI band) — the same pattern as the PO list's
 * billing buckets. Same order as the server request: `created desc`.
 *
 * How it works: keeps the tab's statuses that match the search, sorts newest registered first
 * and cuts the 10-row page, clamping the page into range.
 *
 * Edge cases: before the tabs it kept every status but `suspended` — resolved failures showed
 * too; now `statuses` is the only filter, so a party's resolved failure is on no tab, exactly as
 * on the server-paged path.
 */
export function failuresLocalWindow(
  items: FailureRecord[],
  input: { search: string; page: number; statuses: readonly FailureStatus[] },
): FailuresPagination & { rows: FailureRecord[] } {
  const listed = items
    .filter(
      (f) =>
        input.statuses.includes(f.status) &&
        matchesFailureSearch(f, input.search),
    )
    .sort((a, b) => b.createdAt.localeCompare(a.createdAt));
  const totalCount = listed.length;
  const totalPages = Math.max(1, Math.ceil(totalCount / FAILURES_PAGE_SIZE));
  const safePage = Math.min(Math.max(1, input.page), totalPages);
  const start = (safePage - 1) * FAILURES_PAGE_SIZE;
  return {
    rows: listed.slice(start, start + FAILURES_PAGE_SIZE),
    totalCount,
    totalPages,
    safePage,
    rangeStart: totalCount === 0 ? 0 : start + 1,
    rangeEnd: Math.min(start + FAILURES_PAGE_SIZE, totalCount),
  };
}

/**
 * A deep link (`?highlight=<id>`) lands on page 1, where the record may not
 * be. The whole set is in cache anyway (KPI band, sidebar badge), so the
 * highlighted row is pinned above the page rather than lost.
 */
export function pinHighlightedFailure(
  pageRows: FailureRecord[],
  allItems: FailureRecord[],
  highlightId: string | null,
): FailureRecord[] {
  if (!highlightId || pageRows.some((f) => f.id === highlightId)) {
    return pageRows;
  }
  const pinned = allItems.find((f) => f.id === highlightId);
  return pinned ? [pinned, ...pageRows] : pageRows;
}
