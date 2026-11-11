/**
 * Ruling 2026-11-11: the lines of «جدول حصر المباني» come down into «بنود التكلفة المباشرة» once the
 * case specialist approved it (the study is issued), as a draft the appraiser reviews, prices and
 * saves himself with «حفظ بنود التكلفة» — and that save is what opens the tables after it.
 */
import { act, renderHook, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

const api = vi.hoisted(() => ({
  getBuildingInventory: vi.fn(),
  saveValuationCostApproach: vi.fn(),
}));
const toast = vi.hoisted(() => ({ showToast: vi.fn() }));

vi.mock("../../../../lib/case-study-bridge", async (importOriginal) => ({
  ...(await importOriginal<typeof import("../../../../lib/case-study-bridge")>()),
  fetchInspectorWorkspace: vi.fn().mockResolvedValue(null),
}));
vi.mock("@platform/api-client", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@platform/api-client")>()),
  ...api,
}));
vi.mock("@platform/ui-kit", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@platform/ui-kit")>()),
  useToast: () => toast,
}));
vi.mock("../lib/shell-utils", async (importOriginal) => ({
  ...(await importOriginal<typeof import("../lib/shell-utils")>()),
  apiConfig: () => ({ token: "t" }),
}));
vi.mock("../lib/cost-autosave", async (importOriginal) => ({
  ...(await importOriginal<typeof import("../lib/cost-autosave")>()),
  COST_AUTOSAVE_MS: 5,
}));

import { useCostApproachWorkflow } from "../useCostApproachWorkflow";
import { costLinesReviewed, unpricedCostLines } from "../lib/cost-approach-state";

const INVENTORY = [
  { id: "inv-1", itemKey: "ground_floor", structureKind: "floor", label: "الدور الأرضي", areaSqm: "250", unit: "sqm" },
  { id: "inv-2", itemKey: "fence", structureKind: "fence", label: "السور", areaSqm: "80", unit: "lm" },
];

function render(cost: unknown, opts: { locked?: boolean; inventoryApproved?: boolean } = {}) {
  return renderHook(() =>
    useCostApproachWorkflow({
      valuationRequestId: "vr-1",
      poNumber: "PO-1",
      propertyId: "p-1",
      cost: cost as never,
      hydrateKey: 1,
      buildingOnly: false,
      locked: opts.locked ?? false,
      inventoryApproved: opts.inventoryApproved ?? true,
      costBasisKey: "replacement",
      onSavingChange: vi.fn(),
      onCostSaved: vi.fn(),
    }),
  );
}

type SavedLine = { sourceInventoryLineId?: string | null; areaSqm: number; unitCostSar: number };
const pause = (ms = 40) => new Promise((r) => setTimeout(r, ms));
const savedLine = (over: Record<string, unknown> = {}) => ({
  id: "c-1",
  itemKey: "ground_floor",
  label: "الدور الأرضي",
  areaSqm: 200,
  unitCostSar: 1500,
  lineTotal: 300000,
  rationale: "",
  unit: "sqm",
  structureKind: "floor",
  isIncluded: true,
  ...over,
});

beforeEach(() => {
  toast.showToast.mockReset();
  api.getBuildingInventory.mockReset().mockResolvedValue({ ok: true, data: { lines: INVENTORY } });
  api.saveValuationCostApproach
    .mockReset()
    .mockImplementation(async (_config: unknown, _id: unknown, request: { lines: SavedLine[] }) => ({
      ok: true,
      data: { isSaved: true, lines: request.lines },
    }));
});

describe("the approved inventory comes down into the cost table", () => {
  it("as a draft — unpriced, tied to its inventory lines, and not saved by itself", async () => {
    const view = render(null);
    await waitFor(() => expect(view.result.current.costDraft).toHaveLength(2));
    expect(view.result.current.costDraft.map((l) => l.sourceInventoryLineId)).toEqual(["inv-1", "inv-2"]);
    expect(view.result.current.costDraft.map((l) => l.areaSqm)).toEqual([250, 80]);
    await pause();
    expect(api.saveValuationCostApproach).not.toHaveBeenCalled();
    expect(view.result.current.linesReviewed).toBe(false);
  });

  it("takes nothing, and the pull is closed, until the study is issued", async () => {
    const view = render(null, { inventoryApproved: false });
    await pause();
    // The inventory is still read (to follow its changes), but nothing comes down from it.
    expect(view.result.current.costDraft).toEqual([]);

    const readsBefore = api.getBuildingInventory.mock.calls.length;
    await act(() => view.result.current.seedCostFromInventory());
    expect(api.getBuildingInventory.mock.calls.length).toBe(readsBefore);
    expect(view.result.current.costDraft).toEqual([]);
    expect(toast.showToast).toHaveBeenCalledWith(expect.stringContaining("بانتظار اعتماد دارس العقار"), "error");
  });

  it("leaves a saved cost table alone", async () => {
    const view = render({ isSaved: true, lines: [savedLine()] });
    await pause();
    expect(view.result.current.costDraft).toHaveLength(1);
    expect(api.saveValuationCostApproach).not.toHaveBeenCalled();
  });

  it("says so when the inventory cannot be read", async () => {
    api.getBuildingInventory.mockResolvedValue({ ok: false, kind: "network" });
    render(null);
    await waitFor(() =>
      expect(toast.showToast).toHaveBeenCalledWith(expect.stringContaining("تعذّر تحميل حصر المباني"), "error"),
    );
  });
});

describe("«حفظ بنود التكلفة» opens the tables after the direct costs", () => {
  it("refuses while an included line has no price, and names how many", async () => {
    const view = render(null);
    await waitFor(() => expect(view.result.current.costDraft).toHaveLength(2));
    await act(() => view.result.current.saveCostLines());
    expect(api.saveValuationCostApproach).not.toHaveBeenCalled();
    expect(view.result.current.linesReviewed).toBe(false);
    expect(toast.showToast).toHaveBeenCalledWith(expect.stringContaining("2 بند بلا كمية أو سعر"), "error");
  });

  it("saves the priced lines the appraiser edited, and stays open after a later edit", async () => {
    const view = render(null);
    await waitFor(() => expect(view.result.current.costDraft).toHaveLength(2));
    act(() => {
      view.result.current.patchLine(0, { unitCostSar: 1800, areaSqm: 240 });
      view.result.current.patchLine(1, { unitCostSar: 300 });
    });
    await act(() => view.result.current.saveCostLines());
    await waitFor(() => expect(view.result.current.linesReviewed).toBe(true));
    const request = api.saveValuationCostApproach.mock.calls.at(-1)![2] as { lines: SavedLine[] };
    expect(request.lines.map((l) => [l.areaSqm, l.unitCostSar])).toEqual([[240, 1800], [80, 300]]);

    // A new unpriced line later does not close what was opened.
    act(() => view.result.current.patchLine(0, { unitCostSar: 0 }));
    expect(view.result.current.linesReviewed).toBe(true);
  });
});

describe("the review state of a loaded valuation", () => {
  it("is open when every included saved line carries a total", () => {
    expect(costLinesReviewed({ isSaved: true, lines: [savedLine()] } as never)).toBe(true);
    expect(
      costLinesReviewed({ isSaved: true, lines: [savedLine(), savedLine({ id: "c-2", lineTotal: 0, isIncluded: false })] } as never),
    ).toBe(true);
  });

  it("is closed for no saved lines or an unpriced one", () => {
    expect(costLinesReviewed(null)).toBe(false);
    expect(costLinesReviewed({ isSaved: true, lines: [] } as never)).toBe(false);
    expect(costLinesReviewed({ isSaved: true, lines: [savedLine({ lineTotal: 0 })] } as never)).toBe(false);
  });

  it("stays open for a valuation already worked past the lines", () => {
    const unpriced = [savedLine(), savedLine({ id: "c-2", lineTotal: 0 })];
    expect(costLinesReviewed({ isSaved: true, lines: unpriced, economicAgeYears: 40 } as never)).toBe(true);
    expect(
      costLinesReviewed({ isSaved: true, lines: unpriced, indirectItems: [{ pct: 10 }] } as never),
    ).toBe(true);
  });

  it("lists the included lines without a total as unpriced", () => {
    const lines = [
      savedLine({ id: "a" }),
      savedLine({ id: "b", unitCostSar: 0 }),
      savedLine({ id: "c", areaSqm: 0 }),
      savedLine({ id: "d", unitCostSar: 0, isIncluded: false }),
    ];
    expect(unpricedCostLines(lines as never).map((l) => l.id)).toEqual(["b", "c"]);
  });
});
