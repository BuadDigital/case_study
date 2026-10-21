import { describe, expect, it } from "vitest";
import {
  createInspectorWorkspaceDraft,
  INSPECTOR_FEATURE_FIELDS,
  inspectorFeatureOffersPhoto,
  inspectorFeatureRequiresPhoto,
} from "@platform/app-shared/app-data/inspector-workspace-data";
import { movablesPhotosResetPatch } from "../../../components/field-inspection/inspector-wizard-state";
import { validateInspectorWorkspace } from "../inspector-workspace-validation";

const att = { fileName: "a.jpg", mimeType: "image/jpeg", attachmentId: "11111111-1111-1111-1111-111111111111" };
const slot = { "feature:movables": { none: false, photos: [{ id: 1, approved: true, ...att }] } };

function errorsFor(extra: object, values: Record<string, string> = {}) {
  const base = createInspectorWorkspaceDraft({ taskId: "t", propertyId: "p", poNumber: "po" });
  return validateInspectorWorkspace(
    {
      ...base,
      ...extra,
      featureValues: { ...base.featureValues, movables: "نعم", movablesDescription: "أثاث", ...values },
    } as never,
    {},
  );
}

describe("photos on chosen components are optional (Omar 2026-10-21)", () => {
  it("offers the picker on «نعم» but never requires it", () => {
    for (const key of ["movables", "carEntrance", "hasBasement", "hasElevator", "hasPool", "kitchen"]) {
      const field = INSPECTOR_FEATURE_FIELDS.find((f) => f.key === key)!;
      expect(inspectorFeatureOffersPhoto(field, "نعم")).toBe(true);
      expect(inspectorFeatureRequiresPhoto(field, "نعم")).toBe(false);
    }
  });

  it("a chosen component with no photo does not block submit", () => {
    const errors = errorsFor({}, { hasPool: "نعم", kitchen: "نعم", hasElevator: "نعم" });
    expect(errors.featurePhotos).toBeUndefined();
    expect(errors.missingFeaturePhotoKey).toBeUndefined();
  });
});

describe("«يوجد منقولات» photos", () => {
  it("any one photo — new slot or the old single proof — is accepted", () => {
    expect(errorsFor({ definedPhotos: slot }).featurePhotos).toBeUndefined();
    expect(errorsFor({ featurePhotoAttachments: { movables: att } }).featurePhotos).toBeUndefined();
  });

  it("a slot photo that never reached the server still has to be uploaded first", () => {
    const local = { "feature:movables": { none: false, photos: [{ id: 1, approved: true, fileName: "a.jpg", mimeType: "image/jpeg" }] } };
    expect(errorsFor({ definedPhotos: local }).featurePhotos).toContain("يجب رفع الصور");
  });

  it("switching away from «نعم» drops the photos; staying on «نعم» keeps them", () => {
    const draft = { definedPhotos: slot } as never;
    expect(movablesPhotosResetPatch(draft, "movables", "لا").definedPhotos?.["feature:movables"]?.photos).toEqual([]);
    expect(movablesPhotosResetPatch(draft, "movables", "نعم")).toEqual({});
    expect(movablesPhotosResetPatch(draft, "kitchen", "لا")).toEqual({});
  });
});
