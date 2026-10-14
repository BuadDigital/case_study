import { describe, expect, it } from "vitest";
import {
  firstValuationWorkError,
  normalizeValuationWorkErrors,
  valuationWorkErrorMessage,
  VALUATION_WORK_ERROR_TARGETS,
} from "../valuation-work-error-targets";

describe("normalizeValuationWorkErrors", () => {
  it("keeps the services' flat camelCase map", () => {
    expect(
      normalizeValuationWorkErrors({
        methodsRationale: "مبرر استخدام طرق التقييم مطلوب",
      }),
    ).toEqual({ methodsRationale: "مبرر استخدام طرق التقييم مطلوب" });
  });

  it("flattens model state: Pascal keys and message arrays", () => {
    expect(
      normalizeValuationWorkErrors({
        MethodsRationale: ["مبرر استخدام طرق التقييم مطلوب", "آخر"],
      }),
    ).toEqual({ methodsRationale: "مبرر استخدام طرق التقييم مطلوب" });
  });

  it("keeps the index of an indexed key and camelCases each segment", () => {
    expect(
      normalizeValuationWorkErrors({ "Lines[2].UnitCostSar": ["خطأ"] }),
    ).toEqual({ "lines[2].unitCostSar": "خطأ" });
  });

  it("drops empty messages and a missing map", () => {
    expect(normalizeValuationWorkErrors({ a: "", b: [] })).toEqual({});
    expect(normalizeValuationWorkErrors(null)).toEqual({});
  });
});

describe("firstValuationWorkError", () => {
  it("points the required rationale at its own field on رأي القيمة النهائي", () => {
    const first = firstValuationWorkError({
      methodsRationale: "مبرر استخدام طرق التقييم مطلوب",
    });
    expect(first).toMatchObject({
      targetId: "final-methods-rationale",
      screen: "final",
    });
  });

  it("resolves an indexed key to its row control, with the table as fallback", () => {
    expect(
      firstValuationWorkError({ "lines[3].unitCostSar": "تكلفة الوحدة" }),
    ).toMatchObject({
      targetId: "cost-line-3-unitCostSar",
      fallbackTargetId: "cost-lines",
      screen: "cost",
    });
    expect(
      firstValuationWorkError({ "methods[1].weightPct": "النسبة" }),
    ).toMatchObject({
      targetId: "final-method-weight-1",
      fallbackTargetId: "final-recon",
      screen: "final",
    });
  });

  it("takes the earliest field in registry order when a save fails on several", () => {
    const first = firstValuationWorkError({
      methodsRationale: "مبرر",
      retrospectiveDate: "تاريخ الأثر الرجعي إلزامي",
    });
    expect(first).toMatchObject({ screen: "basic", targetId: "as-retro-date" });
  });

  it("has no target for a key the registry does not know", () => {
    expect(firstValuationWorkError({ somethingElse: "خطأ" })).toBeNull();
  });
});

describe("valuationWorkErrorMessage", () => {
  it("prefers a targeted message, then any message", () => {
    expect(
      valuationWorkErrorMessage({ zzz: "عام", methodsRationale: "مبرر" }),
    ).toBe("مبرر");
    expect(valuationWorkErrorMessage({ zzz: "عام" })).toBe("عام");
    expect(valuationWorkErrorMessage({})).toBeNull();
  });
});

describe("the registry itself", () => {
  it("has no duplicate keys", () => {
    const keys = VALUATION_WORK_ERROR_TARGETS.map((t) => t.key);
    expect(new Set(keys).size).toBe(keys.length);
  });

  it("gives every indexed key an indexed target id", () => {
    for (const target of VALUATION_WORK_ERROR_TARGETS) {
      if (!target.key.includes("[]")) continue;
      if (target.targetId.includes("{i}")) continue;
      // A request that drops rows cannot map an index back to a row — those
      // point at the card instead, and must not carry a stale `{i}`.
      expect(target.targetId).not.toContain("{i}");
    }
  });
});
