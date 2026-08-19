import { describe, expect, it, vi } from "vitest";
import { validateEvaluatorSubmission } from "../evaluator-validation";

vi.mock("../evaluator-report-attachments", () => ({
  getCachedEvaluatorReport: () => ({
    dataUrl: "data:application/pdf;base64,abc",
    fileName: "report.pdf",
  }),
}));

describe("validateEvaluatorSubmission", () => {
  const base = {
    taskId: "t1",
    reportNo: "RPT-1",
    evaluatorPrice: "1000",
    landValue: "1000",
    buildingValue: "0",
    forcedSaleDiscountPct: "20",
    independenceDeclared: true,
    reportWorkers: [
      {
        id: "w1",
        role: "معد" as const,
        name: "أحمد",
        licenseNumber: "",
        licenseDate: "",
        licenseFileName: null,
      },
    ],
  };

  it("requires report number", () => {
    const errors = validateEvaluatorSubmission({
      ...base,
      reportNo: "",
      assetDataConfirmed: true,
    });
    expect(errors.report_no).toBeTruthy();
  });

  it("requires asset data confirmation or variance notes", () => {
    const errors = validateEvaluatorSubmission({
      ...base,
      assetDataConfirmed: false,
      assetDataVarianceNotes: "",
    });
    expect(errors.asset_data_confirmed).toBeTruthy();
  });

  it("passes asset data check when confirmed without notes", () => {
    const errors = validateEvaluatorSubmission({
      ...base,
      assetDataConfirmed: true,
      assetDataVarianceNotes: "",
    });
    expect(errors.asset_data_confirmed).toBeUndefined();
  });

  it("passes asset data check when not confirmed but variance notes filled", () => {
    const errors = validateEvaluatorSubmission({
      ...base,
      assetDataConfirmed: false,
      assetDataVarianceNotes: "فرق في مساحة البناء عن المعاينة الميدانية.",
    });
    expect(errors.asset_data_confirmed).toBeUndefined();
  });

  it("requires independence declaration", () => {
    const errors = validateEvaluatorSubmission({
      ...base,
      assetDataConfirmed: true,
      independenceDeclared: false,
    });
    expect(errors.independence_declared).toBeTruthy();
  });

  it("requires a named report worker", () => {
    const errors = validateEvaluatorSubmission({
      ...base,
      assetDataConfirmed: true,
      reportWorkers: [
        {
          id: "w1",
          role: "معد",
          name: "  ",
          licenseNumber: "",
          licenseDate: "",
          licenseFileName: null,
        },
      ],
    });
    expect(errors.report_workers).toBeTruthy();
  });
});
