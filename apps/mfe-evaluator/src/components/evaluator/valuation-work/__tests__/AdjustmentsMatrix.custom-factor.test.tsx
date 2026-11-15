import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import type {
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
 * An added custom difference factor on the adjustments matrix: «إضافة» adds «عامل مخصص», and its
 * name is typed in the row's own label — a catalogue factor's name stays plain text.
 */
const comparable = (n: number, factors: [key: string, label: string][]) =>
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
      comparablePropertyType: "أرض",
      district: "الملقا",
      areaSqm: 500,
      price: 1_500_000,
      pricePerSqm: 3000,
      transactionDate: "2026-10-01",
      transactionKind: "executed",
    },
    effectiveAreaSqm: 500,
    effectivePriceSar: 1_500_000,
    effectivePricePerSqm: 3000,
    market: {
      adjustmentLines: factors.map(([factorKey, labelAr], i) => ({
        id: `${n}-${factorKey}`,
        factorKey,
        labelAr,
        percent: 0,
        rationale: "",
        isIncluded: true,
        sortOrder: i,
        isSuggestedValue: false,
      })),
      sumSequentialPct: 0,
      sumDifferencePct: 0,
      sumIncludedPct: 0,
      exceedsLargeAdjustmentThreshold: false,
      dealAgeMonths: 1,
      pricePerSqmAfterSequential: 3000,
      pricePerSqmAfterDifference: 3000,
      suggestedWeightPct: 50,
      effectiveWeightPct: 50,
      weightIsManual: false,
      areaAdjustmentMethod: "amthal",
      suggestedAreaAdjustmentPct: 0,
    },
  }) as unknown as ValuationComparableSelectionDto;

const selection = {
  valuationRequestId: "vr",
  propertyId: "p",
  selectionContext: "market",
  adoptedCount: 2,
  meetsMinimumAdoptedGate: true,
  weightsSumTo100: true,
  weightedPricePerSqm: 3000,
  subjectAreaSqm: 500,
  adjustmentBasis: "price_per_sqm",
  adjustmentBasisLabelAr: "",
  marketOpinionValue: 1_500_000,
  marketOpinionValueRaw: 1_500_000,
  areaFactorPct: 5,
  items: [],
} as unknown as ValuationComparableSelectionListDto;

const STANDARD: [string, string][] = [
  ["market", "ظروف السوق"],
  ["area", "المساحة"],
  ["location", "الموقع"],
];

function renderMatrix(factors: [string, string][], desktop = true) {
  viewport.desktop = desktop;
  const dispatch = vi.fn().mockResolvedValue(true);
  render(
    <AdjustmentsMatrix
      selection={selection}
      adopted={[comparable(1, factors), comparable(2, factors)]}
      locked={false}
      saving={false}
      subjectArea="500"
      subjectKind="land"
      idealArea=""
      dispatch={dispatch}
    />,
  );
  return dispatch;
}

const nameInputs = () => screen.queryAllByPlaceholderText("اسم العامل…") as HTMLInputElement[];

describe("a custom difference factor on the adjustments matrix", () => {
  it("«إضافة» adds «عامل مخصص» under the next free key", () => {
    const first = renderMatrix(STANDARD);
    fireEvent.click(screen.getByRole("button", { name: "إضافة" }));
    expect(first).toHaveBeenCalledWith({ type: "add-factor", factorKey: "c_1", labelAr: "عامل مخصص" });
  });

  it("a second custom factor takes the key after the first", () => {
    const dispatch = renderMatrix([...STANDARD, ["c_1", "إطلالة"]]);
    fireEvent.click(screen.getByRole("button", { name: "إضافة" }));
    expect(dispatch).toHaveBeenCalledWith({ type: "add-factor", factorKey: "c_2", labelAr: "عامل مخصص" });
  });

  it.each([
    ["the table", true],
    ["the phone cards", false],
  ])("on %s the custom row's name is an input, and typing a new name renames the factor", (_, desktop) => {
    const dispatch = renderMatrix([...STANDARD, ["c_1", "عامل مخصص"]], desktop);
    const [name, ...others] = nameInputs();
    // only the custom row can be renamed — «الموقع» is plain text
    expect(others).toHaveLength(0);
    expect(name!.value).toBe("عامل مخصص");

    fireEvent.focus(name!);
    fireEvent.change(name!, { target: { value: "إطلالة على حديقة" } });
    fireEvent.blur(name!);
    expect(dispatch).toHaveBeenCalledWith({
      type: "rename-factor",
      factorKey: "c_1",
      labelAr: "إطلالة على حديقة",
    });
  });

  it("a table without a custom factor has no name input", () => {
    renderMatrix(STANDARD);
    expect(nameInputs()).toHaveLength(0);
  });

  it("leaving the name as it was saves nothing", () => {
    const dispatch = renderMatrix([...STANDARD, ["c_1", "إطلالة"]]);
    const [name] = nameInputs();
    fireEvent.focus(name!);
    fireEvent.blur(name!);
    expect(dispatch).not.toHaveBeenCalled();
  });
});
