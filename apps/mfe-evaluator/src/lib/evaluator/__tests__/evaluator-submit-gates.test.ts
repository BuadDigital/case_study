import { beforeEach, describe, expect, it, vi } from "vitest";

const getOpen = vi.fn();
const getGates = vi.fn();
const getSubmission = vi.fn();
const apiConfigMock = vi.fn();

vi.mock("@platform/api-client", () => ({
  getOpenValuationRequestByProperty: (...a: unknown[]) => getOpen(...a),
  getValuationIssuanceGates: (...a: unknown[]) => getGates(...a),
  getPartyTaskSubmission: (...a: unknown[]) => getSubmission(...a),
}));
vi.mock("../api-config", () => ({ apiConfig: () => apiConfigMock() }));

import { STUDY_REPORT_NOT_ISSUED_MESSAGE } from "../evaluator-inspection-gate";
import {
  ISSUANCE_GATES_UNVERIFIED_MESSAGE,
  STUDY_REPORT_UNVERIFIED_MESSAGE,
  checkIssuanceGatesFailClosed,
  readFreshStudyReportGate,
} from "../evaluator-submit-gates";

beforeEach(() => {
  getOpen.mockReset();
  getGates.mockReset();
  getSubmission.mockReset();
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
    expect(await checkIssuanceGatesFailClosed(input)).toEqual({ ok: true });
    expect(getGates).not.toHaveBeenCalled();
  });

  it("passes when issuance is allowed", async () => {
    getOpen.mockResolvedValue({ ok: true, data: { id: "vr1" } });
    getGates.mockResolvedValue({
      ok: true,
      data: { allowsIssuance: true, blockingReasonsAr: [] },
    });
    expect(await checkIssuanceGatesFailClosed(input)).toEqual({ ok: true });
  });

  it("lists up to four blocking reasons when issuance is refused", async () => {
    getOpen.mockResolvedValue({ ok: true, data: { id: "vr1" } });
    getGates.mockResolvedValue({
      ok: true,
      data: {
        allowsIssuance: false,
        blockingReasonsAr: ["أ", "ب", "ج", "د", "هـ", "و"],
      },
    });
    const res = await checkIssuanceGatesFailClosed(input);
    expect(res).toEqual({
      ok: false,
      kind: "blocked",
      message: "الاعتماد ممنوع — أ؛ ب؛ ج؛ د وغيرها (2 أخرى)",
    });
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
