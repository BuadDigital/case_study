import { describe, expect, it } from "vitest";
import {
  buildInfathUploadModel,
  infathApproachesUsed,
  infathLinkedDeedLabels,
  infathValuationFigures,
  INFATH_NOT_APPLICABLE_APARTMENT,
  INFATH_NOT_APPLICABLE_BUILDING_ONLY_SCOPE,
  INFATH_NOT_APPLICABLE_LAND,
  INFATH_NOT_APPLICABLE_LAND_ONLY_SCOPE,
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

  // A→Z 2026-11-04: the approved report's date, not the day the appraiser handed his package over.
  it("prints the approved report date as «تاريخ إصدار التقرير»", () => {
    const model = buildInfathUploadModel({ ...base, opsContext: { reportDate: "2026-11-05" } });
    expect(fieldValue(model, "report-meta", "issue-date")).toContain("2026");
    expect(fieldValue(model, "report-meta", "issue-date")).toContain("05");
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

type PartyStub = NonNullable<Parameters<typeof buildInfathUploadModel>[0]["parties"]>[string];

describe("Infath sheet — value estimate from the valuation's results (A→Z #1/#18/#27/#85)", () => {
  const recon = {
    finalOpinionValue: 2_227_000,
    finalOpinionBeforeLiquidation: 2_474_000,
    additionsTotal: 0,
    liquidationDiscountApplied: false,
    liquidationDiscountPct: 0,
  };
  const landAndBuilding = {
    costApproachEnabled: false,
    costScopeKey: "land_and_building",
    isLandPropertyType: false,
    hasStructuresToValue: true,
  };

  it("is null without a final value (the sheet keeps the package)", () => {
    expect(infathValuationFigures({ recon: null })).toBeNull();
    expect(infathValuationFigures({ recon: { ...recon, finalOpinionValue: 0 } })).toBeNull();
  });

  it("market approach alone: the total is the final value and the land / buildings split is unknown", () => {
    expect(infathValuationFigures({ settings: landAndBuilding, recon })).toMatchObject({
      totalValue: 2_227_000,
      landValue: null,
      buildingsValue: null,
      forcedDiscountPct: null,
      forcedSaleValue: null,
    });
  });

  it("cost approach: land and buildings after depreciation come from it", () => {
    const figures = infathValuationFigures({
      settings: { ...landAndBuilding, costApproachEnabled: true },
      recon,
      cost: { landValueFromMarket: 1_965_359, landEstimateComplete: true, buildingsValueAfterDepreciation: 850_290 },
    });
    expect(figures?.landValue).toBe(1_965_359);
    expect(figures?.buildingsValue).toBe(850_290);
  });

  it("a liquidation discount: the total is the value before it, the final value is the forced-sale value", () => {
    const figures = infathValuationFigures({
      settings: landAndBuilding,
      recon: { ...recon, liquidationDiscountApplied: true, liquidationDiscountPct: 10 },
    });
    expect(figures).toMatchObject({ totalValue: 2_474_000, forcedDiscountPct: 10, forcedSaleValue: 2_227_000 });
  });

  it("the scope decides: bare land / «أرض فقط» is all land, «مباني فقط» all buildings", () => {
    const land = infathValuationFigures({
      settings: { ...landAndBuilding, isLandPropertyType: true, hasStructuresToValue: false },
      recon,
    });
    expect(land).toMatchObject({ landValue: 2_227_000, buildingsValue: null, buildingsNote: INFATH_NOT_APPLICABLE_LAND });
    const landOnly = infathValuationFigures({ settings: { ...landAndBuilding, costScopeKey: "land_only" }, recon });
    expect(landOnly?.buildingsNote).toBe(INFATH_NOT_APPLICABLE_LAND_ONLY_SCOPE);
    const buildingOnly = infathValuationFigures({
      settings: { ...landAndBuilding, costScopeKey: "building_only" },
      recon,
    });
    expect(buildingOnly).toMatchObject({
      landValue: null,
      buildingsValue: 2_227_000,
      landNote: INFATH_NOT_APPLICABLE_BUILDING_ONLY_SCOPE,
    });
  });

  const appraisal = (fields: Array<{ label: string; value: string }>) =>
    ({
      roleKey: "appraisal",
      hasData: true,
      submittedAtUtc: "2026-11-02T10:00:00Z",
      fields,
      answers: [],
      remarks: [],
    }) as unknown as PartyStub;
  const valueOf = (model: ReturnType<typeof buildInfathUploadModel>, id: string) =>
    model.sections.find((s) => s.id === "valuation")?.fields.find((f) => f.id === id);
  const zeros = [
    { label: "سعر التقييم", value: "2,227,000" },
    { label: "قيمة الأرض (ر.س)", value: "0" },
    { label: "قيمة المباني (ر.س)", value: "0" },
  ];

  it("prints the valuation's figures, never the package's zeros", () => {
    const model = buildInfathUploadModel({
      record,
      property: emptyProperty(),
      parties: { appraisal: appraisal(zeros) },
      documentSections: [],
      reportContext: {
        valuation: infathValuationFigures({
          settings: { ...landAndBuilding, costApproachEnabled: true },
          recon: {
            ...recon,
            finalOpinionValue: 2_816_000,
            finalOpinionBeforeLiquidation: 3_128_000,
            liquidationDiscountApplied: true,
            liquidationDiscountPct: 10,
          },
          cost: { landValueFromMarket: 1_965_359, landEstimateComplete: true, buildingsValueAfterDepreciation: 850_290 },
        }),
      },
    });
    expect(valueOf(model, "land-value")?.value).toBe("1,965,359");
    expect(valueOf(model, "build-value")?.value).toBe("850,290");
    expect(valueOf(model, "total-value")?.value).toBe("3,128,000");
    expect(valueOf(model, "forced-pct")?.value).toBe("10%");
    expect(valueOf(model, "forced-value")?.value).toBe("2,816,000");
    // 1,965,359 + 850,290 ≠ 3,128,000 and Enfaz sums land + buildings — the specialist is warned.
    expect(valueOf(model, "land-value")?.state).toBe("un");
  });

  it("without the valuation's figures, a «0» reads as not entered and the total is the final value", () => {
    const model = buildInfathUploadModel({
      record,
      property: emptyProperty(),
      parties: { appraisal: appraisal(zeros) },
      documentSections: [],
    });
    expect(valueOf(model, "land-value")?.value).toBe("");
    expect(valueOf(model, "build-value")?.value).toBe("");
    expect(valueOf(model, "total-value")?.value).toBe("2,227,000");
  });

  it("ignores a discount left in the package when the basis has none", () => {
    const model = buildInfathUploadModel({
      record,
      property: emptyProperty(),
      parties: { appraisal: appraisal([...zeros, { label: "نسبة خصم البيع القسري", value: "10" }]) },
      documentSections: [],
      reportContext: { valuation: infathValuationFigures({ settings: landAndBuilding, recon }) },
    });
    expect(valueOf(model, "forced-pct")?.value).toBe("");
    expect(valueOf(model, "forced-value")?.value).toBe("");
    expect(valueOf(model, "total-value")?.value).toBe("2,227,000");
  });

  it("waits for the valuation to be handed over", () => {
    const model = buildInfathUploadModel({
      record,
      property: emptyProperty(),
      parties: null,
      documentSections: [],
      reportContext: { valuation: infathValuationFigures({ settings: landAndBuilding, recon }) },
    });
    expect(valueOf(model, "total-value")?.value).toBe("");
  });
});

describe("Infath sheet — land fields the inspector is never asked (A→Z #3)", () => {
  const inspection = {
    roleKey: "inspection",
    hasData: true,
    acceptedAtUtc: "2026-10-01T10:00:00Z",
    fields: [{ label: "الأصل محل التقييم", value: "أرض" }],
    answers: [],
    remarks: [],
  } as unknown as PartyStub;

  it("reads «لا ينطبق — أرض» for facade, wells, landscaping, occupancy, floors and the building areas", () => {
    const model = buildInfathUploadModel({
      record,
      property: emptyProperty(),
      parties: { inspection },
      documentSections: [],
    });
    const fields = model.sections.flatMap((s) => s.fields);
    for (const id of [
      "facade",
      "wells",
      "landscaping",
      "occupancy",
      "floors",
      "basement-total",
      "annex-total",
      "buildings-total",
      "build-value",
    ]) {
      expect(fields.find((f) => f.id === id), id).toMatchObject({ value: INFATH_NOT_APPLICABLE_LAND, state: "" });
    }
  });
});

describe("Infath sheet — linked assets (A→Z #4)", () => {
  const deed = (propertyId: string, deedNumber: string, isRemoved = false) => ({
    propertyId,
    poNumber: "PO-1",
    deedNumber,
    city: "",
    district: "",
    isRemoved,
    createdAtUtc: "",
  });
  const linkedOf = (labels: string[] | null) => {
    const model = buildInfathUploadModel({
      record,
      property: emptyProperty(),
      parties: null,
      documentSections: [],
      linkedDeedLabels: labels,
    });
    const fields = model.sections.find((s) => s.id === "linked")?.fields ?? [];
    return { answer: fields[0]?.value, deeds: fields[1]?.value };
  };

  it("lists the transaction's other live deeds", () => {
    expect(infathLinkedDeedLabels(undefined, "p1")).toBeNull();
    expect(infathLinkedDeedLabels(null, "p1")).toEqual([]);
    expect(infathLinkedDeedLabels({ deeds: [deed("p1", "111")] }, "p1")).toEqual([]);
    expect(
      infathLinkedDeedLabels({ deeds: [deed("p1", "111"), deed("p2", "222"), deed("p3", "333", true)] }, "p1"),
    ).toEqual(["222"]);
  });

  it("answers «لا» for a one-deed transaction and «نعم» with the deeds otherwise", () => {
    expect(linkedOf([])).toEqual({ answer: "لا", deeds: "لا يوجد" });
    expect(linkedOf(["222", "333"])).toEqual({ answer: "نعم", deeds: "222، 333" });
    expect(linkedOf(null)).toEqual({ answer: "", deeds: "" });
  });
});

describe("Infath sheet — asset photos and deed follow the attachment rows (A→Z #5, #7)", () => {
  const photo = (id: string, name: string) => ({
    id,
    name,
    fileName: `${id}.jpg`,
    source: "المعاين الميداني",
    kind: "image" as const,
    attachmentId: `att-${id}`,
    documentTypeKey: "inspection-photo",
  });
  const sections: PropertyDetailDocumentSection[] = [
    {
      id: "inspection",
      title: "المعاين الميداني",
      documents: [
        photo("p1", "صور خارجية · واجهة"),
        photo("p2", "صور خارجية · واجهة"),
        photo("p3", "صور داخلية · غرفة"),
        photo("p4", "خدمة: عداد كهرباء"),
      ],
    },
    {
      id: "intake",
      title: "البيانات الأولية",
      documents: [
        {
          id: "deed",
          name: "صك الملكية",
          fileName: "deed.pdf",
          source: "s",
          kind: "pdf",
          attachmentId: "att-deed",
          documentTypeKey: "deed",
        },
      ],
    },
  ];
  const model = buildInfathUploadModel({
    record,
    property: { ...emptyProperty(), deedNumber: "4100" },
    parties: null,
    documentSections: sections,
  });
  const photoField = (id: string) =>
    model.sections.find((s) => s.id === "photos")?.fields.find((f) => f.id === id);
  const row = (id: string) => model.attachments.find((a) => a.id === id);

  it("bundles the exterior and interior photos into ready rows the fields name", () => {
    expect(row("exterior-photos")?.status).toBe("ready");
    // Omar 2026-11-08: the exterior file carries the meters (they fell out of both files before).
    expect(row("exterior-photos")?.photos?.map((p) => p.id)).toEqual(["p1", "p2", "p4"]);
    expect(row("interior-photos")?.photos?.map((p) => p.id)).toEqual(["p3"]);
    expect(photoField("ext-photo")?.value).toBe("صور الأصل من الخارج - 4100.pdf");
    expect(photoField("int-photo")?.value).toBe("صور الأصل من الداخل - 4100.pdf");
  });

  it("names the deed the attachment row has ready", () => {
    expect(row("deed")?.status).toBe("ready");
    expect(photoField("deed-photo")?.value).toBe("deed.pdf");
  });

  it("names the open question of the asset section in plain words", () => {
    expect(model.sections.find((s) => s.id === "asset")?.badge).toBe("مصدر البيانات غير محسوم");
  });

  it("has no ready photo rows without photos", () => {
    const empty = buildInfathUploadModel({ record, property: emptyProperty(), parties: null, documentSections: [] });
    expect(empty.attachments.find((a) => a.id === "exterior-photos")?.status).toBe("missing");
    expect(empty.sections.find((s) => s.id === "photos")?.fields.find((f) => f.id === "ext-photo")?.value).toBe("");
  });
});

