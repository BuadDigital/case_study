import { describe, expect, it } from "vitest";
import {
  inspectorFreePhotoKindsForParent,
  INSPECTOR_FREE_PHOTO_CATEGORY_EXTERIOR,
  INSPECTOR_FREE_PHOTO_CATEGORY_FACADE,
  isApartmentInspectionContext,
  patchInspectorFeatureValues,
  sanitizeInspectorDraftForLand,
  visibleInspectorFeatureFields,
  type InspectorWorkspaceDraft,
} from "../inspector-workspace-data";

const side = (facade: string) => ({
  matches: null,
  mismatchNote: "",
  facade,
  deedDesc: "شارع",
  deedLength: "20",
});

function draft(featureValues: Record<string, string>): InspectorWorkspaceDraft {
  return {
    taskId: "t1",
    propertyId: "p1",
    poNumber: "PO-1",
    vacantLand: false,
    featureValues,
    featurePhotoAttachments: {},
    boundaryMatches: {
      north: side("حجر"),
      south: side(""),
      east: side("زجاج"),
      west: side(""),
    },
  } as unknown as InspectorWorkspaceDraft;
}

describe("apartment: facades are not recorded", () => {
  it("reads the inspector's «الأصل محل التقييم» first, the PO type only before it", () => {
    expect(isApartmentInspectionContext({ assetSubject: "شقة" })).toBe(true);
    expect(isApartmentInspectionContext({ propertyType: "شقة سكنية" })).toBe(true);
    expect(
      isApartmentInspectionContext({ propertyType: "شقة سكنية", assetSubject: "فيلا" }),
    ).toBe(false);
    expect(isApartmentInspectionContext({ assetSubject: "عمارة" })).toBe(false);
    expect(isApartmentInspectionContext({ assetSubject: "أرض" })).toBe(false);
    // «وحدة داخل مبنى» also holds shops and offices — not an apartment by itself.
    expect(isApartmentInspectionContext({ classification: "وحدة داخل مبنى" })).toBe(false);
  });

  it("drops the «الواجهة» row only for an apartment", () => {
    const keys = (isApartment: boolean) =>
      visibleInspectorFeatureFields(false, { isApartment }).map((f) => f.key);
    expect(keys(true)).not.toContain("facade");
    expect(keys(false)).toContain("facade");
    // Nothing else is hidden — an apartment still has building condition, elevator…
    expect(keys(true)).toHaveLength(keys(false).length - 1);
  });

  it("clears the direction and every side's facade type from a saved apartment draft", () => {
    const clean = sanitizeInspectorDraftForLand(
      draft({ assetSubject: "شقة", facade: "شمالية", buildState: "جيد" }),
    );
    expect(clean.featureValues.facade).toBe("");
    expect(clean.featureValues.buildState).toBe("جيد");
    for (const key of ["north", "south", "east", "west"] as const) {
      expect(clean.boundaryMatches[key].facade).toBe("");
      expect(clean.boundaryMatches[key].deedDesc).toBe("شارع");
    }
  });

  it("leaves a villa's facades alone", () => {
    const saved = draft({ assetSubject: "فيلا", facade: "شمالية" });
    expect(sanitizeInspectorDraftForLand(saved)).toBe(saved);
  });

  it("clears the direction when the inspector switches the asset to an apartment", () => {
    const values = patchInspectorFeatureValues(
      { assetSubject: "فيلا", facade: "شرقية" },
      "assetSubject",
      "شقة",
    );
    expect(values.facade).toBe("");
  });

  it("offers no «واجهة» photo kind for an apartment", () => {
    const kinds = (isApartment: boolean) =>
      inspectorFreePhotoKindsForParent(INSPECTOR_FREE_PHOTO_CATEGORY_EXTERIOR, {
        isApartment,
      }).map((k) => k.key);
    expect(kinds(true)).not.toContain(INSPECTOR_FREE_PHOTO_CATEGORY_FACADE);
    expect(kinds(false)).toContain(INSPECTOR_FREE_PHOTO_CATEGORY_FACADE);
  });
});
