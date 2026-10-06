import { describe, expect, it } from "vitest";
import type { ValuationCostLineDto } from "@platform/api-client";
import {
  buildCostAlerts,
  costApproachDerived,
  costLineTotals,
  EMPTY_COST_FIELDS,
  type CostApproachFields,
} from "../cost-approach-state";

function line(extra: Partial<ValuationCostLineDto> = {}): ValuationCostLineDto {
  return {
    id: extra.id ?? "line-1",
    sourceInventoryLineId: null,
    structureKind: null,
    itemKey: "custom",
    label: "سور",
    areaSqm: 10,
    unit: "sqm",
    buildRatioPct: null,
    repeatedFloorCount: null,
    unitCostSar: 100,
    rationale: "",
    isIncluded: true,
    sortOrder: 0,
    ...extra,
  } as ValuationCostLineDto;
}

function alertsFor(
  fields: Partial<CostApproachFields>,
  lines: ValuationCostLineDto[] = [line()],
  buildingOnly = true,
) {
  const merged = { ...EMPTY_COST_FIELDS, ...fields };
  const totals = costLineTotals(lines);
  const derived = costApproachDerived(
    merged,
    totals.directTotal,
    null,
    buildingOnly,
  );
  return buildCostAlerts(merged, lines, totals, derived, buildingOnly);
}

function find(list: ReturnType<typeof alertsFor>, title: string) {
  return list.find((a) => a.title.startsWith(title));
}

describe("cost alerts carry the control they are about", () => {
  it("points «تمديد العمر مستخدم» at the extension-basis field", () => {
    const alert = find(
      alertsFor({ lifeExtension: "5", lifeExtensionBasis: "" }),
      "تمديد العمر مستخدم",
    );
    expect(alert).toMatchObject({
      targetId: "cost-lifeExtensionBasis",
      fallbackTargetId: "cost-age",
    });
  });

  it("points an unjustified extra line at that row's rationale cell", () => {
    const alert = find(
      alertsFor({}, [line({ itemKey: "custom", label: "سور", rationale: "" })]),
      "بند إضافي بلا مبرر",
    );
    expect(alert).toMatchObject({
      targetId: "cost-line-0-rationale",
      fallbackTargetId: "cost-lines",
    });
  });

  it("points the obsolescence alert at whichever rationale is missing", () => {
    expect(
      find(
        alertsFor({ functionalObs: "5", functionalObsRationale: "" }),
        "تقادم وظيفي",
      ),
    ).toMatchObject({ targetId: "cost-functionalObsRationale" });

    expect(
      find(
        alertsFor({
          functionalObs: "5",
          functionalObsRationale: "مبرر",
          externalObs: "5",
          externalObsRationale: "",
        }),
        "تقادم وظيفي",
      ),
    ).toMatchObject({ targetId: "cost-externalObsRationale" });
  });

  it("points «خصم تقييد الاستخدام بلا مبرر» at its justification field", () => {
    expect(
      find(
        alertsFor({ useRestrictionPct: "10", useRestrictionRationale: "" }),
        "خصم تقييد الاستخدام",
      ),
    ).toMatchObject({ targetId: "cost-useRestrictionRationale" });
  });

  it("points the missing land value at the land-comparables section", () => {
    expect(
      find(alertsFor({}, [line()], false), "قيمة الأرض غير مقدَّرة"),
    ).toMatchObject({ targetId: "cost-land-bank" });
  });

  it("points an empty cost table at the table", () => {
    expect(find(alertsFor({}, []), "لا يوجد بند تكلفة")).toMatchObject({
      targetId: "cost-lines",
    });
  });

  it("leaves «لا تنبيهات» without a target", () => {
    const clean = alertsFor({
      actualAgeRationale: "مبرر",
      economicAgeRationale: "مبرر",
    }, [line({ rationale: "أساس التقدير" })]);
    const ok = find(clean, "لا تنبيهات");
    if (ok) expect(ok.targetId).toBeUndefined();
  });
});
