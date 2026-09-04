import { afterEach, describe, expect, it, vi } from "vitest";
import {
  getWorkOrderListCounts,
  normalizeWorkOrderListCounts,
} from "./work-orders";

const CONFIG = { baseUrl: "https://api.test", token: "t" };

function stubFetch(body: unknown, status = 200) {
  const calls: string[] = [];
  vi.stubGlobal("fetch", async (url: string) => {
    calls.push(url);
    return {
      ok: status >= 200 && status < 300,
      status,
      json: async () => body,
    } as unknown as Response;
  });
  return calls;
}

const ENVELOPE = {
  total: 137,
  totalUnfiltered: 240,
  active: 88,
  overdue: 12,
  dueSoon: 5,
  doneProperties: 310,
};

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("getWorkOrderListCounts", () => {
  it("sends the three filters and no page window (pagination-contract §1.1)", async () => {
    const calls = stubFetch(ENVELOPE);
    await getWorkOrderListCounts(CONFIG, {
      q: " PO-1 ",
      status: "under_study",
      type: "تنفيذ",
    });
    expect(calls[0]).toBe(
      "https://api.test/api/work-orders/counts?q=PO-1&status=under_study&type=%D8%AA%D9%86%D9%81%D9%8A%D8%B0",
    );
  });

  it("asks for the unfiltered counts when the screen has no filters", async () => {
    const calls = stubFetch(ENVELOPE);
    await getWorkOrderListCounts(CONFIG);
    expect(calls[0]).toBe("https://api.test/api/work-orders/counts");
  });

  it("drops a blank search instead of sending an empty q", async () => {
    const calls = stubFetch(ENVELOPE);
    await getWorkOrderListCounts(CONFIG, { q: "   " });
    expect(calls[0]).toBe("https://api.test/api/work-orders/counts");
  });

  it("returns the counts envelope", async () => {
    stubFetch(ENVELOPE);
    const result = await getWorkOrderListCounts(CONFIG);
    expect(result.ok && result.data).toEqual(ENVELOPE);
  });

  it("maps 401 to an auth failure", async () => {
    stubFetch(null, 401);
    const result = await getWorkOrderListCounts(CONFIG);
    expect(result).toEqual({ ok: false, kind: "auth" });
  });
});

describe("normalizeWorkOrderListCounts", () => {
  it("treats a missing or non-numeric field as 0, never NaN", () => {
    expect(
      normalizeWorkOrderListCounts({ total: 5, active: "x", overdue: null }),
    ).toEqual({
      total: 5,
      totalUnfiltered: 0,
      active: 0,
      overdue: 0,
      dueSoon: 0,
      doneProperties: 0,
    });
  });

  it("returns all zeros for a non-object body", () => {
    expect(normalizeWorkOrderListCounts(null).total).toBe(0);
    expect(normalizeWorkOrderListCounts("nope").doneProperties).toBe(0);
  });
});
