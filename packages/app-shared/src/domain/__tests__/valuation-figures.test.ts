import { describe, expect, it } from "vitest";
import type {
  ComparablePropertyDto,
  ValuationApproachSettingsDto,
  ValuationComparableSelectionListDto,
  ValuationCostApproachDto,
  ValuationReconciliationDto,
} from "@platform/api-client";
import { NO_VALUATION_FIGURES, districtLandRates, valuationFigures } from "../valuation-figures";

/** Omar 2026-11-11: the navy card under «حالة الأطراف». */

const settings = (over: Partial<ValuationApproachSettingsDto>) =>
  ({ isLandPropertyType: false, costApproachEnabled: true, ...over }) as ValuationApproachSettingsDto;
const cost = (over: Partial<ValuationCostApproachDto>) =>
  ({
    isSaved: true,
    landEstimateComplete: true,
    landUnitRateAfterDiscount: 2600,
    landValueFromMarket: 156000,
    buildingsValueAfterDepreciation: 360000,
    buildingAreaSqm: 180,
    ...over,
  }) as ValuationCostApproachDto;
const recon = (finalOpinionValue: number) => ({ finalOpinionValue }) as ValuationReconciliationDto;
const market = (over: Partial<ValuationComparableSelectionListDto>) =>
  over as ValuationComparableSelectionListDto;

describe("valuationFigures", () => {
  it("reads a built property's land and buildings from the cost approach, its value from the final opinion", () => {
    expect(
      valuationFigures({ settings: settings({}), cost: cost({}), recon: recon(950000), market: null }),
    ).toEqual({
      landRate: 2600,
      landValue: 156000,
      buildingRate: 2000,
      buildingsValue: 360000,
      propertyValue: 950000,
    });
  });

  it("reads a land's value and rate from the market approach", () => {
    expect(
      valuationFigures({
        settings: settings({ isLandPropertyType: true }),
        cost: cost({}),
        recon: recon(1200000),
        market: market({ marketOpinionValue: 1200000, subjectAreaSqm: 600 }),
      }),
    ).toEqual({
      landRate: 2000,
      landValue: 1200000,
      buildingRate: null,
      buildingsValue: null,
      propertyValue: 1200000,
    });
  });

  it("shows nothing that is not the appraiser's work yet", () => {
    // Nothing loaded.
    expect(valuationFigures({ settings: null, cost: null, recon: null, market: null })).toEqual(
      NO_VALUATION_FIGURES,
    );
    // The cost approach not saved yet: the server's starter defaults are not shown as buildings.
    const unsaved = valuationFigures({
      settings: settings({}),
      cost: cost({ isSaved: false }),
      recon: recon(0),
      market: null,
    });
    expect(unsaved).toMatchObject({ landRate: 2600, buildingsValue: null, buildingRate: null, propertyValue: null });
    // Land comparables not weighed yet.
    expect(
      valuationFigures({
        settings: settings({}),
        cost: cost({ landEstimateComplete: false }),
        recon: null,
        market: null,
      }),
    ).toMatchObject({ landRate: null, landValue: null, buildingsValue: 360000 });
    // The cost approach switched off: its stored row is ignored.
    expect(
      valuationFigures({
        settings: settings({ costApproachEnabled: false }),
        cost: cost({}),
        recon: recon(700000),
        market: null,
      }),
    ).toEqual({ ...NO_VALUATION_FIGURES, propertyValue: 700000 });
  });

  it("gives no buildings rate without a built area", () => {
    expect(
      valuationFigures({ settings: settings({}), cost: cost({ buildingAreaSqm: 0 }), recon: null, market: null }),
    ).toMatchObject({ buildingsValue: 360000, buildingRate: null });
  });
});

describe("districtLandRates", () => {
  const comp = (over: Partial<ComparablePropertyDto>) =>
    ({
      isActive: true,
      isExcludedFromSuggestions: false,
      district: "النرجس",
      city: "الرياض",
      comparablePropertyType: "أرض",
      usage: "سكني",
      pricePerSqm: 2000,
      ...over,
    }) as ComparablePropertyDto;
  const place = { district: "النرجس", city: "الرياض" };

  it("averages the district's lands, residential and commercial apart", () => {
    const rates = districtLandRates(
      [
        comp({ pricePerSqm: 2000 }),
        comp({ pricePerSqm: 3000 }),
        comp({ usage: "تجاري", pricePerSqm: 9000 }),
        // The use is read from the type when it is not recorded.
        comp({ usage: "", comparablePropertyType: "أرض سكنية", pricePerSqm: 4000 }),
      ],
      place,
    );
    expect(rates).toEqual({
      residential: { rate: 3000, count: 3 },
      commercial: { rate: 9000, count: 1 },
    });
  });

  it("leaves out what is not the district's land price", () => {
    const rates = districtLandRates(
      [
        comp({ comparablePropertyType: "فيلا", pricePerSqm: 5200 }),
        comp({ district: "الياسمين" }),
        comp({ city: "جدة" }),
        comp({ isExcludedFromSuggestions: true }),
        comp({ isActive: false }),
        comp({ pricePerSqm: 0 }),
        comp({ usage: "سكني تجاري" }),
        comp({ usage: "", comparablePropertyType: "أرض" }),
      ],
      place,
    );
    expect(rates).toEqual({
      residential: { rate: null, count: 0 },
      commercial: { rate: null, count: 0 },
    });
  });

  it("counts a comparable with no city recorded, and gives nothing without a district", () => {
    expect(districtLandRates([comp({ city: null })], place).residential.count).toBe(1);
    expect(districtLandRates([comp({})], { district: " " }).residential.count).toBe(0);
  });
});
