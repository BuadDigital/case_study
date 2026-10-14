import { afterEach, describe, expect, it, vi } from "vitest";
import { liftSurveyFreeze } from "./failures";
import { decideEvaluatorRecallApi } from "./prototype-modules";
import { getReturnImpact, returnInspectionPackage } from "./party-task-submissions";
import { patchWorkflowTask } from "./workflow-tasks";
import { recordEnfazHandover, returnFromEnfaz } from "./work-orders";

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

function lastCall(fetchMock: ReturnType<typeof stubFetch>) {
  return fetchMock.mock.calls[0] as unknown as [string, RequestInit];
}

afterEach(() => vi.unstubAllGlobals());

describe("return inspection with affected parties", () => {
  it("reads the impact of the chosen sections", async () => {
    const fetchMock = stubFetch(200, {
      sections: [{ key: "area", labelAr: "المساحات" }],
      parties: [
        {
          taskId: "a1",
          kind: "property-appraisal",
          assigneeName: "مقيّم",
          packageStatus: "submitted",
          suggested: true,
          suggestedBecause: ["المساحات تؤثر على التقييم"],
          willBe: "reopen",
        },
      ],
      studyReportIssued: true,
      valuationClosed: false,
    });
    const result = await getReturnImpact(config, "i1", ["area", "components"]);
    const [url] = lastCall(fetchMock);
    expect(url).toBe(
      "http://api/api/party-task-submissions/i1/return-impact?sections=area%2Ccomponents",
    );
    expect(result).toMatchObject({
      ok: true,
      data: {
        studyReportIssued: true,
        parties: [{ taskId: "a1", suggested: true, willBe: "reopen" }],
      },
    });
  });

  it("posts the return with the idempotency key and maps the per-party outcomes", async () => {
    const fetchMock = stubFetch(200, {
      inspection: { taskId: "i1", kind: "field-inspection", status: "reopened", payload: {} },
      parties: [{ taskId: "a1", kind: "property-appraisal", outcome: "skipped_deposited" }],
      studyReport: { issued: true, reopened: false },
    });
    const result = await returnInspectionPackage(
      config,
      "i1",
      {
        returnNote: "صحّح",
        sections: ["area"],
        affectedTaskIds: ["a1"],
        studyReport: "keep",
      },
      "key-1",
    );
    const [url, init] = lastCall(fetchMock);
    expect(url).toBe("http://api/api/party-task-submissions/i1/return-inspection");
    expect(init.method).toBe("POST");
    expect(new Headers(init.headers).get("Idempotency-Key")).toBe("key-1");
    expect(JSON.parse(String(init.body))).toMatchObject({ studyReport: "keep", affectedTaskIds: ["a1"] });
    expect(result).toMatchObject({
      ok: true,
      data: {
        inspection: { status: "reopened" },
        parties: [{ outcome: "skipped_deposited" }],
        studyReport: { issued: true, reopened: false },
      },
    });
  });

  it("keeps the field errors of a refused return", async () => {
    stubFetch(400, { errors: { studyReport: "اختر إبقاء التقرير الصادر أو إعادة فتحه" } });
    const result = await returnInspectionPackage(config, "i1", {
      returnNote: "x",
      sections: [],
      affectedTaskIds: [],
      studyReport: null,
    });
    expect(result).toMatchObject({
      ok: false,
      kind: "validation",
      errors: { studyReport: "اختر إبقاء التقرير الصادر أو إعادة فتحه" },
    });
  });
});

describe("recall decision", () => {
  it("is one PATCH to /decide", async () => {
    const fetchMock = stubFetch(200, { taskId: "t1", status: "rejected" });
    const result = await decideEvaluatorRecallApi(config, "t1", "reject", " لا داعي ");
    const [url, init] = lastCall(fetchMock);
    expect(url).toBe("http://api/api/evaluator-recalls/t1/decide");
    expect(init.method).toBe("PATCH");
    expect(JSON.parse(String(init.body))).toEqual({ decision: "reject", note: "لا داعي" });
    expect(result).toMatchObject({ ok: true, data: { status: "rejected" } });
  });

  it("carries the server's refusal text after a deposit", async () => {
    stubFetch(409, { errors: { _: "أودع المقيّم تقريره" } });
    const result = await decideEvaluatorRecallApi(config, "t1", "approve");
    expect(result).toMatchObject({
      ok: false,
      kind: "validation",
      message: "أودع المقيّم تقريره",
    });
  });

  it("maps 403 to forbidden", async () => {
    stubFetch(403, {});
    expect(await decideEvaluatorRecallApi(config, "t1", "approve")).toMatchObject({
      ok: false,
      kind: "forbidden",
    });
  });
});

describe("Enfaz handover", () => {
  it("fills the 2C transaction-state fields an older server lacks", async () => {
    stubFetch(200, { workOrderId: "w", propertyId: "p", stages: [] });
    const result = await recordEnfazHandover(config, "w", "p");
    expect(result).toMatchObject({
      ok: true,
      data: { studyReportIssued: false, enfazBlockReasonsAr: [], enfazReturnNoticesAr: [] },
    });
  });

  it("surfaces the specific refusal of a blocked handover", async () => {
    stubFetch(400, { errors: { _: "تقرير دراسة الحالة لم يُصدر بعد" } });
    expect(await recordEnfazHandover(config, "w", "p")).toEqual({
      ok: false,
      kind: "server",
      message: "تقرير دراسة الحالة لم يُصدر بعد",
    });
  });

  it("reports a 403 as forbidden", async () => {
    stubFetch(403, { errors: { _: "للأخصائي وحده" } });
    expect(await recordEnfazHandover(config, "w", "p")).toMatchObject({
      ok: false,
      kind: "forbidden",
      message: "للأخصائي وحده",
    });
  });

  it("returns from Enfaz with the reason and both reopen flags", async () => {
    const fetchMock = stubFetch(200, {
      workOrderId: "w",
      propertyId: "p",
      stages: [],
      enfazBlockReasonsAr: ["x"],
      enfazReturnNoticesAr: ["أُعيد فتح تقرير الدراسة"],
    });
    const result = await returnFromEnfaz(config, "w", "p", {
      reason: "ملاحظة من إنفاذ",
      reopenStudy: true,
      reopenValuation: false,
    });
    const [url, init] = lastCall(fetchMock);
    expect(url).toBe("http://api/api/work-orders/w/properties/p/transaction-state/enfaz-return");
    expect(init.method).toBe("POST");
    expect(JSON.parse(String(init.body))).toEqual({
      reason: "ملاحظة من إنفاذ",
      reopenStudy: true,
      reopenValuation: false,
    });
    expect(result).toMatchObject({
      ok: true,
      data: { enfazReturnNoticesAr: ["أُعيد فتح تقرير الدراسة"] },
    });
  });
});

describe("survey freeze lift", () => {
  it("posts the lift and answers how many were lifted", async () => {
    const fetchMock = stubFetch(200, { lifted: 2 });
    const result = await liftSurveyFreeze(config, {
      poNumber: "PO-1",
      propertyId: "p1",
      reason: "عاد المالك للتعاون",
    });
    const [url, init] = lastCall(fetchMock);
    expect(url).toBe("http://api/api/failures/by-property/lift-survey-freeze");
    expect(JSON.parse(String(init.body))).toEqual({
      poNumber: "PO-1",
      propertyId: "p1",
      reason: "عاد المالك للتعاون",
    });
    expect(result).toEqual({ ok: true, data: { lifted: 2 } });
  });

  it("carries the refusal text", async () => {
    stubFetch(403, { errors: { _: "للأخصائي وحده" } });
    expect(
      await liftSurveyFreeze(config, { poNumber: "PO-1", propertyId: "p1", reason: "x" }),
    ).toMatchObject({ ok: false, kind: "forbidden", message: "للأخصائي وحده" });
  });
});

describe("generic workflow-task PATCH refusal", () => {
  it("keeps the Arabic text of a refused completion", async () => {
    stubFetch(400, { errors: { _: "يُنجز الإصدار وإعادة الفتح من تقرير دراسة الحالة" } });
    expect(await patchWorkflowTask(config, "t1", { status: "completed" })).toMatchObject({
      ok: false,
      kind: "validation",
      message: "يُنجز الإصدار وإعادة الفتح من تقرير دراسة الحالة",
    });
  });
});
