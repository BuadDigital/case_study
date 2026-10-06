import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { ValuationReportDraftDto } from "@platform/api-client";

const api = vi.hoisted(() => ({
  approveReportDraft: vi.fn(),
  withdrawReportDraftApproval: vi.fn(),
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

import { ReportDraftApprovalBar } from "../ReportDraftApprovalBar";
import { FinalReportDownload } from "../FinalReportDownload";

const PROPERTY = "prop-1";

function draft(overrides: Partial<ValuationReportDraftDto> = {}): ValuationReportDraftDto {
  return {
    valuationRequestId: "vr-1",
    status: "sent",
    version: 1,
    packageStatus: "submitted",
    canPrepare: false,
    hasSnapshot: false,
    updatedAtUtc: "2026-10-05T09:00:00Z",
    reportStage: "draft",
    ...overrides,
  };
}

function renderBar(d: ValuationReportDraftDto, buildApprovedHtml = vi.fn(async () => "<p>report</p>")) {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  const view = render(
    <QueryClientProvider client={client}>
      <ReportDraftApprovalBar propertyId={PROPERTY} draft={d} buildApprovedHtml={buildApprovedHtml} />
    </QueryClientProvider>,
  );
  return { ...view, buildApprovedHtml };
}

function pdfFile(name = "certificate.pdf") {
  return new File([new Uint8Array([0x25, 0x50, 0x44, 0x46, 0x2d])], name, { type: "application/pdf" });
}

beforeEach(() => {
  Object.values(api).forEach((fn) => fn.mockReset());
  toast.showToast.mockReset();
  vi.spyOn(window, "confirm").mockReturnValue(true);
});

afterEach(() => {
  vi.restoreAllMocks();
});

describe("ReportDraftApprovalBar", () => {
  it("shows nothing while the specialist is still preparing", () => {
    renderBar(draft({ status: "preparing" }));
    expect(screen.queryByTestId("report-draft-approval-bar")).toBeNull();
  });

  it("approves with today's date — there is no date to pick", async () => {
    api.approveReportDraft.mockResolvedValue({ ok: true, data: draft({ status: "approved", reportStage: "deposit_issued" }) });
    const { buildApprovedHtml } = renderBar(draft({ status: "sent" }));

    expect(screen.getByText(/تاريخ التقرير: تاريخ الاعتماد/)).toBeTruthy();
    expect(document.querySelector('input[type="date"]')).toBeNull();

    fireEvent.click(screen.getByRole("button", { name: "اعتماد التقرير" }));

    await waitFor(() => expect(api.approveReportDraft).toHaveBeenCalledTimes(1));
    const today = new Date().toLocaleDateString("en-CA");
    expect(buildApprovedHtml).toHaveBeenCalledWith(today);
    expect(api.approveReportDraft).toHaveBeenCalledWith({ token: "t" }, "vr-1", { reportDate: today, html: "<p>report</p>" });
  });

  it("does nothing when the appraiser does not confirm the approval", async () => {
    vi.spyOn(window, "confirm").mockReturnValue(false);
    renderBar(draft({ status: "sent" }));

    fireEvent.click(screen.getByRole("button", { name: "اعتماد التقرير" }));

    await Promise.resolve();
    expect(api.approveReportDraft).not.toHaveBeenCalled();
  });

  it("reports a refused approval without changing the draft", async () => {
    api.approveReportDraft.mockResolvedValue({ ok: false, kind: "validation", message: "تاريخ الاعتماد غير صحيح" });
    renderBar(draft({ status: "sent" }));

    fireEvent.click(screen.getByRole("button", { name: "اعتماد التقرير" }));

    await waitFor(() => expect(toast.showToast).toHaveBeenCalledWith("تاريخ الاعتماد غير صحيح", "error"));
  });

  describe("after approval — the deposit step", () => {
    const approved = () => draft({ status: "approved", reportStage: "deposit_issued", reportDate: "2026-10-05" });

    it("needs the code first, then the certificate", () => {
      renderBar(approved());
      const record = screen.getByRole("button", { name: /تسجيل رمز الإيداع/ });

      fireEvent.click(record);
      expect(toast.showToast).toHaveBeenLastCalledWith("اكتب رمز الإيداع", "error");

      fireEvent.change(screen.getByPlaceholderText("رمز الإيداع"), { target: { value: "QYM-1" } });
      fireEvent.click(record);
      expect(toast.showToast).toHaveBeenLastCalledWith("أرفق شهادة الإيداع (PDF)", "error");
      expect(api.registerDepositCertificate).not.toHaveBeenCalled();
    });

    it("refuses a certificate that is not a PDF", () => {
      renderBar(approved());
      fireEvent.change(screen.getByPlaceholderText("رمز الإيداع"), { target: { value: "QYM-1" } });
      const input = document.querySelector('input[type="file"]') as HTMLInputElement;
      fireEvent.change(input, { target: { files: [new File(["x"], "photo.png", { type: "image/png" })] } });

      fireEvent.click(screen.getByRole("button", { name: /تسجيل رمز الإيداع/ }));

      expect(toast.showToast).toHaveBeenLastCalledWith("شهادة الإيداع ملف PDF", "error");
      expect(api.registerDepositCertificate).not.toHaveBeenCalled();
    });

    it("sends the code with the certificate as base64", async () => {
      api.registerDepositCertificate.mockResolvedValue({ ok: true, data: {} });
      renderBar(approved());
      fireEvent.change(screen.getByPlaceholderText("رمز الإيداع"), { target: { value: " QYM-1 " } });
      const input = document.querySelector('input[type="file"]') as HTMLInputElement;
      fireEvent.change(input, { target: { files: [pdfFile()] } });

      fireEvent.click(screen.getByRole("button", { name: /تسجيل رمز الإيداع/ }));

      await waitFor(() => expect(api.registerDepositCertificate).toHaveBeenCalledTimes(1));
      const [, id, body] = api.registerDepositCertificate.mock.calls[0]!;
      expect(id).toBe("vr-1");
      expect(body).toMatchObject({
        depositCode: "QYM-1",
        certificateFileName: "certificate.pdf",
        certificateContentType: "application/pdf",
      });
      expect(typeof body.certificateContentBase64).toBe("string");
      expect(body.certificateContentBase64.length).toBeGreaterThan(0);
    });

    it("lets him take the approval back", async () => {
      vi.spyOn(window, "prompt").mockReturnValue("نسيت بنداً");
      api.withdrawReportDraftApproval.mockResolvedValue({ ok: true, data: draft({ status: "sent" }) });
      renderBar(approved());

      fireEvent.click(screen.getByRole("button", { name: "سحب الاعتماد" }));

      await waitFor(() => expect(api.withdrawReportDraftApproval).toHaveBeenCalledWith({ token: "t" }, "vr-1", "نسيت بنداً"));
    });
  });

  describe("after the final issuance", () => {
    const issued = (extra: Partial<ValuationReportDraftDto> = {}) =>
      draft({
        status: "approved",
        reportStage: "final_issued",
        reportDate: "2026-10-05",
        depositCode: "QYM-1",
        certificateFileName: "certificate.pdf",
        finalReportStatus: "ready",
        ...extra,
      });

    it("shows the recorded code and corrects it without a certificate", async () => {
      api.registerDepositCertificate.mockResolvedValue({ ok: true, data: {} });
      renderBar(issued());

      expect(screen.getByTestId("report-final-issued").textContent).toContain("QYM-1");
      fireEvent.click(screen.getByRole("button", { name: "تعديل رمز الإيداع" }));
      const input = screen.getByPlaceholderText("رمز الإيداع الصحيح") as HTMLInputElement;
      expect(input.value).toBe("QYM-1");
      fireEvent.change(input, { target: { value: "QYM-2" } });
      fireEvent.click(screen.getByRole("button", { name: "حفظ الرمز" }));

      await waitFor(() => expect(api.registerDepositCertificate).toHaveBeenCalledTimes(1));
      expect(api.registerDepositCertificate).toHaveBeenCalledWith({ token: "t" }, "vr-1", { depositCode: "QYM-2" });
    });

    it("offers the final report download", () => {
      renderBar(issued());
      expect(screen.getByRole("button", { name: /تنزيل التقرير النهائي/ })).toBeTruthy();
    });
  });
});

describe("FinalReportDownload", () => {
  function renderDownload(d: ValuationReportDraftDto) {
    const client = new QueryClient();
    return render(
      <QueryClientProvider client={client}>
        <FinalReportDownload propertyId={PROPERTY} draft={d} />
      </QueryClientProvider>,
    );
  }

  it("shows nothing before the final copy is issued", () => {
    renderDownload(draft({ reportStage: "deposit_issued" }));
    expect(screen.queryByTestId("final-report-download")).toBeNull();
  });

  it("downloads the file when it is ready", async () => {
    api.downloadFinalReport.mockResolvedValue({ ok: true, data: new Blob(["%PDF-"], { type: "application/pdf" }) });
    const create = vi.fn(() => "blob:final");
    Object.assign(URL, { createObjectURL: create, revokeObjectURL: vi.fn() });
    const click = vi.spyOn(HTMLAnchorElement.prototype, "click").mockImplementation(() => {});
    renderDownload(draft({ reportStage: "final_issued", finalReportStatus: "ready" }));

    fireEvent.click(screen.getByRole("button", { name: /تنزيل التقرير النهائي/ }));

    await waitFor(() => expect(click).toHaveBeenCalledTimes(1));
    expect(api.downloadFinalReport).toHaveBeenCalledWith({ token: "t" }, "vr-1");
    expect(create).toHaveBeenCalledTimes(1);
  });

  it("says the file is being prepared and retries on request", async () => {
    api.generateFinalReport.mockResolvedValue({ ok: true, data: { finalReportStatus: "ready" } });
    renderDownload(draft({ reportStage: "final_issued", finalReportStatus: "preparing" }));

    expect(screen.getByText("ملف التقرير النهائي قيد الإعداد.")).toBeTruthy();
    expect(screen.queryByRole("button", { name: /تنزيل التقرير النهائي/ })).toBeNull();

    fireEvent.click(screen.getByRole("button", { name: "إعادة تجهيز الملف" }));

    await waitFor(() => expect(api.generateFinalReport).toHaveBeenCalledWith({ token: "t" }, "vr-1"));
    await waitFor(() => expect(toast.showToast).toHaveBeenCalledWith("جهز ملف التقرير النهائي", "success"));
  });

  it("keeps the retry open when the file is still not ready", async () => {
    api.generateFinalReport.mockResolvedValue({ ok: true, data: { finalReportStatus: "preparing" } });
    renderDownload(draft({ reportStage: "final_issued", finalReportStatus: "preparing" }));

    fireEvent.click(screen.getByRole("button", { name: "إعادة تجهيز الملف" }));

    await waitFor(() => expect(toast.showToast).toHaveBeenCalledWith("ملف التقرير النهائي ما زال قيد الإعداد", "error"));
  });
});
