import { describe, expect, it } from "vitest";
import {
  isInspectorGlancePhoto,
  pickInspectorPrimaryPhoto,
  type PropertyDetailDocumentEntry,
} from "@platform/app-shared/app-data/property-detail-document-types";

function entry(
  partial: Partial<PropertyDetailDocumentEntry> &
    Pick<PropertyDetailDocumentEntry, "id" | "name" | "fileName" | "source" | "kind">,
): PropertyDetailDocumentEntry {
  return partial;
}

describe("inspector glance photo", () => {
  it("rejects intake/deed images for the basic-tab primary slot", () => {
    const deed = entry({
      id: "deed",
      name: "صورة الصك من البورصة",
      fileName: "deed.png",
      source: "استعلام البورصة",
      kind: "image",
      dataUrl: "data:image/png;base64,xxx",
      documentTypeKey: "bourse-deed",
    });
    expect(isInspectorGlancePhoto(deed)).toBe(false);
    expect(pickInspectorPrimaryPhoto([deed])).toBeNull();
  });

  it("accepts field-inspection photos", () => {
    const photo = entry({
      id: "insp",
      name: "واجهة",
      fileName: "facade.jpg",
      source: "المعاين الميداني",
      kind: "image",
      dataUrl: "data:image/jpeg;base64,yyy",
      documentTypeKey: "inspection-photo",
      inspectionPhoto: {
        taskId: "t1",
        photoRef: "slot:facade:1",
        attachment: {
          fileName: "facade.jpg",
          mimeType: "image/jpeg",
          attachmentId: "a1",
          sizeBytes: 10,
        },
      },
    });
    expect(isInspectorGlancePhoto(photo)).toBe(true);
    expect(pickInspectorPrimaryPhoto([photo])?.id).toBe("insp");
  });
});
