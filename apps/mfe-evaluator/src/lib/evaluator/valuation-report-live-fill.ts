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
import {
  VALUATION_REPORT_USER_OPTION_LABEL,
  showsValuationReportUserField,
  subClientIdFromReportUsers,
} from "@case-study/mfe/lib/prototype/po-intake-data";
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
const SAMPLE_SECS = new Set(["10", "11", "13", "14", "15", "17", "19", "20", "21", "22", "23", "24", "25"]);

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

export function reportUserNamesFromRecord(
  record: Pick<PoIntakeRecord, "clientNameAr" | "reportUserClientIds" | "clientId"> | null | undefined,
  clients: Pick<ClientDto, "id" | "nameAr">[],
): string {
  const ids = record?.reportUserClientIds ?? [];
  const names = ids
    .map((id) => clients.find((c) => c.id === id)?.nameAr.trim() ?? "")
    .filter(Boolean);
  if (names.length) return names.join(" و ");
  return clientNameFromRecord(record, clients);
}

export function clientNameFromRecord(
  record: Pick<PoIntakeRecord, "clientNameAr" | "clientId"> | null | undefined,
  clients: Pick<ClientDto, "id" | "nameAr">[] = [],
): string {
  const named = (record?.clientNameAr ?? "").trim();
  if (named) return named;
  const id = (record?.clientId ?? "").trim();
  if (!id) return "";
  return clients.find((c) => c.id === id)?.nameAr.trim() ?? "";
}

export function formatValuationReportUsers(
  record:
    | Pick<
        PoIntakeRecord,
        "clientNameAr" | "reportUserClientIds" | "assignmentType" | "clientId"
      >
    | null
    | undefined,
  clients: Pick<ClientDto, "id" | "nameAr">[],
): string {
  if (
    record &&
    showsValuationReportUserField(record.assignmentType, record.clientId)
  ) {
    return VALUATION_REPORT_USER_OPTION_LABEL;
  }
  const names = reportUserNamesFromRecord(record, clients);
  const client = clientNameFromRecord(record, clients);
  if (names && client && names !== client) return `${client} و ${names}`;
  return names || client;
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

function dash(value: string | null | undefined): string {
  const t = (value ?? "").trim();
  return t || "—";
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

function normLabel(value: string): string {
  return value
    .replace(/[\u200e\u200f\u202a-\u202e\u2066-\u2069]/g, "")
    .replace(/\s+/g, " ")
    .trim();
}

function blankValueCells(root: ParentNode) {
  root.querySelectorAll("tr").forEach((tr) => {
    const cells = [...tr.querySelectorAll("td.v, td.num")];
    const skipFirstLabel =
      tr.querySelectorAll("td").length > 1 &&
      cells[0] === tr.querySelector("td");
    cells.forEach((td, i) => {
      if (td.classList.contains("k")) return;
      if (skipFirstLabel && i === 0) return;
      td.textContent = "—";
    });
  });
}

function fillBoundaries(
  sec: Element,
  rows: ValuationReportLiveFill["boundaries"],
) {
  sec.querySelectorAll("tr").forEach((tr) => {
    const cells = [...tr.querySelectorAll("td")];
    if (cells.length < 2) return;
    const name = normLabel(cells[0]?.textContent ?? "");
    const row = rows.find((r) => r.name === name);
    if (!row) return;
    if (cells[1]) cells[1].textContent = dash(row.bound);
    if (cells[2]) cells[2].textContent = dash(row.len);
    if (cells[3]) cells[3].textContent = dash(row.face);
  });
}

function fillMethodRow(sec: Element, methods: [string, string, string]) {
  const dataRow = [...sec.querySelectorAll("tr")].find((tr) =>
    [...tr.querySelectorAll("td")].length >= 3 &&
    !tr.querySelector("th"),
  );
  if (!dataRow) return;
  const cells = [...dataRow.querySelectorAll("td")];
  cells.forEach((cell, i) => {
    if (methods[i] != null) cell.textContent = methods[i]!;
  });
}

function fillFinalBanner(sec: Element, fill: ValuationReportLiveFill) {
  const banner = [...sec.querySelectorAll("div")].find((d) =>
    (d.getAttribute("style") ?? "").includes("#102b4e"),
  );
  if (!banner) return;
  const kids = [...banner.children];
  const row = kids[0];
  if (row) {
    const parts = [...row.children];
    if (parts[1]) parts[1].textContent = fill.finalDisplay;
  }
  if (kids[1]) kids[1].textContent = fill.finalWords;
}

function peopleNameMatch(a: string, b: string): boolean {
  const n = (s: string) => s.replace(/\s+/g, " ").trim();
  const left = n(a);
  const right = n(b);
  if (!left || !right) return false;
  return left === right || left.includes(right) || right.includes(left);
}

function workerJobTitle(
  role: string,
  rosterRole: string | undefined,
): string {
  if (rosterRole) {
    const fromRoster = valuerRoleLabel(rosterRole);
    if (fromRoster) return fromRoster;
  }
  if (role === "مراجع") return "مقيم عقاري مراجع";
  if (role === "معد") return "مقيم عقاري";
  return "";
}

function rowValueCells(row: Element): Element[] {
  return [...row.children].filter(
    (el): el is HTMLTableCellElement =>
      el instanceof HTMLTableCellElement &&
      (el.classList.contains("v") || el.classList.contains("num")),
  );
}

function fillRowValues(row: Element | undefined, values: string[]) {
  if (!row) return;
  rowValueCells(row).forEach((cell, i) => {
    cell.textContent = values[i] ?? "—";
  });
}

type ParticipantFill = {
  name: string;
  title: string;
  category: string;
  membership: string;
  membershipExpires: string;
  signatureUrl: string;
};

/** §26 — ثلاثة مشاركون ثابتون من السجل + الرابع من توزيع المعاملات (المقيم المسند). */
export const FIXED_REPORT_PARTICIPANT_NAMES = [
  "سليمان عبد الله الصالحي",
  "سالم الغريب",
  "أيمن أحمد مجرشي",
] as const;

function participantFromRoster(
  name: string,
  roster: OrganizationValuerRosterEntry[],
  fallbackRole: string,
): ParticipantFill {
  const hit = roster.find((v) => peopleNameMatch(v.nameAr, name));
  return {
    name: (hit?.nameAr || name).trim(),
    title: hit
      ? valuerRoleLabel(hit.role)
      : workerJobTitle(fallbackRole, undefined),
    category: membershipCategoryLabel(hit?.membershipCategory),
    membership: (hit?.membershipNumber ?? "").trim(),
    membershipExpires: slashDateFromIso(hit?.membershipExpiresAt),
    signatureUrl: (hit?.signatureUrl ?? "").trim(),
  };
}

/** §26 — ثلاثة ثابتون + عمود رابع من إسناد التقييم في توزيع المعاملات. */
export function resolveReportParticipants(
  _workers: EvaluatorReportWorker[] | undefined,
  valuers: OrganizationValuerRosterEntry[] | null | undefined,
  assignedAppraiserName?: string | null,
): ParticipantFill[] {
  const roster = (valuers ?? []).filter((v) => v.isActive !== false);
  const fixed = FIXED_REPORT_PARTICIPANT_NAMES.map((name) =>
    participantFromRoster(name, roster, "مراجع"),
  );
  const assignee = (assignedAppraiserName ?? "").trim();
  if (!assignee) return [...fixed];
  if (fixed.some((p) => peopleNameMatch(p.name, assignee))) return [...fixed];
  return [...fixed, participantFromRoster(assignee, roster, "معد")];
}

/** يوسّع/يقلّص أعمدة جدول المشاركين حسب العدد الفعلي من النظام. */
function syncParticipantColumns(table: Element, count: number) {
  const cols = Math.max(count, 1);
  const doc = table.ownerDocument;
  if (!doc) return;
  for (const row of table.querySelectorAll("tr")) {
    const labelCell = [...row.children].find(
      (el) => el instanceof HTMLTableCellElement && el.classList.contains("k"),
    );
    if (!labelCell) continue;
    const label = normLabel(labelCell.textContent ?? "");
    const isNum = label.includes("رقم") || label.includes("تاريخ");
    const isSig = label === "التوقيع";
    const valueCells = rowValueCells(row);
    while (valueCells.length > cols) {
      valueCells.pop()?.remove();
    }
    while (valueCells.length < cols) {
      const td = doc.createElement("td");
      td.className = isNum ? "v num" : "v";
      if (isSig) td.setAttribute("style", "height:52px");
      row.appendChild(td);
      valueCells.push(td);
    }
  }
}

/** يساوي عرض أعمدة المشاركين (باستثناء عمود التسمية). */
function equalizeParticipantColumns(table: Element, count: number) {
  const cols = Math.max(count, 1);
  if (table instanceof HTMLElement) {
    table.style.tableLayout = "fixed";
    table.style.width = "100%";
    table.classList.add("ctr");
  }
  const labelPct = 18;
  const valuePct = (100 - labelPct) / cols;
  for (const row of table.querySelectorAll("tr")) {
    const labelCell = [...row.children].find(
      (el) => el instanceof HTMLTableCellElement && el.classList.contains("k"),
    );
    if (labelCell instanceof HTMLElement) {
      labelCell.style.width = `${labelPct}%`;
    }
    for (const cell of rowValueCells(row)) {
      if (cell instanceof HTMLElement) {
        cell.style.width = `${valuePct}%`;
      }
    }
  }
}

/** يدرج صف التسمية إن غاب عن القالب (تحت رقم العضوية). */
function ensureParticipantLabeledRow(
  table: Element,
  label: string,
  afterLabel: string,
  cellClass: string,
): Element | undefined {
  const rows = [...table.querySelectorAll("tr")];
  const existing = rows.find(
    (r) => normLabel(r.querySelector("td.k")?.textContent ?? "") === label,
  );
  if (existing) return existing;
  const after = rows.find(
    (r) =>
      normLabel(r.querySelector("td.k")?.textContent ?? "") === afterLabel,
  );
  const doc = table.ownerDocument;
  if (!doc || !after) return undefined;
  const tr = doc.createElement("tr");
  const k = doc.createElement("td");
  k.className = "k";
  k.textContent = label;
  const v = doc.createElement("td");
  v.className = cellClass;
  tr.append(k, v);
  after.after(tr);
  return tr;
}

function fillParticipants(
  sec: Element,
  workers: EvaluatorReportWorker[] | undefined,
  valuers: OrganizationValuerRosterEntry[] | null | undefined,
  branch: string,
  assignedAppraiserName?: string | null,
) {
  const people = resolveReportParticipants(
    workers,
    valuers,
    assignedAppraiserName,
  );
  const tables = [...sec.querySelectorAll("table")];
  const table = tables[0];
  if (!table) return;
  ensureParticipantLabeledRow(
    table,
    "تاريخ انتهاء العضوية",
    "رقم العضوية",
    "v num",
  );
  syncParticipantColumns(table, people.length);
  equalizeParticipantColumns(table, people.length);
  const byLabel = (label: string) =>
    [...table.querySelectorAll("tr")].find(
      (r) => normLabel(r.querySelector("td.k")?.textContent ?? "") === label,
    );
  const cols = Math.max(people.length, 1);
  const pad = (pick: (p: ParticipantFill) => string) =>
    Array.from({ length: cols }, (_, i) =>
      dash(people[i] ? pick(people[i]!) : ""),
    );
  fillRowValues(byLabel("الاسم"), pad((p) => p.name));
  fillRowValues(byLabel("المسمى الوظيفي"), pad((p) => p.title));
  fillRowValues(byLabel("فئة العضوية"), pad((p) => p.category));
  fillRowValues(byLabel("رقم العضوية"), pad((p) => p.membership));
  fillRowValues(
    byLabel("تاريخ انتهاء العضوية"),
    pad((p) => p.membershipExpires),
  );
  fillRowValues(byLabel("فرع التقييم"), pad(() => branch));
  // التوقيع من نفس صف المشارك (بالفهرس) — ارتفاع ثابت 1.5سم وعرض متناسب.
  const sigRow = byLabel("التوقيع");
  if (sigRow) {
    const cells = rowValueCells(sigRow);
    cells.forEach((cell, i) => {
      const url = (people[i]?.signatureUrl ?? "").trim();
      if (!url || url.endsWith("ejadah-signature.png")) {
        cell.replaceChildren();
        return;
      }
      const doc = cell.ownerDocument;
      if (!doc) return;
      const img = doc.createElement("img");
      img.src = url;
      img.alt = "التوقيع";
      img.classList.add("org-signature-roster");
      img.style.objectFit = "contain";
      img.style.maxWidth = "100%";
      img.style.height = "1.5cm";
      img.style.width = "auto";
      img.style.display = "block";
      img.style.marginInline = "auto";
      if (cell instanceof HTMLElement) {
        cell.style.textAlign = "center";
        cell.style.verticalAlign = "middle";
      }
      cell.replaceChildren(img);
    });
  }
}

function fillApprovalTable(sec: Element, fill: ValuationReportLiveFill) {
  const heading = [...sec.querySelectorAll("h2")].find((h) =>
    (h.textContent ?? "").includes("إعتماد"),
  );
  const table = heading?.nextElementSibling;
  if (!table || table.tagName !== "TABLE") return;
  const put = (label: string, value: string) => {
    table.querySelectorAll("td.k").forEach((labelCell) => {
      if (normLabel(labelCell.textContent ?? "") !== normLabel(label)) return;
      const next = labelCell.nextElementSibling;
      if (
        next &&
        (next.classList.contains("v") || next.classList.contains("num"))
      ) {
        next.textContent = value;
      }
    });
  };
  put("الاسم", fill.cells["اسم المقيم المعتمد"] || "—");
  put("رقم العضوية", fill.cells["رقم العضوية"] || "—");
  put("فرع التقييم", fill.cells["فرع التقييم"] || "—");
  put("فئة العضوية", fill.cells["فئة العضوية"] || "—");
  put("صفته", fill.cells["صفته"] || "—");
  put("تاريخ انتهاء العضوية", fill.cells["تاريخ انتهاء العضوية"] || "—");
}

function fillKeyedRows(
  sec: Element,
  rows: Array<{ key: string; values: string[] }>,
  match: "exact" | "adjustment" = "exact",
) {
  sec.querySelectorAll("tr").forEach((tr) => {
    const cells = [...tr.querySelectorAll("td")];
    if (cells.length < 2) return;
    const name = normLabel(cells[0]?.textContent ?? "");
    const row = rows.find((r) => {
      const key = normLabel(r.key);
      if (key === name) return true;
      if (match === "adjustment" && key === "القيمة بطريقة المقارنة") {
        return name.includes("القيمة بطريقة المقارنة");
      }
      return false;
    });
    if (!row) return;
    row.values.forEach((value, i) => {
      const cell = cells[i + 1];
      if (cell) cell.textContent = value;
    });
  });
}

/**
 * مواصفة النموذج التفاعلي: عمود لكل مقارن معتمد (حتى ٥) — يوسّع/يقلّص أعمدة
 * جدول التسويات في القالب (رأس «العقار المقارن (n)» وخلايا القيم وcolspan صفوف الإجمالي).
 */
function syncAdjustmentColumns(sec: Element, count: number) {
  const table = sec.querySelector("table.mx") ?? sec.querySelector("table");
  if (!table) return;
  const headerRow = table.querySelector("tr");
  const headerCells = headerRow ? [...headerRow.querySelectorAll("th")] : [];
  if (headerCells.length < 2) return;
  const currentCols = headerCells.length - 1;
  if (count < 1) return;

  // رأس الجدول.
  for (let i = currentCols; i < count; i++) {
    const clone = headerCells[headerCells.length - 1]!.cloneNode(true) as Element;
    headerRow!.appendChild(clone);
  }
  while (headerRow!.querySelectorAll("th").length - 1 > count) {
    headerRow!.querySelectorAll("th")[headerRow!.querySelectorAll("th").length - 1]!.remove();
  }
  [...headerRow!.querySelectorAll("th")].slice(1).forEach((th, i) => {
    th.textContent = `العقار المقارن (${i + 1})`;
  });

  // صفوف القيم: صف بخلية واحدة ممتدة يظل ممتداً بعرض الأعمدة الجديد؛
  // غيره يُستنسخ/يُقلَّم إلى عدد المقارنات.
  [...table.querySelectorAll("tr")].slice(1).forEach((tr) => {
    const cells = [...tr.querySelectorAll("td")];
    if (cells.length < 2) return;
    const valueCells = cells.slice(1);
    if (valueCells.length === 1 && valueCells[0]!.hasAttribute("colspan")) {
      valueCells[0]!.setAttribute("colspan", String(count));
      return;
    }
    for (let i = valueCells.length; i < count; i++) {
      tr.appendChild(valueCells[valueCells.length - 1]!.cloneNode(true));
    }
    while (tr.querySelectorAll("td").length - 1 > count) {
      const all = tr.querySelectorAll("td");
      all[all.length - 1]!.remove();
    }
  });
}

/** يضبط عدد الصفوف المرقّمة (1..n) في جداول المقارنات ليساوي المعتمد فعلاً. */
function syncNumberedRows(scope: Element, count: number) {
  const table = scope.matches("table")
    ? scope
    : [...scope.querySelectorAll("table")].find((t) =>
        [...t.querySelectorAll("tr")].some((tr) =>
          /^\d+$/.test((tr.querySelector("td")?.textContent ?? "").trim()),
        ),
      );
  if (!table) return;
  const numbered = () =>
    [...table.querySelectorAll("tr")].filter((tr) =>
      /^\d+$/.test((tr.querySelector("td")?.textContent ?? "").trim()),
    );
  let rows = numbered();
  if (!rows.length) return;
  const target = Math.max(count, 1);
  while (rows.length < target) {
    const clone = rows[rows.length - 1]!.cloneNode(true) as Element;
    rows[rows.length - 1]!.after(clone);
    rows = numbered();
  }
  while (rows.length > target) {
    rows[rows.length - 1]!.remove();
    rows = numbered();
  }
  rows.forEach((tr, i) => {
    const first = tr.querySelector("td");
    if (first) first.textContent = String(i + 1);
    // امسح بيانات العيّنة في الصفوف المستنسخة/غير المطابقة — تُملأ بعد ذلك.
    [...tr.querySelectorAll("td")].slice(1).forEach((td) => {
      td.textContent = "—";
    });
  });
}

function fillAdjustmentSection(sec: Element, fill: ValuationReportLiveFill) {
  const colCount = fill.adjustmentRows.reduce(
    (m, r) => Math.max(m, r.values.length > 1 ? r.values.length : 0),
    0,
  );
  if (colCount > 0) syncAdjustmentColumns(sec, colCount);
  fillKeyedRows(sec, fill.adjustmentRows, "adjustment");
  sec.querySelectorAll("tr").forEach((tr) => {
    const first = tr.querySelector("td");
    if (!first) return;
    if (!normLabel(first.textContent ?? "").includes("القيمة بطريقة المقارنة")) {
      return;
    }
    first.textContent = fill.adjustmentComparisonLabel;
  });
  const notesCell = [...sec.querySelectorAll("td.k")].find(
    (td) => normLabel(td.textContent ?? "") === "مبررات التسويات",
  )?.nextElementSibling;
  if (notesCell) {
    const text = fill.adjustmentNotes.trim();
    notesCell.replaceChildren();
    if (!text) {
      notesCell.textContent = "—";
      return;
    }
    const ul = sec.ownerDocument.createElement("ul");
    ul.setAttribute("style", "margin:0;padding-inline-start:14px");
    for (const line of text.split("\n")) {
      const li = sec.ownerDocument.createElement("li");
      li.textContent = line;
      ul.appendChild(li);
    }
    notesCell.appendChild(ul);
  }
}

function fillLoneValueSection(sec: Element, text: string) {
  const cell = sec.querySelector("td.v, td.num");
  if (cell) cell.textContent = text;
}

function fillKeyedInSection(
  sec: Element,
  label: string,
  value: string,
) {
  sec.querySelectorAll("td.k").forEach((labelCell) => {
    if (normLabel(labelCell.textContent ?? "") !== normLabel(label)) return;
    const next = labelCell.nextElementSibling;
    if (
      next &&
      (next.classList.contains("v") || next.classList.contains("num"))
    ) {
      next.textContent = value;
    }
  });
}

function rebuildTwoColSheet(
  sec: Element,
  rows: Array<{ key: string; values: string[] }>,
  secondClass: "num" | "v",
) {
  const table = [...sec.querySelectorAll("table")].find((t) =>
    t.querySelector("th"),
  );
  if (!table) {
    fillKeyedRows(sec, rows);
    return;
  }
  const doc = table.ownerDocument;
  const header = table.querySelector("tr");
  if (!header) {
    fillKeyedRows(sec, rows);
    return;
  }
  const seen = new Set<string>();
  const ordered: Array<{ key: string; values: string[] }> = [];
  for (const row of rows) {
    const k = normLabel(row.key);
    if (!k || seen.has(k)) continue;
    seen.add(k);
    ordered.push(row);
  }
  while (table.rows.length > 1) table.deleteRow(-1);
  for (const row of ordered) {
    const tr = doc.createElement("tr");
    if (normLabel(row.key) === "مجموع مسطحات البناء") tr.className = "total";
    const a = doc.createElement("td");
    a.className = "v";
    a.textContent = row.key;
    const b = doc.createElement("td");
    b.className = secondClass;
    b.textContent = row.values[0] ?? "—";
    tr.append(a, b);
    table.appendChild(tr);
  }
}

function rebuildDirectCostSheet(
  sec: Element,
  rows: Array<{ key: string; values: string[] }>,
) {
  const table = [...sec.querySelectorAll("table")].find((t) =>
    t.querySelector("th"),
  );
  if (!table) {
    fillKeyedRows(sec, rows);
    return;
  }
  const doc = table.ownerDocument;
  const header = table.querySelector("tr");
  if (!header) {
    fillKeyedRows(sec, rows);
    return;
  }
  while (table.rows.length > 1) table.deleteRow(-1);
  for (const row of rows) {
    const tr = doc.createElement("tr");
    const isTotal = normLabel(row.key) === "مجموع التكلفة المباشرة";
    if (isTotal) tr.className = "total";
    const name = doc.createElement("td");
    name.className = "v";
    name.textContent = row.key;
    tr.appendChild(name);
    if (isTotal || row.values.length === 1) {
      const total = doc.createElement("td");
      total.className = "num";
      total.colSpan = 3;
      total.textContent = row.values[0] ?? "—";
      tr.appendChild(total);
    } else if (row.values.length === 2) {
      const lump = doc.createElement("td");
      lump.className = "num";
      lump.colSpan = 2;
      lump.textContent = row.values[0] ?? "—";
      const total = doc.createElement("td");
      total.className = "num";
      total.textContent = row.values[1] ?? "—";
      tr.append(lump, total);
    } else {
      for (const value of row.values.slice(0, 3)) {
        const cell = doc.createElement("td");
        cell.className = "num";
        cell.textContent = value;
        tr.appendChild(cell);
      }
    }
    table.appendChild(tr);
  }
}

function rebuildIndirectCostSheet(
  sec: Element,
  rows: Array<{ key: string; values: string[] }>,
  totalLabel: string,
) {
  const table = [...sec.querySelectorAll("table")].find((t) =>
    t.querySelector("th"),
  );
  if (!table) {
    fillKeyedRows(sec, rows);
    return;
  }
  const doc = table.ownerDocument;
  if (!table.querySelector("tr")) {
    fillKeyedRows(sec, rows);
    return;
  }
  while (table.rows.length > 1) table.deleteRow(-1);
  for (const row of rows) {
    const tr = doc.createElement("tr");
    const key = normLabel(row.key);
    if (key === "مجموع النسب غير المباشرة") tr.className = "sub";
    if (key === "التكلفة الإجمالية") tr.className = "total";
    const a = doc.createElement("td");
    a.className = "v";
    a.textContent = key === "التكلفة الإجمالية" ? totalLabel : row.key;
    const b = doc.createElement("td");
    b.className = "num";
    b.textContent = row.values[0] ?? "—";
    tr.append(a, b);
    table.appendChild(tr);
  }
}

function rebuildReconSheet(
  sec: Element,
  rows: Array<{ key: string; values: string[] }>,
) {
  const table = [...sec.querySelectorAll("table")].find((t) =>
    t.querySelector("th"),
  );
  if (!table) {
    fillKeyedRows(sec, rows);
    return;
  }
  const doc = table.ownerDocument;
  if (!table.querySelector("tr")) {
    fillKeyedRows(sec, rows);
    return;
  }
  while (table.rows.length > 1) table.deleteRow(-1);
  for (const row of rows) {
    const tr = doc.createElement("tr");
    const key = normLabel(row.key);
    if (key === "مجموع نسب المشاركة") tr.className = "sub";
    if (key === "القيمة المرجّحة") tr.className = "total";
    const name = doc.createElement("td");
    name.className = "v";
    name.textContent = row.key;
    tr.appendChild(name);
    if (row.values.length === 1) {
      const total = doc.createElement("td");
      total.className = "num";
      total.colSpan = 3;
      total.textContent = row.values[0] ?? "—";
      tr.appendChild(total);
    } else {
      for (const value of row.values.slice(0, 3)) {
        const cell = doc.createElement("td");
        cell.className = "num";
        cell.textContent = value || "—";
        tr.appendChild(cell);
      }
    }
    table.appendChild(tr);
  }
}

function fillImageSlot(
  dom: Document,
  slotId: string,
  item: ValuationReportSlotAttachment | null | undefined,
  emptyLabel: string,
) {
  const el =
    dom.getElementById(slotId) ||
    dom.querySelector(`[data-slot-id="${slotId}"]`);
  if (!el) return;
  const style = el.getAttribute("style") ?? "";
  if (!item?.url) {
    el.className = "image-ph";
    el.replaceChildren();
    el.textContent = emptyLabel;
    if (style) el.setAttribute("style", style);
    return;
  }
  if (item.isImage) {
    const wrap = dom.createElement("figure");
    wrap.className = "attach-fig";
    if (style) wrap.setAttribute("style", style);
    const img = dom.createElement("img");
    img.src = item.url;
    img.alt = item.labelAr || item.fileName || emptyLabel;
    const fit = item.contentType.includes("svg") ? "contain" : "cover";
    img.style.cssText =
      `width:100%;height:100%;object-fit:${fit};display:block;background:#faf8f3`;
    const cap = dom.createElement("figcaption");
    cap.style.cssText = "font-size:9px;margin-top:4px;color:#3a3f4d";
    cap.textContent = item.labelAr || item.fileName || emptyLabel;
    wrap.append(img, cap);
    el.replaceWith(wrap);
    return;
  }
  // Never iframe PDFs into the report HTML — Chrome print preview hangs on
  // "Loading preview…" when laying out data:/blob: PDF frames (often deed/survey).
  const isPdf = item.contentType.toLowerCase().includes("pdf");
  if (isPdf) {
    const note = dom.createElement("div");
    note.className = "attach-pdf-note image-ph";
    if (style) note.setAttribute("style", style);
    else note.style.cssText =
      "display:flex;flex-direction:column;justify-content:center;align-items:center;gap:6px;min-height:120px;padding:16px;border:1px dashed #c4c0b6;background:#faf8f3;text-align:center";
    const title = dom.createElement("strong");
    title.textContent = item.labelAr || emptyLabel;
    const file = dom.createElement("span");
    file.style.cssText = "font-size:11px;color:#3a3f4d";
    file.textContent = item.fileName || "مرفق PDF";
    const hint = dom.createElement("span");
    hint.style.cssText = "font-size:10px;color:#6b6b66";
    hint.textContent =
      "ملف PDF لا يُضمَّن داخل الطباعة — اطبعه من مرفقات العقار عند الحاجة.";
    note.append(title, file, hint);
    el.replaceWith(note);
    return;
  }
  const link = dom.createElement("p");
  link.className = "attach-link";
  if (style) link.setAttribute("style", style);
  const a = dom.createElement("a");
  a.href = item.url;
  a.target = "_blank";
  a.rel = "noopener noreferrer";
  a.textContent = item.labelAr || item.fileName || emptyLabel;
  link.appendChild(a);
  el.replaceWith(link);
}

function rebuildDefinitionTable(
  sec: Element | null,
  pairs: Array<{ term: string; text: string }>,
  keyWidth = "22%",
) {
  if (!sec || !pairs.length) return;
  const table = sec.querySelector("table");
  if (!table) return;
  const doc = table.ownerDocument;
  table.replaceChildren();
  for (const pair of pairs) {
    const tr = doc.createElement("tr");
    const k = doc.createElement("td");
    k.className = "k";
    k.style.width = keyWidth;
    k.textContent = pair.term;
    const v = doc.createElement("td");
    v.textContent = pair.text;
    tr.append(k, v);
    table.appendChild(tr);
  }
}

function slashDateFromIso(iso: string | null | undefined): string {
  const m = /^(\d{4})-(\d{2})-(\d{2})/.exec((iso ?? "").trim());
  return m ? `${m[1]}/${m[2]}/${m[3]}` : "";
}

/** يستبدل فقرات القسم بنصوص الإعدادات — فارغ يُبقي نص القالب. */
function fillParagraphSection(sec: Element | null, paragraphs: string[]) {
  if (!sec || !paragraphs.length) return;
  const doc = sec.ownerDocument;
  sec.querySelectorAll("p").forEach((p) => p.remove());
  for (const text of paragraphs) {
    const p = doc.createElement("p");
    p.textContent = text;
    sec.appendChild(p);
  }
}

/** يمسح تواريخ العيّنة المجمّدة (2026/06/03) عندما يبقى نص القالب كما هو. */
function scrubFrozenDates(sec: Element | null, reportDateSlash: string) {
  if (!sec || !reportDateSlash) return;
  sec.querySelectorAll("li").forEach((li) => {
    const text = li.textContent ?? "";
    if (text.includes("2026/06/03")) {
      li.textContent = text.replaceAll("2026/06/03", reportDateSlash);
    }
  });
}

function fillBulletListSection(
  sec: Element | null,
  bullets: string[] | null | undefined,
) {
  if (!sec || bullets == null) return;
  const ul = sec.querySelector("ul");
  if (!ul) return;
  const doc = sec.ownerDocument;
  ul.replaceChildren();
  for (const text of bullets) {
    const li = doc.createElement("li");
    li.textContent = text;
    ul.appendChild(li);
  }
}

function fillResearchScopeSection(
  sec: Element | null,
  bullets: string[],
  notes: string,
) {
  if (!sec) return;
  if (bullets.length) fillBulletListSection(sec, bullets);
  const existing = sec.querySelector(".search-scope-notes");
  if (existing) existing.remove();
  if (!notes) return;
  const doc = sec.ownerDocument;
  const noteBlock = doc.createElement("table");
  noteBlock.className = "search-scope-notes";
  noteBlock.style.marginTop = "8px";
  const tr = doc.createElement("tr");
  const k = doc.createElement("td");
  k.className = "k";
  k.style.width = "28%";
  k.textContent = "ملاحظات نطاق البحث";
  const v = doc.createElement("td");
  v.className = "v";
  v.textContent = notes;
  tr.append(k, v);
  noteBlock.appendChild(tr);
  sec.appendChild(noteBlock);
}

function formatFinishingHtml(text: string): string {
  const t = text.trim();
  if (!t) return "";
  // Org settings use "تشطيبات خارجية: …\nتشطيبات داخلية: …"
  const parts = t.split(/\n+/).map((p) => p.trim()).filter(Boolean);
  return parts
    .map((line) => {
      const colon = line.indexOf(":");
      if (colon > 0 && colon < 40) {
        const head = line.slice(0, colon).trim();
        const body = line.slice(colon + 1).trim();
        return `<b>${escHtml(head)}:</b><br>${escHtml(body)}`;
      }
      return escHtml(line);
    })
    .join("<br>");
}

function fillFinishingLevelSection(
  sec: Element | null,
  fill: ValuationReportLiveFill,
) {
  if (!sec) return;
  const table = sec.querySelector("table");
  if (!table) return;
  const rows = [...table.querySelectorAll("tr")];
  const header = rows[0];
  const body = rows[1];
  const noneRow = rows.find((tr) =>
    normLabel(tr.textContent ?? "").includes("بدون تشطيب"),
  );
  if (!header || !body) return;

  const headers = [...header.querySelectorAll("th")];
  const cells = [...body.querySelectorAll("td")];
  const level = fill.finishingLevel;
  const label = finishingLevelLabel(level);

  const texts = [
    fill.finishingTexts.luxury,
    fill.finishingTexts.medium,
    fill.finishingTexts.ordinary,
  ];
  cells.forEach((cell, i) => {
    const html = formatFinishingHtml(texts[i] ?? "");
    if (html) {
      cell.innerHTML = html;
      cell.style.fontSize = "9px";
      cell.style.lineHeight = "1.5";
    }
  });

  const clearMark = (el: Element) => {
    el.removeAttribute("data-finishing-selected");
    const htmlEl = el as HTMLElement;
    htmlEl.style.outline = "";
    htmlEl.style.outlineOffset = "";
    htmlEl.style.background = "";
    htmlEl.style.color = "";
    htmlEl.style.boxShadow = "";
    htmlEl.style.opacity = "";
  };

  headers.forEach(clearMark);
  cells.forEach(clearMark);
  if (noneRow) {
    [...noneRow.querySelectorAll("th, td")].forEach(clearMark);
  }

  if (!label) return;

  const markSelected = (el: Element) => {
    const htmlEl = el as HTMLElement;
    htmlEl.setAttribute("data-finishing-selected", "1");
    htmlEl.style.outline = "2px solid #102b4e";
    htmlEl.style.outlineOffset = "-2px";
    htmlEl.style.background = "#eef2f7";
    htmlEl.style.boxShadow = "inset 0 0 0 1px #a4906f";
  };
  const dim = (el: Element) => {
    (el as HTMLElement).style.opacity = "0.45";
  };

  if (level === "none" && noneRow) {
    headers.forEach(dim);
    cells.forEach(dim);
    [...noneRow.querySelectorAll("th, td")].forEach(markSelected);
    const th = noneRow.querySelector("th");
    if (th && !th.textContent?.includes("✓")) {
      th.textContent = `✓ ${normLabel(th.textContent ?? "بدون تشطيب")}`;
    }
    return;
  }

  const idx = headers.findIndex(
    (th) => normLabel(th.textContent ?? "") === normLabel(label),
  );
  if (idx < 0) return;

  headers.forEach((th, i) => {
    if (i === idx) {
      markSelected(th);
      if (!th.textContent?.includes("✓")) {
        th.textContent = `✓ ${normLabel(th.textContent ?? "")}`;
      }
    } else {
      dim(th);
    }
  });
  cells.forEach((td, i) => {
    if (i === idx) markSelected(td);
    else dim(td);
  });
  if (noneRow) {
    [...noneRow.querySelectorAll("th, td")].forEach(dim);
  }
}

function fillAttachmentAndGlossarySections(
  dom: Document,
  fill: ValuationReportLiveFill,
) {
  fillImageSlot(
    dom,
    "map-comparables",
    fill.comparableMapSlot,
    "خريطة مواقع المقارنات — اسحب الصورة هنا",
  );

  const photos = fill.photoSlots ?? [];
  for (let i = 0; i < 12; i++) {
    fillImageSlot(
      dom,
      `photo-${i + 1}`,
      photos[i] ?? null,
      "—",
    );
  }

  fillImageSlot(
    dom,
    "survey-report",
    fill.surveySlot,
    "التقرير المساحي — يُرفق مستند الرفع المساحي",
  );
  fillImageSlot(
    dom,
    "deed",
    fill.deedSlot,
    "صك الملكية — تُرفق صورة الصك",
  );

  fillResearchScopeSection(
    dom.querySelector('[data-sec="28"]'),
    fill.researchScopeBullets,
    fill.searchScopeNotes,
  );

  fillBulletListSection(
    dom.querySelector('[data-sec="29"]'),
    fill.specialAssumptionBullets,
  );

  rebuildDefinitionTable(
    dom.querySelector('[data-sec="37"]'),
    fill.ivsPairs,
    "22%",
  );

  const glossary = fill.glossaryPairs ?? [];
  if (glossary.length) {
    const mid = Math.ceil(glossary.length / 2);
    rebuildDefinitionTable(
      dom.querySelector('[data-sec="38"]'),
      glossary.slice(0, mid),
      "20%",
    );
    const rest = glossary.slice(mid);
    const secB = dom.querySelector('[data-sec="38ب"]');
    if (rest.length) {
      rebuildDefinitionTable(secB, rest, "20%");
    } else if (secB) {
      const table = secB.querySelector("table");
      if (table) table.replaceChildren();
    }
  }
}

export function applyValuationReportLiveFill(
  dom: Document,
  fill: ValuationReportLiveFill,
  extras?: {
    valuers?: OrganizationValuerRosterEntry[] | null;
    valuationBranch?: string;
  },
): void {
  SAMPLE_SECS.forEach((id) => {
    const sec = dom.querySelector(`[data-sec="${id}"]`);
    if (sec) blankValueCells(sec);
  });

  const map = new Map(
    Object.entries(fill.cells).map(([k, v]) => [normLabel(k), v]),
  );
  if (fill.isLand) {
    const ageLabels = new Set(["عمر البناء", "عمر العقار", "العمر الفعلي"]);
    dom.querySelectorAll("td.k").forEach((labelCell) => {
      if (!ageLabels.has(normLabel(labelCell.textContent ?? ""))) return;
      const row = labelCell.closest("tr");
      const next = labelCell.nextElementSibling;
      if (
        next &&
        (next.classList.contains("v") || next.classList.contains("num")) &&
        row
      ) {
        labelCell.remove();
        next.remove();
        if (![...row.querySelectorAll("td")].length) row.remove();
      }
    });
  }
  dom.querySelectorAll("td.k").forEach((labelCell) => {
    const label = normLabel(labelCell.textContent ?? "");
    if (!map.has(label)) return;
    const value = map.get(label)!;
    const next = labelCell.nextElementSibling;
    if (
      next &&
      (next.classList.contains("v") || next.classList.contains("num"))
    ) {
      next.textContent = value;
    }
  });

  const scope = dom.querySelector('[data-sec="2"]');
  if (scope) {
    const p = scope.querySelector("p");
    if (p && fill.scopeBasis && fill.scopeBasis !== "—") {
      p.textContent = `يعتمد أساس التقييم على تحديد ${fill.scopeBasis} لموضوع التقييم في حالته الراهنة.`;
    } else if (p && !fill.isLiquidation) {
      p.textContent = "";
    }
    const items = scope.querySelectorAll("li");
    if (items[0]) {
      items[0].textContent =
        fill.basisDefinition ||
        (!fill.isLiquidation ? "" : items[0].textContent);
    }
    if (items[1]) {
      items[1].textContent =
        `أُعد هذا التقرير لاستخدام العميل (${fill.scopeClient && fill.scopeClient !== "—" ? fill.scopeClient : "—"}) فقط، ولا يجوز استخدامه من قبل مستخدم آخر إلا بإذن خطي موقع ومختوم بختم الشركة.`;
    }
  }

  const asset = dom.querySelector('[data-sec="6"]');
  if (asset && fill.propertyDescription) {
    const desc = [...asset.querySelectorAll("td.k")].find(
      (td) => normLabel(td.textContent ?? "") === "وصف العقار",
    )?.nextElementSibling;
    if (desc) desc.textContent = fill.propertyDescription;
  }

  const bounds = dom.querySelector('[data-sec="8"]');
  if (bounds) fillBoundaries(bounds, fill.boundaries);

  const areas = dom.querySelector('[data-sec="9"]');
  if (areas) rebuildTwoColSheet(areas, fill.areaRows, "num");

  const build = dom.querySelector('[data-sec="10"]');
  if (build) rebuildTwoColSheet(build, fill.buildDescRows, "v");

  const defectsSec = dom.querySelector('[data-sec="13"]');
  if (defectsSec) {
    fillLoneValueSection(defectsSec, fill.cells["وصف العيوب الإنشائية"] || "—");
  }

  const surr = dom.querySelector('[data-sec="15"]');
  if (surr) fillKeyedInSection(surr, "أخرى", fill.surroundingsOther);

  const feat = dom.querySelector('[data-sec="11"]');
  if (feat) fillKeyedInSection(feat, "أخرى", "—");

  const services = dom.querySelector('[data-sec="14"]');
  if (services) fillKeyedRows(services, fill.serviceRows);

  const methods = dom.querySelector('[data-sec="16"]');
  if (methods) fillMethodRow(methods, fill.methodRow);

  const comps = dom.querySelector('[data-sec="17"]');
  if (comps) {
    if (fill.comparableRows.length > 0) {
      syncNumberedRows(comps, fill.comparableRows.length);
    }
    fillKeyedRows(comps, fill.comparableRows);
  }

  const landAppendix = dom.querySelector('[data-sec="20"]');
  if (landAppendix) {
    fillKeyedInSection(
      landAppendix,
      "إشارة الملحق",
      fill.landAppendixNote || "—",
    );
    const landTable = landAppendix.querySelector("[data-land-comps]");
    if (landTable && fill.landComparableRows.length > 0) {
      syncNumberedRows(landTable as HTMLElement, fill.landComparableRows.length);
      fillKeyedRows(landTable as HTMLElement, fill.landComparableRows);
    }
  }

  const adj = dom.querySelector('[data-sec="19"]');
  if (adj) fillAdjustmentSection(adj, fill);

  const costSec = dom.querySelector('[data-sec="21"]');
  if (costSec) rebuildDirectCostSheet(costSec, fill.costRows);

  const indirectSec = dom.querySelector('[data-sec="22"]');
  if (indirectSec) {
    rebuildIndirectCostSheet(
      indirectSec,
      fill.indirectRows,
      fill.indirectTotalLabel,
    );
  }

  const reconSec = dom.querySelector('[data-sec="24"]');
  if (reconSec) rebuildReconSheet(reconSec, fill.reconRows);

  const finalSec = dom.querySelector('[data-sec="25"]');
  if (finalSec) {
    const liqShown = (fill.cells["نسبة خصم التصفية المنظمة"] ?? "—") !== "—";
    if (!liqShown) {
      const disc = [...finalSec.querySelectorAll("td.k")].find((td) =>
        normLabel(td.textContent ?? "").includes("خصم التصفية"),
      );
      const discVal = disc?.nextElementSibling;
      if (discVal) discVal.textContent = "—";
      const reason = [...finalSec.querySelectorAll("td.k")].find((td) =>
        normLabel(td.textContent ?? "").includes("مبرر معامل"),
      )?.nextElementSibling;
      if (reason) reason.textContent = "—";
    }
    fillFinalBanner(finalSec, fill);
  }

  const people = dom.querySelector('[data-sec="26"]');
  if (people) {
    fillParticipants(
      people,
      fill.reportWorkers,
      extras?.valuers,
      extras?.valuationBranch || fill.cells["فرع التقييم"] || "",
      fill.assignedAppraiserName,
    );
    fillApprovalTable(people, fill);
  }

  // §3/§4/§5/§31/§32 — نصوص إعدادات المنشأة تحل محل نص العيّنة؛ الفراغ يُبقي القالب.
  fillBulletListSection(
    dom.querySelector('[data-sec="3"]'),
    fill.keyInputsBullets.length ? fill.keyInputsBullets : null,
  );
  fillParagraphSection(dom.querySelector('[data-sec="4"]'), fill.standardsParagraphs);
  fillParagraphSection(
    dom.querySelector('[data-sec="5"]'),
    fill.independenceParagraphs,
  );
  const termsSec = dom.querySelector('[data-sec="31"]');
  if (fill.termsBullets.length) fillBulletListSection(termsSec, fill.termsBullets);
  else scrubFrozenDates(termsSec, fill.reportDateSlash);
  const restrictionsSec = dom.querySelector('[data-sec="32"]');
  if (fill.restrictionsBullets.length) {
    fillBulletListSection(restrictionsSec, fill.restrictionsBullets);
  } else {
    scrubFrozenDates(restrictionsSec, fill.reportDateSlash);
  }

  // §33 — الموقع الحقيقي وخريطتا الأقمار/المقربة (المولّدة أو المرفوعة).
  const mapsSec = dom.querySelector('[data-sec="33"]');
  if (mapsSec && fill.locationLabel) {
    fillKeyedInSection(mapsSec, "الموقع", fill.locationLabel);
  }
  fillImageSlot(
    dom,
    "map-satellite",
    fill.comparableMapSlot,
    "خريطة الأقمار الصناعية — تُرفق صورة الموقع",
  );
  fillImageSlot(
    dom,
    "map-closeup",
    fill.closeupMapSlot ?? fill.comparableMapSlot,
    "صورة مقربة للموقع — تُرفق صورة",
  );

  fillAttachmentAndGlossarySections(dom, fill);
  fillFinishingLevelSection(dom.querySelector('[data-sec="12"]'), fill);
}
