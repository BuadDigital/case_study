import { describe, expect, it } from "vitest";
import { appraiserAreaFacts, areaText, restrictionFacts } from "../appraiser-summary-model";

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
