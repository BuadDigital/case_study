import { describe, expect, it } from "vitest";
import { createInspectorWorkspaceDraft } from "@platform/app-shared/app-data/inspector-workspace-data";
import { resolveInspectorWorkspacePatch, type InspectorWorkspacePatch } from "../inspector-workspace-model";
import { priorInspectionPatch } from "../prior-inspection-copy";

const current = () => ({
  ...createInspectorWorkspaceDraft({ taskId: "t1", propertyId: "p1", poNumber: "PO-1" }),
  mapPinned: true,
  inspectionDate: "2026-11-01",
  propertyDescription: "قديم",
  roomCount: "2",
  freePhotos: [{ id: "f1" }] as never[],
});

const apply = (payload: Record<string, unknown>): InspectorWorkspacePatch =>
  resolveInspectorWorkspacePatch(current(), priorInspectionPatch(payload));

/** 2026-11-01: the copy fills the answers; this visit keeps its photos, date and pin. */
describe("the copy of an earlier inspection as a draft patch", () => {
  it("takes the answers the server sent", () => {
    const patch = apply({
      propertyDescription: "فيلا دورين",
      roomCount: "6",
      featureValues: { assetSubject: "فيلا" },
      observations: [{ id: "o1", category: "general", text: "شرخ" }],
    });
    expect(patch.propertyDescription).toBe("فيلا دورين");
    expect(patch.roomCount).toBe("6");
    expect(patch.featureValues).toEqual({ assetSubject: "فيلا" });
    expect(patch.observations).toEqual([{ id: "o1", category: "general", text: "شرخ", photo: null }]);
  });

  it("leaves this visit's photos and date alone", () => {
    const patch = apply({ propertyDescription: "فيلا" });
    expect("freePhotos" in patch).toBe(false);
    expect("definedPhotos" in patch).toBe(false);
    expect("inspectionDate" in patch).toBe(false);
  });

  it("takes the point as the inspector's own, unpinned", () => {
    const patch = apply({ mapLatitude: "24.45", mapLongitude: "39.61" });
    expect(patch.mapLatitude).toBe("24.45");
    expect(patch.inspectorMapLatitude).toBe("24.45");
    expect(patch.mapPinned).toBe(false);
  });
});
