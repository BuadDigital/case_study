import { describe, expect, it } from "vitest";
import {
  isLandInspectionContext,
  sanitizeInspectorDraftForLand,
  type InspectorWorkspaceDraft,
} from "../inspector-workspace-data";

function draft(
  patch: Partial<InspectorWorkspaceDraft> & {
    featureValues?: Record<string, string>;
  },
): InspectorWorkspaceDraft {
  return {
    taskId: "t1",
    propertyId: "p1",
    poNumber: "PO-1",
    vacantLand: false,
    featureValues: {},
    featurePhotoAttachments: {},
    ...patch,
  } as InspectorWorkspaceDraft;
}

describe("isLandInspectionContext", () => {
  it("treats a villa origin as a building even when the PO type is vacant land", () => {
    expect(
      isLandInspectionContext({
        assetSubject: "فيلا",
        propertyType: "ارض",
        classification: "سكني",
      }),
    ).toBe(false);
  });

  it("keeps vacant-land origin and the vacant-land flag as land", () => {
    expect(
      isLandInspectionContext({
        assetSubject: "أرض",
        propertyType: "فيلا",
      }),
    ).toBe(true);
    expect(
      isLandInspectionContext({
        vacantLand: true,
        assetSubject: "فيلا",
      }),
    ).toBe(true);
  });

  it("falls back to the PO type only before the inspector chooses an origin", () => {
    expect(
      isLandInspectionContext({
        assetSubject: "",
        propertyType: "ارض",
      }),
    ).toBe(true);
  });
});

describe("sanitizeInspectorDraftForLand", () => {
  it("does not wipe حالة البناء when the inspector recorded a villa on a land PO", () => {
    const saved = draft({
      featureValues: { assetSubject: "فيلا", buildState: "جيد" },
    });
    expect(
      sanitizeInspectorDraftForLand(saved, {
        propertyType: "ارض",
        classification: "سكني",
      }).featureValues.buildState,
    ).toBe("جيد");
  });
});
