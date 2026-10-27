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
  failuresTabOf,
  failuresTabStatuses,
  pinHighlightedFailure,
  type FailuresPagination,
  type FailuresTab,
} from "../lib/failures-list-page";
import { useFailuresPageQuery, useFailuresQuery } from "../query/failures-queries";

const EMPTY: FailureRecord[] = [];

/**
 * Row source for the failures queue — server-paged per the pagination contract,
 * one tab at a time (`failuresTabStatuses` is the tab's status filter).
 *
 * Two things still need the whole set, so `useFailuresQuery` stays mounted:
 * - the KPI band and the tab counts: there is no `/api/failures/counts`
 *   endpoint, and the set is in cache anyway for the sidebar badge and the
 *   property gates;
 * - party-scoped roles (engineering office, inspector, appraiser, government
 *   reviewer) are narrowed by *raiser label*, which `GET /api/failures` cannot
 *   filter on — their window is cut client-side from the whole set.
 *
 * How it works: the tab picks the statuses, the statuses go into the server query (or the
 * local window), and switching tab restarts at page 1. The tab counts come from the same whole
 * set as the KPI band, so they agree with it. The swap fade is keyed on `tab:page`.
 *
 * Edge cases: a deep link opens on the tab that holds the failure, once — when it first appears
 * in the whole set — and later clicks are left alone. A highlighted failure on no tab (resolved)
 * is still pinned above the page, so a notification link never lands on nothing. The fade key
 * used to be the page alone, so switching tab on page 1 did not animate.
 */
export function useFailuresListPage(role: RoleId, highlightId: string | null) {
  const partyScoped = isPartyScopedFailuresRole(role);
  const [search, setSearch] = useState("");
  const [page, setPage] = useState(1);
  const [tab, setTabState] = useState<FailuresTab>("action");
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

  const setTab = useCallback((next: FailuresTab) => {
    setTabState(next);
    setPage(1);
  }, []);

  const whole = useFailuresQuery();
  const allItems = whole.data ?? EMPTY;
  const kpiItems = useMemo(
    () => failuresForPartyRole(role, allItems) ?? allItems,
    [allItems, role],
  );

  // A deep link (`?highlight=`) to a final failure opens on «التعذّرات» — once, when the
  // record first shows up in the whole set; later tab clicks are the user's.
  const [highlightPlaced, setHighlightPlaced] = useState(false);
  if (!highlightPlaced && highlightId) {
    const target = allItems.find((f) => f.id === highlightId);
    if (target) {
      setHighlightPlaced(true);
      const targetTab = failuresTabOf(target.status, role);
      if (targetTab && targetTab !== tab) setTabState(targetTab);
    }
  }

  const statuses = useMemo(() => failuresTabStatuses(tab, role), [tab, role]);
  const tabCounts = useMemo((): Record<FailuresTab, number> => {
    const action = failuresTabStatuses("action", role);
    const final = failuresTabStatuses("final", role);
    let actionCount = 0;
    let finalCount = 0;
    for (const f of kpiItems) {
      if (action.includes(f.status)) actionCount += 1;
      else if (final.includes(f.status)) finalCount += 1;
    }
    return { action: actionCount, final: finalCount };
  }, [kpiItems, role]);

  const serverQuery = useMemo(
    () => failuresListServerQuery({ search: debouncedSearch, page, statuses }),
    [debouncedSearch, page, statuses],
  );
  const pageQuery = useFailuresPageQuery(serverQuery, { enabled: !partyScoped });

  const cut = useMemo((): FailuresPagination & { rows: FailureRecord[] } => {
    if (partyScoped) {
      return failuresLocalWindow(kpiItems, { search: debouncedSearch, page, statuses });
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
  }, [partyScoped, kpiItems, debouncedSearch, page, statuses, pageQuery.data]);

  const rows = useMemo(
    () => pinHighlightedFailure(cut.rows, allItems, highlightId),
    [cut.rows, allItems, highlightId],
  );

  const source = partyScoped ? whole : pageQuery;
  // `isFetched` belongs to the new key's query, so it read false while the
  // previous page was still on screen as placeholder — every page or search
  // change blanked the table to skeleton rows despite `keepPreviousData`.
  const ready = source.isFetched || source.isPlaceholderData;

  // The page whose rows are on screen: follows `page` (and the tab) once its own rows
  // land, so the swap fade plays on the new rows, not on the placeholder ones.
  const rowsKey = `${tab}:${page}`;
  const [rowsPage, setRowsPage] = useState(rowsKey);
  if (!source.isPlaceholderData && rowsPage !== rowsKey) setRowsPage(rowsKey);
  const refetchWhole = whole.refetch;
  const refetchPage = pageQuery.refetch;
  const refetch = useCallback(async () => {
    await Promise.all([refetchWhole(), partyScoped ? null : refetchPage()]);
  }, [partyScoped, refetchPage, refetchWhole]);

  return {
    rows,
    kpiItems,
    tab,
    setTab,
    tabCounts,
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
