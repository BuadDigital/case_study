import { describe, expect, it } from "vitest";
import {
  buildQueueFilterOptions,
  buildQueuePageQuery,
  buildQueueServerQuery,
  queueLayoutSupportsPaging,
  queuePagination,
  queueServerSort,
  queueSortComparator,
  resolveQueueServerAssigneeRole,
  QUEUE_ASSIGNMENT_TYPE_OPTIONS,
  QUEUE_DEFAULT_STATUSES,
  QUEUE_PAGE_SIZE,
  resolveQueueLayoutFlags,
  type ActiveTransactionQueueConfig,
} from "../active-transaction-queue-state";
import type { WorkflowTask } from "../../lib/app-data/tasks-storage";

function config(
  over: Partial<ActiveTransactionQueueConfig> = {},
): ActiveTransactionQueueConfig {
  return {
    pageTitle: "queue",
    emptyLine: "",
    emptyHint: "",
    panelId: "panel",
    getBasePath: () => "/",
    getTaskPath: (id) => `/${id}`,
    filterListed: (mine) => mine,
    ...over,
  };
}

describe("queueServerSort", () => {
  it("maps every queue sort mode onto an endpoint sort key", () => {
    expect(queueServerSort("oldest-first")).toEqual({
      sort: "poReceived",
      dir: "asc",
    });
    expect(queueServerSort("newest-first")).toEqual({
      sort: "poCreated",
      dir: "desc",
    });
    expect(queueServerSort("distributed-newest-first")).toEqual({
      sort: "updated",
      dir: "desc",
    });
    expect(queueServerSort(undefined)).toEqual({ sort: "updated", dir: "desc" });
  });

  it("maps the two new PO-record orders onto `deed` and `city`", () => {
    expect(queueServerSort("deed-first")).toEqual({ sort: "deed", dir: "asc" });
    expect(queueServerSort("city-first")).toEqual({ sort: "city", dir: "asc" });
  });
});

describe("resolveQueueServerAssigneeRole", () => {
  it("does not narrow for a viewer who sees every row of the page", () => {
    expect(
      resolveQueueServerAssigneeRole({
        role: "section-supervisor",
        pageId: "active-primary-data",
      }),
    ).toBeUndefined();
  });

  it("narrows a section supervisor outside the case-study queue pages", () => {
    expect(
      resolveQueueServerAssigneeRole({
        role: "section-supervisor",
        pageId: "property-inspection",
        partyAssignee: true,
        assigneeRole: "field-inspector",
      }),
    ).toBe("section-supervisor");
  });

  it("does not narrow a super admin on a page — they see every row", () => {
    expect(
      resolveQueueServerAssigneeRole({
        role: "cdo",
        pageId: "property-inspection",
        partyAssignee: true,
        assigneeRole: "field-inspector",
      }),
    ).toBeUndefined();
  });

  it("uses the queue's role for a super admin on a party queue with no page id", () => {
    expect(
      resolveQueueServerAssigneeRole({
        role: "cdo",
        partyAssignee: true,
        assigneeRole: "field-inspector",
      }),
    ).toBe("field-inspector");
    expect(
      resolveQueueServerAssigneeRole({ role: "cdo", partyAssignee: true }),
    ).toBeUndefined();
  });

  it("narrows a plain role queue to that role", () => {
    expect(
      resolveQueueServerAssigneeRole({ role: "field-inspector" }),
    ).toBe("field-inspector");
  });
});

describe("buildQueueServerQuery", () => {
  it("sends nothing when the screen still reads sibling rows", () => {
    expect(
      buildQueueServerQuery({
        config: config({ serverQuery: { kind: ["case-study-property"] } }),
        role: "field-inspector",
        showCompleted: false,
        narrow: false,
      }),
    ).toEqual({});
  });

  it("sends the screen's kind/phase plus the default listed statuses", () => {
    expect(
      buildQueueServerQuery({
        config: config({
          pageId: "active-primary-data",
          serverQuery: { kind: ["case-study-property"], phase: ["enfath"] },
        }),
        role: "case-specialist",
        showCompleted: false,
        narrow: true,
      }),
    ).toEqual({
      kind: ["case-study-property"],
      phase: ["enfath"],
      status: QUEUE_DEFAULT_STATUSES,
      assigneeRole: "case-specialist",
      sort: "updated",
      dir: "desc",
    });
  });

  it("omits the status filter when the screen lists every status", () => {
    const query = buildQueueServerQuery({
      config: config({ includeAllStatuses: true }),
      role: "case-specialist",
      showCompleted: false,
      narrow: true,
    });
    expect(query.status).toBeUndefined();
  });

  it("omits the status filter once a toggle queue shows completed rows", () => {
    const base = config({
      tableLayout: "engineering-survey",
      serverQuery: { kind: ["engineering-survey"] },
    });
    expect(
      buildQueueServerQuery({
        config: base,
        role: "engineering-office",
        showCompleted: false,
        narrow: true,
      }).status,
    ).toEqual(QUEUE_DEFAULT_STATUSES);
    expect(
      buildQueueServerQuery({
        config: base,
        role: "engineering-office",
        showCompleted: true,
        narrow: true,
      }).status,
    ).toBeUndefined();
  });

  it("lets the screen pin an explicit status set", () => {
    expect(
      buildQueueServerQuery({
        config: config({
          includeAllStatuses: true,
          serverQuery: { status: ["completed"] },
        }),
        role: "case-specialist",
        showCompleted: false,
        narrow: true,
      }).status,
    ).toEqual(["completed"]);
  });

  it("sends the search term as `q` — the server matches the PO-record columns now", () => {
    const query = buildQueueServerQuery({
      config: config(),
      role: "case-specialist",
      showCompleted: false,
      narrow: true,
      search: "  الرياض  ",
    });
    expect(query.q).toBe("الرياض");
  });

  it("omits `q` for a blank search and when the caller sends none", () => {
    const base = {
      config: config(),
      role: "case-specialist" as const,
      showCompleted: false,
      narrow: true,
    };
    expect(buildQueueServerQuery({ ...base, search: "   " })).not.toHaveProperty(
      "q",
    );
    expect(buildQueueServerQuery(base)).not.toHaveProperty("q");
  });

  it("never sends `q` on a sibling-reading layout — it would drop the children", () => {
    expect(
      buildQueueServerQuery({
        config: config({ tableLayout: "case-study" }),
        role: "case-specialist",
        showCompleted: false,
        narrow: false,
        search: "الرياض",
      }),
    ).toEqual({});
  });
});

describe("queueLayoutSupportsPaging", () => {
  it("pages the layouts whose rows are one per task", () => {
    expect(queueLayoutSupportsPaging(undefined)).toBe(true);
    expect(queueLayoutSupportsPaging("primary-data")).toBe(true);
    expect(queueLayoutSupportsPaging("engineering-survey")).toBe(true);
  });

  it("refuses the layouts that read siblings or collapse rows", () => {
    expect(queueLayoutSupportsPaging("distribution")).toBe(false);
    expect(queueLayoutSupportsPaging("case-study")).toBe(false);
    expect(queueLayoutSupportsPaging("property-appraisal")).toBe(false);
    expect(queueLayoutSupportsPaging("all-transactions")).toBe(false);
  });
});

describe("buildQueuePageQuery", () => {
  it("adds the page window to the filters without touching them", () => {
    const filters = { kind: ["case-study-property"], sort: "updated" } as const;
    expect(buildQueuePageQuery({ filters, page: 3 })).toEqual({
      kind: ["case-study-property"],
      sort: "updated",
      page: 3,
      pageSize: QUEUE_PAGE_SIZE,
    });
  });

  it("clamps a bad page to 1", () => {
    expect(buildQueuePageQuery({ filters: {}, page: 0 }).page).toBe(1);
    expect(buildQueuePageQuery({ filters: {}, page: -4 }).page).toBe(1);
    expect(buildQueuePageQuery({ filters: {}, page: 2.7 }).page).toBe(2);
  });
});

describe("queuePagination", () => {
  it("reports the range from the envelope and the rows that survived", () => {
    expect(
      queuePagination({
        totalCount: 137,
        page: 2,
        pageSize: 25,
        totalPages: 6,
        shownOnPage: 25,
      }),
    ).toEqual({
      totalCount: 137,
      totalPages: 6,
      safePage: 2,
      rangeStart: 26,
      rangeEnd: 50,
      hasPrev: true,
      hasNext: true,
    });
  });

  it("shortens the range when a client-side rule dropped rows from the page", () => {
    const pager = queuePagination({
      totalCount: 137,
      page: 2,
      pageSize: 25,
      totalPages: 6,
      shownOnPage: 4,
    });
    expect(pager.rangeStart).toBe(26);
    expect(pager.rangeEnd).toBe(29);
  });

  it("clamps a page past the end and reports an empty result as 0–0", () => {
    expect(
      queuePagination({
        totalCount: 10,
        page: 99,
        pageSize: 25,
        totalPages: 1,
        shownOnPage: 10,
      }).safePage,
    ).toBe(1);
    const empty = queuePagination({
      totalCount: 0,
      page: 1,
      pageSize: 25,
      totalPages: 1,
      shownOnPage: 0,
    });
    expect([empty.rangeStart, empty.rangeEnd]).toEqual([0, 0]);
    expect(empty.hasNext).toBe(false);
  });
});

describe("queueSortComparator", () => {
  function task(over: Partial<WorkflowTask>): WorkflowTask {
    return {
      id: "t1",
      kind: "case-study-property",
      poNumber: "PO-1",
      propertyOrdinal: 1,
      title: "t",
      phase: "case-study",
      assigneeRole: "case-specialist",
      assigneeName: "n",
      status: "open",
      createdAt: "2026-01-01",
      updatedAt: "2026-01-01",
      ...over,
    } as WorkflowTask;
  }
  const po = new Map();

  it("orders by the deed column the server put on the row, nulls first", () => {
    const compare = queueSortComparator("deed-first");
    const withDeed = task({ id: "a", deedNumber: "310107029844" });
    const without = task({ id: "b" });
    expect(compare(without, withDeed, po)).toBeLessThan(0);
    expect(compare(withDeed, without, po)).toBeGreaterThan(0);
  });

  it("orders by the city column and falls back to PO then slot", () => {
    const compare = queueSortComparator("city-first");
    const a = task({ id: "a", city: "الرياض", propertyOrdinal: 2 });
    const b = task({ id: "b", city: "الرياض", propertyOrdinal: 1 });
    expect(compare(a, b, po)).toBeGreaterThan(0);
  });
});

describe("buildQueueFilterOptions", () => {
  const primaryRowMeta = [
    { assignmentType: "تنفيذ", statusLabel: "متأخرة", city: "الرياض", district: "النرجس" },
  ] as Parameters<typeof buildQueueFilterOptions>[0]["primaryRowMeta"];

  function options(paged: boolean) {
    return buildQueueFilterOptions({
      flags: resolveQueueLayoutFlags(config()),
      allTransactionsRowMeta: [],
      distributionRowMeta: [],
      primaryRowMeta,
      paged,
    });
  }

  it("derives the type dropdown from the rows on an unpaged queue", () => {
    expect(options(false).assignmentTypes).toEqual(["تنفيذ"]);
  });

  it("lists the three known labels once the queue only holds one page", () => {
    expect(options(true).assignmentTypes).toEqual([
      ...QUEUE_ASSIGNMENT_TYPE_OPTIONS,
    ]);
  });

  it("leaves the status dropdown page-derived — its labels have no closed list", () => {
    expect(options(true).statusOptions).toEqual(["متأخرة"]);
  });
});
