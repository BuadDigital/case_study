import { renderHook, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

const bridge = vi.hoisted(() => ({ fetchInspectorWorkspace: vi.fn() }));
const api = vi.hoisted(() => ({ getBuildingInventory: vi.fn() }));

vi.mock("../../../../lib/case-study-bridge", async (importOriginal) => ({
  ...(await importOriginal<typeof import("../../../../lib/case-study-bridge")>()),
  ...bridge,
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

import { useCostApproachWorkflow } from "../useCostApproachWorkflow";

type Props = { inspectionTaskId: string | null; cost: { actualAgeYears: number | null; lines: [] } | null };

function render(initial: Props) {
  return renderHook(
    ({ inspectionTaskId, cost }: Props) =>
      useCostApproachWorkflow({
        valuationRequestId: "vr-1",
        poNumber: "PO-1",
        propertyId: "p-1",
        inspectionTaskId,
        cost: cost as never,
        hydrateKey: 1,
        buildingOnly: true,
        costBasisKey: "replacement",
        onSavingChange: vi.fn(),
        onCostSaved: vi.fn(),
      }),
    { initialProps: initial },
  );
}

beforeEach(() => {
  bridge.fetchInspectorWorkspace.mockReset();
  api.getBuildingInventory.mockReset();
  api.getBuildingInventory.mockResolvedValue({ ok: true, data: { lines: [] } });
  bridge.fetchInspectorWorkspace.mockResolvedValue({ propertyAgeYears: "9" });
});

describe("«العمر الفعلي» before the cost approach is saved", () => {
  it("takes the inspector's age when the inspection id arrives after the first load", async () => {
    const view = render({ inspectionTaskId: null, cost: null });
    view.rerender({ inspectionTaskId: "insp-1", cost: null });
    await waitFor(() => expect(view.result.current.fields.actualAge).toBe("9"));
  });

  it("keeps the inspector's age when the cost object is replaced while it is being read", async () => {
    const view = render({ inspectionTaskId: "insp-1", cost: null });
    view.rerender({ inspectionTaskId: "insp-1", cost: { actualAgeYears: null, lines: [] } });
    await waitFor(() => expect(view.result.current.fields.actualAge).toBe("9"));
  });

  it("never replaces an age the appraiser saved", async () => {
    const view = render({ inspectionTaskId: "insp-1", cost: { actualAgeYears: 15, lines: [] } });
    await new Promise((r) => setTimeout(r, 20));
    expect(bridge.fetchInspectorWorkspace).not.toHaveBeenCalled();
    expect(view.result.current.fields.actualAge).not.toBe("9");
  });
});
