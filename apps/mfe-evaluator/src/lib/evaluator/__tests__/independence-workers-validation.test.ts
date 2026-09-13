import { describe, expect, it } from "vitest";
import {
  firstEvaluatorErrorTarget,
  evaluatorWorkScreenForErrorTarget,
  validateEvaluatorSubmission,
} from "../evaluator-validation";
import {
  emptyReportChoices,
  normalizeReportWorkers,
} from "../evaluator-window-data";

describe("validateEvaluatorSubmission", () => {
  const base = {
    taskId: "t1",
    evaluatorPrice: "1000",
    landValue: "1000",
    buildingValue: "0",
    forcedSaleDiscountPct: "15",
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
    });
    expect(errors.report_no).toBeUndefined();
    expect(errors.evaluator_report_file).toBeUndefined();
  });

  it("does not require asset data confirmation", () => {
    const errors = validateEvaluatorSubmission({
      ...base,
      assetDataConfirmed: false,
      assetDataVarianceNotes: "",
    });
    expect(errors.asset_data_confirmed).toBeUndefined();
  });

  it("does not require liquidation discount unless value basis is liquidation", () => {
    const errors = validateEvaluatorSubmission({
      ...base,
      forcedSaleDiscountPct: "",
      valueBasisKey: "market",
    });
    expect(errors.forced_sale_discount).toBeUndefined();
  });

  it("requires liquidation discount when value basis is liquidation", () => {
    const errors = validateEvaluatorSubmission({
      ...base,
      forcedSaleDiscountPct: "",
      valueBasisKey: "liquidation",
    });
    expect(errors.forced_sale_discount).toBeTruthy();
  });

  it("requires a retrospective date when valuation date mode is retrospective", () => {
    const errors = validateEvaluatorSubmission({
      ...base,
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
      retrospective: {
        mode: "retrospective",
        kind: "range",
        date: "2024-01-01",
        dateEnd: "",
      },
    });
    expect(errors.retrospective_date_to).toBe("حدّد تاريخ نهاية الفترة");
  });

  it("requires ESG impact notes when «يوجد تأثير» is checked", () => {
    const errors = validateEvaluatorSubmission({
      ...base,
      reportChoices: {
        ...emptyReportChoices(),
        esgEnv: {
          none: false,
          selected: [],
          notes: "",
        },
      },
    });
    expect(errors.esg_impact_notes).toBeTruthy();
  });

  it("passes ESG when impact notes are filled", () => {
    const errors = validateEvaluatorSubmission({
      ...base,
      reportChoices: {
        ...emptyReportChoices(),
        esgEnv: {
          none: false,
          selected: [],
          notes: "قرب موقع صناعي يؤثر على الطلب.",
        },
      },
    });
    expect(errors.esg_impact_notes).toBeUndefined();
  });

  it("requires independence declaration", () => {
    const errors = validateEvaluatorSubmission({
      ...base,
      independenceDeclared: false,
    });
    expect(errors.independence_declared).toBe(
      "يجب تأكيد إقرار الاستقلالية وعدم تضارب المصالح.",
    );
  });

  it("requires at least one named report worker", () => {
    const errors = validateEvaluatorSubmission({
      ...base,
      reportWorkers: [
        {
          id: "w1",
          role: "معد",
          name: "   ",
          licenseNumber: "",
          licenseDate: "",
          licenseFileName: null,
        },
      ],
    });
    expect(errors.report_workers).toBe(
      "أضف عاملاً واحداً على الأقل على التقرير (الدور والاسم).",
    );
  });

  it("passes when independence is confirmed and a worker is named", () => {
    const errors = validateEvaluatorSubmission({ ...base });
    expect(errors.independence_declared).toBeUndefined();
    expect(errors.report_workers).toBeUndefined();
  });
});

describe("firstEvaluatorErrorTarget", () => {
  it("points value errors at the final-opinion tab", () => {
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
    expect(evaluatorWorkScreenForErrorTarget("inf-land")).toBe("final");
    expect(evaluatorWorkScreenForErrorTarget("inf-building")).toBe("final");
    expect(evaluatorWorkScreenForErrorTarget("final-inf-total")).toBe("final");
    expect(evaluatorWorkScreenForErrorTarget("final-inf-discount")).toBe(
      "final",
    );
    expect(evaluatorWorkScreenForErrorTarget("val-esg")).toBe("review");
  });

  it("points independence and workers errors at the review screen", () => {
    expect(
      firstEvaluatorErrorTarget({
        independence_declared: "مطلوب",
      }),
    ).toBe("inf-independence");
    expect(
      firstEvaluatorErrorTarget({
        report_workers: "مطلوب",
      }),
    ).toBe("inf-workers");
    expect(evaluatorWorkScreenForErrorTarget("inf-independence")).toBe(
      "review",
    );
    expect(evaluatorWorkScreenForErrorTarget("inf-workers")).toBe("review");
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
