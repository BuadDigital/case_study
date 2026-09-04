import { afterEach, describe, expect, it, vi } from "vitest";
import { buildListQueryString, fetchListPage } from "./pagination";

describe("buildListQueryString", () => {
  it("returns an empty string when nothing survives", () => {
    expect(buildListQueryString()).toBe("");
    expect(buildListQueryString({})).toBe("");
    expect(
      buildListQueryString({ q: "   ", status: undefined, kind: null }),
    ).toBe("");
  });

  it("keeps the page window and the sort keys", () => {
    expect(
      buildListQueryString({ page: 2, pageSize: 25, sort: "due", dir: "asc" }),
    ).toBe("?page=2&pageSize=25&sort=due&dir=asc");
  });

  it("keeps page 1 and page size 0 (0 is a value, not a blank)", () => {
    expect(buildListQueryString({ page: 1, pageSize: 0 })).toBe(
      "?page=1&pageSize=0",
    );
  });

  it("drops non-finite numbers", () => {
    expect(buildListQueryString({ page: Number.NaN, pageSize: 10 })).toBe(
      "?pageSize=10",
    );
  });

  it("joins array filters as CSV and drops blank tokens", () => {
    expect(
      buildListQueryString({
        kind: ["case-study-property", " field-inspection ", ""],
        status: ["open", "blocked"],
      }),
    ).toBe(
      "?kind=case-study-property%2Cfield-inspection&status=open%2Cblocked",
    );
  });

  it("drops an array filter that is entirely blank", () => {
    expect(buildListQueryString({ kind: ["", "  "], page: 1 })).toBe("?page=1");
  });

  it("serialises booleans as true/false, including false", () => {
    expect(
      buildListQueryString({ activeOnly: true, excludeFailurePaused: false }),
    ).toBe("?activeOnly=true&excludeFailurePaused=false");
  });

  it("trims free text and form-encodes it (spaces as +)", () => {
    expect(buildListQueryString({ q: "  صك 12  " })).toBe(
      "?q=%D8%B5%D9%83+12",
    );
  });

  it("preserves the caller's key order so query keys stay stable", () => {
    expect(buildListQueryString({ status: "new", page: 3, q: "po" })).toBe(
      "?status=new&page=3&q=po",
    );
  });
});

describe("fetchListPage", () => {
  const envelope = {
    items: [{ id: "a" }],
    totalCount: 137,
    page: 2,
    pageSize: 25,
    totalPages: 6,
  };

  function stubFetch(body: unknown) {
    const calls: string[] = [];
    vi.stubGlobal("fetch", async (url: string) => {
      calls.push(url);
      return {
        ok: true,
        status: 200,
        json: async () => body,
      } as unknown as Response;
    });
    return calls;
  }

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("defaults to page 1 when the typed query omits the page window", async () => {
    const calls = stubFetch(envelope);
    const result = await fetchListPage(
      { baseUrl: "https://api.test", token: "t" },
      "/api/work-orders",
      { page: undefined, pageSize: undefined, status: "new" },
    );
    expect(calls[0]).toBe(
      "https://api.test/api/work-orders?page=1&pageSize=500&status=new",
    );
    expect(result.ok && result.data.totalCount).toBe(137);
  });

  it("keeps the caller's page window", async () => {
    const calls = stubFetch(envelope);
    await fetchListPage(
      { baseUrl: "https://api.test", token: "t" },
      "/api/work-orders",
      { page: 2, pageSize: 25, sort: "due", dir: "asc" },
    );
    expect(calls[0]).toBe(
      "https://api.test/api/work-orders?page=2&pageSize=25&sort=due&dir=asc",
    );
  });

  it("wraps a plain array body in the envelope", async () => {
    stubFetch([{ id: "a" }, { id: "b" }]);
    const result = await fetchListPage(
      { baseUrl: "https://api.test", token: "t" },
      "/api/work-orders",
    );
    expect(result.ok && result.data).toMatchObject({
      totalCount: 2,
      page: 1,
      totalPages: 1,
    });
  });
});
