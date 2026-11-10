import { afterEach, describe, expect, it, vi } from "vitest";
import { saveValuationCostApproach } from "./valuation-comparable-selections";

const config = { token: "tok", baseUrl: "http://api" };
const STALE = "حفظ مستخدم آخر تعديلات أحدث — أعد تحميل الصفحة";

function stubFetch(status: number, body: unknown) {
  const fetchMock = vi.fn(
    async (_input: RequestInfo | URL, _init?: RequestInit) =>
      new Response(JSON.stringify(body), {
        status,
        headers: { "Content-Type": "application/problem+json" },
      }),
  );
  vi.stubGlobal("fetch", fetchMock);
  return fetchMock;
}

afterEach(() => vi.unstubAllGlobals());

describe("cost save — two tabs (2026-11-10)", () => {
  it("a 409 is a conflict failure carrying the server's Arabic reason", async () => {
    stubFetch(409, { status: 409, detail: STALE, errors: { _: STALE } });
    expect(await saveValuationCostApproach(config, "vr-1", { lines: [] })).toEqual({
      ok: false,
      kind: "conflict",
      message: STALE,
    });
  });

  it("a 409 without a body still says to reload", async () => {
    stubFetch(409, null);
    const res = await saveValuationCostApproach(config, "vr-1", { lines: [] });
    expect(res).toEqual({ ok: false, kind: "conflict", message: STALE });
  });

  it("sends the stamp it was given", async () => {
    const fetchMock = stubFetch(200, { lines: [], updatedAtUtc: "2026-11-10T08:00:01.0000000Z" });
    const res = await saveValuationCostApproach(config, "vr-1", {
      lines: [],
      expectedUpdatedAtUtc: "2026-11-10T08:00:00.0000000Z",
    });
    expect(res.ok && res.data.updatedAtUtc).toBe("2026-11-10T08:00:01.0000000Z");
    const init = fetchMock.mock.calls[0]![1] as RequestInit;
    expect(JSON.parse(String(init.body)).expectedUpdatedAtUtc).toBe("2026-11-10T08:00:00.0000000Z");
  });
});
