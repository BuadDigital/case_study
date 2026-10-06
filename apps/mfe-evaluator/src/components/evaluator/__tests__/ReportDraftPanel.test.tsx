import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { ValuationReportDraftDto } from "@platform/api-client";
import type { EvaluatorReportDraftPanelProps } from "@platform/app-shared/party-appraisal/evaluator-runtime-bridge";

const api = vi.hoisted(() => ({
  getReportDraftByProperty: vi.fn(),
  saveReportDraftChoices: vi.fn(),
  sendReportDraft: vi.fn(),
  withdrawReportDraft: vi.fn(),
  reopenReportIssuance: vi.fn(),
  downloadFinalReport: vi.fn(),
  generateFinalReport: vi.fn(),
}));
const toast = vi.hoisted(() => ({ showToast: vi.fn() }));

vi.mock("@platform/api-client", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@platform/api-client")>()),
  ...api,
}));
vi.mock("@platform/ui-kit", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@platform/ui-kit")>()),
  useToast: () => toast,
}));
vi.mock("../valuation-work/lib/shell-utils", () => ({
  apiConfig: () => ({ token: "t" }),
}));
vi.mock("@platform/app-shared/query/valuation-lists-query", () => ({
  useValuationListsQuery: () => ({ data: undefined }),
}));
vi.mock("../../../lib/case-study-bridge", () => ({
  usePropertyDetailDocuments: () => [],
}));
vi.mock("../../../lib/evaluator/evaluator-submission-reads", () => ({
  fetchEvaluatorSubmission: async () => null,
}));
vi.mock("../ValuationReportEsgEditor", () => ({
  ValuationReportEsgEditor: () => <div data-testid="esg-editor" />,
}));
vi.mock("../ValuationReportAttachmentsEditor", () => ({
  ValuationReportAttachmentsEditor: () => <div data-testid="attachments-editor" />,
}));

import { ReportDraftPanel } from "../ReportDraftPanel";

const PROPERTY = "prop-1";

function draft(overrides: Partial<ValuationReportDraftDto> = {}): ValuationReportDraftDto {
  return {
    valuationRequestId: "vr-1",
    status: "preparing",
    version: 1,
    packageStatus: "submitted",
    canPrepare: true,
    hasSnapshot: false,
    updatedAtUtc: "2026-10-05T09:00:00Z",
    reportStage: "draft",
    ...overrides,
  };
}

function renderPanel(d: ValuationReportDraftDto | null, canEdit = true) {
  api.getReportDraftByProperty.mockResolvedValue(d ? { ok: true, data: d } : { ok: false, kind: "not_found" });
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  const props = {
    appraisalTask: { id: "task-1", propertyId: PROPERTY, poNumber: "PO-1" },
    allTasks: [],
    property: { id: PROPERTY },
    canEdit,
  } as unknown as EvaluatorReportDraftPanelProps;
  return render(
    <QueryClientProvider client={client}>
      <ReportDraftPanel {...props} />
    </QueryClientProvider>,
  );
}

beforeEach(() => {
  Object.values(api).forEach((fn) => fn.mockReset());
  toast.showToast.mockReset();
});

afterEach(() => {
  vi.restoreAllMocks();
});

describe("ReportDraftPanel (the specialist's side)", () => {
  it("shows nothing when the property has no valuation request", async () => {
    const { container } = renderPanel(null);
    await waitFor(() => expect(api.getReportDraftByProperty).toHaveBeenCalled());
    expect(container.textContent).toBe("");
  });

  it("waits for the appraiser's hand-over before opening the draft", async () => {
    renderPanel(draft({ status: "none", canPrepare: false, packageStatus: "draft" }));

    expect(await screen.findByText("تُفتح المسودة بعد أن يسلّم المقيّم تقييمه للأخصائي.")).toBeTruthy();
    expect(screen.queryByTestId("esg-editor")).toBeNull();
  });

  it("sends only after he confirms the valuation matches the property study", async () => {
    api.sendReportDraft.mockResolvedValue({ ok: true, data: draft({ status: "sent" }) });
    renderPanel(draft());

    const send = await screen.findByRole("button", { name: "إرسال المسودة للمقيّم" });
    expect((send as HTMLButtonElement).disabled).toBe(true);

    fireEvent.click(screen.getByLabelText("أؤكد أن التقييم مطابق لدراسة العقار"));
    await waitFor(() => expect((send as HTMLButtonElement).disabled).toBe(false));
    fireEvent.click(send);

    await waitFor(() => expect(api.sendReportDraft).toHaveBeenCalledTimes(1));
    expect(api.sendReportDraft).toHaveBeenCalledWith({ token: "t" }, "vr-1", { conformityConfirmed: true, note: undefined });
    await waitFor(() => expect(toast.showToast).toHaveBeenCalledWith("أُرسلت مسودة التقرير للمقيّم", "success"));
  });

  it("is read-only for everyone who may not prepare it", async () => {
    renderPanel(draft(), false);

    expect(await screen.findByTestId("esg-editor")).toBeTruthy();
    expect(screen.queryByRole("button", { name: "إرسال المسودة للمقيّم" })).toBeNull();
  });

  it("pulls a sent draft back with a note for the appraiser", async () => {
    vi.spyOn(window, "prompt").mockReturnValue("راجع الأرقام");
    api.withdrawReportDraft.mockResolvedValue({ ok: true, data: draft({ status: "preparing" }) });
    renderPanel(draft({ status: "sent", canPrepare: false }));

    fireEvent.click(await screen.findByRole("button", { name: "سحب المسودة" }));

    await waitFor(() => expect(api.withdrawReportDraft).toHaveBeenCalledWith({ token: "t" }, "vr-1", "راجع الأرقام"));
  });

  describe("after the final issuance", () => {
    const issued = (extra: Partial<ValuationReportDraftDto> = {}) =>
      draft({
        status: "approved",
        canPrepare: false,
        reportStage: "final_issued",
        reportDate: "2026-10-05",
        depositCode: "QYM-1",
        finalReportStatus: "ready",
        ...extra,
      });

    it("shows the recorded code and the final report download", async () => {
      renderPanel(issued());

      const status = await screen.findByTestId("report-draft-deposit-status");
      expect(status.textContent).toContain("QYM-1");
      expect(screen.getByRole("button", { name: /تنزيل التقرير النهائي/ })).toBeTruthy();
    });

    it("offers a retry while the final file is still being prepared", async () => {
      renderPanel(issued({ finalReportStatus: "preparing" }));

      expect(await screen.findByRole("button", { name: "إعادة تجهيز الملف" })).toBeTruthy();
      expect(screen.queryByRole("button", { name: /تنزيل التقرير النهائي/ })).toBeNull();
    });

    it("reopens as a new version only with a real reason", async () => {
      const prompt = vi.spyOn(window, "prompt");
      api.reopenReportIssuance.mockResolvedValue({ ok: true, data: {} });
      renderPanel(issued());
      const reopen = await screen.findByRole("button", { name: /فتح التقرير بنسخة جديدة/ });

      // The dialog refuses a short reason (without a host the same rule runs on the native prompt's answer).
      const alert = vi.spyOn(window, "alert").mockImplementation(() => {});
      prompt.mockReturnValueOnce("قصير");
      fireEvent.click(reopen);
      await waitFor(() => expect(alert).toHaveBeenCalledWith("اكتب 10 أحرف على الأقل"));
      expect(api.reopenReportIssuance).not.toHaveBeenCalled();

      prompt.mockReturnValueOnce("تغيّر الرأي بعد ملاحظة الهيئة");
      fireEvent.click(reopen);
      await waitFor(() =>
        expect(api.reopenReportIssuance).toHaveBeenCalledWith({ token: "t" }, "vr-1", "تغيّر الرأي بعد ملاحظة الهيئة"),
      );
    });
  });
});
