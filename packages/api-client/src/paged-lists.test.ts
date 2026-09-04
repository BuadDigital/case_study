/**
 * Query-string tests for the paged list clients of
 * `docs/architecture/pagination-contract.md` §4–§7. Each asserts the exact URL
 * the fetcher builds, because a renamed or dropped parameter is silently
 * ignored by the endpoint (unknown `sort` falls back, it never 400s).
 */
import { afterEach, describe, expect, it, vi } from "vitest";
import { listComparablePropertiesPage } from "./comparable-properties";
import { listFailuresPage } from "./failures";
import { listNotificationsPage } from "./notifications";
import {
  listDiscountFlagsPage,
  listIncentiveSuspensionsPage,
} from "./financial";

const CONFIG = { baseUrl: "https://api.test", token: "t" };

function stubFetch() {
  const calls: string[] = [];
  vi.stubGlobal("fetch", async (url: string) => {
    calls.push(url);
    return {
      ok: true,
      status: 200,
      json: async () => ({
        items: [],
        totalCount: 0,
        page: 1,
        pageSize: 25,
        totalPages: 1,
      }),
    } as unknown as Response;
  });
  return calls;
}

/** Everything after the `?`, so a test reads as a parameter list. */
function params(url: string): string {
  return url.slice(url.indexOf("?") + 1);
}

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("listComparablePropertiesPage (§4)", () => {
  it("sends the filters, the sort and the page window", async () => {
    const calls = stubFetch();
    await listComparablePropertiesPage(CONFIG, {
      district: "النرجس",
      transactionKind: "sale",
      includeInactive: true,
      forPropertyId: "p-1",
      sort: "pricePerSqm",
      dir: "asc",
      page: 3,
      pageSize: 25,
    });
    expect(calls[0]).toContain("https://api.test/api/comparable-properties?");
    expect(params(calls[0]!)).toBe(
      "page=3&pageSize=25&district=%D8%A7%D9%84%D9%86%D8%B1%D8%AC%D8%B3&transactionKind=sale&includeInactive=true&forPropertyId=p-1&sort=pricePerSqm&dir=asc",
    );
  });

  it("never sends `take` — it only caps the unpaged array", async () => {
    const calls = stubFetch();
    await listComparablePropertiesPage(CONFIG, { take: 200, page: 1 });
    expect(calls[0]).not.toContain("take=");
  });

  it("omits includeInactive when it is off, so the default is not restated", async () => {
    const calls = stubFetch();
    await listComparablePropertiesPage(CONFIG, { includeInactive: false });
    expect(calls[0]).not.toContain("includeInactive");
  });

  it("defaults to page 1 when the caller sends filters only", async () => {
    const calls = stubFetch();
    await listComparablePropertiesPage(CONFIG, { city: "الرياض" });
    expect(calls[0]).toContain("page=1");
  });
});

describe("listFailuresPage (§5)", () => {
  it("joins the status CSV and keeps the rest of the filters", async () => {
    const calls = stubFetch();
    await listFailuresPage(CONFIG, {
      page: 2,
      pageSize: 50,
      sort: "deed",
      dir: "asc",
      q: " 3101 ",
      status: ["review", "approved"],
      poNumber: "PO-1",
      problemTypeId: "pt-9",
    });
    expect(params(calls[0]!)).toBe(
      "page=2&pageSize=50&sort=deed&dir=asc&q=3101&status=review%2Capproved&poNumber=PO-1&problemTypeId=pt-9",
    );
  });

  it("drops a status list that is entirely blank", async () => {
    const calls = stubFetch();
    await listFailuresPage(CONFIG, { status: ["", "  "] });
    expect(calls[0]).not.toContain("status=");
  });
});

describe("listNotificationsPage (§6)", () => {
  it("sends the feed's single sort, the category and the unread flag", async () => {
    const calls = stubFetch();
    await listNotificationsPage(CONFIG, {
      page: 1,
      pageSize: 20,
      sort: "created",
      dir: "desc",
      category: "workflow",
      unread: true,
    });
    expect(params(calls[0]!)).toBe(
      "page=1&pageSize=20&sort=created&dir=desc&category=workflow&unread=true",
    );
  });

  it("sends `unread=false` for read-only, not nothing", async () => {
    const calls = stubFetch();
    await listNotificationsPage(CONFIG, { unread: false });
    expect(calls[0]).toContain("unread=false");
  });
});

describe("financial ledgers (§7)", () => {
  it("pages the incentive-suspension ledger under the v1 alias", async () => {
    const calls = stubFetch();
    await listIncentiveSuspensionsPage(CONFIG, {
      page: 2,
      pageSize: 25,
      sort: "transaction",
      q: "PO-1",
      assigneeId: "a-1",
      activeOnly: false,
    });
    expect(calls[0]).toContain(
      "https://api.test/api/financial/v1/incentive-suspensions?",
    );
    expect(params(calls[0]!)).toBe(
      "page=2&pageSize=25&sort=transaction&q=PO-1&assigneeId=a-1&activeOnly=false",
    );
  });

  it("pages the discount-flag ledger with its exact status filter", async () => {
    const calls = stubFetch();
    await listDiscountFlagsPage(CONFIG, {
      sort: "created",
      dir: "desc",
      transactionKey: "PO-1::p1",
      status: "pending",
    });
    expect(calls[0]).toContain(
      "https://api.test/api/financial/v1/discount-flags?",
    );
    expect(params(calls[0]!)).toBe(
      "page=1&pageSize=500&sort=created&dir=desc&transactionKey=PO-1%3A%3Ap1&status=pending",
    );
  });
});
