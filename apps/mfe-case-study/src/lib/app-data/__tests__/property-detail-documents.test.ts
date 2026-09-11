import { describe, expect, it } from "vitest";
import type {
  PropertyDetailDocumentEntry,
  PropertyDetailDocumentSection,
} from "@platform/app-shared/app-data/property-detail-document-types";
import {
  collectFieldInspectionDocumentsFromSubmission,
  inspectorFeaturePhotoLabel,
  withGovernedDocumentsSection,
} from "../property-detail-documents";

describe("withGovernedDocumentsSection", () => {
  const entry = (
    id: string,
    extra: Partial<PropertyDetailDocumentEntry> = {},
  ): PropertyDetailDocumentEntry => ({
    id,
    name: id,
    fileName: `${id}.pdf`,
    source: "مستندات العقار",
    kind: "pdf",
    attachmentId: `att-${id}`,
    ...extra,
  });
  const sections: PropertyDetailDocumentSection[] = [
    { id: "intake", title: "البيانات الأولية", documents: [entry("reg")] },
    { id: "engineering", title: "المكتب الهندسي", documents: [entry("survey")] },
  ];

  it("adds documents-tab uploads right after the intake section", () => {
    const next = withGovernedDocumentsSection(sections, [
      entry("lease", { governed: true, documentTypeKey: "lease-contract" }),
    ]);

    expect(next.map((s) => s.id)).toEqual(["intake", "governed", "engineering"]);
    expect(next[1]!.documents.map((d) => d.id)).toEqual(["lease"]);
  });

  it("skips intake «other documents» rows and files already listed", () => {
    const next = withGovernedDocumentsSection(sections, [
      entry("other", { governed: false, documentTypeKey: "unlisted" }),
      entry("reg", { governed: true, documentTypeKey: "real-estate-registry" }),
    ]);

    expect(next).toBe(sections);
  });
});
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
        buildLicense: {
          fileName: "license.jpg",
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
    expect(names).toContain("رخصة البناء");
    expect(names.some((n) => /facade|hasPool/i.test(n))).toBe(false);
  });
});

