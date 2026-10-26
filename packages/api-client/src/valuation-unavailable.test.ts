import { afterEach, describe, expect, it, vi } from "vitest";
import { serverFailure } from "./parse-json";
import { sendValuationResource } from "./valuation-resource";
import { saveValuationComparableMarket } from "./valuation-comparable-selections";

const config = { token: "tok", baseUrl: "http://api" };
const UNVERIFIED = "تعذّر التحقق من المقيّم المُسنَد — أعد المحاولة";

function stubFetch(status: number, body: unknown) {
  vi.stubGlobal(
    "fetch",
    vi.fn(async () => new Response(JSON.stringify(body), { status, headers: { "Content-Type": "application/problem+json" } })),
  );
}

afterEach(() => vi.unstubAllGlobals());

describe("a 503 keeps its reason (round 2 — assigned-appraiser check unreachable)", () => {
  it("serverFailure reads the problem detail of a 503 only", async () => {
    expect(await serverFailure(new Response(JSON.stringify({ detail: UNVERIFIED }), { status: 503 }))).toEqual({
      ok: false,
      kind: "server",
      message: UNVERIFIED,
    });
    expect(await serverFailure(new Response(JSON.stringify({ detail: "x" }), { status: 500 }))).toEqual({
      ok: false,
      kind: "server",
    });
    expect(await serverFailure(new Response("not json", { status: 503 }))).toEqual({ ok: false, kind: "server" });
  });

  it("a valuation save answered 503 says why — not forbidden, not a generic failure", async () => {
    stubFetch(503, { status: 503, detail: UNVERIFIED });
    expect(await sendValuationResource(config, "vr-1", "cost-approach", "x", { lines: [] })).toEqual({
      ok: false,
      kind: "server",
      message: UNVERIFIED,
    });
    stubFetch(503, { status: 503, detail: UNVERIFIED });
    expect(await saveValuationComparableMarket(config, "vr-1", "s-1", {} as never)).toEqual({
      ok: false,
      kind: "server",
      message: UNVERIFIED,
    });
  });
});
