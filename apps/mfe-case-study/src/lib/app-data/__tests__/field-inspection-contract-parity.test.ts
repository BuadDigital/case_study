import { describe, expect, it, vi } from "vitest";
import {
  createInspectorWorkspaceDraft,
  inspectionStampFromNow,
  INSPECTOR_FEATURE_FIELDS,
  listInspectorPhotoValidationIssues,
  inspectorFeatureRequiresPhoto,
  serviceAmenityPhotoSlotId,
} from "../inspector-workspace-data";
import { validateInspectorWorkspace } from "../inspector-workspace-validation";

function completeDraft() {
  const draft = createInspectorWorkspaceDraft({
    taskId: "task-1",
    propertyId: "prop-1",
    poNumber: "PO-1",
  });
  draft.inspectionConfirmed = true;
  draft.hasAnnex = "لا";
  draft.services = ["كهرباء"];
  draft.amenities = ["مساجد"];
  const serviceSlot = serviceAmenityPhotoSlotId("service", "كهرباء");
  const amenitySlot = serviceAmenityPhotoSlotId("amenity", "مساجد");
  draft.definedPhotos[serviceSlot] = {
    none: false,
    photos: [
      {
        id: 1,
        approved: true,
        fileName: "electricity.jpg",
        mimeType: "image/jpeg",
        attachmentId: "att-service",
      },
    ],
  };
  draft.definedPhotos[amenitySlot] = {
    none: false,
    photos: [
      {
        id: 2,
        approved: true,
        fileName: "mosque.jpg",
        mimeType: "image/jpeg",
        attachmentId: "att-amenity",
      },
    ],
  };
  return draft;
}

describe("Field inspection frontend/backend rule parity", () => {
  it("rejects coordinates outside Saudi Arabia (mirrors ValidateGps)", () => {
    const draft = completeDraft();
    draft.mapLatitude = "0.003054";
    draft.mapLongitude = "0.005699";

    expect(validateInspectorWorkspace(draft).mapLatitude).toBe(
      "يجب تحديد موقع العقار (GPS)",
    );
  });

  it("rejects legacy Red Sea demo coordinates", () => {
    const draft = completeDraft();
    draft.mapLatitude = "21.5433";
    draft.mapLongitude = "39.1728";

    expect(validateInspectorWorkspace(draft).mapLatitude).toBe(
      "يجب تحديد موقع العقار (GPS)",
    );
  });

  it("requires showroom/well photos when counts are positive", () => {
    const draft = completeDraft();
    draft.showroomCount = "2";
    draft.wellCount = "1";

    const issues = listInspectorPhotoValidationIssues(draft);
    expect(issues).toContain("يجب إرفاق صورة المعرض");
    expect(issues).toContain("يجب إرفاق صورة البئر");

    const errors = validateInspectorWorkspace(draft);
    expect(errors.componentPhotos).toBe("يجب إرفاق صورة المعرض");
  });

  it("skips building feature fields and component photos on vacant land", () => {
    const draft = completeDraft();
    draft.featureValues.assetSubject = "أرض";
    draft.vacantLand = true;
    draft.showroomCount = "2";
    draft.featureValues.kitchen = "نعم";

    const errors = validateInspectorWorkspace(draft, { classification: "أرض" });
    expect(errors.emptyFeatureKeys ?? []).not.toContain("facade");
    expect(errors.emptyFeatureKeys ?? []).not.toContain("kitchen");
    expect(errors.featurePhotos).toBeUndefined();
    expect(errors.componentPhotos).toBeUndefined();
  });

  it("does not require a leftover facade photo when الأصل is أرض", () => {
    const draft = completeDraft();
    draft.vacantLand = false;
    draft.featureValues.assetSubject = "أرض";
    draft.featureValues.facade = "شمالية";

    const errors = validateInspectorWorkspace(draft);
    expect(errors.featurePhotos).toBeUndefined();
    expect(errors.emptyFeatureKeys ?? []).not.toContain("facade");
  });

  it("does not require a leftover facade photo when الأصل is أرضي", () => {
    const draft = completeDraft();
    draft.vacantLand = false;
    draft.featureValues.assetSubject = "أرضي";
    draft.featureValues.facade = "شمالية";

    const errors = validateInspectorWorkspace(draft);
    expect(errors.featurePhotos).toBeUndefined();
    expect(errors.emptyFeatureKeys ?? []).not.toContain("facade");
  });

  it("does not require proof photos for الأصل محل التقييم or استخدام العقار", () => {
    const draft = completeDraft();
    draft.featureValues.assetSubject = "أرض";
    draft.featureValues.propertyUsage = "سكني";

    expect(inspectorFeatureRequiresPhoto(
      INSPECTOR_FEATURE_FIELDS.find((f) => f.key === "assetSubject")!,
      "أرض",
    )).toBe(false);
    expect(inspectorFeatureRequiresPhoto(
      INSPECTOR_FEATURE_FIELDS.find((f) => f.key === "propertyUsage")!,
      "سكني",
    )).toBe(false);
    expect(validateInspectorWorkspace(draft, { classification: "أرض" }).featurePhotos).toBeUndefined();
  });

  it("skips well photo and shop-hidden leftover counts for محل تجاري", () => {
    const draft = completeDraft();
    draft.featureValues.assetSubject = "محل تجاري";
    draft.wellCount = "3";
    draft.showroomCount = "1";

    const issues = listInspectorPhotoValidationIssues(draft, { isShop: true });
    expect(issues).not.toContain("يجب إرفاق صورة البئر");
    expect(issues).toContain("يجب إرفاق صورة المعرض");

    const errors = validateInspectorWorkspace(draft, {
      classification: "محل تجاري",
    });
    expect(errors.componentPhotos).toBe("يجب إرفاق صورة المعرض");
  });

  it("requires a photo when a service chip is selected without one", () => {
    const draft = completeDraft();
    draft.services = ["كهرباء", "مياه"];

    const issues = listInspectorPhotoValidationIssues(draft);
    expect(issues.some((i) => i.includes("خدمة") || i.includes("مرفق"))).toBe(
      true,
    );
    expect(validateInspectorWorkspace(draft).definedPhotos).toBeDefined();
  });

  it("requires a movables description when the inspector answers yes", () => {
    const draft = completeDraft();
    for (const field of INSPECTOR_FEATURE_FIELDS) {
      draft.featureValues[field.key] = field.options[0] ?? "نعم";
      if (inspectorFeatureRequiresPhoto(field, draft.featureValues[field.key])) {
        draft.featurePhotoAttachments[field.key] = {
          fileName: `${field.key}.jpg`,
          mimeType: "image/jpeg",
          attachmentId: `att-${field.key}`,
        };
      }
    }
    draft.featureValues.movables = "نعم";
    draft.featureValues.movablesDescription = "";

    expect(validateInspectorWorkspace(draft).movablesDescription).toBe(
      "وصف المنقولات مطلوب عند اختيار «نعم»",
    );

    draft.featureValues.movablesDescription = "أثاث ومكيفات";
    expect(validateInspectorWorkspace(draft).movablesDescription).toBeUndefined();
  });

  it("stamps local inspection date and time when the inspector first opens", () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date(2026, 7, 24, 15, 31, 0));
    expect(inspectionStampFromNow()).toEqual({
      inspectionDate: "2026-08-24",
      inspectionTime: "15:31",
    });
    const draft = createInspectorWorkspaceDraft({
      taskId: "task-1",
      propertyId: "prop-1",
      poNumber: "PO-1",
    });
    expect(draft.inspectionDate).toBe("2026-08-24");
    expect(draft.inspectionTime).toBe("15:31");
    vi.useRealTimers();
  });
});
