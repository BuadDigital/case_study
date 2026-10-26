import { beforeEach, describe, expect, it, vi } from "vitest";

const getOpen = vi.fn();
const getGates = vi.fn();
const getSubmission = vi.fn();
const getRecon = vi.fn();
const apiConfigMock = vi.fn();

vi.mock("@platform/api-client", () => ({
  getOpenValuationRequestByProperty: (...a: unknown[]) => getOpen(...a),
  getValuationIssuanceGates: (...a: unknown[]) => getGates(...a),
  getPartyTaskSubmission: (...a: unknown[]) => getSubmission(...a),
  getValuationReconciliation: (...a: unknown[]) => getRecon(...a),
}));
vi.mock("../api-config", () => ({ apiConfig: () => apiConfigMock() }));

import { STUDY_REPORT_NOT_ISSUED_MESSAGE } from "../evaluator-inspection-gate";
import {
  FINAL_VALUE_UNVERIFIED_MESSAGE,
  ISSUANCE_GATES_UNVERIFIED_MESSAGE,
  STUDY_REPORT_UNVERIFIED_MESSAGE,
  checkIssuanceGatesFailClosed,
  readFreshStudyReportGate,
  readHandOverPriceFromServer,
} from "../evaluator-submit-gates";
import { HANDOVER_GATES_READ_EVENT } from "../handover-blockers";

beforeEach(() => {
  getOpen.mockReset();
  getGates.mockReset();
  getSubmission.mockReset();
  getRecon.mockReset();
  apiConfigMock.mockReset();
  apiConfigMock.mockReturnValue({ token: "t", baseUrl: "http://x" });
});

describe("checkIssuanceGatesFailClosed", () => {
  const input = { token: "tok", propertyId: "p1" };
  const unverified = {
    ok: false,
    kind: "unverified",
    message: ISSUANCE_GATES_UNVERIFIED_MESSAGE,
  };

  it("blocks without a session or a property (cannot verify)", async () => {
    expect(await checkIssuanceGatesFailClosed({ token: null, propertyId: "p1" })).toEqual(
      unverified,
    );
    expect(await checkIssuanceGatesFailClosed({ token: "tok", propertyId: "" })).toEqual(
      unverified,
    );
    expect(getOpen).not.toHaveBeenCalled();
  });

  it("blocks when the open-request lookup fails or throws", async () => {
    getOpen.mockResolvedValueOnce({ ok: false, kind: "network" });
    expect(await checkIssuanceGatesFailClosed(input)).toEqual(unverified);
    getOpen.mockRejectedValueOnce(new Error("boom"));
    expect(await checkIssuanceGatesFailClosed(input)).toEqual(unverified);
    expect(getGates).not.toHaveBeenCalled();
  });

  it("blocks when the gates call fails", async () => {
    getOpen.mockResolvedValue({ ok: true, data: { id: "vr1" } });
    getGates.mockResolvedValueOnce({ ok: false, kind: "server" });
    expect(await checkIssuanceGatesFailClosed(input)).toEqual(unverified);
  });

  it("blocks when the gates call throws", async () => {
    getOpen.mockResolvedValue({ ok: true, data: { id: "vr1" } });
    getGates.mockRejectedValueOnce(new Error("boom"));
    expect(await checkIssuanceGatesFailClosed(input)).toEqual(unverified);
  });

  it("lets a first submit through when there is no open valuation request yet", async () => {
    getOpen.mockResolvedValue({ ok: true, data: null });
    expect(await checkIssuanceGatesFailClosed(input)).toEqual({ ok: true, valuationRequestId: null });
    expect(getGates).not.toHaveBeenCalled();
  });

  it("passes when issuance is allowed", async () => {
    getOpen.mockResolvedValue({ ok: true, data: { id: "vr1" } });
    getGates.mockResolvedValue({
      ok: true,
      data: { allowsIssuance: true, blockingReasonsAr: [] },
    });
    expect(await checkIssuanceGatesFailClosed(input)).toEqual({ ok: true, valuationRequestId: "vr1" });
  });

  const gate = (code: string, detailAr: string) => ({
    code,
    labelAr: code,
    passed: false,
    isHard: true,
    isWarning: false,
    detailAr,
  });

  it("D2: lists every blocker with who fixes it — not just the first four", async () => {
    getOpen.mockResolvedValue({ ok: true, data: { id: "vr1" } });
    getGates.mockResolvedValue({
      ok: true,
      data: {
        allowsIssuance: false,
        gates: [
          gate("final_opinion", "الرأي النهائي غير محسوب أو صفر"),
          gate("comparable_weights_market", "مجموع الأوزان ≠ 100٪"),
          gate("credentials", "انتهت عضوية المقيّم"),
          gate("reconciliation_weights", "مجموع نسب المشاركة ≠ 100٪"),
          gate("min_adopted_comparables_market", "يلزم مقارن معتمد"),
        ],
        methodologyAlerts: [
          { number: 7, code: "m7", labelAr: "تنبيه", triggered: true, isHard: false, evaluated: true, blocksIssuance: true, detailAr: "يلزم مبرر" },
        ],
        blockingReasonsAr: [],
      },
    });
    const res = await checkIssuanceGatesFailClosed(input);
    expect(res.ok).toBe(false);
    const message = res.ok ? "" : res.message;
    expect(message.startsWith("لا يُسلَّم التقييم قبل معالجة ما يلي: ")).toBe(true);
    expect(message).toContain("1) الرأي النهائي غير محسوب أو صفر — يعالجها: المقيّم");
    expect(message).toContain("3) انتهت عضوية المقيّم — يعالجها: إدارة المنشأة");
    expect(message).toContain("6) يلزم مبرر — يعالجها: المقيّم");
  });

  it("D2: the report attachments the specialist adds after the hand-over do not block it", async () => {
    getOpen.mockResolvedValue({ ok: true, data: { id: "vr1" } });
    getGates.mockResolvedValue({
      ok: true,
      data: {
        allowsIssuance: false,
        gates: [gate("required_attachments", "مرفقات إلزامية بلا رفع مصنّف للطباعة: صك الملكية")],
        methodologyAlerts: [],
        blockingReasonsAr: ["مرفقات إلزامية بلا رفع مصنّف للطباعة: صك الملكية"],
      },
    });
    expect(await checkIssuanceGatesFailClosed(input)).toEqual({ ok: true, valuationRequestId: "vr1" });
  });

  it("announces the gates it read so the final-review list shows the same blockers", async () => {
    const seen: unknown[] = [];
    const listener = (e: Event) => seen.push((e as CustomEvent).detail);
    window.addEventListener(HANDOVER_GATES_READ_EVENT, listener);
    getOpen.mockResolvedValue({ ok: true, data: { id: "vr1" } });
    const data = { allowsIssuance: true, gates: [], methodologyAlerts: [], blockingReasonsAr: [] };
    getGates.mockResolvedValue({ ok: true, data });
    await checkIssuanceGatesFailClosed(input);
    window.removeEventListener(HANDOVER_GATES_READ_EVENT, listener);
    expect(seen).toEqual([{ valuationRequestId: "vr1", gates: data }]);
  });
});

describe("readFreshStudyReportGate", () => {
  it("is ready when the fresh submission says the report is issued", async () => {
    getSubmission.mockResolvedValue({ ok: true, data: { studyReportIssued: true } });
    expect(await readFreshStudyReportGate("a1")).toEqual({ ready: true });
    expect(getSubmission).toHaveBeenCalledWith({ token: "t", baseUrl: "http://x" }, "a1");
  });

  it("closes with the agreed reason when the flag is false or absent", async () => {
    getSubmission.mockResolvedValue({ ok: true, data: { studyReportIssued: false } });
    expect(await readFreshStudyReportGate("a1")).toEqual({
      ready: false,
      reason: STUDY_REPORT_NOT_ISSUED_MESSAGE,
    });
    getSubmission.mockResolvedValue({ ok: true, data: {} });
    expect((await readFreshStudyReportGate("a1")).ready).toBe(false);
  });

  it("closes (unverified) on no session, a failed read, or a throw", async () => {
    const closed = { ready: false, reason: STUDY_REPORT_UNVERIFIED_MESSAGE };
    apiConfigMock.mockReturnValueOnce(null);
    expect(await readFreshStudyReportGate("a1")).toEqual(closed);
    getSubmission.mockResolvedValueOnce({ ok: false, kind: "network" });
    expect(await readFreshStudyReportGate("a1")).toEqual(closed);
    getSubmission.mockRejectedValueOnce(new Error("boom"));
    expect(await readFreshStudyReportGate("a1")).toEqual(closed);
  });
});

describe("readHandOverPriceFromServer", () => {
  const input = { token: "tok", propertyId: "p1" };
  const failed = { ok: false, message: FINAL_VALUE_UNVERIFIED_MESSAGE };

  it("takes the reconciliation's final value, not the typed price (r8b: 9,830,000 vs 9,220,000)", async () => {
    getOpen.mockResolvedValue({ ok: true, data: { id: "vr1" } });
    getRecon.mockResolvedValue({ ok: true, data: { finalOpinionValue: 9_220_000 } });
    expect(await readHandOverPriceFromServer(input)).toEqual({ ok: true, price: "9220000" });
    expect(getRecon).toHaveBeenCalledWith({ token: "tok" }, "vr1");
  });

  it("leaves the draft price when there is no request, no reconciliation or no final yet", async () => {
    getOpen.mockResolvedValueOnce({ ok: true, data: null });
    expect(await readHandOverPriceFromServer(input)).toEqual({ ok: true, price: null });
    getOpen.mockResolvedValue({ ok: true, data: { id: "vr1" } });
    getRecon.mockResolvedValueOnce({ ok: false, kind: "not_found" });
    expect(await readHandOverPriceFromServer(input)).toEqual({ ok: true, price: null });
    getRecon.mockResolvedValueOnce({ ok: true, data: { finalOpinionValue: 0 } });
    expect(await readHandOverPriceFromServer(input)).toEqual({ ok: true, price: null });
  });

  it("round 2: reuses the open request the gate check read — no second lookup", async () => {
    getRecon.mockResolvedValue({ ok: true, data: { finalOpinionValue: 9_220_000 } });
    expect(await readHandOverPriceFromServer({ ...input, valuationRequestId: "vr1" })).toEqual({
      ok: true,
      price: "9220000",
    });
    expect(await readHandOverPriceFromServer({ ...input, valuationRequestId: null })).toEqual({
      ok: true,
      price: null,
    });
    expect(getOpen).not.toHaveBeenCalled();
  });

  it("blocks when it cannot read the final value", async () => {
    expect(await readHandOverPriceFromServer({ token: null, propertyId: "p1" })).toEqual(failed);
    getOpen.mockResolvedValue({ ok: true, data: { id: "vr1" } });
    getRecon.mockResolvedValueOnce({ ok: false, kind: "server" });
    expect(await readHandOverPriceFromServer(input)).toEqual(failed);
    getRecon.mockRejectedValueOnce(new Error("boom"));
    expect(await readHandOverPriceFromServer(input)).toEqual(failed);
  });
});
