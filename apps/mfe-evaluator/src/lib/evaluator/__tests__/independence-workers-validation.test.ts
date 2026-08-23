import { describe, expect, it } from "vitest";
import { validateEvaluatorSubmission } from "../evaluator-validation";
import { normalizeReportWorkers } from "../evaluator-window-data";

describe("validateEvaluatorSubmission", () => {
  const base = {
    taskId: "t1",
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

  it("does not require an uploaded report file or typed report number", () => {
    const errors = validateEvaluatorSubmission({
      ...base,
      assetDataConfirmed: true,
    });
    expect(errors.report_no).toBeUndefined();
    expect(errors.evaluator_report_file).toBeUndefined();
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

  it("does not require independence or named workers after infath tab removal", () => {
    const errors = validateEvaluatorSubmission({
      ...base,
      assetDataConfirmed: true,
      independenceDeclared: false,
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
    expect(errors.independence_declared).toBeUndefined();
    expect(errors.report_workers).toBeUndefined();
  });
});

describe("normalizeReportWorkers", () => {
  it("assigns unique ids when they are missing or duplicated", () => {
    const workers = normalizeReportWorkers([
      { role: "معد", name: "أ" },
      { id: "dup", role: "مراجع", name: "ب" },
      { id: "dup", role: "معتمد", name: "ج" },
    ]);
    const ids = workers.map((w) => w.id);
    expect(ids).toHaveLength(3);
    expect(new Set(ids).size).toBe(3);
    expect(ids.every((id) => id.length > 0)).toBe(true);
  });
});
