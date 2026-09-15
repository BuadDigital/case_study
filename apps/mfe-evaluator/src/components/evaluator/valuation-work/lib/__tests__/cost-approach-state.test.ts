import { describe, expect, it } from "vitest";
import type { ValuationCostApproachDto } from "@platform/api-client";
import {
  buildCostNarrative,
  costApproachDerived,
  costFieldsFromDto,
  EMPTY_COST_FIELDS,
  inspectorAgeYearsForCostField,
} from "../cost-approach-state";

function cost(
  extra: Partial<ValuationCostApproachDto> = {},
): ValuationCostApproachDto {
  return {
    landUnitRateFromMarket: 0,
    landAreaSqm: 0,
    landValueFromMarket: 0,
    useRestrictionDiscountPct: 0,
    landEstimateComplete: false,
    directCostTotal: 0,
    indirectItems: [],
    financingAnnualRatePct: 0,
    financingMonths: 0,
    financingPct: 0,
    indirectRatesSumPct: 0,
    totalCostWithIndirect: 0,
    lifeExtensionYears: 0,
    functionalObsolescencePct: 0,
    externalObsolescencePct: 0,
    extendedLifeYears: 0,
    totalObsolescencePct: 0,
    depreciationValue: 0,
    buildingsValueAfterDepreciation: 0,
    costOpinionWithLand: 0,
    costOpinionBuildingsOnly: 0,
    lines: [],
    ...extra,
  } as ValuationCostApproachDto;
}

describe("inspectorAgeYearsForCostField", () => {
  it("returns empty when missing or non-numeric", () => {
    expect(inspectorAgeYearsForCostField(undefined)).toBe("");
    expect(inspectorAgeYearsForCostField("")).toBe("");
    expect(inspectorAgeYearsForCostField("غير محدد")).toBe("");
  });

  it("keeps a latin number and converts eastern arabic digits", () => {
    expect(inspectorAgeYearsForCostField("12")).toBe("12");
    expect(inspectorAgeYearsForCostField("  ١٥ ")).toBe("15");
    expect(inspectorAgeYearsForCostField("10 سنوات")).toBe("10");
  });
});

describe("costFieldsFromDto actual age", () => {
  it("prefers the saved cost actual age over the inspector age", () => {
    expect(costFieldsFromDto(cost({ actualAgeYears: 8 }), "12").actualAge).toBe(
      "8",
    );
  });

  it("fills actual age from the inspector when the cost row has none", () => {
    expect(costFieldsFromDto(cost({ actualAgeYears: null }), "12").actualAge).toBe(
      "12",
    );
  });

  it("seeds the interactive-form starter numbers when the cost row is empty", () => {
    const fields = costFieldsFromDto(cost());
    expect(fields.actualAge).toBe("10");
    expect(fields.economicAge).toBe("40");
    expect(fields.financingRate).toBe("5");
    expect(fields.financingMonths).toBe("18");
    expect(fields.indirectDraft.design_supervision?.pct).toBe("3");
    expect(fields.indirectDraft.developer_profit?.pct).toBe("15");
  });

  it("keeps saved financing and indirect percentages", () => {
    const fields = costFieldsFromDto(
      cost({
        financingAnnualRatePct: 7,
        financingMonths: 12,
        economicAgeYears: 50,
        indirectItems: [
          {
            itemKey: "developer_profit",
            labelAr: "أرباح المطور والمخاطرة",
            pct: 20,
            amount: 0,
            sortOrder: 0,
          },
        ],
      }),
    );
    expect(fields.financingRate).toBe("7");
    expect(fields.financingMonths).toBe("12");
    expect(fields.economicAge).toBe("50");
    expect(fields.indirectDraft.developer_profit?.pct).toBe("20");
    expect(fields.indirectDraft.design_supervision).toBeUndefined();
  });
});

describe("costApproachDerived age / depreciation", () => {
  it("computes physical and total obsolescence live (extended life = economic + extension)", () => {
    const derived = costApproachDerived(
      {
        ...EMPTY_COST_FIELDS,
        indirectDraft: {},
        financingRate: "0",
        financingMonths: "0",
        actualAge: "15",
        economicAge: "40",
        lifeExtension: "2",
        functionalObs: "10",
        externalObs: "10",
      },
      1_000_000,
      null,
      false,
    );
    expect(derived.extLifeLocal).toBe(42);
    expect(derived.physicalLocal).toBeCloseTo((15 / 42) * 100);
    expect(derived.totalDepLocal).toBeCloseTo((15 / 42) * 100 + 20);
    expect(derived.depValueLocal).toBeCloseTo(
      1_000_000 * derived.totalDepLocal / 100,
    );
    expect(derived.netValueLocal).toBeCloseTo(
      1_000_000 - derived.depValueLocal,
    );
  });

  it("leaves physical at zero until actual age and extended life are both present", () => {
    const derived = costApproachDerived(
      {
        ...EMPTY_COST_FIELDS,
        actualAge: "15",
        economicAge: "",
        lifeExtension: "0",
      },
      0,
      null,
      false,
    );
    expect(derived.physicalLocal).toBe(0);
    expect(derived.totalDepLocal).toBe(0);
  });
});

describe("buildCostNarrative", () => {
  it("omits لم يتم تبريره and empty justification lines until they are written", () => {
    const text = buildCostNarrative(EMPTY_COST_FIELDS, [], "replacement");
    expect(text).not.toContain("لم يتم تبريره");
    expect(text).not.toContain("مبررات بنود التكلفة");
    expect(text).not.toContain("مبررات العمر والتقادم");
    expect(text).not.toContain("مخصص الطوارئ");
    expect(text).toContain("طريقة التكلفة: الإحلال.");
    expect(text).toContain("التمويل — معدل 5٪ سنوياً على 18 شهراً");
  });

  it("lists a line only after its justification is written", () => {
    const text = buildCostNarrative(
      {
        ...EMPTY_COST_FIELDS,
        indirectDraft: {
          ...EMPTY_COST_FIELDS.indirectDraft,
          contingency: { pct: "3", rationale: "نقص معلومات التنفيذ" },
        },
        actualAgeRationale: "من المعاينة",
      },
      [
        {
          id: "c1",
          structureKind: "floor",
          itemKey: "ground_floor",
          itemLabelAr: "الدور الأرضي",
          label: "الدور الأرضي",
          areaSqm: 200,
          unit: "sqm",
          unitLabelAr: "م²",
          unitCostSar: 0,
          lineTotal: 0,
          rationale: "سعر مقاول الحي",
          isIncluded: true,
          sortOrder: 0,
        },
      ],
      "reproduction",
    );
    expect(text).toContain("طريقة التكلفة: إعادة الإنتاج.");
    expect(text).toContain("• الدور الأرضي — سعر مقاول الحي");
    expect(text).toContain("• مخصص الطوارئ (3٪) — نقص معلومات التنفيذ");
    expect(text).toContain("• العمر الفعلي (10) — من المعاينة");
    expect(text).not.toContain("لم يتم تبريره");
    expect(text).not.toContain("أرباح المطور");
    expect(text).not.toContain("العمر الاقتصادي");
  });
});
