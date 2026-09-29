import { describe, expect, it } from "vitest";
import type { ValuationReconciliationMethodDto } from "@platform/api-client";
import {
  analysesForRationale,
  appendAnalysesToRationale,
  finalOpinionComputed,
  forcedSaleDiscountOpinionLine,
  looksLikeAutoFinalOpinion,
  normalizeReconMethodsForSave,
  reconciliationSaveRequest,
  syncDiscountLineInOpinion,
  workOrderPremiseKey,
} from "../final-opinion-state";

function method(
  partial: Partial<ValuationReconciliationMethodDto>,
): ValuationReconciliationMethodDto {
  return {
    approachKind: "market",
    labelAr: "السوق",
    approachValue: 1_000_000,
    weightPct: 100,
    suggestedWeightPct: 100,
    contributionValue: 1_000_000,
    rationale: "",
    isIncluded: true,
    sortOrder: 0,
    ...partial,
  };
}

function computed(
  reconMethods: ValuationReconciliationMethodDto[],
): ReturnType<typeof finalOpinionComputed> {
  return finalOpinionComputed({
    reconMethods,
    basisOfValueKey: "market",
    basisOptions: [{ value: "market", label: "السوق" }],
    liquidationDiscountPct: "0",
    finalRoundDecimals: "0",
    cost: null,
    buildingOnly: false,
    hasAdoptedMarket: true,
  });
}

describe("finalOpinionComputed", () => {
  it("weights only included methods", () => {
    const result = computed([
      method({
        approachKind: "market",
        approachValue: 1_000_000,
        weightPct: 70,
        isIncluded: true,
      }),
      method({
        approachKind: "cost",
        labelAr: "التكلفة",
        approachValue: 800_000,
        weightPct: 30,
        isIncluded: false,
      }),
    ]);
    expect(result.weightSumLocal).toBe(70);
    expect(result.reconWeightsBad).toBe(true);
    expect(result.weightedLocal).toBe(700_000);
  });

  it("uses the full indicator for a sole method even when weight is 0", () => {
    const result = computed([
      method({ weightPct: 0, isIncluded: false, approachValue: 1_500_000 }),
    ]);
    expect(result.weightedLocal).toBe(1_500_000);
    expect(result.finalLocal).toBe(1_500_000);
  });
});

describe("normalizeReconMethodsForSave", () => {
  it("forces weight 100 and included for a sole method", () => {
    expect(
      normalizeReconMethodsForSave([
        method({ weightPct: 0, isIncluded: false }),
      ]),
    ).toEqual([
      expect.objectContaining({ weightPct: 100, isIncluded: true }),
    ]);
  });

  it("drops inclusion when a method's weight is 0", () => {
    const [market, cost] = normalizeReconMethodsForSave([
      method({ weightPct: 100, isIncluded: true }),
      method({
        approachKind: "cost",
        weightPct: 0,
        isIncluded: true,
      }),
    ]);
    expect(market?.isIncluded).toBe(true);
    expect(cost?.isIncluded).toBe(false);
  });
});

describe("reconciliationSaveRequest", () => {
  it("sends the sole method as 100% included", () => {
    const body = reconciliationSaveRequest({
      reconMethods: [method({ weightPct: 0, isIncluded: false })],
      methodsRationale: "مبرر",
      finalRoundDecimals: "0",
      basisOfValueKey: "market",
      valuePremiseKey: "",
      liquidationDiscountPct: "0",
      liquidationDiscountRationale: "",
      alertOverrides: {},
    });
    expect(body.methods).toEqual([
      expect.objectContaining({
        weightPct: 100,
        isIncluded: true,
      }),
    ]);
  });

  it("sends a 0 discount when the basis is not liquidation", () => {
    const body = reconciliationSaveRequest({
      reconMethods: [method({})],
      methodsRationale: "مبرر",
      finalRoundDecimals: "0",
      basisOfValueKey: "market",
      valuePremiseKey: "",
      liquidationDiscountPct: "15",
      liquidationDiscountRationale: "قديم",
      alertOverrides: {},
    });
    expect(body.liquidationDiscountPct).toBe(0);
    expect(body.liquidationDiscountRationale).toBeNull();
  });

  it("keeps the discount when the basis is liquidation", () => {
    const body = reconciliationSaveRequest({
      reconMethods: [method({})],
      methodsRationale: "مبرر",
      finalRoundDecimals: "0",
      basisOfValueKey: "liquidation",
      valuePremiseKey: "",
      liquidationDiscountPct: "15",
      liquidationDiscountRationale: "بيع قسري",
      alertOverrides: {},
    });
    expect(body.liquidationDiscountPct).toBe(15);
    expect(body.liquidationDiscountRationale).toBe("بيع قسري");
  });
});

describe("workOrderPremiseKey", () => {
  it("reads the work-order selection ahead of a saved reconciliation", () => {
    expect(
      workOrderPremiseKey({
        poPremise: "hau",
        reconPremise: "current",
        assignmentType: "تنفيذ",
      }),
    ).toBe("hau");
  });

  it("falls back to the assignment default when nothing is stored", () => {
    expect(workOrderPremiseKey({ assignmentType: "قطاع خاص" })).toBe("current");
    expect(workOrderPremiseKey({ assignmentType: "تنفيذ" })).toBe("orderly");
  });
});

describe("looksLikeAutoFinalOpinion", () => {
  it("detects the former auto template", () => {
    expect(
      looksLikeAutoFinalOpinion(
        [
          "اعتُمد أسلوب السوق وحده، وقُدّرت القيمة بطريقة المقارنات.",
          "مؤشر أسلوب المقارنة (السوق): 6,437,500 ر.س بوزن ١٠٠٪.",
          "أساس القيمة المستخدم: قيمة التصفية.",
          "الرأي النهائي في قيمة العقار: 5,793,800 ر.س.",
        ].join("\n"),
      ),
    ).toBe(true);
  });

  it("leaves blank or free-form notes alone", () => {
    expect(looksLikeAutoFinalOpinion("")).toBe(false);
    expect(looksLikeAutoFinalOpinion("بناءً على ظروف السوق المحلي.")).toBe(
      false,
    );
  });
});

describe("syncDiscountLineInOpinion", () => {
  const base = [
    "اعتُمد أسلوب السوق وحده. وقُدّرت القيمة بطريقة المقارنات. ولم يجرِ توفيق بين مؤشرات القيمة لاعتماد أسلوب واحد.",
    "مؤشر أسلوب المقارنة (السوق): 1,566,720 ر.س بوزن ١٠٠٪.",
    "أساس القيمة المستخدم: قيمة التصفية.",
    "الرأي النهائي في قيمة العقار: 1,566,720 ر.س.",
  ].join("\n");

  it("inserts a discount line before the basis sentence", () => {
    const next = syncDiscountLineInOpinion(base, 20);
    expect(next).toContain(forcedSaleDiscountOpinionLine(20));
    expect(next.indexOf("طُبِّق")).toBeLessThan(next.indexOf("أساس القيمة"));
  });

  it("replaces an existing discount percentage", () => {
    const with20 = syncDiscountLineInOpinion(base, 20);
    const with15 = syncDiscountLineInOpinion(with20, 15);
    expect(with15).toContain(forcedSaleDiscountOpinionLine(15));
    expect(with15).not.toContain("20٪");
  });

  it("removes the discount line when pct is zero", () => {
    const with20 = syncDiscountLineInOpinion(base, 20);
    const cleared = syncDiscountLineInOpinion(with20, 0);
    expect(cleared).not.toContain("طُبِّق خصم بيع قسري");
    expect(cleared).toContain("أساس القيمة المستخدم");
  });

  it("preserves custom wording around the discount line", () => {
    const custom = [
      "ملاحظة خاصة عن السوق المحلي.",
      forcedSaleDiscountOpinionLine(20),
      "بناءا على مزادات سابقة.",
      "أساس القيمة المستخدم: قيمة التصفية.",
    ].join("\n");
    const next = syncDiscountLineInOpinion(custom, 10);
    expect(next).toContain("ملاحظة خاصة عن السوق المحلي.");
    expect(next).toContain("بناءا على مزادات سابقة.");
    expect(next).toContain(forcedSaleDiscountOpinionLine(10));
    expect(next).not.toContain("20٪");
  });
});

describe("finalOpinionComputed — «مستند ذو قيمة»", () => {
  it("adds document amounts after the discount and rounds the total once", () => {
    const result = finalOpinionComputed({
      reconMethods: [method({ approachValue: 1_234_567 })],
      basisOfValueKey: "liquidation",
      basisOptions: [{ value: "liquidation", label: "قيمة التصفية" }],
      liquidationDiscountPct: "20",
      finalRoundDecimals: "3",
      cost: null,
      buildingOnly: false,
      hasAdoptedMarket: true,
      additions: [{ attachmentId: "a", labelAr: "تقرير تقييم الآلات", value: 12_345.4 }],
    });

    expect(result.propertyAfterDiscount).toBeCloseTo(987_653.6, 1);
    expect(result.additionsTotal).toBe(12_345.4);
    expect(result.finalLocal).toBe(1_000_000);
    expect(result.opinionAuto).toContain("«تقرير تقييم الآلات»");
    expect(result.opinionAuto).toContain("القيمة النهائية الإجمالية:");
    expect(looksLikeAutoFinalOpinion(result.opinionAuto)).toBe(true);
  });

  it("treats a document indicator as complete", () => {
    const result = computed([
      method({ approachKind: "cost", weightPct: 60 }),
      method({ approachKind: "doc:abc", labelAr: "أسلوب الدخل — الطريقة المتبقية (مستند)", weightPct: 40 }),
    ]);
    expect(result.methodComplete("doc:abc")).toBe(true);
  });
});

describe("إدراج التحليلات", () => {
  it("puts each analysis under its heading and skips empty ones", () => {
    expect(analysesForRationale({ market: " سوق ", cost: "" })).toBe("تحليل التسويات:\nسوق");
    expect(analysesForRationale({ market: "سوق", cost: "تكلفة" })).toBe(
      "تحليل التسويات:\nسوق\n\nتحليل التكلفة:\nتكلفة",
    );
    expect(analysesForRationale({})).toBe("");
  });

  it("appends to what the appraiser wrote, never replacing it", () => {
    expect(appendAnalysesToRationale("", "تحليل")).toBe("تحليل");
    expect(appendAnalysesToRationale("رأيي  ", "تحليل")).toBe("رأيي\n\nتحليل");
    expect(appendAnalysesToRationale("رأيي", "  ")).toBe("رأيي");
  });
});

