import { describe, expect, it } from "vitest";
import {
  createInspectorWorkspaceDraft,
  type InspectorFreePhoto,
} from "@platform/app-shared/app-data/inspector-workspace-data";
import {
  collectFieldInspectionDocumentsFromSubmission,
  STAFF_ADDED_PHOTO_NAME,
  STAFF_ADDED_PHOTO_SOURCE,
} from "../property-detail-documents";
import { staffAddedPhoto, staffPhotoAddRefusal, withoutStaffPhoto } from "../staff-added-photos";

// Omar 2026-11-12: the study adds its own photos to a sent inspection, from the work page's «صور التقرير».

const attachment = { fileName: "site.jpg", mimeType: "image/jpeg", attachmentId: "att-9", sizeBytes: 1200 };

describe("staffPhotoAddRefusal", () => {
  it("lets photos be added to a sent inspection only", () => {
    expect(staffPhotoAddRefusal({ status: "submitted" })).toBeNull();
    expect(staffPhotoAddRefusal({ status: "draft" })).toContain("لدى المعاين");
    expect(staffPhotoAddRefusal({ status: "reopened" })).toContain("لدى المعاين");
    expect(staffPhotoAddRefusal(null)).toContain("لا توجد معاينة");
  });
});

describe("staffAddedPhoto", () => {
  it("marks the photo as the staff's, with who added it and when", () => {
    expect(
      staffAddedPhoto({ id: 41, attachment, addedByName: " عمر الحمراني ", nowIso: "2026-11-12T09:00:00.000Z" }),
    ).toEqual({
      id: 41,
      category: "other",
      approved: true,
      uploadedBy: "specialist",
      uploadedByName: "عمر الحمراني",
      uploadedAtUtc: "2026-11-12T09:00:00.000Z",
      ...attachment,
    });
  });

  it("leaves a blank name out", () => {
    const photo = staffAddedPhoto({ id: 1, attachment, addedByName: " ", nowIso: "2026-11-12T09:00:00.000Z" });
    expect("uploadedByName" in photo).toBe(false);
  });
});

describe("withoutStaffPhoto", () => {
  const free = (id: number, uploadedBy?: InspectorFreePhoto["uploadedBy"]): InspectorFreePhoto => ({
    id,
    category: "other",
    approved: true,
    fileName: `${id}.jpg`,
    mimeType: "image/jpeg",
    ...(uploadedBy ? { uploadedBy } : {}),
  });
  const photos = [free(1), free(2, "inspector"), free(3, "specialist")];

  it("removes the staff's photo", () => {
    expect(withoutStaffPhoto(photos, 3).map((p) => p.id)).toEqual([1, 2]);
  });

  it("never removes the inspector's photos", () => {
    expect(withoutStaffPhoto(photos, 1)).toHaveLength(3);
    expect(withoutStaffPhoto(photos, 2)).toHaveLength(3);
    expect(withoutStaffPhoto(photos, 99)).toHaveLength(3);
  });
});

describe("the documents list", () => {
  it("never shows a staff photo as the inspector's", () => {
    const draft = {
      ...createInspectorWorkspaceDraft({ taskId: "insp-1", propertyId: "p1", poNumber: "PO-1" }),
      status: "submitted" as const,
      freePhotos: [
        { id: 1, category: "exterior:facade", approved: true, fileName: "a.jpg", mimeType: "image/jpeg" },
        staffAddedPhoto({ id: 2, attachment, addedByName: "عمر الحمراني", nowIso: "2026-11-12T09:00:00.000Z" }),
      ],
    };
    const entries = collectFieldInspectionDocumentsFromSubmission(draft).filter((e) =>
      e.id.startsWith("inspection-free-"),
    );
    const [inspectors, staffs] = entries;
    expect(inspectors).toMatchObject({ id: "inspection-free-1", source: "المعاين الميداني" });
    expect(inspectors?.addedByStaff).toBeUndefined();
    expect(staffs).toMatchObject({
      id: "inspection-free-2",
      name: STAFF_ADDED_PHOTO_NAME,
      source: STAFF_ADDED_PHOTO_SOURCE,
      addedByStaff: { freePhotoId: 2, name: "عمر الحمراني", atUtc: "2026-11-12T09:00:00.000Z" },
    });
    // It can still be chosen for the report boards: it keeps the inspection's photo handle.
    expect(staffs?.inspectionPhoto).toMatchObject({ taskId: "insp-1", photoRef: "free:2" });
  });
});
