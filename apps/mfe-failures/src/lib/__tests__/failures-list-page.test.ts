import { describe, expect, it } from "vitest";
import type { FailureRecord } from "@platform/app-shared/failures/failures-types";
import {
  FAILURES_PAGE_SIZE,
  failuresListServerQuery,
  failuresLocalWindow,
  failuresServerPagination,
  failuresTabOf,
  failuresTabStatuses,
  pinHighlightedFailure,
} from "../failures-list-page";
import { failureListStatusLabel } from "../failures-labels";

function failure(
  id: string,
  overrides: Partial<FailureRecord> = {},
): FailureRecord {
  return {
    id,
    poNumber: "PO-1",
    propertyId: `prop-${id}`,
    deedNumber: `D-${id}`,
    title: `تعذر ${id}`,
    problemTypeId: "access-denied",
    severity: "internal",
    raisedByRole: "case-specialist",
    internalNote: "",
    finalNote: "",
    resolutionReason: "",
    continueInstructions: "",
    status: "review",
    specialist: "osama",
    createdAt: `2026-09-01T00:00:${id.padStart(2, "0")}.000Z`,
    updatedAt: "2026-09-02T00:00:00.000Z",
    ...overrides,
  } as FailureRecord;
}

describe("failuresTabStatuses", () => {
  it("lists the open work on «تحتاج إجراء» and the approved failure on «التعذّرات»", () => {
    expect(failuresTabStatuses("action", "case-specialist")).toEqual([
      "internal",
      "returned",
      "review",
    ]);
    expect(failuresTabStatuses("final", "case-specialist")).toEqual(["approved"]);
    expect(failuresTabStatuses("final", "section-supervisor")).toEqual(["approved"]);
  });

  it("gives the section supervisor only what the specialist escalated", () => {
    expect(failuresTabStatuses("action", "section-supervisor")).toEqual(["review"]);
    expect(failuresTabStatuses("action", "cdo")).toContain("internal");
  });

  it("puts a resolved or suspended failure on no tab", () => {
    expect(failuresTabOf("approved", "case-specialist")).toBe("final");
    expect(failuresTabOf("returned", "case-specialist")).toBe("action");
    expect(failuresTabOf("internal", "section-supervisor")).toBeNull();
    expect(failuresTabOf("resolved", "case-specialist")).toBeNull();
    expect(failuresTabOf("suspended", "case-specialist")).toBeNull();
  });
});

describe("failureListStatusLabel", () => {
  it("folds the severity into the stage", () => {
    expect(failureListStatusLabel("internal", "suspected")).toBe("احتمال تعذّر");
    expect(failureListStatusLabel("internal", "internal")).toBe("تعذّر داخلي");
    expect(failureListStatusLabel("returned", "internal")).toBe("مُعاد");
    expect(failureListStatusLabel("review", "internal")).toBe("قيد المراجعة");
    expect(failureListStatusLabel("approved", "internal")).toBe("تعذّر نهائي");
    expect(failureListStatusLabel("suspended", "internal")).toBe("معلّق");
  });
});

describe("failuresListServerQuery", () => {
  it("asks for a 10-row page of the tab's statuses, newest raised first", () => {
    expect(
      failuresListServerQuery({ search: "", page: 2, statuses: ["approved"] }),
    ).toEqual({
      page: 2,
      pageSize: FAILURES_PAGE_SIZE,
      sort: "created",
      dir: "desc",
      status: ["approved"],
    });
    expect(FAILURES_PAGE_SIZE).toBe(10);
  });

  it("sends a trimmed `q` and clamps the page to 1", () => {
    const query = failuresListServerQuery({ search: "  صك 12 ", page: 0, statuses: ["review"] });
    expect(query.q).toBe("صك 12");
    expect(query.page).toBe(1);
  });
});

describe("failuresServerPagination", () => {
  it("derives the range label from the envelope", () => {
    expect(
      failuresServerPagination({ totalCount: 23, page: 3, pageSize: 10, totalPages: 3 }),
    ).toEqual({ totalCount: 23, totalPages: 3, safePage: 3, rangeStart: 21, rangeEnd: 23 });
  });

  it("clamps an out-of-range page and shows 0–0 for an empty list", () => {
    expect(
      failuresServerPagination({ totalCount: 23, page: 9, pageSize: 10, totalPages: 3 }),
    ).toMatchObject({ safePage: 3, rangeStart: 21, rangeEnd: 23 });
    expect(
      failuresServerPagination({ totalCount: 0, page: 1, pageSize: 10, totalPages: 0 }),
    ).toEqual({ totalCount: 0, totalPages: 1, safePage: 1, rangeStart: 0, rangeEnd: 0 });
  });
});

describe("failuresLocalWindow", () => {
  const items = [
    ...Array.from({ length: 12 }, (_, i) => failure(String(i + 1))),
    failure("99", { status: "suspended" }),
  ];

  const statuses = ["review"] as const;

  it("keeps only the tab's statuses, orders by createdAt desc, and cuts 10 per page", () => {
    const first = failuresLocalWindow(items, { search: "", page: 1, statuses });
    expect(first.totalCount).toBe(12);
    expect(first.totalPages).toBe(2);
    expect(first.rows.map((f) => f.id)).toEqual([
      "12", "11", "10", "9", "8", "7", "6", "5", "4", "3",
    ]);
    expect(first).toMatchObject({ safePage: 1, rangeStart: 1, rangeEnd: 10 });

    const second = failuresLocalWindow(items, { search: "", page: 2, statuses });
    expect(second.rows.map((f) => f.id)).toEqual(["2", "1"]);
    expect(second).toMatchObject({ rangeStart: 11, rangeEnd: 12 });
  });

  it("applies the local search before cutting the window", () => {
    const hit = failuresLocalWindow(items, { search: "D-7", page: 1, statuses });
    expect(hit.rows.map((f) => f.id)).toEqual(["7"]);
    expect(hit.totalCount).toBe(1);
  });

  it("shows nothing of another tab's statuses", () => {
    const final = failuresLocalWindow(items, { search: "", page: 1, statuses: ["approved"] });
    expect(final.totalCount).toBe(0);
  });
});

describe("pinHighlightedFailure", () => {
  const page = [failure("1"), failure("2")];
  const all = [...page, failure("3")];

  it("leaves the page alone when the highlighted row is on it or unknown", () => {
    expect(pinHighlightedFailure(page, all, null)).toBe(page);
    expect(pinHighlightedFailure(page, all, "2")).toBe(page);
    expect(pinHighlightedFailure(page, all, "missing")).toBe(page);
  });

  it("pins a highlighted row from the whole set above the page", () => {
    expect(pinHighlightedFailure(page, all, "3").map((f) => f.id)).toEqual([
      "3", "1", "2",
    ]);
  });
});
