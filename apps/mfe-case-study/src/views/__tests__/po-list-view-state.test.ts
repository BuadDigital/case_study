import { describe, expect, it } from "vitest";
import type { PoRow } from "@platform/app-shared/app-data/constants";
import {
  buildPoListPageRows,
  INITIAL_PO_LIST_QUERY,
  isPoListBillingBucket,
  poListBillingWindow,
  poListEmptyMessage,
  poListKpiFromCounts,
  poListQueryReducer,
  poListServerPagination,
  PO_LIST_BILLING_PAGE_SIZE,
  PO_LIST_EMPTY_NO_MATCH,
  PO_LIST_EMPTY_NO_ROWS,
  PO_LIST_PAGE_SIZE,
  toWorkOrderListCountsQuery,
  toWorkOrderListQuery,
  type PoListQueryState,
} from "../po-list-view-state";

function poRow(id: string, over: Partial<PoRow> = {}): PoRow {
  return {
    id,
    type: "تنفيذ",
    count: 2,
    registered: 2,
    done: 0,
    status: "under_study",
    date: "2026-01-01",
    dueDate: "2026-02-01",
    specialist: "سالم",
    team: [],
    ...over,
  } as PoRow;
}

describe("poListQueryReducer", () => {
  it("clamps the page to 1 and keeps identity when unchanged", () => {
    const state = { ...INITIAL_PO_LIST_QUERY, page: 3 };
    expect(poListQueryReducer(state, { type: "page", page: 0 }).page).toBe(1);
    expect(poListQueryReducer(state, { type: "page", page: -5 }).page).toBe(1);
    expect(poListQueryReducer(state, { type: "page", page: 3 })).toBe(state);
  });

  it("resets to page 1 when the search changes", () => {
    const state = { ...INITIAL_PO_LIST_QUERY, page: 4 };
    const next = poListQueryReducer(state, { type: "search", value: "12" });
    expect(next).toMatchObject({ page: 1, search: "12" });
  });

  it("resets to page 1 when a filter changes, and no-ops when it does not", () => {
    const state: PoListQueryState = {
      ...INITIAL_PO_LIST_QUERY,
      page: 4,
      statusFilter: "new",
      typeFilter: "تنفيذ",
    };
    expect(
      poListQueryReducer(state, { type: "status", value: "completed" }),
    ).toMatchObject({ page: 1, statusFilter: "completed" });
    expect(
      poListQueryReducer(state, { type: "assignmentType", value: "تركات" }),
    ).toMatchObject({ page: 1, typeFilter: "تركات" });
    expect(poListQueryReducer(state, { type: "status", value: "new" })).toBe(
      state,
    );
    expect(
      poListQueryReducer(state, { type: "assignmentType", value: "تنفيذ" }),
    ).toBe(state);
  });

  it("flips the direction when the same sort key is clicked again", () => {
    const state = { ...INITIAL_PO_LIST_QUERY, page: 5 };
    const flipped = poListQueryReducer(state, { type: "sort", key: "created" });
    expect(flipped).toMatchObject({
      sortKey: "created",
      sortDir: "asc",
      page: 1,
    });
    expect(
      poListQueryReducer(flipped, { type: "sort", key: "created" }).sortDir,
    ).toBe("desc");
  });

  it("uses the column's default direction on a new sort key", () => {
    const state = INITIAL_PO_LIST_QUERY;
    expect(
      poListQueryReducer(state, { type: "sort", key: "due" }),
    ).toMatchObject({ sortKey: "due", sortDir: "asc" });
    expect(
      poListQueryReducer(state, { type: "sort", key: "received" }).sortDir,
    ).toBe("asc");
    expect(poListQueryReducer(state, { type: "sort", key: "po" }).sortDir).toBe(
      "desc",
    );
  });
});

describe("toWorkOrderListQuery", () => {
  it("sends the page window, sort and nothing blank", () => {
    expect(toWorkOrderListQuery(INITIAL_PO_LIST_QUERY)).toEqual({
      page: 1,
      pageSize: PO_LIST_PAGE_SIZE,
      sort: "created",
      dir: "desc",
    });
  });

  it("sends status, type and the search term", () => {
    expect(
      toWorkOrderListQuery({
        ...INITIAL_PO_LIST_QUERY,
        page: 3,
        statusFilter: "new",
        typeFilter: "تركات",
        search: "سالم",
      }),
    ).toEqual({
      page: 3,
      pageSize: PO_LIST_PAGE_SIZE,
      sort: "created",
      dir: "desc",
      q: "سالم",
      status: "new",
      type: "تركات",
    });
  });

  it("folds a deed query before sending it — the server `q` is a plain substring", () => {
    expect(
      toWorkOrderListQuery({ ...INITIAL_PO_LIST_QUERY, search: "صك 006" }).q,
    ).toBe("006");
  });

  it("asks for one generous page for the billing buckets the server can only widen", () => {
    for (const status of ["partially_billed", "fully_billed"] as const) {
      expect(isPoListBillingBucket(status)).toBe(true);
      expect(
        toWorkOrderListQuery({
          ...INITIAL_PO_LIST_QUERY,
          page: 4,
          statusFilter: status,
        }),
      ).toMatchObject({ page: 1, pageSize: PO_LIST_BILLING_PAGE_SIZE, status });
    }
  });

  it("uses the debounced search override when given", () => {
    expect(
      toWorkOrderListQuery(
        { ...INITIAL_PO_LIST_QUERY, search: "typing" },
        { search: "settled" },
      ).q,
    ).toBe("settled");
  });
});

describe("poListServerPagination", () => {
  it("reports the server totals, not the loaded rows", () => {
    expect(
      poListServerPagination({
        totalCount: 137,
        page: 2,
        pageSize: 10,
        totalPages: 14,
      }),
    ).toEqual({ totalPages: 14, safePage: 2, rangeStart: 11, rangeEnd: 20 });
  });

  it("clamps a page past the end and reports an empty range at zero rows", () => {
    expect(
      poListServerPagination({
        totalCount: 0,
        page: 9,
        pageSize: 10,
        totalPages: 1,
      }),
    ).toEqual({ totalPages: 1, safePage: 1, rangeStart: 0, rangeEnd: 0 });
  });

  it("caps the last page's range at the total", () => {
    expect(
      poListServerPagination({
        totalCount: 23,
        page: 3,
        pageSize: 10,
        totalPages: 3,
      }),
    ).toMatchObject({ rangeStart: 21, rangeEnd: 23 });
  });
});

describe("billing bucket refinement", () => {
  it("narrows the widened bucket to the rows carrying the billing label", () => {
    const rows = [
      poRow("PO-1", { status: "partially_billed" }),
      poRow("PO-2", { status: "under_study" }),
      poRow("PO-3", { status: "partially_billed" }),
    ];
    const display = buildPoListPageRows({
      rows,
      search: "",
      deedIndex: [],
      statusFilter: "partially_billed",
    });
    expect(display.map((d) => d.item.row.id)).toEqual(["PO-1", "PO-3"]);
  });

  it("leaves a server-answered bucket alone", () => {
    const rows = [poRow("PO-1"), poRow("PO-2")];
    const display = buildPoListPageRows({
      rows,
      search: "",
      deedIndex: [],
      statusFilter: "under_study",
    });
    expect(display).toHaveLength(2);
  });

  it("windows the refined rows client-side", () => {
    const rows = Array.from({ length: 23 }, (_, i) => i);
    const window = poListBillingWindow(rows, 3);
    expect(window).toMatchObject({
      totalCount: 23,
      totalPages: 3,
      safePage: 3,
      rangeStart: 21,
      rangeEnd: 23,
    });
    expect(window.rows).toEqual([20, 21, 22]);
  });
});

describe("poListKpiFromCounts", () => {
  const counts = {
    total: 137,
    totalUnfiltered: 240,
    active: 88,
    overdue: 12,
    dueSoon: 5,
    doneProperties: 310,
  };

  it("maps the counts envelope onto the four KPI tiles", () => {
    expect(poListKpiFromCounts(counts)).toEqual({
      active: 88,
      overdue: 12,
      dueSoon: 5,
      doneProps: 310,
    });
  });

  it("stays undefined while the counts are loading, so the band shows «—»", () => {
    expect(poListKpiFromCounts(undefined)).toBeUndefined();
  });

  it("keeps zeros as zeros rather than falling back to «—»", () => {
    expect(
      poListKpiFromCounts({
        total: 0,
        totalUnfiltered: 0,
        active: 0,
        overdue: 0,
        dueSoon: 0,
        doneProperties: 0,
      }),
    ).toEqual({ active: 0, overdue: 0, dueSoon: 0, doneProps: 0 });
  });
});

describe("poListEmptyMessage", () => {
  it("says «no work orders» only when the actor has none at all", () => {
    expect(
      poListEmptyMessage({
        total: 0,
        totalUnfiltered: 0,
        active: 0,
        overdue: 0,
        dueSoon: 0,
        doneProperties: 0,
      }),
    ).toBe(PO_LIST_EMPTY_NO_ROWS);
  });

  it("says «no matches» when filters emptied a non-empty list", () => {
    expect(
      poListEmptyMessage({
        total: 0,
        totalUnfiltered: 240,
        active: 0,
        overdue: 0,
        dueSoon: 0,
        doneProperties: 0,
      }),
    ).toBe(PO_LIST_EMPTY_NO_MATCH);
  });

  it("assumes filters while the counts are still loading", () => {
    expect(poListEmptyMessage(undefined)).toBe(PO_LIST_EMPTY_NO_MATCH);
  });
});

describe("toWorkOrderListCountsQuery", () => {
  it("sends the list filters and never the page window or the sort", () => {
    const state: PoListQueryState = {
      ...INITIAL_PO_LIST_QUERY,
      page: 4,
      statusFilter: "under_study",
      typeFilter: "تنفيذ",
      sortKey: "due",
      sortDir: "asc",
      search: "PO-1",
    };
    expect(toWorkOrderListCountsQuery(state)).toEqual({
      q: "PO-1",
      status: "under_study",
      type: "تنفيذ",
    });
  });

  it("omits blank filters so the key stays stable across keystrokes", () => {
    expect(
      toWorkOrderListCountsQuery(INITIAL_PO_LIST_QUERY, { search: "   " }),
    ).toEqual({});
  });

  it("uses the debounced search the caller passes, not the live box", () => {
    const state = { ...INITIAL_PO_LIST_QUERY, search: "PO-99" };
    expect(toWorkOrderListCountsQuery(state, { search: "PO-1" })).toEqual({
      q: "PO-1",
    });
  });
});
