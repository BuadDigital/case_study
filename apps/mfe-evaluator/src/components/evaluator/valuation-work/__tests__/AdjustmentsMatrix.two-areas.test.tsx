import { fireEvent, render, screen, within } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import type {
  ValuationComparableAdjustmentLineDto,
  ValuationComparableSelectionDto,
  ValuationComparableSelectionListDto,
} from "@platform/api-client";

// One layout at a time: true = the table, false = the phone cards.
const viewport = vi.hoisted(() => ({ desktop: true as boolean }));
vi.mock("@platform/app-shared/hooks/use-viewport-desktop", () => ({
  useViewportDesktop: () => viewport.desktop,
}));

import { AdjustmentsMatrix } from "../AdjustmentsMatrix";

/**
 * A built subject's two area rows on the adjustments matrix (Omar 2026-11-15): the building's
 * area and the land's, each with its own factor and ✓, the land areas typed in the land row.
 */
const line = (
  factorKey: string,
  percent: number,
  isIncluded = true,
): ValuationComparableAdjustmentLineDto => ({
  id: `${factorKey}`,
  factorKey,
  labelAr: factorKey,
  percent,
  rationale: "",
  isIncluded,
  sortOrder: 0,
  isSuggestedValue: false,
});

const villa = (n: number, areaPct: number, landPct: number, land: number | null, landIncluded = true) =>
  ({
    id: `sel-${n}`,
    valuationRequestId: "vr",
    comparablePropertyId: `comp-${n}`,
    sortOrder: n,
    isAdopted: true,
    selectedAtUtc: "2026-11-15T00:00:00Z",
    comparable: {
      id: `comp-${n}`,
      referenceCode: `CMP-${n}`,
      comparablePropertyType: "فيلا",
      district: "الملقا",
      areaSqm: 300 + n * 100,
      price: 1_000_000 * n,
      pricePerSqm: 3000,
      transactionDate: "2026-10-01",
      transactionKind: "executed",
    },
    effectiveAreaSqm: 300 + n * 100,
    effectivePriceSar: 1_000_000 * n,
    effectivePricePerSqm: 3000,
    effectiveLandAreaSqm: land,
    market: {
      adjustmentLines: [
        line("market", 0),
        line("area", areaPct),
        line("land_area", landPct, landIncluded),
        line("location", 0),
      ],
      sumSequentialPct: 0,
      sumDifferencePct: areaPct + (landIncluded ? landPct : 0),
      sumIncludedPct: areaPct + (landIncluded ? landPct : 0),
      exceedsLargeAdjustmentThreshold: false,
      dealAgeMonths: 1,
      pricePerSqmAfterSequential: 1_000_000 * n,
      pricePerSqmAfterDifference: 1_000_000 * n,
      suggestedWeightPct: 50,
      effectiveWeightPct: 50,
      weightIsManual: false,
      areaAdjustmentMethod: "amthal",
      suggestedAreaAdjustmentPct: areaPct,
      landAreaAdjustmentMethod: "multiplier",
      suggestedLandAreaAdjustmentPct: landPct,
    },
  }) as unknown as ValuationComparableSelectionDto;

const selection = (extra: Partial<ValuationComparableSelectionListDto> = {}) =>
  ({
    valuationRequestId: "vr",
    propertyId: "p",
    selectionContext: "market",
    adoptedCount: 2,
    meetsMinimumAdoptedGate: true,
    weightsSumTo100: true,
    weightedPricePerSqm: 1_500_000,
    subjectAreaSqm: 400,
    adjustmentBasis: "whole_property",
    adjustmentBasisLabelAr: "",
    marketOpinionValue: 1_500_000,
    marketOpinionValueRaw: 1_500_000,
    areaFactorPct: 5,
    twoAreaAdjustments: true,
    subjectLandAreaSqm: 600,
    subjectLandAreaIsManual: false,
    landAreaFactorPct: 10,
    items: [],
    ...extra,
  }) as unknown as ValuationComparableSelectionListDto;

function renderMatrix({
  desktop = true,
  list = selection(),
  adopted = [villa(1, 1.67, 0, 500), villa(2, -1.25, -10, 1500)],
}: {
  desktop?: boolean;
  list?: ValuationComparableSelectionListDto;
  adopted?: ValuationComparableSelectionDto[];
} = {}) {
  viewport.desktop = desktop;
  const dispatch = vi.fn().mockResolvedValue(true);
  render(
    <AdjustmentsMatrix
      selection={list}
      adopted={adopted}
      locked={false}
      saving={false}
      subjectArea="400"
      subjectKind="building"
      idealArea=""
      dispatch={dispatch}
    />,
  );
  return dispatch;
}

/** The table row whose first cell carries `label`. */
const rowOf = (label: string) => screen.getByText(label, { selector: "div" }).closest("tr")!;

describe("the adjustments table of a built subject", () => {
  it("draws the building's row and the land's row, each with its own method and percents", () => {
    renderMatrix();
    const building = rowOf("مساحة المباني");
    expect(within(building).getByText("طريقة الأمثال — آلية")).toBeTruthy();
    expect(building.textContent).toContain("1.67");
    const land = rowOf("مساحة الأرض");
    expect(within(land).getByText("طريقة المضاعف — آلية")).toBeTruthy();
    expect(land.textContent).toContain("10");
    expect(within(land).getByText("مساحة الأرض — من الصك")).toBeTruthy();
    // Subject 600, comparables 500 and 1,500 — each in its own box.
    expect(within(land).getAllByRole("textbox").map((b) => (b as HTMLInputElement).value)).toEqual(
      expect.arrayContaining(["600", "500", "1500"]),
    );
  });

  it("saves each row's factor apart", () => {
    const dispatch = renderMatrix();
    const landFactor = within(rowOf("مساحة الأرض")).getByDisplayValue("10");
    fireEvent.change(landFactor, { target: { value: "8" } });
    fireEvent.blur(landFactor);
    expect(dispatch).toHaveBeenCalledWith({ type: "area-factor-change", value: "8", line: "land" });
  });

  it("types a comparable's land area and the subject's from the land row", () => {
    const dispatch = renderMatrix({ adopted: [villa(1, 1.67, 0, null), villa(2, -1.25, -10, 1500)] });
    const land = rowOf("مساحة الأرض");
    // The first comparable has no land area yet: its box is empty.
    const empty = within(land).getAllByPlaceholderText("أرض المقارن")[0]!;
    expect((empty as HTMLInputElement).value).toBe("");
    fireEvent.change(empty, { target: { value: "450" } });
    fireEvent.blur(empty);
    expect(dispatch).toHaveBeenCalledWith(
      expect.objectContaining({ type: "save-land-area", raw: "450", item: expect.objectContaining({ id: "sel-1" }) }),
    );
    const subject = within(land).getByDisplayValue("600");
    fireEvent.change(subject, { target: { value: "750" } });
    fireEvent.blur(subject);
    expect(dispatch).toHaveBeenCalledWith({ type: "save-subject-land-area", raw: "750" });
  });

  it("gives each area row a ✓ to leave it out", () => {
    const dispatch = renderMatrix();
    fireEvent.click(within(rowOf("مساحة الأرض")).getByTitle("استبعاد البند من الاحتساب"));
    expect(dispatch).toHaveBeenCalledWith(
      expect.objectContaining({ type: "toggle-included", factorKey: "land_area" }),
    );
    fireEvent.click(within(rowOf("مساحة المباني")).getByTitle("استبعاد البند من الاحتساب"));
    expect(dispatch).toHaveBeenCalledWith(expect.objectContaining({ type: "toggle-included", factorKey: "area" }));
  });

  it("marks a row that was left out", () => {
    renderMatrix({ adopted: [villa(1, 1.67, 0, 500, false), villa(2, -1.25, -10, 1500, false)] });
    const land = rowOf("مساحة الأرض");
    expect(within(land).getByText("غير محتسب في المجموع")).toBeTruthy();
    expect(within(land).getByTitle("تفعيل احتساب البند")).toBeTruthy();
  });

  it("does not draw the land row as a typed difference factor", () => {
    renderMatrix();
    // One land row, and no percent box in it: its figure is computed.
    expect(screen.getAllByText("مساحة الأرض", { selector: "div" })).toHaveLength(1);
  });
});

describe("a table with one area line stays as it was", () => {
  it("has no land row and no ✓ on the area row", () => {
    renderMatrix({ list: selection({ twoAreaAdjustments: false }) });
    expect(screen.queryByText("مساحة الأرض", { selector: "div" })).toBeNull();
    const area = rowOf("المساحة");
    expect(within(area).getByText("لا تسوية مساحة — المقارنة على قيمة العقار كاملة")).toBeTruthy();
    expect(within(area).queryByTitle("استبعاد البند من الاحتساب")).toBeNull();
  });
});

describe("the phone layout of a built subject's matrix", () => {
  it("shows the land row with its factor, the subject's land area and each comparable's", () => {
    const dispatch = renderMatrix({ desktop: false });
    expect(screen.getAllByText("مساحة الأرض").length).toBeGreaterThan(0);
    expect(screen.getAllByText("مساحة المباني").length).toBeGreaterThan(0);
    const boxes = screen.getAllByPlaceholderText("أرض المقارن");
    expect(boxes).toHaveLength(2);
    fireEvent.change(boxes[1]!, { target: { value: "1400" } });
    fireEvent.blur(boxes[1]!);
    expect(dispatch).toHaveBeenCalledWith(
      expect.objectContaining({ type: "save-land-area", raw: "1400", item: expect.objectContaining({ id: "sel-2" }) }),
    );
  });
});
