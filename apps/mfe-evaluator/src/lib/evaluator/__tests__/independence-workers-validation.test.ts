import { describe, expect, it } from "vitest";
import {
  firstEvaluatorErrorTarget,
  evaluatorWorkScreenForErrorTarget,
  validateEvaluatorSubmission,
} from "../evaluator-validation";
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

  it("does not require liquidation discount unless value basis is liquidation", () => {
    const errors = validateEvaluatorSubmission({
      ...base,
      forcedSaleDiscountPct: "",
      valueBasisKey: "market",
      assetDataConfirmed: true,
    });
    expect(errors.forced_sale_discount).toBeUndefined();
  });

  it("requires liquidation discount when value basis is liquidation", () => {
    const errors = validateEvaluatorSubmission({
      ...base,
      forcedSaleDiscountPct: "",
      valueBasisKey: "liquidation",
      assetDataConfirmed: true,
    });
    expect(errors.forced_sale_discount).toBeTruthy();
  });

  it("requires a retrospective date when valuation date mode is retrospective", () => {
    const errors = validateEvaluatorSubmission({
      ...base,
      assetDataConfirmed: true,
      retrospective: {
        mode: "retrospective",
        kind: "single",
        date: "",
        dateEnd: "",
      },
    });
    expect(errors.retrospective_date).toBe("تاريخ الأثر الرجعي إلزامي");
  });

  it("requires the period end when retrospective range is selected", () => {
    const errors = validateEvaluatorSubmission({
      ...base,
      assetDataConfirmed: true,
      retrospective: {
        mode: "retrospective",
        kind: "range",
        date: "2024-01-01",
        dateEnd: "",
      },
    });
    expect(errors.retrospective_date_to).toBe("حدّد تاريخ نهاية الفترة");
  });
});

describe("firstEvaluatorErrorTarget", () => {
  it("points value errors at the final-opinion tab and asset review at send", () => {
    expect(
      firstEvaluatorErrorTarget({
        evaluator_price: "مطلوب",
      }),
    ).toBe("final-inf-total");
    expect(
      firstEvaluatorErrorTarget({
        forced_sale_discount: "مطلوب",
      }),
    ).toBe("final-inf-discount");
    expect(
      firstEvaluatorErrorTarget({
        asset_data_confirmed: "أكّد المراجعة",
      }),
    ).toBe("val-asset-data");
    expect(evaluatorWorkScreenForErrorTarget("inf-land")).toBe("final");
    expect(evaluatorWorkScreenForErrorTarget("inf-building")).toBe("final");
    expect(evaluatorWorkScreenForErrorTarget("final-inf-total")).toBe("final");
    expect(evaluatorWorkScreenForErrorTarget("final-inf-discount")).toBe(
      "final",
    );
    expect(evaluatorWorkScreenForErrorTarget("val-asset-data")).toBe("review");
  });

  it("opens basics and focuses the missing retrospective date", () => {
    expect(
      firstEvaluatorErrorTarget({
        retrospective_date: "تاريخ الأثر الرجعي إلزامي",
        evaluator_price: "مطلوب",
      }),
    ).toBe("as-retro-date");
    expect(
      firstEvaluatorErrorTarget({
        retrospective_date_from: "تاريخ الأثر الرجعي إلزامي",
      }),
    ).toBe("as-retro-date-from");
    expect(
      firstEvaluatorErrorTarget({
        retrospective_date_to: "حدّد تاريخ نهاية الفترة",
      }),
    ).toBe("as-retro-date-to");
    expect(evaluatorWorkScreenForErrorTarget("as-retro-date")).toBe("basic");
    expect(evaluatorWorkScreenForErrorTarget("as-retro-date-from")).toBe(
      "basic",
    );
    expect(evaluatorWorkScreenForErrorTarget("as-retro-date-to")).toBe("basic");
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
