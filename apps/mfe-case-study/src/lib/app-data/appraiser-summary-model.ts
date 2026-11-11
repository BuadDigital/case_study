/**
 * What the appraiser's summary section reads about the property's areas and its restrictions
 * (Omar 2026-11-10, items 3 of the approved preview): the deed's land area against the engineering
 * office's survey, the inspector's measured building areas, and the restrictions on the deed.
 * Pure: no React, no I/O.
 */
import { computeBuildingsTotalSqm } from "@platform/app-shared/app-data/inspector-workspace-data";
import {
  RESTRICTION_TYPE_OPTIONS,
  parseRestrictionTypes,
} from "@platform/app-shared/app-data/po-intake-identifiers";
import { parseLocaleNumber } from "@platform/app-shared/format/number";

/** «450» / «١٢٫٥» → «450 م²» / «12.5 م²»; an empty or unreadable value → «» (the field then shows «—»). */
export function areaText(raw: string | null | undefined): string {
  const text = (raw ?? "").trim();
  if (!text) return "";
  const n = parseLocaleNumber(text);
  if (!Number.isFinite(n)) return text;
  return `${Number.isInteger(n) ? n : Math.round(n * 100) / 100} م²`;
}

/** An annex or basement area: «0» (the inspector's untouched field) says nothing, so it is left out. */
function presentAreaText(raw: string | null | undefined): string {
  const n = parseLocaleNumber(raw);
  return Number.isFinite(n) && n <= 0 ? "" : areaText(raw);
}

/** The survey's part of the facts: the area by the deed and, when the deed does not match nature, by nature. */
type SurveyAreas = {
  onSiteAreaSqm: string;
  natureOnSiteAreaSqm?: string;
  deedMatchesNature: "yes" | "no" | null;
};

/** The inspector's measured areas. */
type InspectorAreas = {
  builtArea: string;
  annexTotal: string;
  basementTotal: string;
  buildingsTotal: string;
};

export type AppraiserAreaFacts = {
  /** «مساحة الأرض (الصك)». */
  deed: string;
  /** «مساحة الأرض (الرفع المساحي)» — by the deed. */
  survey: string;
  /** The survey's area by nature — only when the survey found the deed does not match nature. */
  surveyNature: string;
  /** The inspector's building areas: the main building, annexes, basement and the total. */
  built: string;
  annex: string;
  basement: string;
  buildingsTotal: string;
  /** «يزيد الرفع المساحي عن الصك بـ …» — null when the two agree or one is missing. */
  gapLine: string | null;
};

/**
 * The area facts of a property from its deed, its survey and its inspection.
 *
 * How it works: each area is read as a number and written back as «450 م²»; the building total is
 * the inspector's own, else main building + annexes + basement; the gap line compares the deed's
 * land area with the survey's — by nature when the survey says the deed does not match nature,
 * else by the deed — and speaks only for a difference of at least a hundredth of a metre.
 * Edge cases: no survey or no inspection leaves its fields empty; an area that is not a number is
 * shown as typed and takes no part in the gap line; land (no building areas) leaves the building
 * fields empty.
 */
export function appraiserAreaFacts(input: {
  deedArea: string;
  survey: SurveyAreas | null;
  inspector: InspectorAreas | null;
}): AppraiserAreaFacts {
  const { survey, inspector } = input;
  const byNature = survey?.deedMatchesNature === "no" && Boolean(survey.natureOnSiteAreaSqm?.trim());
  const total =
    inspector?.buildingsTotal.trim() ||
    (inspector
      ? computeBuildingsTotalSqm(inspector.builtArea, inspector.basementTotal, inspector.annexTotal)
      : "");

  const deed = parseLocaleNumber(input.deedArea);
  const surveyed = parseLocaleNumber(byNature ? survey?.natureOnSiteAreaSqm : survey?.onSiteAreaSqm);
  let gapLine: string | null = null;
  if (Number.isFinite(deed) && deed > 0 && Number.isFinite(surveyed) && surveyed > 0) {
    const gap = Math.round((surveyed - deed) * 100) / 100;
    if (Math.abs(gap) >= 0.01) {
      const size = areaText(String(Math.abs(gap)));
      gapLine = `${byNature ? "مساحة الطبيعة في الرفع المساحي" : "مساحة الرفع المساحي"} ${gap > 0 ? "تزيد" : "تنقص"} عن مساحة الصك بـ ${size}.`;
    }
  }

  return {
    deed: areaText(input.deedArea),
    survey: areaText(survey?.onSiteAreaSqm),
    surveyNature: byNature ? areaText(survey?.natureOnSiteAreaSqm) : "",
    built: areaText(inspector?.builtArea),
    annex: presentAreaText(inspector?.annexTotal),
    basement: presentAreaText(inspector?.basementTotal),
    buildingsTotal: areaText(total),
    gapLine,
  };
}

export type RestrictionFacts = {
  /** «مرهون، محجوز» / «لا توجد قيود»; empty when the bourse stage has not recorded it. */
  text: string;
  /** One flag per restriction: a mortgage is red, the others amber. */
  flags: { label: string; tone: "danger" | "warning" }[];
};

/**
 * The restrictions on the deed as the bourse stage recorded them.
 *
 * How it works: «توجد قيود» lists the chosen types by their labels (a mortgage first by the
 * options' order) and «أخرى» adds its reason; «لا توجد قيود» says so; a mortgage is the one red flag.
 * Edge cases: «توجد قيود» with no recognised type reads as «توجد قيود»; nothing recorded → empty text.
 */
export function restrictionFacts(property: {
  restrictionsPresent: string;
  restrictionType: string;
  restrictionOtherReason: string;
}): RestrictionFacts {
  const present = property.restrictionsPresent.trim();
  if (present === "no") return { text: "لا توجد قيود", flags: [] };
  if (present !== "yes") return { text: "", flags: [] };

  const types = parseRestrictionTypes(property.restrictionType);
  const reason = property.restrictionOtherReason.trim();
  const flags = RESTRICTION_TYPE_OPTIONS.filter((o) => types.includes(o.value)).map((o) => ({
    label: o.value === "other" && reason ? `${o.label}: ${reason}` : o.label,
    tone: o.value === "mortgaged" ? ("danger" as const) : ("warning" as const),
  }));
  return {
    text: flags.length > 0 ? flags.map((f) => f.label).join("، ") : "توجد قيود",
    flags,
  };
}
