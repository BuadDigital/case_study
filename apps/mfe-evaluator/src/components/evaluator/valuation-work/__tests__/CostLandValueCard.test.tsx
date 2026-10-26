import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import type {
  ValuationComparableSelectionListDto,
  ValuationCostApproachDto,
} from "@platform/api-client";

import { CostLandValueCard } from "../CostApproachParts";
import { EMPTY_COST_FIELDS } from "../lib/cost-approach-state";
import { matrixBasisView } from "../lib/adjustments-matrix-state";

/** VR-542 after the fix: plot 900 m², share 60 m², rate 3,561.58 → 213,694.80. */
const cost = {
  landUnitRateFromMarket: 3561.58,
  landUnitRateAfterDiscount: 3561.58,
  landAreaSqm: 900,
  buildingPlotAreaSqm: 900,
  apartmentLandShareSqm: 60,
  landValueFromMarket: 213694.8,
  landEstimateComplete: true,
  useRestrictionDiscountPct: 0,
} as ValuationCostApproachDto;

describe("CostLandValueCard — decision A", () => {
  it("shows the plot box and the share, and the land value as rate × share", () => {
    const setField = vi.fn();
    render(
      <CostLandValueCard
        cost={cost}
        fields={{ ...EMPTY_COST_FIELDS, buildingPlotArea: "900", apartmentLandShare: "60" }}
        setField={setField}
        landComplete
        isApartmentProperty
      />,
    );

    expect(screen.getByText("مساحة أرض العمارة كاملة (م²)")).toBeTruthy();
    const plot = document.getElementById("cost-buildingPlotArea") as HTMLInputElement;
    expect(plot.value).toBe("900");
    expect((document.getElementById("cost-apartmentLandShare") as HTMLInputElement).value).toBe("60");
    expect(screen.getByTestId("cost-land-formula").textContent).toBe(
      "قيمة الأرض = 3,561.58 ر.س/م² × حصة الشقة 60 م² = 213,694.8 — تسوية المساحة على مساحة الأرض كاملة 900 م²",
    );

    fireEvent.change(plot, { target: { value: "٩٥٠" } });
    expect(setField).toHaveBeenCalledWith("buildingPlotArea", "950");
  });

  it("labels the plot as the land itself when the property is not an apartment", () => {
    render(
      <CostLandValueCard
        cost={{ ...cost, apartmentLandShareSqm: null, landValueFromMarket: 3205422 }}
        fields={{ ...EMPTY_COST_FIELDS, buildingPlotArea: "900" }}
        setField={() => {}}
        landComplete
        isApartmentProperty={false}
      />,
    );
    expect(screen.getByText("مساحة قطعة الأرض (م²)")).toBeTruthy();
    expect(document.getElementById("cost-apartmentLandShare")).toBeNull();
    expect(screen.getByTestId("cost-land-formula").textContent).toContain("× مساحة الأرض 900 م²");
  });
});

describe("land matrix output caption", () => {
  const land = (share: number | null) =>
    ({
      selectionContext: "land_within_cost",
      adjustmentBasis: "price_per_sqm",
      weightedPricePerSqm: 3561.58,
      marketOpinionValue: 213694.8,
      marketOpinionValueRaw: 213694.8,
      subjectAreaSqm: 900,
      apartmentLandShareSqm: share,
      areaFactorPct: 5,
    }) as unknown as ValuationComparableSelectionListDto;

  it("says the land value multiplies the apartment's share, adjusted on the whole plot", () => {
    const view = matrixBasisView(land(60), [], "900");
    expect(view.opinionRaw).toBe(213694.8);
    expect(view.outputFormula).toBe(
      "سعر المتر بعد التسوية × حصة الشقة 60 م² — تسوية المساحة على أرض العمارة كاملة 900 م²",
    );
    expect(matrixBasisView(land(null), [], "900").outputFormula).toBe("سعر المتر بعد التسوية × مساحة الأرض");
  });
});
