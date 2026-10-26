import { describe, expect, it } from "vitest";
import type { ValuationCostApproachDto } from "@platform/api-client";
import {
  buildCostAlerts,
  buildingPlotAreaSeed,
  costApproachDerived,
  costFieldsFromDto,
  costLineTotals,
  costSaveRequest,
  EMPTY_COST_FIELDS,
  type CostApproachFields,
} from "../cost-approach-state";
import { subjectAreaSyncPlan } from "../valuation-data-state";
import {
  COST_FIELD_ERROR_KEYS,
  VALUATION_WORK_ERROR_TARGETS,
} from "../valuation-work-error-targets";

/**
 * Decision A (round 2): the apartment's land table is compared with the whole building plot, kept on
 * the cost approach apart from the market header the subject-area sync writes.
 */
function cost(extra: Partial<ValuationCostApproachDto> = {}): ValuationCostApproachDto {
  return {
    landUnitRateFromMarket: 0,
    landAreaSqm: 0,
    landValueFromMarket: 0,
    useRestrictionDiscountPct: 0,
    landEstimateComplete: false,
    directCostTotal: 0,
    indirectItems: [],
    lines: [],
    ...extra,
  } as ValuationCostApproachDto;
}

function apartmentAlerts(fields: Partial<CostApproachFields>) {
  const merged = { ...EMPTY_COST_FIELDS, ...fields };
  const totals = costLineTotals([]);
  const derived = costApproachDerived(merged, totals.directTotal, null, false);
  return buildCostAlerts(merged, [], totals, derived, false, true);
}

describe("building plot area — draft, seed and save", () => {
  it("seeds the plot from the deed only when the deed is the land itself", () => {
    expect(buildingPlotAreaSeed("٤٥٠", false)).toBe("450");
    expect(buildingPlotAreaSeed("1,250", false)).toBe("1,250");
    // An apartment's deed area is the unit (VR-542: 180 m²), never the building plot.
    expect(buildingPlotAreaSeed("180", true)).toBe("");
    expect(buildingPlotAreaSeed("", false)).toBe("");
    expect(buildingPlotAreaSeed("غير محدد", false)).toBe("");
  });

  it("keeps the saved plot over any seed, and starts from the seed only before one is saved", () => {
    expect(costFieldsFromDto(cost({ buildingPlotAreaSqm: 900 }), null, "180").buildingPlotArea).toBe("900");
    expect(costFieldsFromDto(cost({ buildingPlotAreaSqm: null }), null, "450").buildingPlotArea).toBe("450");
    expect(costFieldsFromDto(cost()).buildingPlotArea).toBe("");
  });

  it("sends the plot with the cost save and clears it when blank", () => {
    const fields = { ...EMPTY_COST_FIELDS, buildingPlotArea: "900", apartmentLandShare: "60" };
    expect(costSaveRequest(fields, [])).toMatchObject({
      buildingPlotAreaSqm: 900,
      apartmentLandShareSqm: 60,
    });
    expect(costSaveRequest({ ...fields, buildingPlotArea: " " }, []).buildingPlotAreaSqm).toBeNull();
  });

  it("points a server refusal of the plot at the plot box", () => {
    expect(COST_FIELD_ERROR_KEYS.buildingPlotArea).toBe("buildingPlotAreaSqm");
    expect(
      VALUATION_WORK_ERROR_TARGETS.find((t) => t.key === "buildingPlotAreaSqm")?.targetId,
    ).toBe("cost-buildingPlotArea");
  });
});

describe("apartment land alerts", () => {
  it("asks for the plot, then the share, then a share within the plot", () => {
    expect(
      apartmentAlerts({ apartmentLandShare: "60" }).find((a) => a.targetId === "cost-buildingPlotArea"),
    ).toMatchObject({
      kind: "error",
      title: "مساحة أرض العمارة مطلوبة",
      targetId: "cost-buildingPlotArea",
    });
    expect(
      apartmentAlerts({ buildingPlotArea: "900" }).find((a) => a.targetId === "cost-apartmentLandShare")
        ?.title,
    ).toBe("حصة الشقة من الأرض مطلوبة");
    expect(
      apartmentAlerts({ buildingPlotArea: "50", apartmentLandShare: "60" }).find(
        (a) => a.targetId === "cost-apartmentLandShare",
      )?.title,
    ).toBe("حصة الشقة تتجاوز مساحة أرض العمارة");
    expect(
      apartmentAlerts({ buildingPlotArea: "900", apartmentLandShare: "60" }).some((a) =>
        a.targetId === "cost-buildingPlotArea" || a.targetId === "cost-apartmentLandShare",
      ),
    ).toBe(false);
  });

  it("never asks a villa or a building-only scope for an apartment share", () => {
    const merged = { ...EMPTY_COST_FIELDS };
    const totals = costLineTotals([]);
    const derived = costApproachDerived(merged, 0, null, false);
    expect(
      buildCostAlerts(merged, [], totals, derived, false, false).some(
        (a) => a.targetId === "cost-buildingPlotArea",
      ),
    ).toBe(false);
    expect(
      buildCostAlerts(merged, [], totals, derived, true, true).some(
        (a) => a.targetId === "cost-buildingPlotArea",
      ),
    ).toBe(false);
  });
});

describe("subject-area sync and the plot", () => {
  const selection = { subjectAreaSqm: 900, adjustmentBasis: "whole_property", analysisNotes: null };

  it("writes only the market header — the plot is never part of the body", () => {
    const plan = subjectAreaSyncPlan({
      requestId: "vr-542",
      transactionArea: "180",
      selection,
      lastSyncKey: null,
    });
    expect(plan?.body).toEqual({
      subjectAreaSqm: 180,
      adjustmentBasis: "whole_property",
      analysisNotes: null,
    });
    expect(Object.keys(plan!.body)).not.toContain("buildingPlotAreaSqm");
  });

  it("sends nothing while writes are frozen (after hand-over)", () => {
    expect(
      subjectAreaSyncPlan({
        requestId: "vr-542",
        transactionArea: "180",
        selection,
        lastSyncKey: null,
        writesFrozen: true,
      }),
    ).toBeNull();
  });

  it("keeps a saved plot through the full reload that follows a sync", () => {
    // The sync rewrote the header to 180; the cost row still carries 900 and the draft follows it.
    const afterSync = cost({ buildingPlotAreaSqm: 900, landAreaSqm: 900, apartmentLandShareSqm: 60 });
    expect(costFieldsFromDto(afterSync, null, buildingPlotAreaSeed("180", true)).buildingPlotArea).toBe("900");
  });
});
