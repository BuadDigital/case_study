import { describe, expect, it } from "vitest";
import {
  createInspectorWorkspaceDraft,
  listInspectorPhotoValidationIssues,
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
  for (const id of ["front", "sides", "water", "elec", "inside"]) {
    draft.definedPhotos[id] = {
      none: false,
      photos: [
        {
          id: 1,
          approved: true,
          fileName: `${id}.jpg`,
          mimeType: "image/jpeg",
          attachmentId: `att-${id}`,
        },
      ],
    };
  }
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

  it("uses the same showroom/well photo messages as the backend", () => {
    const draft = completeDraft();
    draft.showroomCount = "2";
    draft.wellCount = "1";

    const issues = listInspectorPhotoValidationIssues(draft);
    expect(issues).toContain("يجب إرفاق صورة المعرض");
    expect(issues).toContain("يجب إرفاق صورة البئر");

    const errors = validateInspectorWorkspace(draft);
    expect(errors.componentPhotos).toBe("يجب إرفاق صورة المعرض");
    expect(errors.featurePhotos).toBeUndefined();
  });
});
