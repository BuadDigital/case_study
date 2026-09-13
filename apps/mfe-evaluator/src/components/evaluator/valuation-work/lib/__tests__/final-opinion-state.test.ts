import { describe, expect, it } from "vitest";
import {
  forcedSaleDiscountOpinionLine,
  syncDiscountLineInOpinion,
  workOrderPremiseKey,
} from "../final-opinion-state";

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
