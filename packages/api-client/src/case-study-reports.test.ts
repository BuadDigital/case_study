import { afterEach, describe, expect, it, vi } from "vitest";
import { issueCaseStudyReport, reopenCaseStudyReport } from "./case-study-reports";

const config = { token: "tok", baseUrl: "http://api" };

function stubFetch(status: number, body: unknown) {
  const fetchMock = vi.fn(
    async () =>
      new Response(JSON.stringify(body), {
        status,
        headers: { "Content-Type": "application/json" },
      }),
  );
  vi.stubGlobal("fetch", fetchMock);
  return fetchMock;
}

describe("case study report issue / reopen", () => {
  afterEach(() => vi.unstubAllGlobals());

  it("posts the report to /issue", async () => {
    const fetchMock = stubFetch(200, { taskId: "t1", status: "issued" });
    const result = await issueCaseStudyReport(config, "t1", { taskId: "t1" } as never);
    expect(result).toMatchObject({ ok: true, data: { status: "issued" } });
    const [url, init] = fetchMock.mock.calls[0] as unknown as [string, RequestInit];
    expect(url).toBe("http://api/api/case-study-reports/t1/issue");
    expect(init.method).toBe("POST");
    expect(JSON.parse(String(init.body))).toEqual({ report: { taskId: "t1" } });
  });

  it("keeps the field errors of a 400 on issue", async () => {
    stubFetch(400, { errors: { answers: "x", missingQuestionKeys: "deed_1" } });
    const result = await issueCaseStudyReport(config, "t1", { taskId: "t1" } as never);
    expect(result).toMatchObject({
      ok: false,
      kind: "validation",
      errors: { answers: "x", missingQuestionKeys: "deed_1" },
    });
  });

  it("keeps enfazHandover on a 409 of reopen and sends the confirmation flag", async () => {
    const fetchMock = stubFetch(409, { errors: { enfazHandover: "h" } });
    const result = await reopenCaseStudyReport(config, "t1", {
      reason: "reason long enough",
      clearEnfazHandover: false,
    });
    expect(result).toMatchObject({ ok: false, errors: { enfazHandover: "h" } });
    const [url, init] = fetchMock.mock.calls[0] as unknown as [string, RequestInit];
    expect(url).toBe("http://api/api/case-study-reports/t1/reopen");
    expect(JSON.parse(String(init.body))).toEqual({
      reason: "reason long enough",
      clearEnfazHandover: false,
    });
  });

  it("returns the reopen result", async () => {
    stubFetch(200, {
      report: { taskId: "t1", status: "draft" },
      appraiserSubmitted: true,
      enfazHandoverCleared: false,
    });
    const result = await reopenCaseStudyReport(config, "t1", {
      reason: "reason long enough",
      clearEnfazHandover: true,
    });
    expect(result).toMatchObject({ ok: true, data: { appraiserSubmitted: true } });
  });

  it("maps 403 to forbidden", async () => {
    stubFetch(403, {});
    const result = await reopenCaseStudyReport(config, "t1", {
      reason: "reason long enough",
      clearEnfazHandover: false,
    });
    expect(result).toMatchObject({ ok: false, kind: "forbidden" });
  });
});
