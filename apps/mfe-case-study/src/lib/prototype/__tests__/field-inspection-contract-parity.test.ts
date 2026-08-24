import { describe, expect, it, vi } from "vitest";
import {
  createInspectorWorkspaceDraft,
  inspectionStampFromNow,
  INSPECTOR_FEATURE_FIELDS,
  listInspectorPhotoValidationIssues,
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

  it("does not require showroom/well photos (optional, mirrors the backend)", () => {
    const draft = completeDraft();
    draft.showroomCount = "2";
    draft.wellCount = "1";

    const issues = listInspectorPhotoValidationIssues(draft);
    expect(issues).not.toContain("يجب إرفاق صورة المعرض");
    expect(issues).not.toContain("يجب إرفاق صورة البئر");

    const errors = validateInspectorWorkspace(draft);
    expect(errors.componentPhotos).toBeUndefined();
    expect(errors.featurePhotos).toBeUndefined();
  });

  it("does not require a photo when a service chip is selected without one", () => {
    const draft = completeDraft();
    draft.services = ["كهرباء", "مياه"];
    // only first service has a photo in completeDraft shape — water slot stays empty

    const issues = listInspectorPhotoValidationIssues(draft);
    expect(issues.some((i) => i.includes("خدمة") || i.includes("مرفق"))).toBe(
      false,
    );
    expect(validateInspectorWorkspace(draft).definedPhotos).toBeUndefined();
  });

  it("requires a movables description when the inspector answers yes", () => {
    const draft = completeDraft();
    for (const field of INSPECTOR_FEATURE_FIELDS) {
      draft.featureValues[field.key] = field.options[0] ?? "نعم";
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
