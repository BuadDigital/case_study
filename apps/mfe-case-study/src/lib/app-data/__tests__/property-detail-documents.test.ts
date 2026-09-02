import { describe, expect, it } from "vitest";
import {
  collectFieldInspectionDocumentsFromSubmission,
  inspectorFeaturePhotoLabel,
} from "../property-detail-documents";
import { createInspectorWorkspaceDraft } from "../inspector-workspace-data";

describe("inspectorFeaturePhotoLabel", () => {
  it("maps known feature keys to Arabic", () => {
    expect(inspectorFeaturePhotoLabel("facade")).toBe("الواجهة");
    expect(inspectorFeaturePhotoLabel("hasPool")).toBe("يوجد مسبح");
    expect(inspectorFeaturePhotoLabel("kitchen")).toBe("مطبخ");
    expect(inspectorFeaturePhotoLabel("movables")).toBe("يوجد منقولات");
    expect(inspectorFeaturePhotoLabel("buildState")).toBe("حالة البناء");
    expect(inspectorFeaturePhotoLabel("carEntrance")).toBe("مدخل السيارة");
    expect(inspectorFeaturePhotoLabel("hasBasement")).toBe("يوجد قبو");
    expect(inspectorFeaturePhotoLabel("hasElevator")).toBe("يوجد مصعد");
    expect(inspectorFeaturePhotoLabel("assetSubject")).toBe("الأصل محل التقييم");
    expect(inspectorFeaturePhotoLabel("propertyUsage")).toBe("استخدام العقار");
  });
});

describe("collectFieldInspectionDocumentsFromSubmission", () => {
  it("labels documentation photos in Arabic, not camelCase keys", () => {
    const submission = {
      ...createInspectorWorkspaceDraft({
        taskId: "task-1",
        propertyId: "prop-1",
        poNumber: "PO-1",
      }),
      status: "submitted" as const,
      featurePhotoAttachments: {
        facade: {
          fileName: "image.jpg",
          mimeType: "image/jpeg",
        },
        hasPool: {
          fileName: "pool.jpg",
          mimeType: "image/jpeg",
        },
      },
      componentPhotoAttachments: {
        showroom: {
          fileName: "show.jpg",
          mimeType: "image/jpeg",
        },
        well: {
          fileName: "well.jpg",
          mimeType: "image/jpeg",
        },
      },
    };

    const docs = collectFieldInspectionDocumentsFromSubmission(submission);
    const names = docs.map((d) => d.name);

    expect(names).toContain("صورة توثيقية — الواجهة");
    expect(names).toContain("صورة توثيقية — يوجد مسبح");
    expect(names).toContain("صورة المعرض");
    expect(names).toContain("صورة البئر");
    expect(names.some((n) => /facade|hasPool/i.test(n))).toBe(false);
  });
});
