import { describe, expect, it } from "vitest";
import type { ValuationCostLineDto } from "@platform/api-client";
import { textLooksLikeApartment } from "@platform/app-shared/app-data/inspector-workspace-data";
import {
  EMPTY_COST_FIELDS,
  buildCostAlerts,
  buildingPlotAreaSeed,
  costApproachDerived,
  costDepreciationIncomplete,
  costLineTotals,
  costSaveRequest,
  type CostApproachFields,
} from "../cost-approach-state";
import { costLineComputed, includedFirstFloorLine } from "../cost-line-math";
import { costLoadedStamp, newerCostSaveStamp } from "../cost-autosave";

function line(extra: Partial<ValuationCostLineDto> = {}): ValuationCostLineDto {
  return {
    id: extra.id ?? "l",
    sourceInventoryLineId: null,
    structureKind: "floor",
    itemKey: "ground_floor",
    itemLabelAr: "",
    label: "",
    areaSqm: 200,
    unit: "sqm",
    unitLabelAr: "م²",
    buildRatioPct: null,
    repeatedFloorCount: null,
    unitCostSar: 1500,
    lineTotal: 0,
    rationale: "",
    isIncluded: true,
    sortOrder: 0,
    ...extra,
  };
}

function alertsFor(fields: Partial<CostApproachFields>, lines: ValuationCostLineDto[]) {
  const merged = { ...EMPTY_COST_FIELDS, ...fields };
  const totals = costLineTotals(lines);
  const derived = costApproachDerived(merged, totals.directTotal, null, true);
  return buildCostAlerts(merged, lines, totals, derived, true);
}

describe("building age — no invented defaults (fix 5, 2026-11-10)", () => {
  it("is incomplete only for included floor lines with a blank age", () => {
    const floor = [line()];
    expect(costDepreciationIncomplete({ actualAge: "", economicAge: "40" }, floor)).toBe(true);
    expect(costDepreciationIncomplete({ actualAge: "10", economicAge: " " }, floor)).toBe(true);
    expect(costDepreciationIncomplete({ actualAge: "10", economicAge: "40" }, floor)).toBe(false);
    // A new building (0) is an answer.
    expect(costDepreciationIncomplete({ actualAge: "0", economicAge: "40" }, floor)).toBe(false);
    // Additions only, or an excluded floor, need no ages.
    expect(
      costDepreciationIncomplete({ actualAge: "", economicAge: "" }, [
        line({ itemKey: "fence", structureKind: "fence", unit: "lm" }),
      ]),
    ).toBe(false);
    expect(
      costDepreciationIncomplete({ actualAge: "", economicAge: "" }, [line({ isIncluded: false })]),
    ).toBe(false);
  });

  it("sends blank ages as null, never 0", () => {
    const body = costSaveRequest(EMPTY_COST_FIELDS, [line()]);
    expect(body.actualAgeYears).toBeNull();
    expect(body.economicAgeYears).toBeNull();
  });

  it("names the blank age instead of «العمر الممتد صفر»", () => {
    const alerts = alertsFor({ actualAge: "12", economicAge: "" }, [line()]);
    const blank = alerts.find((a) => a.title === "العمر الفعلي أو العمر الاقتصادي فارغ");
    expect(blank).toMatchObject({ kind: "error", targetId: "cost-economicAge", fallbackTargetId: "cost-age" });
    expect(blank?.body).toContain("أدخل العمر الفعلي والعمر الاقتصادي لحساب الإهلاك");
    expect(alerts.some((a) => a.title === "العمر الممتد صفر")).toBe(false);
    expect(alertsFor({ actualAge: "", economicAge: "40" }, [line()]).find((a) => a.title.startsWith("العمر الفعلي أو"))?.targetId).toBe(
      "cost-actualAge",
    );
    expect(alertsFor({ actualAge: "10", economicAge: "40" }, [line()]).some((a) => a.title.startsWith("العمر الفعلي أو"))).toBe(false);
  });
});

describe("repeated floors inherit from the included first floor only (fix 6, 2026-11-10)", () => {
  const first = line({ id: "f", itemKey: "first_floor", areaSqm: 600, unitCostSar: 2000, buildRatioPct: 50 });
  const repeated = line({ id: "r", itemKey: "repeated_floors", areaSqm: 0, unitCostSar: 0, repeatedFloorCount: 2 });

  it("inherits area (before the first floor's ratio) and unit cost from an included first floor", () => {
    const c = costLineComputed(repeated, [first, repeated]);
    expect(c.qty).toBe(1200);
    expect(c.uc).toBe(2000);
    expect(c.inherited).toBe(true);
    expect(costLineTotals([first, repeated]).firstFloorLine?.id).toBe("f");
  });

  it("inherits nothing from an excluded first floor — preview = server", () => {
    const excluded = { ...first, isIncluded: false };
    expect(includedFirstFloorLine([excluded, repeated])).toBeNull();
    const c = costLineComputed(repeated, [excluded, repeated]);
    expect(c.qty).toBe(0);
    expect(c.inherited).toBe(false);
    const own = costLineComputed({ ...repeated, unitCostSar: 1700 }, [excluded, repeated]);
    expect(own.uc).toBe(1700);
    expect(costLineTotals([excluded, repeated]).firstFloorLine).toBeNull();
  });

  it("picks the first included first floor when an excluded one comes before it", () => {
    const second = line({ id: "f2", itemKey: "first_floor", areaSqm: 450, unitCostSar: 1800 });
    expect(includedFirstFloorLine([{ ...first, isIncluded: false }, second])?.id).toBe("f2");
  });

  it("asks for an included first floor, and no longer compares with an excluded one's rate", () => {
    const alerts = alertsFor({ actualAge: "10", economicAge: "40" }, [
      { ...first, isIncluded: false },
      { ...repeated, unitCostSar: 1700 },
    ]);
    expect(alerts.some((a) => a.title === "بند الأدوار المتكررة بلا «الدور الأول» مدرج")).toBe(true);
    expect(alerts.some((a) => a.title === "تكلفة متر المتكررة تخالف الدور الأول")).toBe(false);
  });
});

describe("cost save stamp — two tabs (fix 11, 2026-11-10)", () => {
  it("reads the loaded stamp: none → no check, never saved → empty", () => {
    expect(costLoadedStamp(null)).toBeUndefined();
    expect(costLoadedStamp({})).toBeUndefined();
    expect(costLoadedStamp({ updatedAtUtc: null })).toBe("");
    expect(costLoadedStamp({ updatedAtUtc: "2026-11-10T08:00:00.0000000Z" })).toBe(
      "2026-11-10T08:00:00.0000000Z",
    );
  });

  it("keeps the later stamp when a reload races the screen's own save", () => {
    const older = "2026-11-10T08:00:00.0000000Z";
    const newer = "2026-11-10T08:00:05.0000000Z";
    expect(newerCostSaveStamp(newer, older)).toBe(newer);
    expect(newerCostSaveStamp(older, newer)).toBe(newer);
    expect(newerCostSaveStamp(undefined, older)).toBe(older);
    expect(newerCostSaveStamp(older, undefined)).toBe(older);
    expect(newerCostSaveStamp("", older)).toBe(older);
    expect(newerCostSaveStamp(older, "")).toBe(older);
    // Same millisecond, one more tick → the text decides.
    expect(newerCostSaveStamp("2026-11-10T08:00:00.0000001Z", older)).toBe("2026-11-10T08:00:00.0000001Z");
  });
});

describe("apartment test on the cost screen (fix 7, 2026-11-10)", () => {
  it("never seeds the deed area as the building plot for «شقه» / Apartment / flat", () => {
    for (const type of ["شقة", "شقه سكنية", "Apartment", "flat"]) {
      expect(buildingPlotAreaSeed("150", textLooksLikeApartment(type))).toBe("");
    }
    expect(buildingPlotAreaSeed("600", textLooksLikeApartment("فيلا"))).toBe("600");
  });
});
