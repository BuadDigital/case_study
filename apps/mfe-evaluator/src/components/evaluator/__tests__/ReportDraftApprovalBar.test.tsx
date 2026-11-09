import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { ValuationReportDraftDto } from "@platform/api-client";

const api = vi.hoisted(() => ({
  approveReportDraft: vi.fn(),
  ensureReportNumber: vi.fn(),
  withdrawReportDraftApproval: vi.fn(),
  returnReportDraftToReviewer: vi.fn(),
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
    api.ensureReportNumber.mockResolvedValue({ ok: true, data: { valuationRequestId: "vr-1", reportNumber: "PRV-2026-00007" } });
    api.approveReportDraft.mockResolvedValue({ ok: true, data: draft({ status: "approved", reportStage: "deposit_issued" }) });
    const { buildApprovedHtml } = renderBar(draft({ status: "sent" }));

    expect(screen.getByText(/تاريخ التقرير: تاريخ الاعتماد/)).toBeTruthy();
    expect(document.querySelector('input[type="date"]')).toBeNull();

    fireEvent.click(screen.getByRole("button", { name: "اعتماد التقرير" }));

    await waitFor(() => expect(api.approveReportDraft).toHaveBeenCalledTimes(1));
    const today = new Date().toLocaleDateString("en-CA");
    // The report number is fixed on the server before the copy is printed.
    expect(api.ensureReportNumber).toHaveBeenCalledWith({ token: "t" }, "vr-1");
    expect(buildApprovedHtml).toHaveBeenCalledWith(today, expect.any(Function), "PRV-2026-00007");
    expect(api.approveReportDraft).toHaveBeenCalledWith({ token: "t" }, "vr-1", { reportDate: today, html: "<p>report</p>" });
  });

  // Omar 2026-11-08: he never edits the draft — he returns it to review with a reason.
  it("returns the draft to review with a required reason", async () => {
    vi.spyOn(window, "prompt").mockReturnValue("صحّح وصف الموقع");
    api.returnReportDraftToReviewer.mockResolvedValue({ ok: true, data: draft({ status: "preparing" }) });
    renderBar(draft());

    fireEvent.click(screen.getByRole("button", { name: "إرجاع للمراجع" }));

    await waitFor(() =>
      expect(api.returnReportDraftToReviewer).toHaveBeenCalledWith({ token: "t" }, "vr-1", "صحّح وصف الموقع"),
    );
    await waitFor(() => expect(toast.showToast).toHaveBeenCalledWith("أُعيدت المسودة للمراجع", "success"));
  });

  it("a refused approval lists every blocker in a panel that stays (round 2)", async () => {
    api.ensureReportNumber.mockResolvedValue({ ok: true, data: { valuationRequestId: "vr-1", reportNumber: "PRV-2026-00007" } });
    api.approveReportDraft.mockResolvedValue({
      ok: false,
      kind: "validation",
      message: "المسح الهندسي غير مرفوع",
      errors: { survey: "المسح الهندسي غير مرفوع", deed: "مطابقة الصك للطبيعة لم تُحسم" },
    });
    renderBar(draft({ status: "sent" }));
    fireEvent.click(screen.getByRole("button", { name: "اعتماد التقرير" }));
    const panel = await screen.findByTestId("report-approval-refusal");
    expect(panel.textContent).toContain("تعذّر اعتماد التقرير");
    expect(panel.textContent).toContain("المسح الهندسي غير مرفوع");
    expect(panel.textContent).toContain("مطابقة الصك للطبيعة لم تُحسم");
    expect(panel.querySelectorAll("li")).toHaveLength(2);
  });

  it("a double-click on «اعتماد التقرير» asks once and approves once", async () => {
    api.ensureReportNumber.mockResolvedValue({ ok: true, data: { valuationRequestId: "vr-1", reportNumber: "PRV-2026-00007" } });
    api.approveReportDraft.mockResolvedValue({ ok: true, data: draft({ status: "approved", reportStage: "deposit_issued" }) });
    const confirm = vi.spyOn(window, "confirm").mockReturnValue(true);
    renderBar(draft({ status: "sent" }));

    const button = screen.getByRole("button", { name: "اعتماد التقرير" });
    fireEvent.click(button, { detail: 1 });
    fireEvent.click(button, { detail: 2 });

    await waitFor(() => expect(api.approveReportDraft).toHaveBeenCalledTimes(1));
    expect(confirm).toHaveBeenCalledTimes(1);
  });

  it("does nothing when the appraiser does not confirm the approval", async () => {
    vi.spyOn(window, "confirm").mockReturnValue(false);
    renderBar(draft({ status: "sent" }));

    fireEvent.click(screen.getByRole("button", { name: "اعتماد التقرير" }));

    await Promise.resolve();
    expect(api.approveReportDraft).not.toHaveBeenCalled();
  });

  it("stops before building the copy when the report number cannot be fixed", async () => {
    api.ensureReportNumber.mockResolvedValue({ ok: false, kind: "validation", message: "تعذّر تثبيت رقم التقرير من خدمة دراسة الحالة" });
    const { buildApprovedHtml } = renderBar(draft({ status: "sent" }));

    fireEvent.click(screen.getByRole("button", { name: "اعتماد التقرير" }));

    await waitFor(() => expect(toast.showToast).toHaveBeenCalledWith("تعذّر تثبيت رقم التقرير من خدمة دراسة الحالة", "error"));
    expect(buildApprovedHtml).not.toHaveBeenCalled();
    expect(api.approveReportDraft).not.toHaveBeenCalled();
  });

  it("reports a refused approval without changing the draft", async () => {
    api.ensureReportNumber.mockResolvedValue({ ok: true, data: { valuationRequestId: "vr-1", reportNumber: "PRV-2026-00007" } });
    api.approveReportDraft.mockResolvedValue({ ok: false, kind: "validation", message: "تاريخ الاعتماد غير صحيح" });
    renderBar(draft({ status: "sent" }));

    fireEvent.click(screen.getByRole("button", { name: "اعتماد التقرير" }));

    await waitFor(() => expect(toast.showToast).toHaveBeenCalledWith("تاريخ الاعتماد غير صحيح", "error"));
  });

  describe("after approval — the specialist deposits", () => {
    const approved = () => draft({ status: "approved", reportStage: "deposit_issued", reportDate: "2026-10-05" });

    it("says the specialist deposits the report and asks him for no code or certificate", () => {
      renderBar(approved());

      expect(screen.getByTestId("report-awaiting-deposit").textContent).toContain("يودعه المراجع في «قيمة»");
      expect(screen.queryByPlaceholderText("رمز الإيداع")).toBeNull();
      expect(document.querySelector('input[type="file"]')).toBeNull();
      expect(screen.queryByRole("button", { name: /تسجيل رمز الإيداع/ })).toBeNull();
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

    it("shows the recorded code without offering to change it", () => {
      renderBar(issued());

      expect(screen.getByTestId("report-final-issued").textContent).toContain("QYM-1");
      expect(screen.queryByRole("button", { name: "تعديل رمز الإيداع" })).toBeNull();
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

    expect(screen.getByText(/ملف التقرير النهائي قيد الإعداد/)).toBeTruthy();
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
