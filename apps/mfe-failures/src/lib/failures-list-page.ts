import type { FailureListQuery } from "@platform/api-client";
import type { FailureRecord } from "@platform/app-shared/failures/failures-types";
import {
  failureListSeverityLabel,
  failureListStatusLabel,
  failureRecordTitle,
} from "./failures-labels";

/** Same window as the PO list — pagination-contract §5 pages the failures queue. */
export const FAILURES_PAGE_SIZE = 10;

/**
 * Every persisted status except `suspended`: suspended failures live on the
 * suspended-transactions screen, so the queue never listed them.
 */
export const FAILURES_LISTED_STATUSES: readonly string[] = [
  "internal",
  "review",
  "approved",
  "returned",
  "resolved",
];

/**
 * The server request for one queue page. `q` is the contract's substring
 * search over PO number, deed number, title and specialist; the sort is the
 * endpoint default (`updated desc`), spelled out so the cache key is explicit.
 */
export function failuresListServerQuery(input: {
  search: string;
  page: number;
}): FailureListQuery {
  const q = input.search.trim();
  return {
    page: Math.max(1, input.page),
    pageSize: FAILURES_PAGE_SIZE,
    sort: "updated",
    dir: "desc",
    status: FAILURES_LISTED_STATUSES,
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
export function matchesFailureSearch(f: FailureRecord, search: string): boolean {
  const q = search.trim().toLowerCase();
  if (!q) return true;
  const hay = [
    f.deedNumber,
    f.poNumber,
    failureRecordTitle(f),
    failureListSeverityLabel(f.severity),
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
 * billing buckets. Same order as the server default: `updated desc`.
 */
export function failuresLocalWindow(
  items: FailureRecord[],
  input: { search: string; page: number },
): FailuresPagination & { rows: FailureRecord[] } {
  const listed = items
    .filter(
      (f) =>
        FAILURES_LISTED_STATUSES.includes(f.status) &&
        matchesFailureSearch(f, input.search),
    )
    .sort((a, b) => b.updatedAt.localeCompare(a.updatedAt));
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
