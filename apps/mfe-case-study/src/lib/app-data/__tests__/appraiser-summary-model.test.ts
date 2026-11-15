import { describe, expect, it } from "vitest";
import type { InspectorBoundaryMatch } from "@platform/app-shared/app-data/inspector-workspace-data";
import { emptyProperty } from "@platform/app-shared/app-data/po-intake-property-model";
import {
  appraiserAlerts,
  appraiserAreaFacts,
  appraiserBoundaryRows,
  appraiserBuildingFacts,
  appraiserLocationFacts,
  appraiserViolationsText,
  areaText,
  restrictionFacts,
} from "../appraiser-summary-model";

const noInspector = null;
const inspector = (over: Partial<NonNullable<Parameters<typeof appraiserAreaFacts>[0]["inspector"]>> = {}) => ({
  builtArea: "",
  annexTotal: "",
  basementTotal: "",
  buildingsTotal: "",
  ...over,
});

describe("areaText", () => {
  it("writes a number back with its unit, in Latin digits, without trailing zeros", () => {
    expect(areaText("450")).toBe("450 م²");
    expect(areaText("448.60")).toBe("448.6 م²");
    expect(areaText("١٢٫٥")).toBe("12.5 م²");
  });

  it("leaves an empty value empty and an unreadable one as typed", () => {
    expect(areaText("")).toBe("");
    expect(areaText(undefined)).toBe("");
    expect(areaText("حوالي مئتين")).toBe("حوالي مئتين");
  });
});

describe("appraiserAreaFacts", () => {
  it("shows the deed alone when there is no survey and no inspection", () => {
    expect(appraiserAreaFacts({ deedArea: "450", survey: null, inspector: noInspector })).toEqual({
      deed: "450 م²",
      survey: "",
      surveyNature: "",
      built: "",
      annex: "",
      basement: "",
      buildingsTotal: "",
      gapLine: null,
    });
  });

  it("says nothing about a survey that agrees with the deed", () => {
    const facts = appraiserAreaFacts({
      deedArea: "450",
      survey: { onSiteAreaSqm: "450", deedMatchesNature: "yes" },
      inspector: noInspector,
    });
    expect(facts.survey).toBe("450 م²");
    expect(facts.gapLine).toBeNull();
  });

  it("names the gap, whichever way it goes", () => {
    const less = appraiserAreaFacts({
      deedArea: "450",
      survey: { onSiteAreaSqm: "448.6", deedMatchesNature: "yes" },
      inspector: noInspector,
    });
    expect(less.gapLine).toBe("مساحة الرفع المساحي تنقص عن مساحة الصك بـ 1.4 م².");
    const more = appraiserAreaFacts({
      deedArea: "450",
      survey: { onSiteAreaSqm: "452", deedMatchesNature: "yes" },
      inspector: noInspector,
    });
    expect(more.gapLine).toBe("مساحة الرفع المساحي تزيد عن مساحة الصك بـ 2 م².");
  });

  it("compares the nature area when the survey found the deed does not match nature", () => {
    const facts = appraiserAreaFacts({
      deedArea: "450",
      survey: { onSiteAreaSqm: "450", natureOnSiteAreaSqm: "438", deedMatchesNature: "no" },
      inspector: noInspector,
    });
    expect(facts.surveyNature).toBe("438 م²");
    expect(facts.gapLine).toBe("مساحة الطبيعة في الرفع المساحي تنقص عن مساحة الصك بـ 12 م².");
  });

  it("keeps the survey's nature area out of a matching deed", () => {
    const facts = appraiserAreaFacts({
      deedArea: "450",
      survey: { onSiteAreaSqm: "450", natureOnSiteAreaSqm: "438", deedMatchesNature: "yes" },
      inspector: noInspector,
    });
    expect(facts.surveyNature).toBe("");
    expect(facts.gapLine).toBeNull();
  });

  it("takes no part in a gap when an area is missing or not a number", () => {
    expect(
      appraiserAreaFacts({ deedArea: "", survey: { onSiteAreaSqm: "448", deedMatchesNature: "yes" }, inspector: noInspector })
        .gapLine,
    ).toBeNull();
    expect(
      appraiserAreaFacts({ deedArea: "450", survey: { onSiteAreaSqm: "؟", deedMatchesNature: "yes" }, inspector: noInspector })
        .gapLine,
    ).toBeNull();
  });

  it("reads the inspector's areas and sums the total when he left it blank", () => {
    const facts = appraiserAreaFacts({
      deedArea: "450",
      survey: null,
      inspector: inspector({ builtArea: "520", annexTotal: "12", basementTotal: "100" }),
    });
    expect(facts.built).toBe("520 م²");
    expect(facts.annex).toBe("12 م²");
    expect(facts.basement).toBe("100 م²");
    expect(facts.buildingsTotal).toBe("632 م²");
  });

  it("leaves out an annex or basement the inspector left at zero", () => {
    const facts = appraiserAreaFacts({
      deedArea: "450",
      survey: null,
      inspector: inspector({ builtArea: "640", annexTotal: "1", basementTotal: "0" }),
    });
    expect(facts.annex).toBe("1 م²");
    expect(facts.basement).toBe("");
    expect(facts.buildingsTotal).toBe("641 م²");
  });

  it("prefers the total the inspector recorded", () => {
    expect(
      appraiserAreaFacts({
        deedArea: "450",
        survey: null,
        inspector: inspector({ builtArea: "520", buildingsTotal: "540" }),
      }).buildingsTotal,
    ).toBe("540 م²");
  });
});

describe("restrictionFacts", () => {
  const props = (restrictionsPresent: string, restrictionType = "", restrictionOtherReason = "") => ({
    restrictionsPresent,
    restrictionType,
    restrictionOtherReason,
  });

  it("flags a mortgage red and the other restrictions amber, in the options' order", () => {
    expect(restrictionFacts(props("yes", "seized,mortgaged"))).toEqual({
      text: "مرهون، محجوز",
      flags: [
        { label: "مرهون", tone: "danger" },
        { label: "محجوز", tone: "warning" },
      ],
    });
  });

  it("adds the reason of «أخرى»", () => {
    expect(restrictionFacts(props("yes", "other", "حق انتفاع")).text).toBe("أخرى: حق انتفاع");
  });

  it("says «لا توجد قيود» for none, and nothing when the bourse stage recorded nothing", () => {
    expect(restrictionFacts(props("no"))).toEqual({ text: "لا توجد قيود", flags: [] });
    expect(restrictionFacts(props(""))).toEqual({ text: "", flags: [] });
  });

  it("reads restrictions with no recognised type as «توجد قيود»", () => {
    expect(restrictionFacts(props("yes", ""))).toEqual({ text: "توجد قيود", flags: [] });
  });
});

// Omar 2026-11-15: the summary gathers what the appraiser starts from — the four sides, the
// location, the building and a line of what needs his attention.
const side = (over: Partial<InspectorBoundaryMatch> = {}): InspectorBoundaryMatch => ({
  matches: null,
  mismatchNote: "",
  facade: "",
  deedDesc: "",
  deedLength: "",
  ...over,
});
const sides = (over: Partial<Record<"north" | "south" | "east" | "west", InspectorBoundaryMatch>> = {}) => ({
  north: side(),
  south: side(),
  east: side(),
  west: side(),
  ...over,
});
const fullInspector = (over: Record<string, unknown> = {}) =>
  ({
    boundaryMatches: sides(),
    streetName: "",
    mainStreetName: "",
    streetWidthM: "",
    services: [],
    amenities: [],
    electricityMeterCount: "",
    waterMeterCount: "",
    vacantLand: false,
    featureValues: {},
    buildingFloors: "",
    propertyAgeYears: "",
    buildLicenseNumber: "",
    buildLicenseDate: "",
    unitCount: "",
    roomCount: "",
    hallCount: "",
    bathroomCount: "",
    hasAnnex: "",
    annexUpperCount: "",
    annexGroundCount: "",
    hasViolations: "",
    violationsCount: "",
    violationsDescription: "",
    ...over,
  }) as NonNullable<Parameters<typeof appraiserLocationFacts>[1]>;
const valueOf = (facts: { label: string; value: string }[] | null, label: string) =>
  facts?.find((fact) => fact.label === label)?.value;

describe("appraiserBoundaryRows", () => {
  const property = { ...emptyProperty(), northBoundary: "شارع عرض 15م", northBoundaryLengthM: "25", northFacadeFinishing: "حجر" };

  it("reads the property's own sides while there is no inspection", () => {
    const rows = appraiserBoundaryRows(property, null);
    expect(rows.map((row) => row.label)).toEqual(["الحد الشمالي", "الحد الجنوبي", "الحد الشرقي", "الحد الغربي"]);
    expect(rows[0]).toEqual({ label: "الحد الشمالي", desc: "شارع عرض 15م", len: "25", facade: "حجر", match: "", note: "" });
    expect(rows[1].desc).toBe("");
  });

  it("puts the inspector's boundary, length and facade first, and falls back side by side", () => {
    const rows = appraiserBoundaryRows(property, {
      boundaryMatches: sides({
        north: side({ matches: true, deedDesc: "شارع عرض 20م", deedLength: "24.5" }),
        east: side({ matches: false, mismatchNote: "السور يتجاوز الحد", facade: "دهان" }),
      }),
    });
    expect(rows[0]).toMatchObject({ desc: "شارع عرض 20م", len: "24.5", facade: "حجر", match: "مطابق", note: "" });
    expect(rows[2]).toMatchObject({ facade: "دهان", match: "غير مطابق", note: "السور يتجاوز الحد" });
  });

  it("keeps a note only for a side that does not match, and no verdict for a side not judged", () => {
    const rows = appraiserBoundaryRows(property, {
      boundaryMatches: sides({ south: side({ matches: true, mismatchNote: "ملاحظة قديمة" }) }),
    });
    expect(rows[1]).toMatchObject({ match: "مطابق", note: "" });
    expect(rows[3].match).toBe("");
  });
});

describe("appraiserLocationFacts", () => {
  it("reads the plan, plot and block from the property and the rest from the inspector", () => {
    const facts = appraiserLocationFacts(
      { planNumber: " 2917 ", plotNumber: "145", blockNumber: "" },
      fullInspector({ streetName: "الأمير سلطان", streetWidthM: "20", services: ["كهرباء", "ماء"], waterMeterCount: "1" }),
    );
    expect(valueOf(facts, "رقم المخطط")).toBe("2917");
    expect(valueOf(facts, "رقم البلك")).toBe("");
    expect(valueOf(facts, "اسم الشارع (المعاين)")).toBe("الأمير سلطان");
    expect(valueOf(facts, "عرض الشارع (المعاين)")).toBe("20 م");
    expect(valueOf(facts, "الخدمات (المعاين)")).toBe("كهرباء، ماء");
    expect(valueOf(facts, "عدادات الماء")).toBe("1");
  });

  it("leaves the inspector's fields empty before the inspection, and a width that is not a number as typed", () => {
    const none = appraiserLocationFacts({ planNumber: "1", plotNumber: "2", blockNumber: "3" }, null);
    expect(valueOf(none, "عرض الشارع (المعاين)")).toBe("");
    expect(valueOf(none, "الخدمات (المعاين)")).toBe("");
    const typed = appraiserLocationFacts({ planNumber: "", plotNumber: "", blockNumber: "" }, fullInspector({ streetWidthM: "بين 15 و20" }));
    expect(valueOf(typed, "عرض الشارع (المعاين)")).toBe("بين 15 و20");
  });
});

describe("appraiserBuildingFacts", () => {
  const villa = { propertyType: "فيلا", inspectedPropertyType: "", effectivePropertyType: "" };
  const land = { propertyType: "أرض", inspectedPropertyType: "", effectivePropertyType: "" };

  it("has no building for land — by the property's type before the inspection, by the inspector after it", () => {
    expect(appraiserBuildingFacts(land, null, "")).toBeNull();
    expect(appraiserBuildingFacts(villa, fullInspector({ vacantLand: true }), "")).toBeNull();
    expect(appraiserBuildingFacts(land, fullInspector({ featureValues: { assetSubject: "فيلا" } }), "")).not.toBeNull();
  });

  it("always shows the floors, the age, the licence and the finishing, and the rest only when filled", () => {
    const before = appraiserBuildingFacts(villa, null, "");
    expect(before?.map((fact) => fact.label)).toEqual([
      "عدد الأدوار",
      "عمر العقار (سنوات)",
      "رقم رخصة البناء",
      "تاريخ رخصة البناء",
      "التشطيب (الأخصائي)",
    ]);
    const after = appraiserBuildingFacts(
      villa,
      fullInspector({
        buildingFloors: "2",
        propertyAgeYears: "8",
        roomCount: "7",
        bathroomCount: "6",
        featureValues: { hasElevator: "لا", hasPool: "نعم" },
        hasAnnex: "نعم",
        annexUpperCount: "1",
        annexGroundCount: "2",
      }),
      "تشطيب متوسط",
    );
    expect(valueOf(after, "عدد الأدوار")).toBe("2");
    expect(valueOf(after, "التشطيب (الأخصائي)")).toBe("تشطيب متوسط");
    expect(valueOf(after, "عدد الغرف")).toBe("7");
    expect(valueOf(after, "المصعد")).toBe("لا يوجد");
    expect(valueOf(after, "المسبح")).toBe("يوجد");
    expect(valueOf(after, "الملاحق")).toBe("علوي 1، أرضي 2");
    expect(valueOf(after, "عدد الصالات")).toBeUndefined();
  });

  it("gives a shop no rooms or halls, and annexes without a count read «يوجد»", () => {
    const shop = appraiserBuildingFacts(
      villa,
      fullInspector({ featureValues: { assetSubject: "محل تجاري" }, roomCount: "3", hallCount: "1", bathroomCount: "1", hasAnnex: "نعم" }),
      "",
    );
    expect(valueOf(shop, "عدد الغرف")).toBeUndefined();
    expect(valueOf(shop, "عدد الصالات")).toBeUndefined();
    expect(valueOf(shop, "دورات المياه")).toBe("1");
    expect(valueOf(shop, "الملاحق")).toBe("يوجد");
  });
});

describe("appraiserViolationsText", () => {
  it("says «لا توجد», names what the inspector saw, and stays empty while he did not answer", () => {
    expect(appraiserViolationsText(null)).toBe("");
    expect(appraiserViolationsText(fullInspector())).toBe("");
    expect(appraiserViolationsText(fullInspector({ hasViolations: "لا" }))).toBe("لا توجد");
    expect(appraiserViolationsText(fullInspector({ hasViolations: "نعم" }))).toBe("توجد مخالفات");
    expect(
      appraiserViolationsText(fullInspector({ hasViolations: "نعم", violationsCount: "2", violationsDescription: "ملحق بلا رخصة" })),
    ).toBe("2 — ملحق بلا رخصة");
  });
});

describe("appraiserAlerts", () => {
  const none = { text: "لا توجد قيود", flags: [] };

  it("draws nothing when the deed is clean, the areas agree and the study says «مطابق» or nothing yet", () => {
    expect(appraiserAlerts({ restrictions: none, gapLine: null, deedNatureMatchOutcome: "matched" })).toEqual([]);
    expect(appraiserAlerts({ restrictions: none, gapLine: null, deedNatureMatchOutcome: "" })).toEqual([]);
    expect(appraiserAlerts({ restrictions: none, gapLine: null, deedNatureMatchOutcome: undefined })).toEqual([]);
  });

  it("lists the restrictions first (a mortgage red), then the area gap, then the study's outcome", () => {
    expect(
      appraiserAlerts({
        restrictions: restrictionFacts({ restrictionsPresent: "yes", restrictionType: "seized,mortgaged", restrictionOtherReason: "" }),
        gapLine: "مساحة الرفع المساحي تزيد عن مساحة الصك بـ 12.5 م².",
        deedNatureMatchOutcome: "Differences",
      }),
    ).toEqual([
      { label: "قيد على الصك: مرهون", tone: "danger" },
      { label: "قيد على الصك: محجوز", tone: "warning" },
      { label: "مساحة الرفع المساحي تزيد عن مساحة الصك بـ 12.5 م²", tone: "warning" },
      { label: "مطابقة الصك على الطبيعة: فروق", tone: "warning" },
    ]);
  });
});
