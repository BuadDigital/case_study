import { act, renderHook } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  readFreshStudyReportGate: vi.fn(),
  checkIssuanceGatesFailClosed: vi.fn(),
  readHandOverPriceFromServer: vi.fn(),
  updateEvaluatorDraft: vi.fn(),
  finalizeAppraiserSubmission: vi.fn(),
  validateEvaluatorSubmission: vi.fn(),
  confirmIgnoringDoubleClick: vi.fn(),
}));

vi.mock("@platform/auth-client", () => ({ getAuthSession: () => ({ token: "t" }) }));
vi.mock("@platform/app-shared", () => ({
  // One call per click: runs the action with a fixed key, like the real hook does for a fresh click.
  useIdempotentAction: (action: (key: string) => Promise<unknown>) => ({
    execute: async () => ({ status: "done", value: await action("key-1") }),
    loading: false,
  }),
}));
vi.mock("@platform/app-shared/form-ux", () => ({ scheduleScrollToFormField: vi.fn() }));
vi.mock("../../../lib/evaluator/evaluator-submission-commands", () => ({
  updateEvaluatorDraft: mocks.updateEvaluatorDraft,
}));
vi.mock("../../../lib/evaluator/finalize-appraiser-submission", () => ({
  finalizeAppraiserSubmission: mocks.finalizeAppraiserSubmission,
}));
vi.mock("../../../lib/evaluator/evaluator-validation", () => ({
  firstEvaluatorError: () => null,
  firstEvaluatorErrorTarget: () => "",
  evaluatorWorkScreenForErrorTarget: () => "review",
  validateEvaluatorSubmission: mocks.validateEvaluatorSubmission,
}));
vi.mock("../../../lib/evaluator/confirm-ignoring-double-click", () => ({
  confirmIgnoringDoubleClick: mocks.confirmIgnoringDoubleClick,
}));
vi.mock("../../../lib/evaluator/evaluator-submit-gates", () => ({
  readFreshStudyReportGate: mocks.readFreshStudyReportGate,
  checkIssuanceGatesFailClosed: mocks.checkIssuanceGatesFailClosed,
  readHandOverPriceFromServer: mocks.readHandOverPriceFromServer,
}));

import { useEvaluatorSubmit } from "../useEvaluatorSubmit";

function setup(host: Record<string, unknown>, draftPrice = "") {
  const showToast = vi.fn();
  const hostRef = { current: host } as never;
  const { result } = renderHook(() =>
    useEvaluatorSubmit({
      task: { id: "t1", propertyId: "p1", studyReportIssued: true } as never,
      hostRef,
      locked: false,
      draft: { reportChoices: {}, evaluatorPrice: draftPrice } as never,
      setDraft: vi.fn(),
      flushPendingAutosave: vi.fn(),
      retrospectiveRef: { current: null },
      specialistRef: { current: null },
      setFormError: vi.fn(),
      setFieldErrors: vi.fn(),
      setActiveTab: vi.fn(),
      showToast,
    }),
  );
  return { result, showToast };
}

describe("useEvaluatorSubmit — the sending dialog", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.readFreshStudyReportGate.mockResolvedValue({ ready: true });
    mocks.validateEvaluatorSubmission.mockReturnValue({});
    mocks.checkIssuanceGatesFailClosed.mockResolvedValue({ ok: true, valuationRequestId: "vr-1" });
    mocks.readHandOverPriceFromServer.mockResolvedValue({ ok: true, price: null });
    mocks.updateEvaluatorDraft.mockResolvedValue(null);
    mocks.confirmIgnoringDoubleClick.mockResolvedValue(true);
  });

  it("round 2: asks before the hand-over, and reuses the gate check's open request for the price", async () => {
    mocks.readHandOverPriceFromServer.mockResolvedValue({ ok: true, price: "9220000" });
    mocks.finalizeAppraiserSubmission.mockResolvedValue({ ok: true, submission: {} });
    const { result } = setup({ onSubmitted: vi.fn() });
    expect(await act(() => result.current.submit())).toBe(true);
    expect(mocks.readHandOverPriceFromServer).toHaveBeenCalledWith(
      expect.objectContaining({ valuationRequestId: "vr-1" }),
    );
    expect(mocks.confirmIgnoringDoubleClick).toHaveBeenCalledWith(
      expect.objectContaining({ title: "اعتماد التقييم وإرساله", message: expect.stringContaining("9,220,000") }),
    );
  });

  it("round 2: a declined confirmation sends nothing and opens no dialog", async () => {
    mocks.confirmIgnoringDoubleClick.mockResolvedValue(false);
    const host = { onSubmitStarted: vi.fn(), onSubmitted: vi.fn() };
    const { result } = setup(host);
    expect(await act(() => result.current.submit())).toBe(false);
    expect(host.onSubmitStarted).not.toHaveBeenCalled();
    expect(mocks.updateEvaluatorDraft).not.toHaveBeenCalled();
    expect(mocks.finalizeAppraiserSubmission).not.toHaveBeenCalled();
  });

  it("hands over the server's final value instead of the typed price", async () => {
    mocks.readHandOverPriceFromServer.mockResolvedValue({ ok: true, price: "9220000" });
    mocks.finalizeAppraiserSubmission.mockResolvedValue({ ok: true, submission: {} });
    const { result } = setup({ onSubmitted: vi.fn() }, "9830000");
    expect(await act(() => result.current.submit())).toBe(true);
    expect(mocks.updateEvaluatorDraft).toHaveBeenCalledWith(
      "t1",
      expect.objectContaining({ evaluatorPrice: "9220000" }),
    );
  });

  it("keeps the draft price when the server has no final yet, and blocks when it cannot read it", async () => {
    mocks.finalizeAppraiserSubmission.mockResolvedValue({ ok: true, submission: {} });
    const first = setup({ onSubmitted: vi.fn() }, "1000000");
    await act(() => first.result.current.submit());
    expect(mocks.updateEvaluatorDraft).toHaveBeenCalledWith(
      "t1",
      expect.objectContaining({ evaluatorPrice: "1000000" }),
    );

    mocks.updateEvaluatorDraft.mockClear();
    mocks.readHandOverPriceFromServer.mockResolvedValue({ ok: false, message: "تعذّر" });
    const host = { onSubmitStarted: vi.fn() };
    const second = setup(host, "1000000");
    expect(await act(() => second.result.current.submit())).toBe(false);
    expect(second.showToast).toHaveBeenCalledWith("تعذّر", "error");
    expect(host.onSubmitStarted).not.toHaveBeenCalled();
    expect(mocks.updateEvaluatorDraft).not.toHaveBeenCalled();
  });

  it("does not open the dialog while a gate still refuses", async () => {
    mocks.checkIssuanceGatesFailClosed.mockResolvedValue({ ok: false, message: "بوابة مغلقة", kind: "blocked" });
    const host = { onSubmitStarted: vi.fn(), onSubmitFailed: vi.fn(), onSubmitted: vi.fn() };
    const { result, showToast } = setup(host);
    expect(await act(() => result.current.submit())).toBe(false);
    expect(host.onSubmitStarted).not.toHaveBeenCalled();
    expect(showToast).toHaveBeenCalledWith("بوابة مغلقة", "error");
  });

  it("opens the dialog once the checks pass and reports the send as done", async () => {
    mocks.finalizeAppraiserSubmission.mockResolvedValue({ ok: true, submission: {} });
    const host = { onSubmitStarted: vi.fn(), onSubmitFailed: vi.fn(), onSubmitted: vi.fn() };
    const { result, showToast } = setup(host);
    expect(await act(() => result.current.submit())).toBe(true);
    expect(host.onSubmitStarted).toHaveBeenCalledOnce();
    expect(host.onSubmitted).toHaveBeenCalledOnce();
    expect(host.onSubmitFailed).not.toHaveBeenCalled();
    expect(showToast).not.toHaveBeenCalled();
  });

  it("closes the dialog on a refusal and shows the reason", async () => {
    mocks.finalizeAppraiserSubmission.mockResolvedValue({ ok: false, message: "تقرير الدراسة غير صادر" });
    const host = { onSubmitStarted: vi.fn(), onSubmitFailed: vi.fn(), onSubmitted: vi.fn() };
    const { result, showToast } = setup(host);
    expect(await act(() => result.current.submit())).toBe(false);
    expect(showToast).toHaveBeenCalledWith("تقرير الدراسة غير صادر", "error");
    expect(host.onSubmitFailed).toHaveBeenCalledOnce();
    expect(host.onSubmitted).not.toHaveBeenCalled();
  });

  it("closes the dialog when the send throws, and still throws", async () => {
    mocks.finalizeAppraiserSubmission.mockRejectedValue(new Error("انقطع الاتصال"));
    const host = { onSubmitStarted: vi.fn(), onSubmitFailed: vi.fn(), onSubmitted: vi.fn() };
    const { result } = setup(host);
    await expect(act(() => result.current.submit())).rejects.toThrow("انقطع الاتصال");
    expect(host.onSubmitFailed).toHaveBeenCalledOnce();
  });

  it("a host without the dialog keeps the success toast", async () => {
    mocks.finalizeAppraiserSubmission.mockResolvedValue({ ok: true, submission: {} });
    const host = { onSubmitted: vi.fn() };
    const { result, showToast } = setup(host);
    await act(() => result.current.submit());
    expect(host.onSubmitted).toHaveBeenCalledOnce();
    expect(showToast).toHaveBeenCalledWith("تم اعتماد التقييم وإرساله لأخصائي دراسة الحالة.", "success");
  });
});
