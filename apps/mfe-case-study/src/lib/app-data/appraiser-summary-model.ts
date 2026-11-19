/**
 * What the appraiser's summary section reads about the property's areas and its restrictions
 * (Omar 2026-11-10, items 3 of the approved preview): the deed's land area against the engineering
 * office's survey, the inspector's measured building areas, and the restrictions on the deed.
 * Pure: no React, no I/O.
 */
import {
  computeBuildingsTotalSqm,
  isCommercialShopInspectionContext,
  isLandInspectionContext,
  type InspectorWorkspaceDraft,
} from "@platform/app-shared/app-data/inspector-workspace-data";
import { PROPERTY_BOUNDARY_ROWS } from "@platform/app-shared/app-data/po-intake-boundaries";
import {
  RESTRICTION_TYPE_OPTIONS,
  parseRestrictionTypes,
} from "@platform/app-shared/app-data/po-intake-identifiers";
import {
  propertyIsLand,
  type PoPropertyIntake,
} from "@platform/app-shared/app-data/po-intake-property-model";
import {
  DEED_NATURE_MATCH_OPTIONS,
  DeedNatureMatchOutcomes,
  normalizeDeedNatureMatchOutcome,
} from "@platform/app-shared/domain/case-study/deed-nature-match-outcomes";
import { parseLocaleNumber } from "@platform/app-shared/format/number";
import { ChecklistAnswers } from "@platform/app-shared/engineering-survey/checklist-answers";

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
  const byNature = survey?.deedMatchesNature === ChecklistAnswers.No && Boolean(survey.natureOnSiteAreaSqm?.trim());
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

/** One labelled value of a summary group; an empty value shows «—». */
export type SummaryFact = { label: string; value: string };

/** The inspector's part the summary reads; null until the specialist accepted the inspection. */
type InspectorFacts = Pick<
  InspectorWorkspaceDraft,
  | "boundaryMatches"
  | "streetName"
  | "mainStreetName"
  | "streetWidthM"
  | "services"
  | "amenities"
  | "electricityMeterCount"
  | "waterMeterCount"
  | "vacantLand"
  | "featureValues"
  | "buildingFloors"
  | "propertyAgeYears"
  | "buildLicenseNumber"
  | "buildLicenseDate"
  | "unitCount"
  | "roomCount"
  | "hallCount"
  | "bathroomCount"
  | "hasAnnex"
  | "annexUpperCount"
  | "annexGroundCount"
  | "hasViolations"
  | "violationsCount"
  | "violationsDescription"
> | null;

const clean = (value: string | null | undefined): string => (value ?? "").trim();

export type AppraiserBoundaryRow = {
  /** «الحد الشمالي». */
  label: string;
  desc: string;
  /** The side's length as recorded, without its unit. */
  len: string;
  /** «نوع الواجهة» of the side. */
  facade: string;
  /** The inspector's verdict on the side: «مطابق», «غير مطابق», or empty while he gave none. */
  match: string;
  /** His note on a side that does not match. */
  note: string;
};

/**
 * The four sides of the property as the appraiser reads them.
 *
 * How it works: each side takes its boundary, length and facade type from the inspector when he
 * recorded one, else from the property's own fields (the same order the valuation report prints
 * them in); the verdict and its note are the inspector's.
 * Edge cases: no inspection yet → the property's fields alone and no verdict; a side the inspector
 * did not judge has an empty verdict; a note is kept only for a side that does not match.
 */
export function appraiserBoundaryRows(
  property: Pick<
    PoPropertyIntake,
    (typeof PROPERTY_BOUNDARY_ROWS)[number]["descKey" | "lenKey" | "facadeKey"]
  >,
  inspector: Pick<InspectorWorkspaceDraft, "boundaryMatches"> | null,
): AppraiserBoundaryRow[] {
  return PROPERTY_BOUNDARY_ROWS.map((row) => {
    const side = row.descKey.replace("Boundary", "") as keyof InspectorWorkspaceDraft["boundaryMatches"];
    const seen = inspector?.boundaryMatches?.[side];
    const mismatch = seen?.matches === false;
    return {
      label: row.label,
      desc: clean(seen?.deedDesc) || clean(property[row.descKey]),
      len: clean(seen?.deedLength) || clean(property[row.lenKey]),
      facade: clean(seen?.facade) || clean(property[row.facadeKey]),
      match: seen?.matches === true ? "مطابق" : mismatch ? "غير مطابق" : "",
      note: mismatch ? clean(seen?.mismatchNote) : "",
    };
  });
}

/**
 * «الموقع والخدمات»: the plan, the plot and the block from the deed's data, then the street, the
 * services, the amenities and the meters the inspector recorded.
 * Edge cases: no inspection yet → his fields are empty; a street width that is a number reads «20 م».
 */
export function appraiserLocationFacts(
  property: Pick<PoPropertyIntake, "planNumber" | "plotNumber" | "blockNumber">,
  inspector: InspectorFacts,
): SummaryFact[] {
  const width = clean(inspector?.streetWidthM);
  return [
    { label: "رقم المخطط", value: clean(property.planNumber) },
    { label: "رقم القطعة", value: clean(property.plotNumber) },
    { label: "رقم البلك", value: clean(property.blockNumber) },
    { label: "اسم الشارع (المعاين)", value: clean(inspector?.streetName) },
    { label: "الشارع الرئيسي (المعاين)", value: clean(inspector?.mainStreetName) },
    {
      label: "عرض الشارع (المعاين)",
      value: width && Number.isFinite(parseLocaleNumber(width)) ? `${width} م` : width,
    },
    { label: "الخدمات (المعاين)", value: (inspector?.services ?? []).filter(Boolean).join("، ") },
    { label: "المرافق (المعاين)", value: (inspector?.amenities ?? []).filter(Boolean).join("، ") },
    { label: "عدادات الكهرباء", value: clean(inspector?.electricityMeterCount) },
    { label: "عدادات الماء", value: clean(inspector?.waterMeterCount) },
  ];
}

const presence = (answer: string | null | undefined): string =>
  answer === "نعم" ? "يوجد" : answer === "لا" ? "لا يوجد" : "";

/**
 * «وصف المبنى» — null for land, which has no building to describe.
 *
 * How it works: land is the inspector's own answer once there is an inspection, else the property's
 * type; the floors, the age, the building licence and the finishing level always show (empty →
 * «—»), the counts and the yes/no features only when the inspector filled them; a shop has no
 * rooms or halls.
 * Edge cases: the finishing level is the case specialist's, handed in already worded; annexes read
 * «علوي 1، أرضي 2», «يوجد» with no count, or «لا يوجد».
 */
export function appraiserBuildingFacts(
  property: Pick<PoPropertyIntake, "propertyType" | "inspectedPropertyType" | "effectivePropertyType">,
  inspector: InspectorFacts,
  finishingLabel: string,
): SummaryFact[] | null {
  const subject = {
    vacantLand: inspector?.vacantLand,
    assetSubject: inspector?.featureValues?.assetSubject,
  };
  if (inspector ? isLandInspectionContext(subject) : propertyIsLand(property)) return null;

  const annexCounts = [
    clean(inspector?.annexUpperCount) ? `علوي ${clean(inspector?.annexUpperCount)}` : "",
    clean(inspector?.annexGroundCount) ? `أرضي ${clean(inspector?.annexGroundCount)}` : "",
  ].filter(Boolean);
  const shop = Boolean(inspector) && isCommercialShopInspectionContext(subject);
  const optional: SummaryFact[] = [
    { label: "عدد الوحدات", value: clean(inspector?.unitCount) },
    { label: "عدد الغرف", value: shop ? "" : clean(inspector?.roomCount) },
    { label: "عدد الصالات", value: shop ? "" : clean(inspector?.hallCount) },
    { label: "دورات المياه", value: clean(inspector?.bathroomCount) },
    { label: "المصعد", value: presence(inspector?.featureValues?.hasElevator) },
    { label: "المسبح", value: presence(inspector?.featureValues?.hasPool) },
    {
      label: "الملاحق",
      value:
        inspector?.hasAnnex === "نعم" ? annexCounts.join("، ") || "يوجد" : presence(inspector?.hasAnnex),
    },
  ];
  return [
    { label: "عدد الأدوار", value: clean(inspector?.buildingFloors) },
    { label: "عمر العقار (سنوات)", value: clean(inspector?.propertyAgeYears) },
    { label: "رقم رخصة البناء", value: clean(inspector?.buildLicenseNumber) },
    { label: "تاريخ رخصة البناء", value: clean(inspector?.buildLicenseDate) },
    { label: "التشطيب (الأخصائي)", value: clean(finishingLabel) },
    ...optional.filter((fact) => fact.value),
  ];
}

/**
 * «المخالفات الظاهرة» as the inspector answered: «لا توجد», or the count and the description of
 * the ones he saw («توجد مخالفات» when he gave neither); empty while he did not answer.
 */
export function appraiserViolationsText(inspector: InspectorFacts): string {
  if (inspector?.hasViolations === "لا") return "لا توجد";
  if (inspector?.hasViolations !== "نعم") return "";
  return (
    [clean(inspector.violationsCount), clean(inspector.violationsDescription)].filter(Boolean).join(" — ") ||
    "توجد مخالفات"
  );
}

export type AppraiserAlert = { label: string; tone: "danger" | "warning" };

/**
 * «يستدعي الانتباه» — what the appraiser must see before he values: the restrictions on the deed
 * (a mortgage red), the gap between the survey's area and the deed's, and a study outcome that is
 * not «مطابق».
 * Edge cases: nothing to flag → an empty list, and the line is not drawn; an outcome not chosen yet
 * is not an alert.
 */
export function appraiserAlerts(input: {
  restrictions: RestrictionFacts;
  gapLine: string | null;
  deedNatureMatchOutcome: string | null | undefined;
}): AppraiserAlert[] {
  const alerts: AppraiserAlert[] = input.restrictions.flags.map((flag) => ({
    label: `قيد على الصك: ${flag.label}`,
    tone: flag.tone,
  }));
  if (input.gapLine) alerts.push({ label: input.gapLine.replace(/\.$/, ""), tone: "warning" });
  const outcome = normalizeDeedNatureMatchOutcome(input.deedNatureMatchOutcome);
  const outcomeLabel = DEED_NATURE_MATCH_OPTIONS.find((o) => o.value === outcome)?.label;
  if (outcomeLabel && outcome !== DeedNatureMatchOutcomes.Matched) {
    alerts.push({ label: `مطابقة الصك على الطبيعة: ${outcomeLabel}`, tone: "warning" });
  }
  return alerts;
}
