import { describe, expect, it } from "vitest";
import { buildInfathUploadModel } from "../infath-upload-model";
import { emptyProperty } from "../po-intake-data";
import type { PoIntakeRecord } from "../po-intake-data";
import type { PropertyDetailDocumentSection } from "../property-detail-documents";

const record = { poNumber: "PO-1" } as unknown as PoIntakeRecord;

function fieldValue(
  model: ReturnType<typeof buildInfathUploadModel>,
  sectionId: string,
  fieldId: string,
): string | undefined {
  return model.sections.find((s) => s.id === sectionId)?.fields.find((f) => f.id === fieldId)?.value;
}

describe("Infath sheet — report data the appraiser no longer types", () => {
  const base = { record, property: emptyProperty(), parties: null, documentSections: [] as PropertyDetailDocumentSection[] };

  it("is empty without a source", () => {
    const model = buildInfathUploadModel(base);
    expect(fieldValue(model, "workers", "worker-name")).toBe("");
    expect(fieldValue(model, "workers", "worker-license")).toBe("");
  });

  it("fills the worker section from the certified appraiser's identity", () => {
    const model = buildInfathUploadModel({
      ...base,
      reportContext: {
        appraiserName: "عماد رشيد صالح الرشيد",
        appraiserLicenseNumber: "1302",
        appraiserLicenseDate: "2022-03-10",
      },
    });
    expect(fieldValue(model, "workers", "worker-name")).toBe("عماد رشيد صالح الرشيد");
    expect(fieldValue(model, "workers", "worker-license")).toBe("1302");
    expect(fieldValue(model, "workers", "worker-license-date")).toContain("2022");
  });

  it("takes the signed appraisal from the final report when the package names none", () => {
    const sections: PropertyDetailDocumentSection[] = [
      {
        id: "final-report",
        title: "التقرير النهائي",
        documents: [
          {
            id: "final-1",
            name: "تقرير التقييم النهائي",
            fileName: "final-report-v1.pdf",
            source: "المقيّم العقاري",
            kind: "pdf",
            dataUrl: "data:application/pdf;base64,AA==",
            documentTypeKey: "valuation-report",
          },
        ],
      },
    ];
    const model = buildInfathUploadModel({ ...base, documentSections: sections });

    expect(fieldValue(model, "appraisal-file", "signed-appraisal")).toBe("final-report-v1.pdf");
    expect(model.attachments.find((a) => a.id === "appraisal")?.status).toBe("ready");
  });
});
