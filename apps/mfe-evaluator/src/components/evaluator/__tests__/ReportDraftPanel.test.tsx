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
  registerDepositCertificate: vi.fn(),
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
  useValuationListsQuery: () => ({ data: { lists: { attachments: [] } } }),
}));
vi.mock("../../../lib/case-study-bridge", () => ({
  usePropertyDetailDocuments: () => [],
}));
vi.mock("../../../lib/evaluator/evaluator-submission-reads", () => ({
  fetchEvaluatorSubmission: async () => null,
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
    // The card shows a loading skeleton until the read settles, then nothing at all.
    await waitFor(() => expect(container.textContent).toBe(""));
  });

  it("waits for the appraiser's hand-over before opening the draft", async () => {
    renderPanel(draft({ status: "none", canPrepare: false, packageStatus: "draft" }));

    expect(await screen.findByText("تُفتح المسودة بعد أن يسلّم المقيّم تقييمه للأخصائي.")).toBeTruthy();
    expect(screen.queryByTestId("attachments-editor")).toBeNull();
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

    expect(await screen.findByTestId("attachments-editor")).toBeTruthy();
    // ESG is the appraiser's own — the specialist's panel never offers it.
    expect(screen.queryByText("العوامل البيئية والاجتماعية والحوكمة (ESG)")).toBeNull();
    expect(screen.queryByRole("button", { name: "إرسال المسودة للمقيّم" })).toBeNull();
  });

  it("pulls a sent draft back with a note for the appraiser", async () => {
    vi.spyOn(window, "prompt").mockReturnValue("راجع الأرقام");
    api.withdrawReportDraft.mockResolvedValue({ ok: true, data: draft({ status: "preparing" }) });
    renderPanel(draft({ status: "sent", canPrepare: false }));

    fireEvent.click(await screen.findByRole("button", { name: "سحب المسودة" }));

    await waitFor(() => expect(api.withdrawReportDraft).toHaveBeenCalledWith({ token: "t" }, "vr-1", "راجع الأرقام"));
  });

  describe("after the appraiser's approval — the specialist's deposit", () => {
    const approved = () =>
      draft({ status: "approved", canPrepare: false, reportStage: "deposit_issued", reportDate: "2026-10-05" });
    const pdf = () =>
      new File([new Uint8Array([0x25, 0x50, 0x44, 0x46, 0x2d])], "certificate.pdf", { type: "application/pdf" });

    it("asks him for the code first, then the certificate", async () => {
      renderPanel(approved());
      const record = await screen.findByRole("button", { name: /تسجيل رمز الإيداع/ });

      fireEvent.click(record);
      expect(toast.showToast).toHaveBeenLastCalledWith("اكتب رمز الإيداع", "error");

      fireEvent.change(screen.getByPlaceholderText("رمز الإيداع"), { target: { value: "QYM-1" } });
      fireEvent.click(record);
      expect(toast.showToast).toHaveBeenLastCalledWith("أرفق شهادة الإيداع (PDF)", "error");
      expect(api.registerDepositCertificate).not.toHaveBeenCalled();
    });

    it("refuses a certificate that is not a PDF", async () => {
      renderPanel(approved());
      fireEvent.change(await screen.findByPlaceholderText("رمز الإيداع"), { target: { value: "QYM-1" } });
      const input = document.querySelector('input[type="file"]') as HTMLInputElement;
      fireEvent.change(input, { target: { files: [new File(["x"], "photo.png", { type: "image/png" })] } });

      fireEvent.click(screen.getByRole("button", { name: /تسجيل رمز الإيداع/ }));

      expect(toast.showToast).toHaveBeenLastCalledWith("شهادة الإيداع ملف PDF", "error");
      expect(api.registerDepositCertificate).not.toHaveBeenCalled();
    });

    it("sends the code with the certificate as base64", async () => {
      api.registerDepositCertificate.mockResolvedValue({ ok: true, data: {} });
      renderPanel(approved());
      fireEvent.change(await screen.findByPlaceholderText("رمز الإيداع"), { target: { value: " QYM-1 " } });
      const input = document.querySelector('input[type="file"]') as HTMLInputElement;
      fireEvent.change(input, { target: { files: [pdf()] } });

      fireEvent.click(screen.getByRole("button", { name: /تسجيل رمز الإيداع/ }));

      await waitFor(() => expect(api.registerDepositCertificate).toHaveBeenCalledTimes(1));
      const [, id, body] = api.registerDepositCertificate.mock.calls[0]!;
      expect(id).toBe("vr-1");
      expect(body).toMatchObject({
        depositCode: "QYM-1",
        certificateFileName: "certificate.pdf",
        certificateContentType: "application/pdf",
      });
      expect(body.certificateContentBase64.length).toBeGreaterThan(0);
      await waitFor(() => expect(toast.showToast).toHaveBeenCalledWith("صدر التقرير النهائي", "success"));
    });

    it("lists every reason when the server refuses the deposit", async () => {
      api.registerDepositCertificate.mockResolvedValue({
        ok: false,
        errors: { depositCode: "رمز الإيداع مسجّل على تقرير آخر" },
      });
      renderPanel(approved());
      fireEvent.change(await screen.findByPlaceholderText("رمز الإيداع"), { target: { value: "QYM-1" } });
      const input = document.querySelector('input[type="file"]') as HTMLInputElement;
      fireEvent.change(input, { target: { files: [pdf()] } });

      fireEvent.click(screen.getByRole("button", { name: /تسجيل رمز الإيداع/ }));

      expect((await screen.findByTestId("report-approval-refusal")).textContent).toContain(
        "رمز الإيداع مسجّل على تقرير آخر",
      );
    });

    it("is not offered to anyone who may not prepare the draft", async () => {
      renderPanel(approved(), false);

      expect(await screen.findByTestId("report-draft-deposit-status")).toBeTruthy();
      expect(screen.queryByTestId("report-deposit-step")).toBeNull();
    });
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

    it("lets him correct the code without a new certificate", async () => {
      api.registerDepositCertificate.mockResolvedValue({ ok: true, data: {} });
      renderPanel(issued());

      fireEvent.click(await screen.findByRole("button", { name: "تعديل رمز الإيداع" }));
      const input = screen.getByPlaceholderText("رمز الإيداع الصحيح") as HTMLInputElement;
      expect(input.value).toBe("QYM-1");
      fireEvent.change(input, { target: { value: "QYM-2" } });
      fireEvent.click(screen.getByRole("button", { name: "حفظ الرمز" }));

      await waitFor(() =>
        expect(api.registerDepositCertificate).toHaveBeenCalledWith({ token: "t" }, "vr-1", { depositCode: "QYM-2" }),
      );
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
