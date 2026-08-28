/**
 * نموذج تعبئة تقرير التقييم — الجانب الصرف (بيانات فقط، لا DOM):
 * يبني ValuationReportLiveFill من الحقائق ويُبقي التطبيق على القالب
 * في valuation-report-live-fill.ts (فصل المسؤوليتين).
 */
import {
  VALUE_BASIS_OPTIONS,
  VALUE_PREMISE_OPTIONS,
  VALUATION_PURPOSE_OPTIONS,
  basisOfValueKeyForAssignment,
  basisOfValueLabelArForAssignment,
  valuationPurposeKeyForAssignment,
  valuationPurposeLabelArForAssignment,
  valuePremiseKeyForAssignment,
} from "@platform/app-shared/prototype/assignment-valuation-defaults";
import type { PoIntakeRecord, PoPropertyIntake } from "@case-study/mfe/lib/prototype/po-intake-data";
import { subClientIdFromReportUsers } from "@case-study/mfe/lib/prototype/po-intake-data";
import {
  clientNameFromRecord,
  formatValuationReportUsers,
} from "./valuation-report-users";
import type { InspectorWorkspaceDraft } from "@case-study/mfe/lib/prototype/inspector-workspace-data";
import { isLandInspectionContext } from "@case-study/mfe/lib/prototype/inspector-workspace-data";
import {
  applyIvsDateToStandards,
  isNoExternalSpecialistAssumption,
  type BuildingInventoryLineDto,
  type ClientDto,
  type OrganizationValuerRosterEntry,
  type ValuationComparableSelectionListDto,
  type ValuationCostApproachDto,
  type ValuationReconciliationDto,
} from "@platform/api-client";
import {
  areasFromInventory,
  adoptedComparables,
  effectiveComparableValues,
  annexCountDisplay,
  buildAdjustmentRationaleText,
  buildAdjustmentSheetRows,
  buildDirectCostSheetRows,
  buildIndirectCostSheetRows,
  buildReconSheetRows,
  composeTransactionCell,
  costLinePresent,
  costRowCells,
  dashSheet,
  esgCell,
  finishingLevelLabel,
  formatMoneyCell,
  formatSheetPct,
  inventoryLinePresent,
  joinObservations,
  mapSurroundings,
  membershipCategoryLabel,
  presentChip,
  reconWeight,
  valuerRoleLabel,
  yesNoFromFlag,
  existsFromCount,
  existsFromYesNo,
  existsIf,
} from "./valuation-report-sheet-facts";
import { escHtml } from "./html-escape";
import type { ValuationReportSlotAttachment } from "./valuation-report-print-attachments";
import {
  linesFromOrgText,
  pairsFromOrgLines,
} from "./valuation-report-print-attachments";
import {
  buildComparablesMapSvgDataUrl,
  collectComparablesMapPins,
} from "./valuation-report-comparables-map";
import type {
  EvaluatorReportChoices,
  EvaluatorReportWorker,
  EvaluatorSubmission,
} from "./evaluator-window-data";
import { emptyReportChoices } from "./evaluator-window-data";
import {
  amountToArabicWords,
  formatAmountNumberDisplay,
} from "./arabic-amount-words";
import { parseEvaluatorAmount } from "./value-estimation";

const OWNERSHIP_LABELS: Record<string, string> = {
  absolute: "ملكية مطلقة",
  mortgaged: "مرهون",
  investment: "استثمار",
  shared: "مشاع",
};

/** Template sample numbers wiped before live data is written. */
export const SAMPLE_SECS = new Set(["10", "11", "13", "14", "15", "17", "19", "20", "21", "22", "23", "24", "25"]);

const MARKET_BASIS_DEFINITION =
  "القيمة السوقية هي المبلغ المقدَّر الذي ينبغي أن يُتبادل به أصل أو التزام في تاريخ التقييم بين مشترٍ راغب وبائع راغب في معاملة تجارية بحتة بعد تسويق مناسب، بحيث يتصرف كل طرف عن دراية وبحكمة ودون إجبار.";

const LIQUIDATION_BASIS_DEFINITION =
  "قيمة التصفية هي المبلغ الإجمالي الذي يمكن تحقيقه عند بيع أصل أو مجموعة أصول بموجب بيع التصفية، وقد حُددت في هذا التقرير بموجب افتراض المعاملة المنظمة ذات فترة التسويق النموذجية (التصفية المنظمة) — انظر المعيار 102 — أسس القيمة، الملحق (أ)60.";

export function slashReportDate(iso: string | null | undefined): string {
  const t = (iso ?? "").trim();
  const m = /^(\d{4})-(\d{2})-(\d{2})/.exec(t);
  return m ? `${m[1]}/${m[2]}/${m[3]}` : t;
}

export function assignmentValuationFromPo(
  record?: Pick<
    PoIntakeRecord,
    "assignmentType" | "reportUserClientIds" | "clientId"
  > | null,
): { purposeKey: string; valueBasisKey: string; premiseKey: string } {
  const type = record?.assignmentType?.trim() ?? "";
  if (!type) {
    return { purposeKey: "", valueBasisKey: "", premiseKey: "" };
  }
  const sub = subClientIdFromReportUsers(record?.reportUserClientIds);
  const purposeKey = valuationPurposeKeyForAssignment(type, sub);
  const valueBasisKey = basisOfValueKeyForAssignment(type, sub);
  return {
    purposeKey,
    valueBasisKey,
    premiseKey: valuePremiseKeyForAssignment(type, sub),
  };
}

export function labelForPurposeKey(key: string): string {
  return VALUATION_PURPOSE_OPTIONS.find((o) => o.value === key)?.label ?? "";
}

export function labelForBasisKey(key: string): string {
  return VALUE_BASIS_OPTIONS.find((o) => o.value === key)?.label ?? "";
}

export function labelForPremiseKey(key: string): string {
  return VALUE_PREMISE_OPTIONS.find((o) => o.value === key)?.label ?? "";
}

export function ownershipTypeDisplay(value: string | null | undefined): string {
  const t = (value ?? "").trim();
  if (!t) return "";
  return OWNERSHIP_LABELS[t] ?? t;
}

function extraInventoryAreaRows(
  lines: { structureKind?: string; label?: string; areaSqm?: string | null }[] | null | undefined,
  base: Array<{ key: string; values: string[] }>,
): Array<{ key: string; values: string[] }> {
  const known = new Set(base.map((r) => normLabel(r.key)));
  const extra: Array<{ key: string; values: string[] }> = [];
  for (const line of lines ?? []) {
    const kind = (line.structureKind ?? "").trim().toLowerCase();
    if (kind !== "floor" && kind !== "annex" && kind !== "basement") continue;
    const lab = (line.label ?? "").trim();
    if (!lab || known.has(normLabel(lab))) continue;
    extra.push({ key: lab, values: [dashSheet(line.areaSqm)] });
    known.add(normLabel(lab));
  }
  return [...base, ...extra];
}

function pickLength(
  survey: string | null | undefined,
  property: string | null | undefined,
): string {
  const s = (survey ?? "").trim();
  if (s) return s;
  return (property ?? "").trim();
}

function surveyUsesNature(survey?: ValuationReportSurveyBounds | null): boolean {
  return survey?.deedMatchesNature === "no";
}

export function dash(value: string | null | undefined): string {
  const t = (value ?? "").trim();
  return t || "—";
}

/** توحيد عناوين القالب للمطابقة — يسقط محارف الاتجاه ويطوي الفراغات. */
export function normLabel(value: string): string {
  return value
    .replace(/[\u200e\u200f\u202a-\u202e\u2066-\u2069]/g, "")
    .replace(/\s+/g, " ")
    .trim();
}

export function slashDateFromIso(iso: string | null | undefined): string {
  const m = /^(\d{4})-(\d{2})-(\d{2})/.exec((iso ?? "").trim());
  return m ? `${m[1]}/${m[2]}/${m[3]}` : "";
}

function joinCoords(inspector?: InspectorWorkspaceDraft | null): string {
  const lat = (inspector?.mapLatitude ?? "").trim();
  const lng = (inspector?.mapLongitude ?? "").trim();
  if (!lat && !lng) return "";
  return [lat, lng].filter(Boolean).join(" ، ");
}

function methodsUsed(choices: EvaluatorReportChoices): string {
  const bits: string[] = [];
  if (choices.marketMethodKey && choices.marketMethodKey !== "__unused__") {
    bits.push("أسلوب السوق");
  }
  if (choices.costMethodKey && choices.costMethodKey !== "__unused__") {
    bits.push("أسلوب التكلفة");
  }
  if (choices.incomeMethodKey && choices.incomeMethodKey !== "__unused__") {
    bits.push("أسلوب الدخل");
  }
  return bits.join(" و ");
}

export type ValuationReportSurveyBounds = {
  deedMatchesNature?: "yes" | "no" | null;
  northBoundary?: string;
  northBoundaryLengthM?: string;
  southBoundary?: string;
  southBoundaryLengthM?: string;
  eastBoundary?: string;
  eastBoundaryLengthM?: string;
  westBoundary?: string;
  westBoundaryLengthM?: string;
  natureNorthBoundary?: string;
  natureNorthBoundaryLengthM?: string;
  natureSouthBoundary?: string;
  natureSouthBoundaryLengthM?: string;
  natureEastBoundary?: string;
  natureEastBoundaryLengthM?: string;
  natureWestBoundary?: string;
  natureWestBoundaryLengthM?: string;
};

export type ValuationReportLiveFill = {
  cells: Record<string, string>;
  scopeBasis: string;
  scopeClient: string;
  basisDefinition: string;
  methodRow: [string, string, string];
  boundaries: Array<{
    name: string;
    bound: string;
    len: string;
    face: string;
  }>;
  areaRows: Array<{ key: string; values: string[] }>;
  buildDescRows: Array<{ key: string; values: string[] }>;
  serviceRows: Array<{ key: string; values: string[] }>;
  comparableRows: Array<{ key: string; values: string[] }>;
  /** Appendix (أ) — land_within_cost comps only. */
  landComparableRows: Array<{ key: string; values: string[] }>;
  landAppendixNote: string;
  adjustmentRows: Array<{ key: string; values: string[] }>;
  adjustmentComparisonLabel: string;
  adjustmentNotes: string;
  surroundingsOther: string;
  costRows: Array<{ key: string; values: string[] }>;
  indirectRows: Array<{ key: string; values: string[] }>;
  indirectTotalLabel: string;
  reconRows: Array<{ key: string; values: string[] }>;
  finalDisplay: string;
  finalWords: string;
  isLiquidation: boolean;
  isLand: boolean;
  propertyDescription: string;
  reportWorkers: EvaluatorReportWorker[];
  /** §26 — المقيم المسند من توزيع المعاملات (العمود الرابع). */
  assignedAppraiserName: string;
  /** §34 — up to 12 field photos (data URLs). */
  photoSlots: ValuationReportSlotAttachment[];
  /** §35 — survey document (image or PDF data URL). */
  surveySlot: ValuationReportSlotAttachment | null;
  /** §36 — deed document. */
  deedSlot: ValuationReportSlotAttachment | null;
  /** §18 — uploaded site map or generated SVG from coords. */
  comparableMapSlot: ValuationReportSlotAttachment | null;
  /** §28 — optional notes under research scope bullets. */
  searchScopeNotes: string;
  /** §28 — empty keeps template bullets; org `researchScopeText` replaces. */
  researchScopeBullets: string[];
  /** §29 — null keeps template; array (even empty) replaces org-filtered list. */
  specialAssumptionBullets: string[] | null;
  /** §37 — empty keeps template; org `ivsStandards` replaces rows. */
  ivsPairs: Array<{ term: string; text: string }>;
  /** §38 — empty keeps template; org `glossary` replaces rows. */
  glossaryPairs: Array<{ term: string; text: string }>;
  /** §12 — selected finishing level key (luxury|medium|ordinary|none). */
  finishingLevel: "" | "luxury" | "medium" | "ordinary" | "none";
  /** §12 — optional org overrides for the three description columns. */
  finishingTexts: {
    luxury: string;
    medium: string;
    ordinary: string;
  };
  /** §3 — org keyInputsText; empty keeps template bullets. */
  keyInputsBullets: string[];
  /** §4 — org professionalStandards with {{ivsDate}} applied; empty keeps template. */
  standardsParagraphs: string[];
  /** §5 — org independence text; empty keeps template. */
  independenceParagraphs: string[];
  /** §31 — org terms; empty keeps template list (with date scrub). */
  termsBullets: string[];
  /** §32 — org restrictions; empty keeps template list (with date scrub). */
  restrictionsBullets: string[];
  /** تاريخ التقرير بصيغة yyyy/mm/dd — يستبدل تواريخ العيّنة المجمّدة في §31/§32. */
  reportDateSlash: string;
  /** §33 — «المدينة - الحي» بدل «جدة - الصوارى» المثبتة. */
  locationLabel: string;
  /** §33 — الخريطة المقربة: SVG مولّد عند توفر خريطة مرفوعة للأقمار. */
  closeupMapSlot: ValuationReportSlotAttachment | null;
};

export function buildValuationReportLiveFill(input: {
  draft: EvaluatorSubmission;
  record?: PoIntakeRecord | null;
  property?: PoPropertyIntake | null;
  inspector?: InspectorWorkspaceDraft | null;
  inventoryLines?: BuildingInventoryLineDto[] | null;
  market?: ValuationComparableSelectionListDto | null;
  /** Independent vacant-land comps for cost approach (appendix). */
  landMarket?: ValuationComparableSelectionListDto | null;
  cost?: ValuationCostApproachDto | null;
  recon?: ValuationReconciliationDto | null;
  clients?: Pick<ClientDto, "id" | "nameAr">[];
  purposeLabel?: string | null;
  basisLabel?: string | null;
  premiseLabel?: string | null;
  basisDefinition?: string | null;
  certifiedName?: string | null;
  certifiedLicense?: string | null;
  certifiedIssuedAt?: string | null;
  certifiedExpires?: string | null;
  certifiedMembershipCategory?: string | null;
  certifiedTitle?: string | null;
  certifiedMembershipExpires?: string | null;
  certifiedMembershipNumber?: string | null;
  valuationBranch?: string | null;
  reportType?: string | null;
  currency?: string | null;
  effectiveValuationDate?: string | null;
  /** المقيم المسند من توزيع المعاملات — عمود المشاركين الرابع. */
  assignedAppraiserName?: string | null;
  survey?: ValuationReportSurveyBounds | null;
  photoSlots?: ValuationReportSlotAttachment[] | null;
  surveySlot?: ValuationReportSlotAttachment | null;
  deedSlot?: ValuationReportSlotAttachment | null;
  /** Prefer uploaded site-map; else generate from subject + adopted comps. */
  siteMapSlot?: ValuationReportSlotAttachment | null;
  ivsStandardsText?: string | null;
  glossaryText?: string | null;
  researchScopeText?: string | null;
  /**
   * Selected special assumptions from approach settings (source of truth).
   * `undefined` = not provided (keep HTML template).
   * `[]` = none selected (clear printed list).
   */
  selectedSpecialAssumptions?: string[] | null;
  /** @deprecated Prefer `selectedSpecialAssumptions` from approach settings. */
  specialAssumptionLibrary?: string[] | null;
  /** When true, drop the library clause that denies using an external specialist. */
  externalSpecialistUsed?: boolean;
  finishingLuxuryText?: string | null;
  finishingMediumText?: string | null;
  finishingOrdinaryText?: string | null;
  keyInputsText?: string | null;
  professionalStandardsText?: string | null;
  independenceText?: string | null;
  termsText?: string | null;
  restrictionsText?: string | null;
  /** تاريخ سريان معايير IVS — يعوّض {{ivsDate}} في نص المعايير. */
  ivsEffectiveDate?: string | null;
}): ValuationReportLiveFill {
  const { draft, record, property, inspector } = input;
  const keys = assignmentValuationFromPo(record);
  const sub = subClientIdFromReportUsers(record?.reportUserClientIds);
  const purpose =
    (input.purposeLabel ?? "").trim() ||
    labelForPurposeKey(keys.purposeKey) ||
    (record
      ? valuationPurposeLabelArForAssignment(record.assignmentType, sub)
      : "");
  const basis =
    (input.basisLabel ?? "").trim() ||
    labelForBasisKey(keys.valueBasisKey) ||
    (record
      ? basisOfValueLabelArForAssignment(record.assignmentType, sub)
      : "");
  const premise =
    (input.premiseLabel ?? "").trim() ||
    labelForPremiseKey(keys.premiseKey);
  const client = clientNameFromRecord(record, input.clients ?? []);
  const users = formatValuationReportUsers(record, input.clients ?? []);
  const choices = draft.reportChoices ?? emptyReportChoices();
  const appraisal = slashReportDate(
    input.effectiveValuationDate ||
      draft.appraisalDate ||
      draft.reportIssueDate ||
      inspector?.inspectionDate,
  );
  const inspection = slashReportDate(inspector?.inspectionDate);
  const requestDate = slashReportDate(record?.receivedFromEnfathAt);
  const area = (property?.area ?? "").trim();
  const land = (draft.landValue ?? "").trim();
  const price = (draft.evaluatorPrice ?? "").trim();
  const priceN = parseEvaluatorAmount(price);
  const isLiquidation = keys.valueBasisKey === "liquidation";
  const isLand = isLandInspectionContext({
    vacantLand: inspector?.vacantLand,
    assetSubject: inspector?.featureValues?.assetSubject,
    classification: property?.classification,
    propertyType: property?.propertyType,
  });
  const licenseDateRaw = (inspector?.buildLicenseDate ?? "").trim();
  const licenseDate =
    slashReportDate(licenseDateRaw) || licenseDateRaw;
  const license = [
    inspector?.buildLicenseNumber?.trim(),
    licenseDate,
  ]
    .filter(Boolean)
    .join(" · ");

  const cells: Record<string, string> = {
    "اسم العميل": dash(client),
    "تاريخ التقييم": dash(appraisal),
    "مستخدمو التقرير": dash(users || client),
    "اسم مستخدم تقرير التقييم": dash(users || client),
    "تاريخ المعاينة": dash(inspection),
    "اسم المالك": dash(property?.ownerName),
    "رقم الطلب": dash(property?.requestNumber),
    "الغرض من التقييم": dash(purpose),
    "تاريخ الطلب": dash(requestDate),
    "أساس القيمة": dash(basis),
    "فرضية القيمة": dash(premise),
    "فرضية القيمة (الاستخدام المفترض)": dash(premise),
    "نوع التقرير": dash(input.reportType),
    "عملة التقييم": dash(input.currency),
    "نوع العقار": dash(
      property?.propertyType ||
        property?.classification ||
        inspector?.featureValues?.assetSubject ||
        inspector?.featureValues?.propertyUsage,
    ),
    "أساليب التقييم المستخدمة": dash(methodsUsed(choices)),
    "حالة العقار": dash(inspector?.featureValues?.buildState),
    "حالة الصك": dash(property?.deedStatus),
    "نوع الملكية": dash(
      ownershipTypeDisplay(
        property?.ownershipType || property?.suggestedOwnershipType,
      ),
    ),
    "هل يوجد منقولات": dash(inspector?.featureValues?.movables),
    "وصف المنقولات": inspector?.featureValues?.movables === "نعم"
        ? dash(inspector?.featureValues?.movablesDescription)
        : inspector?.featureValues?.movables === "لا"
          ? "لا يوجد منقولات بالعقار"
          : dash(""),
    "المنقولات":
      inspector?.featureValues?.movables === "نعم"
        ? dash(inspector?.featureValues?.movablesDescription)
        : inspector?.featureValues?.movables === "لا"
          ? "لا يوجد منقولات بالعقار"
          : dash(""),
    "اسم المنطقة": dash(property?.region),
    "اسم المدينة": dash(property?.city),
    "اسم الحي": dash(property?.district),
    "اسم المخطط": dash(property?.planName),
    "رقم المخطط": dash(property?.planNumber),
    "رقم البلك": dash(property?.blockNumber),
    "رقم القطعة": dash(property?.plotNumber),
    "استخدام العقار": dash(
      property?.classification || inspector?.featureValues?.propertyUsage,
    ),
    "إحداثيات الموقع": dash(joinCoords(inspector)),
    "رقم الصك": dash(property?.deedNumber),
    "تاريخ الصك": dash(property?.deedDate),
    "رقم رخصة البناء وتاريخها": dash(license),
    ...(isLand
      ? {}
      : {
          "عمر البناء": dash(
            inspector?.propertyAgeYears
              ? `${inspector.propertyAgeYears.trim()} سنوات`
              : "",
          ),
          "عمر العقار": dash(
            inspector?.propertyAgeYears
              ? `${inspector.propertyAgeYears.trim()} سنوات`
              : "",
          ),
        }),
    "حالة البناء": dash(inspector?.featureValues?.buildState),
    "حالة الإشغال": dash(inspector?.featureValues?.occupancyState),
    "مساحة الأرض (حسب الصك)": dash(area ? `${area} م²` : ""),
    "مساحة الأرض (م²)": dash(
      input.cost?.landAreaSqm && input.cost.landAreaSqm > 0
        ? formatMoneyCell(input.cost.landAreaSqm)
        : area,
    ),
    "قيمة الأرض": dash(
      land && land !== "0" ? formatAmountNumberDisplay(land) : land === "0" ? "0" : "",
    ),
    "القيمة المرجّحة": dash(price ? formatAmountNumberDisplay(price) : ""),
    "قيمة العقار": dash(price ? formatAmountNumberDisplay(price) : ""),
    "نسبة خصم التصفية المنظمة": "—",
    "مبرر معامل التصفية": "—",
    "وصف العقار": dash(inspector?.propertyDescription),
  };

  const areas = areasFromInventory(input.inventoryLines, inspector);
  cells["مجموع مسطحات البناء"] = dash(areas.builtUpTotal);
  const surroundings = mapSurroundings(inspector?.amenities);
  const defects = [
    joinObservations(inspector),
    inspector?.hasViolations === "نعم"
      ? [
          "مخالفات ظاهرة",
          inspector.violationsCount.trim()
            ? `(${inspector.violationsCount.trim()})`
            : "",
          inspector.violationsDescription.trim(),
        ]
          .filter(Boolean)
          .join(" ")
      : inspector?.hasViolations === "لا"
        ? "لا توجد مخالفات ظاهرة"
        : "",
  ]
    .filter(Boolean)
    .join("؛ ");
  const kitchenCount =
    inspector?.featureValues?.kitchen === "نعم"
      ? "نعم"
      : inspector?.featureValues?.kitchen === "لا"
        ? "لا"
        : "";
  const reconFinal = input.recon?.finalOpinionValue;
  const reconLand = input.cost?.landValueFromMarket;
  const reconBeforeLiq = input.recon?.finalOpinionBeforeLiquidation;
  const reconWeighted =
    reconBeforeLiq != null && reconBeforeLiq > 0
      ? reconBeforeLiq
      : (input.recon?.weightedValue ?? reconFinal);
  const landDisplay =
    reconLand != null && reconLand > 0
      ? formatMoneyCell(reconLand)
      : land && land !== "0"
        ? formatAmountNumberDisplay(land)
        : land === "0"
          ? "0"
          : "";
  const priceDisplay =
    reconFinal != null && reconFinal > 0
      ? formatMoneyCell(reconFinal)
      : price
        ? formatAmountNumberDisplay(price)
        : "";
  const weightedDisplay =
    reconWeighted != null && reconWeighted > 0
      ? formatMoneyCell(reconWeighted)
      : priceDisplay;
  cells["قيمة الأرض"] = dash(landDisplay);
  cells["القيمة المرجّحة"] = dash(weightedDisplay);
  cells["قيمة العقار"] = dash(priceDisplay);
  const liqOn =
    isLiquidation || input.recon?.liquidationDiscountApplied === true;
  if (liqOn) {
    const pct =
      input.recon?.liquidationDiscountPct != null &&
      input.recon.liquidationDiscountPct > 0
        ? String(input.recon.liquidationDiscountPct).replace(/%/g, "")
        : draft.forcedSaleDiscountPct.replace(/%/g, "");
    cells["نسبة خصم التصفية المنظمة"] = dash(pct ? `${pct}٪` : "");
    cells["مبرر معامل التصفية"] = dash(
      input.recon?.liquidationDiscountRationale,
    );
  }

  const marketW = reconWeight(input.recon, ["market", "comparison"]);
  const costW = reconWeight(input.recon, ["cost", "replacement"]);
  const incomeW = reconWeight(input.recon, ["income"]);
  cells["أسلوب السوق"] = dash(marketW.weight);
  cells["أسلوب التكلفة"] = dash(costW.weight);
  cells["أسلوب الدخل"] = dash(incomeW.weight);

  cells["غرف النوم"] = dash(inspector?.roomCount);
  cells["عدد الغرف"] = dash(inspector?.roomCount);
  cells["الصالات"] = dash(inspector?.hallCount);
  cells["عدد الصالات"] = dash(inspector?.hallCount);
  cells["عدد الشقق"] = dash(inspector?.unitCount);
  cells["الشقق"] = dash(inspector?.unitCount);
  cells["دورات المياه"] = dash(inspector?.bathroomCount);
  cells["عدد دورات المياه"] = dash(inspector?.bathroomCount);
  cells["مطابخ"] = dash(kitchenCount);
  cells["مصعد"] = dash(
    existsFromYesNo(inspector?.featureValues?.hasElevator) ||
      existsIf(
        costLinePresent(input.cost, ["elevator"], ["مصعد"]) ||
          inventoryLinePresent(input.inventoryLines, "other", ["مصعد"]),
      ),
  );
  cells["مسبح"] = dash(
    existsFromYesNo(inspector?.featureValues?.hasPool) ||
      existsIf(
        costLinePresent(input.cost, ["pool"], ["مسبح"]) ||
          inventoryLinePresent(input.inventoryLines, "other", ["مسبح"]),
      ),
  );
  const annexCounts = annexCountDisplay(inspector);
  cells["ملاحق"] = dash(annexCounts);
  cells["ملاحق (عدد)"] = dash(annexCounts);
  cells["ملحق علوي (عدد)"] = dash(inspector?.annexUpperCount);
  cells["ملحق أرضي (عدد)"] = dash(inspector?.annexGroundCount);
  cells["جاكوزي"] = dash(inspector?.jacuzziCount);
  cells["جاكوزي(عدد)"] = dash(inspector?.jacuzziCount);
  cells["غرف الطعام"] = dash(inspector?.diningCount);
  cells["المجالس"] = dash(inspector?.majlisCount);
  cells["غرف الخدم"] = dash(inspector?.maidRoomCount);
  cells["غرفة حارس"] = dash(inspector?.guardRoomCount);
  cells["مواقف"] = dash(existsFromCount(inspector?.parkingCount));
  cells["موقف سيارة"] = dash(inspector?.parkingCount);
  cells["مستودع"] = dash(inspector?.storeCount);
  cells["ملاعب أطفال"] = dash(inspector?.playgroundCount);
  cells["ملاعب أطفال (عدد)"] = dash(inspector?.playgroundCount);
  cells["عدد المعارض"] = dash(inspector?.showroomCount);
  cells["المعارض"] = dash(inspector?.showroomCount);
  cells["عدد الآبار"] = dash(inspector?.wellCount);
  cells["الآبار"] = dash(inspector?.wellCount);
  cells["عدد الأبراج"] = dash(inspector?.towerCount);
  cells["الأبراج"] = dash(inspector?.towerCount);
  cells["مدخل السيارة"] = dash(
    yesNoFromFlag(inspector?.featureValues?.carEntrance),
  );
  cells["يوجد قبو"] = dash(yesNoFromFlag(inspector?.featureValues?.hasBasement));
  cells["وصف العيوب الإنشائية"] = dash(defects);
  cells["جامع"] = dash(surroundings["جامع"]);
  cells["مرفق طبي"] = dash(surroundings["مرفق طبي"]);
  cells["مرفق أمني"] = dash(surroundings["مرفق أمني"]);
  cells["سوق تجاري"] = dash(surroundings["سوق تجاري"]);
  cells["حديقة"] = dash(surroundings["حديقة"]);
  cells["مرفق تعليمي"] = dash(surroundings["مرفق تعليمي"]);
  cells["مقر حكومي"] = dash(surroundings["مقر حكومي"]);
  cells["طريق سريع"] = dash(surroundings["طريق سريع"]);

  cells["محضر التجزئة"] = dash(
    [property?.partitionMinutesNumber, property?.partitionMinutesDate]
      .map((x) => (x ?? "").trim())
      .filter(Boolean)
      .join(" · "),
  );
  cells["تشطيب الواجهة الشمالية"] = dash(property?.northFacadeFinishing);
  cells["تشطيب الواجهة الشرقية"] = dash(property?.eastFacadeFinishing);
  cells["تشطيب الواجهة الجنوبية"] = dash(property?.southFacadeFinishing);
  cells["تشطيب الواجهة الغربية"] = dash(property?.westFacadeFinishing);
  const finLevel = finishingLevelLabel(choices.finishingLevel);
  if (finLevel) cells["مستوى التشطيب"] = finLevel;

  cells["كفاءة الطاقة"] = dash(esgCell(choices.esgEnv));
  cells["أخطار الموقع والمناخ"] = dash(esgCell(choices.esgEnv));
  cells["المباني الخضراء"] = dash(esgCell(choices.esgEnv));
  cells["جودة التصاميم ورفاهية المسكن"] = dash(esgCell(choices.esgSoc));
  cells["الإسهام المجتمعي للعقار"] = dash(esgCell(choices.esgSoc));
  cells["الخدمات المتوفرة في الموقع"] = dash(esgCell(choices.esgSoc));
  cells["الامتثال التنظيمي"] = dash(esgCell(choices.esgGov));
  cells["الإدارة الفعالة لبيانات العقار"] = dash(esgCell(choices.esgGov));
  cells["مقومات تشغيل العقار"] = dash(esgCell(choices.esgGov));

  const rationale =
    (input.recon?.methodsRationale ?? "").trim() ||
    choices.methodsRationale.trim();
  cells["مبرر استخدام طرق التقييم"] = dash(rationale);
  cells["دخل سنوي"] = dash(choices.incomeAnnual);
  cells["نسبة الشغور"] = dash(choices.incomeVacancyPct);
  cells["نسبة التشغيل"] = dash(choices.incomeOpexPct);
  cells["معدل الرسملة"] = dash(choices.incomeCapRatePct);

  const profit = input.cost?.indirectItems?.find((i) =>
    (i.itemKey || i.labelAr || "").toLowerCase().includes("profit"),
  );
  cells["قيمة هامش الربح"] = dash(
    profit ? formatMoneyCell(profit.amount) : "",
  );
  cells["تكلفة المبنى والأرض"] = dash(
    input.cost ? formatMoneyCell(input.cost.costOpinionWithLand) : "",
  );
  if (!isLand) {
    cells["العمر الفعلي"] = dash(
      inspector?.propertyAgeYears
        ? `${inspector.propertyAgeYears.trim()} سنوات`
        : input.cost?.actualAgeYears != null
          ? `${input.cost.actualAgeYears} سنوات`
          : "",
    );
  }
  cells["العمر الاقتصادي"] = dash(
    input.cost?.economicAgeYears != null
      ? `${input.cost.economicAgeYears} سنة`
      : "",
  );
  cells["التقادم المادي"] = dash(
    formatSheetPct(input.cost?.physicalObsolescencePct),
  );
  cells["التقادم الوظيفي"] = dash(
    formatSheetPct(input.cost?.functionalObsolescencePct),
  );
  cells["التقادم الخارجي"] = dash(
    formatSheetPct(input.cost?.externalObsolescencePct),
  );
  cells["مجموع التقادم"] = dash(formatSheetPct(input.cost?.totalObsolescencePct));
  cells["نسبة الإهلاك / مجموع التقادم"] = dash(
    formatSheetPct(input.cost?.totalObsolescencePct),
  );
  cells["قيمة الإهلاك"] = dash(
    input.cost ? formatMoneyCell(input.cost.depreciationValue) : "",
  );
  cells["قيمة المباني بعد الإهلاك"] = dash(
    input.cost ? formatMoneyCell(input.cost.buildingsValueAfterDepreciation) : "",
  );
  cells["ناتج أسلوب التكلفة (الأرض + المباني)"] = dash(
    input.cost ? formatMoneyCell(input.cost.costOpinionWithLand) : "",
  );
  cells["سعر متر الأرض من مقارنات الأراضي الفضاء"] = dash(
    input.cost?.landUnitRateFromMarket
      ? formatMoneyCell(input.cost.landUnitRateFromMarket)
      : "",
  );
  // Legacy template label — keep fill so old sheets still update.
  cells["سعر المتر المستورد من طريقة المقارنة"] =
    cells["سعر متر الأرض من مقارنات الأراضي الفضاء"];
  cells["إشارة الملحق"] =
    input.cost?.landEstimateComplete
      ? "قُدّرت قيمة الأرض بطريقة المقارنات (أراضٍ فضاء)، وتفصيلها في الملحق (أ)."
      : "قيمة الأرض غير مكتملة — بانتظار مقارنات أراضٍ فضاء.";

  const comps = adoptedComparables(input.market);
  comps.forEach((item, i) => {
    const n = i + 1;
    const c = item.comparable;
    cells[`المقارن (${n})`] = dash(c.comparablePropertyType);
  });

  // هوية المقيم المعتمد تُكتب دائماً — «—» عند الفراغ حتى لا تُطبع بيانات عيّنة القالب.
  cells["اسم المقيم المعتمد"] = dash(input.certifiedName ?? "");
  cells["رقم ترخيص مزاولة المهنة"] = dash(input.certifiedLicense ?? "");
  const membershipNo = (
    input.certifiedMembershipNumber ||
    input.certifiedLicense ||
    ""
  ).trim();
  cells["رقم العضوية"] = membershipNo || "—";
  cells["تاريخ الإصدار"] = dash(input.certifiedIssuedAt ?? "");
  cells["تاريخ الانتهاء"] = dash(input.certifiedExpires ?? "");
  cells["فرع التقييم"] = dash(input.valuationBranch ?? "");
  const memCat = membershipCategoryLabel(input.certifiedMembershipCategory);
  cells["فئة العضوية"] = memCat || "—";
  const role =
    (input.certifiedTitle ?? "").trim() || valuerRoleLabel("certified");
  if (role) cells["صفته"] = role;
  cells["تاريخ انتهاء العضوية"] = dash(input.certifiedMembershipExpires ?? "");

  const groundCost = costRowCells(
    input.cost,
    ["ground_floor"],
    ["أرضي"],
    areas.ground,
  );
  const firstCost = costRowCells(
    input.cost,
    ["first_floor"],
    ["الأول"],
    areas.first,
  );
  const annexCost = costRowCells(
    input.cost,
    ["upper_annex"],
    ["علوي"],
    areas.annex,
  );
  const annexGroundCost = costRowCells(
    input.cost,
    ["lower_annex"],
    ["أرضي", "سفلي"],
    areas.annexGround,
  );
  const basementCost = costRowCells(
    input.cost,
    ["basement"],
    ["قبو"],
    areas.basement,
  );
  const fenceCost = costRowCells(input.cost, ["fence"], ["سور"], "");
  const poolCost = costRowCells(input.cost, ["pool"], ["مسبح"], "");
  const parkCost = costRowCells(input.cost, ["parking"], ["مواقف"], "");
  const otherCost = costRowCells(input.cost, ["custom"], ["أخرى"], "");

  const hasFence =
    existsFromYesNo(inspector?.featureValues?.hasFence) ||
    existsIf(
      inventoryLinePresent(input.inventoryLines, "fence", ["سور"]) ||
        costLinePresent(input.cost, ["fence"], ["سور"]),
    );
  cells["سور"] = dash(hasFence);
  const hasAc =
    existsFromYesNo(inspector?.featureValues?.hasCentralAc) ||
    existsIf(
      costLinePresent(input.cost, ["central_ac"], ["تكييف"]) ||
        inventoryLinePresent(input.inventoryLines, "other", ["تكييف"]),
    );
  cells["تكييف مركزي"] = dash(hasAc);
  const hasTanks =
    existsFromYesNo(inspector?.featureValues?.hasTanks) ||
    existsIf(
      costLinePresent(input.cost, ["tanks_pumps"], ["خزان"]) ||
        inventoryLinePresent(input.inventoryLines, "other", ["خزان"]),
    );
  cells["خزانات"] = dash(hasTanks);
  const hasLandscape =
    existsFromYesNo(inspector?.featureValues?.hasLandscaping) ||
    existsIf(
      costLinePresent(input.cost, ["landscaping"], ["تشجير"]) ||
        inventoryLinePresent(input.inventoryLines, "other", ["تشجير"]),
    );
  cells["تشجير"] = dash(hasLandscape);

  const adj = buildAdjustmentSheetRows(comps, input.market);
  const indirect = buildIndirectCostSheetRows(input.cost);

  const mapPins = collectComparablesMapPins({
    subjectLat: inspector?.mapLatitude,
    subjectLng: inspector?.mapLongitude,
    comps: comps.map((item, i) => ({
      latitude: item.comparable.latitude,
      longitude: item.comparable.longitude,
      label: String(i + 1),
    })),
  });
  const generatedMapUrl = buildComparablesMapSvgDataUrl(mapPins);
  const comparableMapSlot: ValuationReportSlotAttachment | null =
    input.siteMapSlot ??
    (generatedMapUrl
      ? {
          attachmentId: "generated-comps-map",
          url: generatedMapUrl,
          contentType: "image/svg+xml",
          fileName: "comparables-map.svg",
          labelAr: "خريطة مواقع المقارنات",
          isImage: true,
        }
      : null);

  // §33 — عندما تشغل الخريطة المرفوعة فتحة الأقمار، يذهب SVG المولّد للفتحة المقربة.
  const closeupMapSlot: ValuationReportSlotAttachment | null =
    input.siteMapSlot && generatedMapUrl
      ? {
          attachmentId: "generated-closeup-map",
          url: generatedMapUrl,
          contentType: "image/svg+xml",
          fileName: "closeup-map.svg",
          labelAr: "صورة مقربة للموقع",
          isImage: true,
        }
      : null;

  return {
    cells,
    scopeBasis: basis,
    scopeClient: client,
    basisDefinition: resolveBasisDefinition(
      keys.valueBasisKey,
      isLiquidation,
      input.basisDefinition,
    ),
    methodRow: [
      choices.marketMethodKey && choices.marketMethodKey !== "__unused__"
        ? "طريقة المقارنة"
        : "غير مستخدم",
      choices.costMethodKey && choices.costMethodKey !== "__unused__"
        ? "طريقة التكلفة (الإحلال)"
        : "غير مستخدم",
      choices.incomeMethodKey && choices.incomeMethodKey !== "__unused__"
        ? "رسملة الدخل"
        : "غير مستخدم",
    ],
    boundaries: [
      {
        name: "الشمالية",
        bound: pickLength(
          surveyUsesNature(input.survey)
            ? input.survey?.natureNorthBoundary
            : input.survey?.northBoundary,
          property?.northBoundary,
        ),
        len: pickLength(
          surveyUsesNature(input.survey)
            ? input.survey?.natureNorthBoundaryLengthM
            : input.survey?.northBoundaryLengthM,
          property?.northBoundaryLengthM,
        ),
        face: property?.northFacadeFinishing ?? "",
      },
      {
        name: "الجنوبية",
        bound: pickLength(
          surveyUsesNature(input.survey)
            ? input.survey?.natureSouthBoundary
            : input.survey?.southBoundary,
          property?.southBoundary,
        ),
        len: pickLength(
          surveyUsesNature(input.survey)
            ? input.survey?.natureSouthBoundaryLengthM
            : input.survey?.southBoundaryLengthM,
          property?.southBoundaryLengthM,
        ),
        face: property?.southFacadeFinishing ?? "",
      },
      {
        name: "الشرقية",
        bound: pickLength(
          surveyUsesNature(input.survey)
            ? input.survey?.natureEastBoundary
            : input.survey?.eastBoundary,
          property?.eastBoundary,
        ),
        len: pickLength(
          surveyUsesNature(input.survey)
            ? input.survey?.natureEastBoundaryLengthM
            : input.survey?.eastBoundaryLengthM,
          property?.eastBoundaryLengthM,
        ),
        face: property?.eastFacadeFinishing ?? "",
      },
      {
        name: "الغربية",
        bound: pickLength(
          surveyUsesNature(input.survey)
            ? input.survey?.natureWestBoundary
            : input.survey?.westBoundary,
          property?.westBoundary,
        ),
        len: pickLength(
          surveyUsesNature(input.survey)
            ? input.survey?.natureWestBoundaryLengthM
            : input.survey?.westBoundaryLengthM,
          property?.westBoundaryLengthM,
        ),
        face: property?.westFacadeFinishing ?? "",
      },
    ],
    areaRows: extraInventoryAreaRows(input.inventoryLines, [
      { key: "الدور الأرضي", values: [dashSheet(areas.ground)] },
      { key: "الدور الأول", values: [dashSheet(areas.first)] },
      { key: "الملحق العلوي", values: [dashSheet(areas.annex)] },
      { key: "الملحق الأرضي", values: [dashSheet(areas.annexGround)] },
      { key: "ملحق أرضي", values: [dashSheet(areas.annexGround)] },
      { key: "القبو", values: [dashSheet(areas.basement)] },
      { key: "إجمالي الملاحق", values: [dashSheet(areas.annexTotal)] },
      { key: "مجموع مسطحات البناء", values: [dashSheet(areas.builtUpTotal)] },
    ]),
    buildDescRows: areas.descriptions.map((r) => ({
      key: r.key,
      values: r.values.map((v) => dashSheet(v)),
    })),
    serviceRows: [
      {
        key: "كهرباء",
        values: [
          presentChip(inspector?.services, "كهرباء"),
          dashSheet(inspector?.electricityMeterCount),
          dashSheet(inspector?.electricityMeterNumbers),
        ],
      },
      {
        key: "ماء",
        values: [
          presentChip(inspector?.services, "ماء"),
          dashSheet(inspector?.waterMeterCount),
          dashSheet(inspector?.waterMeterNumbers),
        ],
      },
      {
        key: "صرف صحي",
        values: [
          presentChip(inspector?.services, "صرف صحي"),
          "—",
          "—",
        ],
      },
      {
        key: "هاتف / ألياف بصرية",
        values: [
          presentChip(inspector?.services, "هاتف / اتصالات"),
          "—",
          "—",
        ],
      },
    ],
    comparableRows: comps.map((item, i) => {
      const c = item.comparable;
      const eff = effectiveComparableValues(item);
      return {
        key: String(i + 1),
        values: [
          dashSheet(c.comparablePropertyType),
          dashSheet(composeTransactionCell(c)),
          dashSheet(eff.areaSqm ? String(eff.areaSqm) : ""),
          dashSheet(c.transactionDate),
          dashSheet(formatMoneyCell(eff.price)),
          dashSheet(formatMoneyCell(eff.pricePerSqm)),
        ],
      };
    }),
    landComparableRows: adoptedComparables(input.landMarket).map((item, i) => {
      const c = item.comparable;
      const eff = effectiveComparableValues(item);
      return {
        key: String(i + 1),
        values: [
          dashSheet(c.comparablePropertyType),
          dashSheet(composeTransactionCell(c)),
          dashSheet(eff.areaSqm ? String(eff.areaSqm) : ""),
          dashSheet(c.transactionDate),
          dashSheet(formatMoneyCell(eff.price)),
          dashSheet(formatMoneyCell(eff.pricePerSqm)),
          item.market
            ? dashSheet(formatSheetPct(item.market.effectiveWeightPct))
            : "—",
        ],
      };
    }),
    landAppendixNote: cells["إشارة الملحق"] || "",
    adjustmentRows: adj.rows,
    adjustmentComparisonLabel: adj.comparisonLabel,
    adjustmentNotes: buildAdjustmentRationaleText(comps),
    surroundingsOther: dash(surroundings["أخرى"]),
    costRows: buildDirectCostSheetRows(input.cost, areas),
    indirectRows: indirect.rows,
    indirectTotalLabel: indirect.totalLabel,
    reconRows: buildReconSheetRows(input.recon),
    finalDisplay:
      (reconFinal != null && reconFinal > 0
        ? `${formatAmountNumberDisplay(reconFinal)} ر.س.`
        : priceN != null && priceN > 0
          ? `${formatAmountNumberDisplay(priceN)} ر.س.`
          : "—"),
    finalWords:
      reconFinal != null && reconFinal > 0
        ? `فقط ${amountToArabicWords(reconFinal)} ريال سعودي لا غير`
        : priceN != null && priceN > 0
          ? `فقط ${amountToArabicWords(priceN)} ريال سعودي لا غير`
          : "—",
    isLiquidation,
    isLand,
    propertyDescription: (inspector?.propertyDescription ?? "").trim(),
    reportWorkers: draft.reportWorkers ?? [],
    assignedAppraiserName: (input.assignedAppraiserName ?? "").trim(),
    photoSlots: input.photoSlots ?? [],
    surveySlot: input.surveySlot ?? null,
    deedSlot: input.deedSlot ?? null,
    comparableMapSlot,
    searchScopeNotes: (draft.searchScopeNotes ?? "").trim(),
    researchScopeBullets: linesFromOrgText(input.researchScopeText),
    specialAssumptionBullets: resolveSpecialAssumptionBullets({
      selected: input.selectedSpecialAssumptions,
      library: input.specialAssumptionLibrary,
      toggles: choices.specialAssumptionOn,
      dropNoSpecialistClause: Boolean(input.externalSpecialistUsed),
    }),
    ivsPairs: pairsFromOrgLines(input.ivsStandardsText),
    glossaryPairs: pairsFromOrgLines(input.glossaryText),
    keyInputsBullets: linesFromOrgText(input.keyInputsText),
    standardsParagraphs: linesFromOrgText(
      applyIvsDateToStandards(
        input.professionalStandardsText ?? "",
        input.ivsEffectiveDate ?? "",
      ),
    ),
    independenceParagraphs: linesFromOrgText(input.independenceText),
    termsBullets: linesFromOrgText(input.termsText),
    restrictionsBullets: linesFromOrgText(input.restrictionsText),
    reportDateSlash: slashDateFromIso(
      draft.appraisalDate || draft.reportIssueDate,
    ),
    locationLabel: [property?.city, property?.district]
      .map((s) => (s ?? "").trim())
      .filter(Boolean)
      .join(" - "),
    closeupMapSlot,
    finishingLevel: choices.finishingLevel || "",
    finishingTexts: {
      luxury: (input.finishingLuxuryText ?? "").trim(),
      medium: (input.finishingMediumText ?? "").trim(),
      ordinary: (input.finishingOrdinaryText ?? "").trim(),
    },
  };
}

/**
 * Prefer approach-settings `selectedSpecialAssumptions` when provided.
 * Legacy fallback: org library filtered by `reportChoices.specialAssumptionOn`.
 * `null` = no selection source → keep HTML template.
 * `[]` = none selected → clear the printed list.
 */
export function resolveSpecialAssumptionBullets(input: {
  selected?: string[] | null;
  library?: string[] | null;
  toggles?: boolean[] | null;
  dropNoSpecialistClause?: boolean;
}): string[] | null {
  if (input.selected !== undefined && input.selected !== null) {
    const items = input.selected.map((x) => x.trim()).filter(Boolean);
    if (input.dropNoSpecialistClause) {
      return items.filter((item) => !isNoExternalSpecialistAssumption(item));
    }
    return items;
  }
  return filterSpecialAssumptionBullets(input.library, input.toggles, {
    dropNoSpecialistClause: input.dropNoSpecialistClause,
  });
}

/**
 * Org library filtered by per-case toggles (legacy draft path).
 * `null` = no library → keep HTML template.
 * `[]` = all unchecked → clear the printed list.
 */
export function filterSpecialAssumptionBullets(
  library: string[] | null | undefined,
  toggles: boolean[] | null | undefined,
  options?: { dropNoSpecialistClause?: boolean },
): string[] | null {
  const items = (library ?? []).map((x) => x.trim()).filter(Boolean);
  if (!items.length) return null;
  const on = toggles ?? [];
  const dropNoSpecialist = Boolean(options?.dropNoSpecialistClause);
  return items.filter((item, i) => {
    if (dropNoSpecialist && isNoExternalSpecialistAssumption(item)) return false;
    return on[i] ?? true;
  });
}

function resolveBasisDefinition(
  valueBasisKey: string,
  isLiquidation: boolean,
  fromLists?: string | null,
): string {
  const listed = (fromLists ?? "").trim();
  if (isLiquidation) {
    return listed || LIQUIDATION_BASIS_DEFINITION;
  }
  if (valueBasisKey === "market") {
    if (listed && !listed.includes("قيمة التصفية")) return listed;
    return MARKET_BASIS_DEFINITION;
  }
  if (listed && !listed.includes("قيمة التصفية")) return listed;
  return listed;
}
