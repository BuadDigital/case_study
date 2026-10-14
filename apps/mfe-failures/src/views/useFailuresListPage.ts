"use client";

import { useCallback, useMemo, useState } from "react";
import type { RoleId } from "@platform/types";
import { useDebouncedValue } from "@platform/app-shared/hooks/use-debounced-value";
import type { FailureRecord } from "@platform/app-shared/failures/failures-types";
import {
  failuresForPartyRole,
  isPartyScopedFailuresRole,
} from "../lib/failures-party-raiser-scope";
import {
  FAILURES_PAGE_SIZE,
  failuresListServerQuery,
  failuresLocalWindow,
  failuresServerPagination,
  pinHighlightedFailure,
  type FailuresPagination,
} from "../lib/failures-list-page";
import { useFailuresPageQuery, useFailuresQuery } from "../query/failures-queries";

const EMPTY: FailureRecord[] = [];

/**
 * Row source for the failures queue — server-paged per pagination-contract §5.
 *
 * Two things still need the whole set, so `useFailuresQuery` stays mounted:
 * - the KPI band (open / review / closed / total): there is no
 *   `/api/failures/counts` endpoint, and the set is in cache anyway for the
 *   sidebar badge and the property gates;
 * - party-scoped roles (engineering office, inspector, appraiser, government
 *   reviewer) are narrowed by *raiser label*, which `GET /api/failures` cannot
 *   filter on — their window is cut client-side from the whole set.
 */
export function useFailuresListPage(role: RoleId, highlightId: string | null) {
  const partyScoped = isPartyScopedFailuresRole(role);
  const [search, setSearch] = useState("");
  const [page, setPage] = useState(1);
  // The search box drives a server request — debounce it, do not just defer a
  // local filter pass (the deferred value would fire a request per keystroke).
  const debouncedSearch = useDebouncedValue(search, 300);

  // A new search term restarts at page 1 (the old page may not exist). Adjusted
  // during render instead of in an effect, so the list never paints the stale page.
  const [pagedSearch, setPagedSearch] = useState(debouncedSearch);
  if (pagedSearch !== debouncedSearch) {
    setPagedSearch(debouncedSearch);
    setPage(1);
  }

  const whole = useFailuresQuery();
  const allItems = whole.data ?? EMPTY;
  const kpiItems = useMemo(
    () => failuresForPartyRole(role, allItems) ?? allItems,
    [allItems, role],
  );

  const serverQuery = useMemo(
    () => failuresListServerQuery({ search: debouncedSearch, page }),
    [debouncedSearch, page],
  );
  const pageQuery = useFailuresPageQuery(serverQuery, { enabled: !partyScoped });

  const cut = useMemo((): FailuresPagination & { rows: FailureRecord[] } => {
    if (partyScoped) {
      return failuresLocalWindow(kpiItems, { search: debouncedSearch, page });
    }
    const result = pageQuery.data;
    return {
      rows: result?.items ?? EMPTY,
      ...failuresServerPagination({
        totalCount: result?.totalCount ?? 0,
        page,
        pageSize: result?.pageSize ?? FAILURES_PAGE_SIZE,
        totalPages: result?.totalPages ?? 1,
      }),
    };
  }, [partyScoped, kpiItems, debouncedSearch, page, pageQuery.data]);

  const rows = useMemo(
    () => pinHighlightedFailure(cut.rows, allItems, highlightId),
    [cut.rows, allItems, highlightId],
  );

  const source = partyScoped ? whole : pageQuery;
  // `isFetched` belongs to the new key's query, so it read false while the
  // previous page was still on screen as placeholder — every page or search
  // change blanked the table to skeleton rows despite `keepPreviousData`.
  const ready = source.isFetched || source.isPlaceholderData;

  // The page whose rows are on screen: follows `page` once its own rows land,
  // so the swap fade plays on the new rows, not on the placeholder ones.
  const [rowsPage, setRowsPage] = useState(page);
  if (!source.isPlaceholderData && rowsPage !== page) setRowsPage(page);
  const refetchWhole = whole.refetch;
  const refetchPage = pageQuery.refetch;
  const refetch = useCallback(async () => {
    await Promise.all([refetchWhole(), partyScoped ? null : refetchPage()]);
  }, [partyScoped, refetchPage, refetchWhole]);

  return {
    rows,
    kpiItems,
    search,
    setSearch,
    setPage,
    pager: {
      totalCount: cut.totalCount,
      totalPages: cut.totalPages,
      page: cut.safePage,
      rangeStart: cut.rangeStart,
      rangeEnd: cut.rangeEnd,
    },
    rowsPage,
    isFetched: ready,
    isError: source.isError,
    error: source.error,
    refetch,
  };
}
