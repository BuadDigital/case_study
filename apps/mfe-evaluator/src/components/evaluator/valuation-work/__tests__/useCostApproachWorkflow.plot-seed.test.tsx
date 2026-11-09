/**
 * Omar's ruling 2026-11-05: the plot box of «طريقة المقاول» shows the deed area, so a saved cost
 * approach without a plot area saves it on its own (PO-067355 valued the land on 0 m² beside a
 * filled box until the appraiser pressed «حفظ»).
 */
import { renderHook, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

const api = vi.hoisted(() => ({
  getBuildingInventory: vi.fn(),
  saveValuationCostApproach: vi.fn(),
}));

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
  useToast: () => ({ showToast: vi.fn() }),
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
import { plotSeedNeedsSave } from "../lib/cost-approach-state";

const savedCost = (plot: number | null, isSaved = true) =>
  ({ isSaved, buildingPlotAreaSqm: plot, actualAgeYears: 20, lines: [] }) as never;

function render(cost: unknown, plotAreaSeed: string, locked = false) {
  return renderHook(() =>
    useCostApproachWorkflow({
      valuationRequestId: "vr-1",
      poNumber: "PO-1",
      propertyId: "p-1",
      cost: cost as never,
      hydrateKey: 1,
      buildingOnly: false,
      plotAreaSeed,
      locked,
      costBasisKey: "replacement",
      onSavingChange: vi.fn(),
      onCostSaved: vi.fn(),
    }),
  );
}

beforeEach(() => {
  api.getBuildingInventory.mockReset().mockResolvedValue({ ok: true, data: { lines: [] } });
  api.saveValuationCostApproach
    .mockReset()
    .mockResolvedValue({ ok: true, data: { isSaved: true, buildingPlotAreaSqm: 460, lines: [] } });
});

describe("plotSeedNeedsSave", () => {
  it("is due only for a saved approach with no plot, a seed and an open package", () => {
    expect(plotSeedNeedsSave({ cost: savedCost(null), plotAreaSeed: "460", locked: false })).toBe(true);
    expect(plotSeedNeedsSave({ cost: savedCost(300), plotAreaSeed: "460", locked: false })).toBe(false);
    expect(plotSeedNeedsSave({ cost: savedCost(null, false), plotAreaSeed: "460", locked: false })).toBe(false);
    expect(plotSeedNeedsSave({ cost: savedCost(null), plotAreaSeed: " ", locked: false })).toBe(false);
    expect(plotSeedNeedsSave({ cost: savedCost(null), plotAreaSeed: "460", locked: true })).toBe(false);
    expect(plotSeedNeedsSave({ cost: null, plotAreaSeed: "460", locked: false })).toBe(false);
  });
});

describe("the deed-area seed of the plot box", () => {
  it("is saved without a click when the saved approach has no plot area", async () => {
    const view = render(savedCost(null), "460");
    await waitFor(() => expect(api.saveValuationCostApproach).toHaveBeenCalledTimes(1));
    const request = api.saveValuationCostApproach.mock.calls[0]![2] as { buildingPlotAreaSqm: number };
    expect(request.buildingPlotAreaSqm).toBe(460);
    expect(view.result.current.fields.buildingPlotArea).toBe("460");
  });

  it("leaves a saved plot area, an unsaved approach and a locked package alone", async () => {
    render(savedCost(300), "460");
    render(savedCost(null, false), "460");
    render(savedCost(null), "460", true);
    await new Promise((r) => setTimeout(r, 40));
    expect(api.saveValuationCostApproach).not.toHaveBeenCalled();
  });
});
