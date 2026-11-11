import { describe, expect, it } from "vitest";
import type { ValuationCostLineDto } from "@platform/api-client";
import {
  buildCostAlerts,
  costApproachDerived,
  costLineTotals,
  EMPTY_COST_FIELDS,
  leaseCapWording,
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

  it("names a life-extension basis under 10 characters at its field (round 2)", () => {
    expect(
      find(
        alertsFor({ lifeExtension: "5", lifeExtensionBasis: "ترميم" }),
        "بيان أساس تمديد العمر يجب ألا يقل عن 10 أحرف",
      ),
    ).toMatchObject({ kind: "error", targetId: "cost-lifeExtensionBasis" });
  });

  it("points the missing land value at the land-comparables section", () => {
    expect(
      find(alertsFor({}, [line()], false), "قيمة الأرض غير مقدَّرة"),
    ).toMatchObject({ targetId: "cost-land-bank" });
  });

  it("points an empty cost table at the table, and names the inventory it is filled from", () => {
    const alert = find(alertsFor({}, []), "لا يوجد بند تكلفة");
    expect(alert).toMatchObject({ targetId: "cost-lines" });
    expect(alert?.body).toContain("جدول حصر المباني");
    expect(alert?.body).toContain("سحب من حصر المباني");
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

describe("extra-line rationale alert (A→Z #52/#78)", () => {
  it("does not ask a rationale for an extra that adds nothing yet («المسبح» at 0)", () => {
    const pool = line({ itemKey: "pool", label: "المسبح", unit: "lump", areaSqm: 1, unitCostSar: 0 });
    expect(find(alertsFor({}, [pool]), "بند إضافي بلا مبرر")).toBeUndefined();
    const priced = line({ itemKey: "pool", label: "المسبح", unit: "lump", areaSqm: 1, unitCostSar: 90000 });
    expect(find(alertsFor({}, [priced]), "بند إضافي بلا مبرر")).toBeDefined();
  });

  it("treats a custom «الدور الثاني» saved as «other» as a floor, not an extra", () => {
    const floor = line({ label: "الدور الثاني", structureKind: "other", areaSqm: 520, unitCostSar: 1500 });
    expect(find(alertsFor({}, [floor]), "بند إضافي بلا مبرر")).toBeUndefined();
    expect(costLineTotals([floor]).buildAreaLocal).toBe(520);
  });
});

describe("leaseCapWording (A→Z #69)", () => {
  it("names the usufruct right, and the lease otherwise", () => {
    expect(leaseCapWording("usufruct").term).toBe("مدة حق المنفعة المتبقية");
    expect(leaseCapWording("leased_land").term).toBe("مدة الإيجار المتبقية");
    expect(leaseCapWording(null).term).toBe("مدة الإيجار المتبقية");
  });
});
