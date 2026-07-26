import { describe, expect, it, vi } from "vitest";
import { validateEvaluatorSubmission } from "../evaluator-validation";
import { createEmptyReportWorker } from "../evaluator-window-data";

vi.mock("../evaluator-report-attachments", () => ({
  getCachedEvaluatorReport: () => ({
    dataUrl: "data:application/pdf;base64,abc",
    fileName: "report.pdf",
  }),
}));

describe("validateEvaluatorSubmission — independence & workers", () => {
  const base = {
    taskId: "t1",
    evaluatorPrice: "1000",
    landValue: "1000",
    buildingValue: "0",
    forcedSaleDiscountPct: "20",
  };

  it("requires independence declaration", () => {
    const errors = validateEvaluatorSubmission({
      ...base,
      independenceDeclared: false,
      reportWorkers: [
        { ...createEmptyReportWorker("معد"), name: "أحمد", licenseNumber: "1" },
      ],
    });
    expect(errors.independence_declared).toBeTruthy();
  });

  it("requires at least one named worker with license", () => {
    const errors = validateEvaluatorSubmission({
      ...base,
      independenceDeclared: true,
      reportWorkers: [createEmptyReportWorker("معد")],
    });
    expect(errors.report_workers).toBeTruthy();
  });

  it("passes when independence and worker are complete", () => {
    const errors = validateEvaluatorSubmission({
      ...base,
      independenceDeclared: true,
      reportWorkers: [
        {
          ...createEmptyReportWorker("معد"),
          name: "أحمد العتيبي",
          licenseNumber: "12345",
        },
      ],
    });
    expect(errors.independence_declared).toBeUndefined();
    expect(errors.report_workers).toBeUndefined();
  });
});
