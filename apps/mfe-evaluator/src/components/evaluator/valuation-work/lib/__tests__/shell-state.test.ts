import { describe, expect, it } from "vitest";
import type {
  DifferenceFactorDefinitionDto,
  ValuationComparableSelectionDto,
} from "@platform/api-client";
import { buildAutoNarrative, buildFactorCatalog } from "../shell-state";

function adopted(
  extra: Record<string, unknown> = {},
): ValuationComparableSelectionDto {
  return {
    id: "sel-1",
    comparablePropertyId: "comp-1",
    isAdopted: true,
    market: {
      adjustmentLines: [],
      suggestedAreaAdjustmentPct: 0,
      weightIsManual: false,
      weightOverrideRationale: "",
    },
    ...extra,
  } as unknown as ValuationComparableSelectionDto;
}

const FACTOR_ROWS = [
  { factorKey: "market", labelAr: "تسوية ظروف السوق" },
  { factorKey: "type", labelAr: "تسوية نوع المقارن" },
  { factorKey: "financing", labelAr: "تسوية شروط التمويل" },
];

describe("buildAutoNarrative", () => {
  it("asks for an adopted comparable when the bank is empty", () => {
    expect(buildAutoNarrative([], FACTOR_ROWS)).toContain("لم تُعتمد أي مقارنة");
  });

  it("lists only written justifications and omits لم يتم تبريره", () => {
    const text = buildAutoNarrative(
      [
        adopted({
          market: {
            adjustmentLines: [
              { factorKey: "type", rationale: "  " },
              { factorKey: "financing", rationale: "legacy line" },
            ],
            weightOverrideRationale: "وزن مبرَّر",
          },
        }),
      ],
      FACTOR_ROWS,
      [
        { factorKey: "market", rationaleAr: "" },
        { factorKey: "financing", rationaleAr: "مبرر تجريبي" },
      ],
    );

    expect(text).toBe(
      "مبررات التسويات:\n• تسوية شروط التمويل — مبرر تجريبي\n• الوزن النسبي — وزن مبرَّر",
    );
    expect(text).not.toContain("لم يتم تبريره");
    expect(text).not.toContain("تسوية ظروف السوق");
    expect(text).not.toContain("تسوية نوع المقارن");
  });

  it("keeps the heading when nothing has been written", () => {
    expect(buildAutoNarrative([adopted()], FACTOR_ROWS)).toBe("مبررات التسويات:");
  });
});

function catalogFactor(
  extra: Partial<DifferenceFactorDefinitionDto>,
): DifferenceFactorDefinitionDto {
  return {
    key: "extra",
    labelAr: "عامل إضافي",
    definitionAr: "تعريف",
    excludesAr: "",
    sortOrder: 1,
    isActive: true,
    ...extra,
  };
}

describe("buildFactorCatalog", () => {
  it("keeps default difference factors in the addable list so a deleted row can return", () => {
    const { addable } = buildFactorCatalog([
      catalogFactor({ key: "location", labelAr: "الموقع" }),
      catalogFactor({ key: "attraction", labelAr: "عامل الجذب للموقع" }),
      catalogFactor({ key: "market", labelAr: "تسوية ظروف السوق" }),
      catalogFactor({ key: "area", labelAr: "المساحة" }),
      catalogFactor({ key: "inactive", labelAr: "مخفي", isActive: false }),
    ]);
    expect(addable.map((f) => f.factorKey)).toEqual(["location", "attraction"]);
  });
});
