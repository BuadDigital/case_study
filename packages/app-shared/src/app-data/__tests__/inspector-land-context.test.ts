import { describe, expect, it } from "vitest";
import {
  isLandInspectionContext,
  preserveInspectorOwnedFeatureValues,
  resolvedInspectorAssetSubject,
  sanitizeInspectorDraftForLand,
  submittedInspectorAssetIsLand,
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

describe("submitted inspector type ownership", () => {
  it("uses the initial type until the inspector submits", () => {
    expect(
      resolvedInspectorAssetSubject({
        status: "draft",
        assetSubject: "أرض",
        initialAssetSubject: "فيلا",
      }),
    ).toBe("فيلا");
    expect(
      resolvedInspectorAssetSubject({
        status: "reopened",
        assetSubject: "أرض",
        initialAssetSubject: "فيلا",
      }),
    ).toBe("فيلا");
  });

  it("uses the inspector type only for a submitted package", () => {
    expect(
      submittedInspectorAssetIsLand({
        status: "submitted",
        assetSubject: "أرض",
        initialAssetSubject: "فيلا",
      }),
    ).toBe(true);
    expect(
      submittedInspectorAssetIsLand({
        status: "draft",
        assetSubject: "أرض",
        initialAssetSubject: "فيلا",
      }),
    ).toBe(false);
  });

  it("preserves assetSubject while applying specialist feature corrections", () => {
    expect(
      preserveInspectorOwnedFeatureValues(
        { assetSubject: "أرض", zoneStatus: "غير موقوفة" },
        { assetSubject: "فيلا", zoneStatus: "موقوفة" },
      ),
    ).toEqual({ assetSubject: "أرض", zoneStatus: "موقوفة" });
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
