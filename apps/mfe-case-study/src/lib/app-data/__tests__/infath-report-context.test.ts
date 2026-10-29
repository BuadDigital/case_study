import { describe, expect, it } from "vitest";
import {
  buildInfathUploadModel,
  infathApproachesUsed,
  INFATH_NOT_APPLICABLE_APARTMENT,
  INFATH_NOT_APPLICABLE_LAND,
} from "../infath-upload-model";
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

  it("reads typed areas by the shared number rule («12,5» is 12.5, not 125)", () => {
    const inspection = {
      roleKey: "inspection",
      hasData: true,
      acceptedAtUtc: "2026-10-01T10:00:00Z",
      fields: [{ label: "المساحة الفعلية", value: "12.5" }],
      answers: [],
      remarks: [],
    } as unknown as NonNullable<Parameters<typeof buildInfathUploadModel>[0]["parties"]>[string];
    const model = (area: string) =>
      buildInfathUploadModel({
        ...base,
        property: { ...emptyProperty(), area },
        parties: { inspection },
      });
    expect(fieldValue(model("12,5"), "survey-conditional", "area-diff")).toBe("لا");
    expect(fieldValue(model("١٢٫٥"), "survey-conditional", "area-diff")).toBe("لا");
    expect(fieldValue(model("125"), "survey-conditional", "area-diff")).toBe("نعم");
  });

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

  const finalReport = {
    id: "final-1",
    name: "تقرير التقييم النهائي",
    fileName: "final-report-v1.pdf",
    source: "المقيّم العقاري",
    kind: "pdf" as const,
    dataUrl: "data:application/pdf;base64,AA==",
    documentTypeKey: "valuation-report",
  };

  it("takes the signed appraisal from the generated final report", () => {
    const model = buildInfathUploadModel({ ...base, attachmentSources: { finalReport } });

    expect(fieldValue(model, "appraisal-file", "signed-appraisal")).toBe("final-report-v1.pdf");
    const row = model.attachments.find((a) => a.id === "appraisal");
    expect(row?.status).toBe("ready");
    expect(row?.document).toBe(finalReport);
  });

  it("never offers the appraiser's old system-generated report as the approved one", () => {
    const legacy: PropertyDetailDocumentSection[] = [
      {
        id: "appraisal",
        title: "التقييم",
        documents: [
          {
            id: "appraisal-report",
            name: "تقرير التقييم",
            fileName: "TQ-2026-00474.pdf",
            source: "المقيّم العقاري",
            kind: "pdf",
            attachmentId: "old-file",
            documentTypeKey: "valuation-report",
          },
        ],
      },
    ];
    const model = buildInfathUploadModel({ ...base, documentSections: legacy });

    expect(fieldValue(model, "appraisal-file", "signed-appraisal")).toBe("");
    expect(model.attachments.find((a) => a.id === "appraisal")?.status).toBe("missing");
  });
});

describe("Infath sheet — upload attachments", () => {
  const base = { record, property: emptyProperty(), parties: null, documentSections: [] as PropertyDetailDocumentSection[] };
  const row = (model: ReturnType<typeof buildInfathUploadModel>, id: string) =>
    model.attachments.find((a) => a.id === id);

  it("offers the case-study report once it is issued, never from an uploaded file", () => {
    expect(row(buildInfathUploadModel(base), "case-study")?.status).toBe("missing");
    const issued = buildInfathUploadModel({
      ...base,
      property: { ...emptyProperty(), deedNumber: "394909001924" },
      attachmentSources: { caseStudyReportIssued: true },
    });
    expect(row(issued, "case-study")?.status).toBe("ready");
    expect(row(issued, "case-study")?.document?.fileName).toBe("تقرير دراسة الحالة - 394909001924.pdf");
  });

  it("says plainly that there is no survey when the transaction has no survey task", () => {
    const none = row(buildInfathUploadModel(base), "survey");
    expect(none?.status).toBe("not-needed");
    expect(none?.statusNote).toBe("لا يوجد رفع مساحي");
    expect(row(buildInfathUploadModel({ ...base, attachmentSources: { hasSurveyTask: true } }), "survey")?.status).toBe(
      "missing",
    );
  });

  it("takes a deed stored on the server even without bytes in this browser", () => {
    const sections: PropertyDetailDocumentSection[] = [
      {
        id: "intake",
        title: "البيانات الأولية",
        documents: [
          { id: "deed", name: "الصك", fileName: "deed.pdf", source: "s", kind: "pdf", attachmentId: "att-deed", documentTypeKey: "deed" },
        ],
      },
    ];
    expect(row(buildInfathUploadModel({ ...base, documentSections: sections }), "deed")?.status).toBe("ready");
  });

  it("downloads the stored deposit certificate", () => {
    const certificate = { id: "c", name: "شهادة", fileName: "cert.pdf", source: "s", kind: "pdf" as const, attachmentId: "att-c" };
    expect(row(buildInfathUploadModel(base), "deposit-certificate")?.status).toBe("missing");
    const model = buildInfathUploadModel({ ...base, attachmentSources: { depositCertificate: certificate } });
    expect(row(model, "deposit-certificate")?.status).toBe("ready");
    expect(row(model, "deposit-certificate")?.document).toBe(certificate);
  });
});

describe("Infath sheet — bare land", () => {
  const record = { poNumber: "PO-1" } as unknown as PoIntakeRecord;
  const fieldOf = (model: ReturnType<typeof buildInfathUploadModel>, id: string) =>
    model.sections.flatMap((s) => s.fields).find((f) => f.id === id);
  const inspection = (asset: string, rooms = "") =>
    ({
      roleKey: "inspection",
      hasData: true,
      acceptedAtUtc: "2026-10-01T10:00:00Z",
      fields: [
        { label: "الأصل محل التقييم", value: asset },
        { label: "عدد الغرف", value: rooms },
      ],
      answers: [],
      remarks: [],
    }) as unknown as NonNullable<Parameters<typeof buildInfathUploadModel>[0]["parties"]>[string];
  const build = (asset: string, rooms = "", componentLines: unknown[] = []) =>
    buildInfathUploadModel({
      record,
      property: emptyProperty(),
      parties: { inspection: inspection(asset, rooms) },
      documentSections: [],
      componentLines: componentLines as never,
    });

  it("reads «لا ينطبق — أرض» for the empty building fields, not «missing»", () => {
    const rooms = fieldOf(build("أرض"), "rooms");
    expect(rooms?.value).toBe(INFATH_NOT_APPLICABLE_LAND);
    expect(fieldOf(build("أرض"), "elevator")?.state).toBe("");
  });

  it("keeps a typed value, land with listed components, and any building as they were", () => {
    expect(fieldOf(build("أرض", "2"), "rooms")?.value).toBe("2");
    expect(fieldOf(build("أرض", "", [{ label: "غرفة حارس" }]), "rooms")?.value).toBe("");
    expect(fieldOf(build("فيلا"), "rooms")?.value).toBe("");
  });
});

describe("Infath sheet — valuation date and apartment facade", () => {
  const record = { poNumber: "PO-1" } as unknown as PoIntakeRecord;
  const fieldOf = (model: ReturnType<typeof buildInfathUploadModel>, id: string) =>
    model.sections.flatMap((s) => s.fields).find((f) => f.id === id);

  it("prints a retrospective valuation date instead of the sent date", () => {
    const model = buildInfathUploadModel({
      record,
      property: emptyProperty(),
      parties: null,
      documentSections: [],
      reportContext: { valuationDate: "2026-06-30" },
    });
    expect(fieldOf(model, "appraisal-date")?.value).toBe("30/06/2026");
  });

  it("names every approach used, not only the first method (market + cost)", () => {
    const appraisal = {
      roleKey: "appraisal",
      hasData: true,
      submittedAtUtc: "2026-10-01T10:00:00Z",
      fields: [{ label: "الأسلوب المستخدم", value: "طريقة المقارنة" }],
      answers: [],
      remarks: [],
    } as unknown as NonNullable<Parameters<typeof buildInfathUploadModel>[0]["parties"]>[string];
    const build = (approachesUsed?: string, withAppraisal = true) =>
      buildInfathUploadModel({
        record,
        property: emptyProperty(),
        parties: withAppraisal ? { appraisal } : null,
        documentSections: [],
        reportContext: { approachesUsed },
      });

    const both = infathApproachesUsed({ marketApproachEnabled: true, costApproachEnabled: true });
    expect(both).toBe("أسلوب السوق و أسلوب التكلفة");
    expect(infathApproachesUsed({ costApproachEnabled: true })).toBe("أسلوب التكلفة");
    expect(fieldOf(build(both), "method")?.value).toBe("أسلوب السوق و أسلوب التكلفة");
    // no settings read → the appraiser's package; no accepted valuation yet → nothing
    expect(fieldOf(build(undefined), "method")?.value).toBe("طريقة المقارنة");
    expect(fieldOf(build(both, false), "method")?.value).toBe("");
  });

  it("an apartment's facade is not applicable, not missing", () => {
    const model = buildInfathUploadModel({
      record,
      property: { ...emptyProperty(), classification: "وحدة داخل مبنى", propertyType: "شقة سكنية" },
      parties: null,
      documentSections: [],
    });
    expect(fieldOf(model, "facade")?.value).toBe(INFATH_NOT_APPLICABLE_APARTMENT);
  });
});

