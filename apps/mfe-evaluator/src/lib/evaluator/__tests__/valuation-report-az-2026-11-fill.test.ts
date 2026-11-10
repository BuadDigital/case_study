/**
 * Report fill fixes from the A→Z run of 2026-11-02 (test-results/az-2026-11-02/findings.md):
 * purpose from the work order (#16/#28), survey boundaries (#17), shared + usufruct ownership
 * (#50), land-only scope (#71), «لا» in section 11 (#47), facade direction (#68), land services
 * (#2), flat / showroom counts (#54) and the value after a liquidation discount (#23).
 */
import { describe, expect, it } from "vitest";
import { INFATH_SEED_CLIENT_ID } from "@platform/api-client";
import { createEvaluatorDraft } from "../evaluator-window-data";
import {
  applyValuationReportLiveFill,
  buildValuationReportLiveFill,
  resolveReportValuationKeys,
} from "../valuation-report-live-fill";
import { reportValuationChoices } from "../../../components/evaluator/evaluator-report-output-helpers";
import {
  formatReportCalendarDate,
  reportBuildingAgeLabel,
} from "../valuation-report-property-age";

const draft = () => createEvaluatorDraft({ taskId: "t1", propertyId: "p1", poNumber: "PO-1" });

function record(over: Record<string, unknown> = {}) {
  return {
    id: "wo1",
    poNumber: "PO-1",
    assignmentType: "تنفيذ",
    clientId: INFATH_SEED_CLIENT_ID,
    reportUserClientIds: [],
    properties: [],
    ...over,
  } as never;
}

const villa = { featureValues: { assetSubject: "فيلا" } };

describe("الغرض من التقييم comes from the work order (#16/#28)", () => {
  it("prints the work order's purpose over the approach settings' assignment default", () => {
    const fill = buildValuationReportLiveFill({
      draft: draft(),
      record: record({ valuationPurposeKey: "estate_liquidation" }),
      // The approach settings always save the assignment default.
      purposeKey: "auction_liquidation",
    });
    expect(fill.cells["الغرض من التقييم"]).toBe("تصفية التركات");
  });

  it("falls back to the assignment default when the work order saved no purpose (ruling 2026-11-10)", () => {
    const fill = buildValuationReportLiveFill({
      draft: draft(),
      record: record(),
      purposeKey: "financing",
    });
    expect(fill.cells["الغرض من التقييم"]).toBe("البيع بالمزاد العلني لغرض التصفية");
    // Without an assignment type the settings' purpose is the last fallback.
    expect(
      resolveReportValuationKeys({ record: record({ assignmentType: "" }), purposeKey: "financing" }).purposeKey,
    ).toBe("financing");
  });

  it("uses the work order's basis when the reconciliation saved none", () => {
    const keys = resolveReportValuationKeys({
      record: record({ valuationPurposeKey: "sale", basisOfValueKey: "market" }),
      recon: null,
    });
    expect(keys).toEqual({ purposeKey: "sale", valueBasisKey: "market", premiseKey: "current" });
  });

  it("does not take the settings' label for another purpose", () => {
    const choices = reportValuationChoices({
      record: record({ valuationPurposeKey: "sale" }),
      recon: null,
      settings: {
        valuationPurposeKey: "auction_liquidation",
        valuationPurposeLabelAr: "البيع بالمزاد العلني لغرض التصفية",
      } as never,
      lists: null,
    });
    expect(choices.purposeLabel).toBeUndefined();
    const fill = buildValuationReportLiveFill({
      draft: draft(),
      record: record({ valuationPurposeKey: "sale" }),
      ...choices,
    });
    expect(fill.cells["الغرض من التقييم"]).toBe("البيع");
  });
});

describe("section 08 boundaries from the engineering office (#17)", () => {
  const sides = {
    northBoundary: "شارع 20م",
    northBoundaryLengthM: "25",
    eastBoundary: "قطعة 5",
    eastBoundaryLengthM: "30",
    southBoundary: "ممر",
    southBoundaryLengthM: "25",
    westBoundary: "قطعة 7",
    westBoundaryLengthM: "30",
  };

  it("prints the office's deed-field boundaries when it said «غير مطابق» without nature values", () => {
    const fill = buildValuationReportLiveFill({
      draft: draft(),
      property: { boundariesAvailability: "no", city: "", deedNumber: "" } as never,
      survey: { deedMatchesNature: "no", ...sides },
    });
    expect(fill.boundaries.map((b) => [b.name, b.bound, b.len])).toEqual([
      ["الشمالية", "شارع 20م", "25"],
      ["الشرقية", "قطعة 5", "30"],
      ["الجنوبية", "ممر", "25"],
      ["الغربية", "قطعة 7", "30"],
    ]);
  });

  it("still prefers the office's «على الطبيعة» values when it entered them", () => {
    const fill = buildValuationReportLiveFill({
      draft: draft(),
      property: { boundariesAvailability: "no", city: "", deedNumber: "" } as never,
      survey: {
        deedMatchesNature: "no",
        ...sides,
        natureNorthBoundary: "شارع 22م",
        natureNorthBoundaryLengthM: "26",
      },
    });
    expect([fill.boundaries[0]?.bound, fill.boundaries[0]?.len]).toEqual(["شارع 22م", "26"]);
    expect(fill.boundaries[1]?.bound).toBe("قطعة 5");
  });
});

/** Omar 2026-11-04: the inspector's boundaries wait for the specialist's acceptance. */
describe("section 08 never reads the inspector's package directly", () => {
  it("leaves a side empty while only the unaccepted inspection holds it", () => {
    const fill = buildValuationReportLiveFill({
      draft: draft(),
      property: { boundariesAvailability: "bourse", city: "", deedNumber: "" } as never,
      inspector: { boundaryMatches: { north: { deedDesc: "قطعة رقم 459", deedLength: "25" } } } as never,
    });
    expect([fill.boundaries[0]?.bound, fill.boundaries[0]?.len]).toEqual(["", ""]);
  });
});

/**
 * Omar 2026-11-05: every inspector field waits for the specialist like the boundaries. The server
 * hands the appraiser no package before acceptance; the usage the property keeps from the submit
 * must not print on its own then.
 */
describe("«استخدام العقار» waits for the accepted inspection", () => {
  const property = { inspectedUsage: "سكني", city: "", deedNumber: "" } as never;

  it("stays empty while the appraiser has no accepted package", () => {
    const fill = buildValuationReportLiveFill({ draft: draft(), property, inspector: null });
    expect(fill.cells["استخدام العقار"]).toBe("—");
  });

  it("prints the property's usage once the accepted package arrives", () => {
    const fill = buildValuationReportLiveFill({
      draft: draft(),
      property,
      inspector: { featureValues: {} } as never,
    });
    expect(fill.cells["استخدام العقار"]).toBe("سكني");
  });
});

describe("نوع الملكية on a shared deed (#50)", () => {
  it("names the shared ownership before the usufruct right", () => {
    const fill = buildValuationReportLiveFill({
      draft: draft(),
      property: { ownershipType: "shared", city: "", deedNumber: "" } as never,
      ownership: { key: "usufruct", labelAr: "حق منفعة", remainingLeaseYears: 20 },
    });
    expect(fill.cells["نوع الملكية"]).toBe("مشاع — حق منفعة، المدة المتبقية 20 سنة");
  });

  it("keeps the single-owner wording and never prints a mortgage", () => {
    const fill = buildValuationReportLiveFill({
      draft: draft(),
      property: {
        ownershipType: "absolute",
        restrictionsPresent: "yes",
        restrictionType: "mortgaged",
        city: "",
        deedNumber: "",
      } as never,
      ownership: { key: "usufruct", labelAr: "حق منفعة", remainingLeaseYears: 20 },
    });
    expect(fill.cells["نوع الملكية"]).toBe("حق منفعة — المدة المتبقية 20 سنة");
    expect(fill.cells["نوع الملكية"]).not.toContain("مرهون");
  });
});

describe("«أرض فقط» scope statement (#71)", () => {
  it("says the buildings are left out when a villa is valued as land only", () => {
    const fill = buildValuationReportLiveFill({
      draft: draft(),
      costScopeKey: "land_only",
      property: { propertyType: "فيلا", city: "", deedNumber: "" } as never,
      inspector: villa as never,
    });
    expect(fill.scopeRows).toContainEqual({
      label: "نطاق التقييم",
      value: "يقتصر التقييم على الأرض دون المباني والإنشاءات القائمة عليها، ولا تشمل القيمة المباني.",
    });
  });

  it("adds nothing for vacant land", () => {
    const fill = buildValuationReportLiveFill({
      draft: draft(),
      costScopeKey: "land_only",
      property: { propertyType: "أرض", city: "", deedNumber: "" } as never,
      inspector: { vacantLand: true, featureValues: { assetSubject: "أرض" } } as never,
    });
    expect(fill.scopeRows.some((r) => r.label === "نطاق التقييم")).toBe(false);
  });
});

describe("section 11 «لا» answers (#47)", () => {
  it("prints «لا يوجد» for every «لا» and «—» for an unanswered item", () => {
    const fill = buildValuationReportLiveFill({
      draft: draft(),
      property: { city: "", deedNumber: "" } as never,
      inspector: {
        featureValues: {
          assetSubject: "شقة",
          hasFence: "لا",
          hasTanks: "لا",
          hasLandscaping: "لا",
          hasCentralAc: "نعم",
        },
      } as never,
    });
    expect(fill.cells["سور"]).toBe("لا يوجد");
    expect(fill.cells["خزانات"]).toBe("لا يوجد");
    expect(fill.cells["تشجير"]).toBe("لا يوجد");
    expect(fill.cells["تكييف مركزي"]).toBe("يوجد");
    expect(fill.cells["مصعد"]).toBe("—");
  });
});

describe("section 08 «الواجهات» from the inspector's facade answer (#68)", () => {
  it("marks the named sides «واجهة» and the others «لا يوجد»; a recorded type still wins", () => {
    const fill = buildValuationReportLiveFill({
      draft: draft(),
      property: { westFacadeFinishing: "حجر", city: "", deedNumber: "" } as never,
      inspector: { featureValues: { assetSubject: "مستودع", facade: "شمالية غربية" } } as never,
    });
    // North, east, south, west.
    expect(fill.boundaries.map((b) => b.face)).toEqual(["واجهة", "لا يوجد", "لا يوجد", "حجر"]);
  });

  it("derives nothing for an apartment", () => {
    const fill = buildValuationReportLiveFill({
      draft: draft(),
      property: { city: "", deedNumber: "" } as never,
      inspector: { featureValues: { assetSubject: "شقة", facade: "شمالية" } } as never,
    });
    expect(fill.boundaries.map((b) => b.face)).toEqual(["", "", "", ""]);
  });
});

describe("section 14 on land (#2)", () => {
  const landProperty = {
    propertyType: "أرض",
    classification: "أرض",
    city: "",
    deedNumber: "",
  } as never;
  const sec14 = `<section data-sec="14"><table>
      <tr><th>الخدمة</th><th>التوفر</th><th>عدد العدادات</th><th>أرقام العدادات</th></tr>
      <tr><td class="k">كهرباء</td><td class="v">متوفر</td><td class="num">6</td><td class="num">1</td></tr>
      <tr><td class="k">صرف صحي</td><td class="v" colspan="3">متوفر</td></tr>
    </table></section>`;

  it("keeps the template's service rows, without meter columns, and adds none (no سفلتة / إنارة row)", () => {
    const fill = buildValuationReportLiveFill({
      draft: draft(),
      property: landProperty,
      inspector: {
        vacantLand: true,
        services: ["كهرباء", "ماء", "سفلتة", "إنارة"],
        featureValues: { assetSubject: "أرض" },
      } as never,
    });
    const dom = new DOMParser().parseFromString(sec14, "text/html");
    applyValuationReportLiveFill(dom, fill, { markMissingFields: false });
    const sec = dom.querySelector('[data-sec="14"]');
    expect(sec).not.toBeNull();
    expect([...sec!.querySelectorAll("th")].map((th) => th.textContent)).toEqual(["الخدمة", "التوفر"]);
    const rows = [...sec!.querySelectorAll("tr")].slice(1).map((tr) =>
      [...tr.querySelectorAll("td")].map((td) => td.textContent),
    );
    expect(rows).toEqual([
      ["كهرباء", "متوفر"],
      ["ماء", "متوفر"],
      ["صرف صحي", "غير متوفر"],
      ["هاتف / ألياف بصرية", "غير متوفر"],
    ]);
  });

  it("drops the section when the inspector picked no service", () => {
    const fill = buildValuationReportLiveFill({
      draft: draft(),
      property: landProperty,
      inspector: { vacantLand: true, services: [], featureValues: { assetSubject: "أرض" } } as never,
    });
    const dom = new DOMParser().parseFromString(sec14, "text/html");
    applyValuationReportLiveFill(dom, fill, { markMissingFields: false });
    expect(dom.querySelector('[data-sec="14"]')).toBeNull();
  });

  it("leaves the building table as it was", () => {
    const fill = buildValuationReportLiveFill({
      draft: draft(),
      property: { city: "", deedNumber: "" } as never,
      inspector: { services: ["كهرباء"], electricityMeterCount: "2", ...villa } as never,
    });
    expect(fill.serviceRows.map((r) => r.key)).toEqual([
      "كهرباء",
      "ماء",
      "صرف صحي",
      "هاتف / ألياف بصرية",
    ]);
    expect(fill.serviceRows[0]?.values).toEqual(["متوفر", "2", "—"]);
  });
});

describe("section 10 adds no rows of its own (Omar 2026-11-04)", () => {
  it("prints the listed components and the total only — no flat or showroom count rows", () => {
    const fill = buildValuationReportLiveFill({
      draft: draft(),
      property: { city: "", deedNumber: "" } as never,
      inspector: { unitCount: "6", showroomCount: "2", ...villa } as never,
    });
    const keys = fill.buildDescRows.map((r) => r.key);
    expect(keys).not.toContain("عدد الشقق");
    expect(keys).not.toContain("عدد المعارض");
    expect(keys[keys.length - 1]).toBe("مجموع مسطحات البناء");
  });
});

describe("value after a liquidation discount (#23)", () => {
  it("is not reported on the market basis even with a «مستند ذو قيمة» addition", () => {
    const fill = buildValuationReportLiveFill({
      draft: draft(),
      property: { city: "", deedNumber: "" } as never,
      recon: {
        basisOfValueKey: "market",
        liquidationDiscountPct: 0,
        weightedValue: 1000000,
        finalOpinionValue: 1250000,
        propertyValueAfterLiquidation: 1000000,
        additions: [{ attachmentId: "a1", labelAr: "مستند", value: 250000 }],
        methods: [],
      } as never,
    });
    expect(fill.propertyValueAfterLiquidation).toBe("");
    expect(fill.finalValueRows.some((r) => r.key.includes("خصم"))).toBe(false);
  });
});

describe("report date and age helpers (#8/#35, #29)", () => {
  it.each([
    ["2025-03-15", "2025/03/15"],
    ["10/05/2015 م", "2015/05/10"],
    ["١٠/٠٥/٢٠١٥ م", "2015/05/10"],
    ["15/03/1441 هـ", "1441/03/15 هـ"],
    ["هـ1441/03/15", "1441/03/15 هـ"],
    ["", ""],
    ["غير معروف", "غير معروف"],
  ])("formats %s as %s", (raw, out) => {
    expect(formatReportCalendarDate(raw)).toBe(out);
  });

  it("takes the inspector's age before the licence", () => {
    const now = new Date(2026, 10, 2, 12);
    expect(reportBuildingAgeLabel("12", "10/05/2015 م", now)).toBe("12 سنة");
    // Licence 2015-05-10 → 11 full years − 2 = 9.
    expect(reportBuildingAgeLabel("", "10/05/2015 م", now)).toBe("9 سنوات");
    expect(reportBuildingAgeLabel("", "", now)).toBe("");
  });
});
