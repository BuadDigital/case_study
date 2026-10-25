import { describe, expect, it } from "vitest";
import type {
  ValuationCostApproachDto,
  ValuationCostLineDto,
} from "@platform/api-client";
import {
  buildCostAlerts,
  costApproachDerived,
  costFieldsFromDto,
  costInt,
  costLineTotals,
  costNumericInput,
  costSaveRequest,
  EMPTY_COST_FIELDS,
} from "../cost-approach-state";
import { INDIRECT_COST_ITEMS } from "../cost-line-math";

function cost(
  extra: Partial<ValuationCostApproachDto> = {},
): ValuationCostApproachDto {
  return {
    valuationRequestId: "vr",
    propertyId: "p",
    landUnitRateFromMarket: 0,
    landAreaSqm: 0,
    landValueFromMarket: 0,
    landUnitRateAfterDiscount: 0,
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
  };
}

function line(extra: Partial<ValuationCostLineDto>): ValuationCostLineDto {
  return {
    id: "l1",
    structureKind: "floor",
    itemKey: "ground_floor",
    itemLabelAr: "",
    label: "",
    areaSqm: 100,
    unit: "sqm",
    unitLabelAr: "م²",
    unitCostSar: 1000,
    lineTotal: 0,
    rationale: "",
    isIncluded: true,
    sortOrder: 0,
    ...extra,
  };
}

describe("O10 — deliberate zeros survive a save and reload", () => {
  it("a saved cost row with every indirect at 0 and no financing reloads as zeros, not 3/15/5/18", () => {
    const fields = costFieldsFromDto(
      cost({
        isSaved: true,
        indirectItems: INDIRECT_COST_ITEMS.map((item, i) => ({
          itemKey: item.key,
          labelAr: item.label,
          pct: 0,
          amount: 0,
          sortOrder: i,
        })),
        financingAnnualRatePct: 0,
        financingMonths: 0,
        actualAgeYears: 15,
        economicAgeYears: 40,
      }),
    );
    for (const item of INDIRECT_COST_ITEMS) {
      expect(fields.indirectDraft[item.key]?.pct).toBe("0");
    }
    expect(fields.financingRate).toBe("0");
    expect(fields.financingMonths).toBe("0");
  });

  it("a never-saved row still starts from the interactive-form defaults", () => {
    const fields = costFieldsFromDto(cost({ isSaved: false }));
    expect(fields.indirectDraft.developer_profit?.pct).toBe("15");
    expect(fields.financingRate).toBe("5");
    expect(fields.financingMonths).toBe("18");
  });

  it("the save sends all six indirect items, zeros included", () => {
    const fields = {
      ...EMPTY_COST_FIELDS,
      indirectDraft: Object.fromEntries(
        INDIRECT_COST_ITEMS.map((i) => [i.key, { pct: "0", rationale: "" }]),
      ),
      financingRate: "0",
      financingMonths: "0",
    };
    const body = costSaveRequest(fields, []);
    expect(body.indirectItems.map((i) => i.itemKey)).toEqual(
      INDIRECT_COST_ITEMS.map((i) => i.key),
    );
    expect(body.indirectItems.every((i) => i.pct === 0)).toBe(true);
    expect(body.financingAnnualRatePct).toBe(0);
    expect(body.financingMonths).toBe(0);
  });
});

describe("O10 — actual and economic age rationales are saved and reloaded", () => {
  it("goes out in the save body and comes back from the DTO", () => {
    const body = costSaveRequest(
      {
        ...EMPTY_COST_FIELDS,
        actualAgeRationale: " رخصة البناء 1432هـ ",
        economicAgeRationale: "مبنى خرساني",
      },
      [],
    );
    expect(body.actualAgeRationale).toBe("رخصة البناء 1432هـ");
    expect(body.economicAgeRationale).toBe("مبنى خرساني");

    const fields = costFieldsFromDto(
      cost({
        isSaved: true,
        actualAgeRationale: "رخصة البناء 1432هـ",
        economicAgeRationale: "مبنى خرساني",
      }),
    );
    expect(fields.actualAgeRationale).toBe("رخصة البناء 1432هـ");
    expect(fields.economicAgeRationale).toBe("مبنى خرساني");
  });
});

describe("O11 — Arabic-Indic digits in cost number boxes", () => {
  it("keeps the typed number in Latin digits", () => {
    expect(costNumericInput("١٥")).toBe("15");
    expect(costNumericInput("٢٫٥")).toBe("2.5");
    expect(costNumericInput("۱۸")).toBe("18");
    expect(costNumericInput("1.2.3")).toBe("1.23");
    expect(costNumericInput("١٨ شهر", true)).toBe("18");
  });

  it("parses Arabic digits for months and the financing derivation", () => {
    expect(costInt("١٨")).toBe(18);
    const derived = costApproachDerived(
      {
        ...EMPTY_COST_FIELDS,
        indirectDraft: {},
        financingRate: "٦",
        financingMonths: "١٢",
      },
      1000,
      null,
      false,
    );
    expect(derived.financingPctLocal).toBeCloseTo(3);
  });
});

describe("D12 — depreciation capped at 100%, alert above 90%", () => {
  const ages = (actual: string, functional: string) => ({
    ...EMPTY_COST_FIELDS,
    indirectDraft: {},
    financingRate: "0",
    financingMonths: "0",
    actualAge: actual,
    economicAge: "40",
    functionalObs: functional,
  });

  it("an obsolescence over 100% depreciates the whole cost and the buildings floor at 0", () => {
    const derived = costApproachDerived(ages("40", "20"), 1_000_000, null, false);
    expect(derived.totalDepLocal).toBeCloseTo(120);
    expect(derived.depValueLocal).toBeCloseTo(1_000_000);
    expect(derived.netValueLocal).toBe(0);
  });

  it("warns between 90% and 100%", () => {
    const fields = ages("38", "0"); // 95%
    const derived = costApproachDerived(fields, 1_000_000, null, false);
    const alerts = buildCostAlerts(fields, [], { firstFloorLine: null }, derived, true);
    expect(alerts.some((a) => a.title.includes("90٪"))).toBe(true);
    const low = ages("20", "0");
    const lowAlerts = buildCostAlerts(
      low,
      [],
      { firstFloorLine: null },
      costApproachDerived(low, 1_000_000, null, false),
      true,
    );
    expect(lowAlerts.some((a) => a.title.includes("90٪"))).toBe(false);
  });
});

describe("D11 — building-only on leased land caps the life at the lease", () => {
  it("measures physical depreciation against actual age + remaining lease", () => {
    const derived = costApproachDerived(
      { ...EMPTY_COST_FIELDS, actualAge: "15", economicAge: "40" },
      0,
      cost({ remainingLeaseYears: 10 }),
      true,
    );
    expect(derived.effectiveLifeLocal).toBe(25);
    expect(derived.physicalLocal).toBeCloseTo(60);
  });

  it("leaves the life alone without a lease term", () => {
    const derived = costApproachDerived(
      { ...EMPTY_COST_FIELDS, actualAge: "15", economicAge: "40" },
      0,
      cost(),
      true,
    );
    expect(derived.effectiveLifeLocal).toBe(40);
  });
});

describe("Problem 6 — repeated floors need a floor count", () => {
  it("raises an error alert when the count is missing", () => {
    const draft = [
      line({ id: "f1", itemKey: "first_floor", areaSqm: 600 }),
      line({ id: "r", itemKey: "repeated_floors", areaSqm: 600, repeatedFloorCount: null }),
    ];
    const totals = costLineTotals(draft);
    const alerts = buildCostAlerts(
      EMPTY_COST_FIELDS,
      draft,
      totals,
      costApproachDerived(EMPTY_COST_FIELDS, totals.directTotal, null, true),
      true,
    );
    const alert = alerts.find((a) => a.title === "عدد الأدوار المتكررة مطلوب");
    expect(alert?.targetId).toBe("cost-line-1-repeatedFloorCount");
  });

  it("is quiet once a count is entered", () => {
    const draft = [
      line({ id: "f1", itemKey: "first_floor", areaSqm: 600 }),
      line({ id: "r", itemKey: "repeated_floors", repeatedFloorCount: 2 }),
    ];
    const totals = costLineTotals(draft);
    const alerts = buildCostAlerts(
      EMPTY_COST_FIELDS,
      draft,
      totals,
      costApproachDerived(EMPTY_COST_FIELDS, totals.directTotal, null, true),
      true,
    );
    expect(alerts.some((a) => a.title === "عدد الأدوار المتكررة مطلوب")).toBe(false);
  });
});
