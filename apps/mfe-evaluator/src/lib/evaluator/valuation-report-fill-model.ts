/**
 * Valuation report fill model — pure data side (no DOM):
 * builds ValuationReportLiveFill from facts and keeps template application
 * in valuation-report-live-fill.ts (separation of concerns).
 */
import {
  VALUE_BASIS_OPTIONS,
  VALUE_PREMISE_OPTIONS,
  VALUATION_PURPOSE_OPTIONS,
  basisOfValueKeyForAssignment,
  basisOfValueLabelArForAssignment,
  defaultPremiseKeyForBasis,
  valuationPurposeKeyForAssignment,
  valuationPurposeLabelArForAssignment,
  valuePremiseKeyForAssignment,
} from "@platform/app-shared/app-data/assignment-valuation-defaults";
import type { PoIntakeRecord, PoPropertyIntake } from "@platform/app-shared/app-data/po-intake-data";
import { subClientIdFromReportUsers } from "@platform/app-shared/app-data/po-intake-data";
import { OTHER_ATTACHMENTS_KEY } from "@platform/app-shared/app-data/inspector-workspace-data";
import {
  clientNameFromRecord,
  formatValuationReportUsers,
} from "./valuation-report-users";
import type { InspectorWorkspaceDraft } from "@platform/app-shared/app-data/inspector-workspace-data";
import {
  reportInspectorPropertyDescription,
  isApartmentInspectionContext,
  isLandInspectionContext,
} from "@platform/app-shared/app-data/inspector-workspace-data";
import {
  formatArabicYears,
  formatReportAgeText,
  formatReportPropertyAgeYears,
  reportPropertyAgeYearsFromLicense,
} from "./valuation-report-property-age";
import {
  applyIvsDateToStandards,
  isNoExternalSpecialistAssumption,
  type BuildingInventoryLineDto,
  ORG_COMPANY_DEFAULTS,
  type ClientDto,
  type OrganizationValuerRosterEntry,
  type TransactionDeedDto,
  transactionDeedDateOf,
  transactionDeedLabelOf,
  type ValuationComparableSelectionListDto,
  type ValuationCostApproachDto,
  type ValuationIncomeApproachDto,
  type ValuationReconciliationDto,
} from "@platform/api-client";
import { buildIncomeSheetRows, type IncomeSheetRow } from "./valuation-report-income";
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
  type SheetTableRow,
} from "./valuation-report-sheet-facts";
import { escHtml } from "./html-escape";
import type { ValuationReportSlotAttachment } from "./valuation-report-print-attachments";
import {
  applyReportDateToken,
  linesFromOrgText,
  pairsFromOrgLines,
} from "./valuation-report-print-attachments";
import {
  collectComparablesMapPins,
  formatSubjectCoordsLabel,
  resolveComparablesMapImage,
  resolveSubjectMapCoords,
  type ComparablesMapPin,
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
import { costLandReportRows, type CostLandReportRow } from "./cost-land-figures";

const OWNERSHIP_LABELS: Record<string, string> = {
  // One wording everywhere (approach settings, report, case study): «ملكية تامة».
  absolute: "ملكية تامة",
  shared: "مشاع",
  // D11 — the interest valued when it is not the deed's full ownership (approach settings).
  usufruct: "حق منفعة",
  leased_land: "أرض مستأجرة",
};

/** Template sample numbers wiped before live data is written. */
export const SAMPLE_SECS = new Set(["10", "11", "13", "14", "15", "17", "19", "20", "21", "22", "23", "24", "25"]);

const LAND_VALUE_BEFORE_ROUNDING = "قيمة الأرض قبل التقريب";

const MARKET_BASIS_DEFINITION =
  "القيمة السوقية هي المبلغ المقدَّر الذي ينبغي أن يُتبادل به أصل أو التزام في تاريخ التقييم بين مشترٍ راغب وبائع راغب في معاملة تجارية بحتة بعد تسويق مناسب، بحيث يتصرف كل طرف عن دراية وبحكمة ودون إجبار.";

const FORCED_SALE_BASIS_DEFINITION =
  "قيمة التصفية هي المبلغ الإجمالي الذي يمكن تحقيقه عند بيع أصل أو مجموعة أصول بموجب بيع التصفية، وقد حُددت في هذا التقرير بموجب افتراض البيع القسري ذي فترة التسويق الأقصر من النموذجية (البيع القسري) — انظر المعيار 102 — أسس القيمة، الملحق (أ)60.";

const LIQUIDATION_BASIS_DEFINITION =
  "قيمة التصفية هي المبلغ الإجمالي الذي يمكن تحقيقه عند بيع أصل أو مجموعة أصول بموجب بيع التصفية، وقد حُددت في هذا التقرير بموجب افتراض المعاملة المنظمة ذات فترة التسويق النموذجية (التصفية المنظمة) — انظر المعيار 102 — أسس القيمة، الملحق (أ)60.";

function slashReportDate(iso: string | null | undefined): string {
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

/**
 * D1 — purpose, basis and premise the report prints: the appraiser's saved choices
 * (reconciliation basis/premise, approach-settings purpose); the work order's defaults only
 * when nothing was chosen.
 */
export function resolveReportValuationKeys(input: {
  record?: Parameters<typeof assignmentValuationFromPo>[0];
  recon?: Pick<ValuationReconciliationDto, "basisOfValueKey" | "valuePremiseKey"> | null;
  /** The appraiser's saved valuation purpose (approach settings), else the report choices. */
  purposeKey?: string | null;
}): { purposeKey: string; valueBasisKey: string; premiseKey: string } {
  const po = assignmentValuationFromPo(input.record);
  const savedBasis = (input.recon?.basisOfValueKey ?? "").trim().toLowerCase();
  const valueBasisKey = savedBasis || po.valueBasisKey;
  const savedPremise = (input.recon?.valuePremiseKey ?? "").trim().toLowerCase();
  const premiseKey =
    savedPremise ||
    (valueBasisKey === po.valueBasisKey ? po.premiseKey : "") ||
    (valueBasisKey ? defaultPremiseKeyForBasis(valueBasisKey) : "");
  return {
    purposeKey: (input.purposeKey ?? "").trim() || po.purposeKey,
    valueBasisKey,
    premiseKey,
  };
}

function labelForPurposeKey(key: string): string {
  return VALUATION_PURPOSE_OPTIONS.find((o) => o.value === key)?.label ?? "";
}

function labelForBasisKey(key: string): string {
  return VALUE_BASIS_OPTIONS.find((o) => o.value === key)?.label ?? "";
}

function labelForPremiseKey(key: string): string {
  return VALUE_PREMISE_OPTIONS.find((o) => o.value === key)?.label ?? "";
}

function ownershipTypeDisplay(value: string | null | undefined): string {
  const t = (value ?? "").trim();
  if (!t) return "";
  return OWNERSHIP_LABELS[t] ?? t;
}

/**
 * «نوع الملكية»: what the appraiser recorded for this valuation (D11 — e.g. a building on
 * leased land, with the remaining lease years), else the deed's ownership (owner count).
 */
function ownershipCell(
  recorded: { key?: string | null; labelAr?: string | null; remainingLeaseYears?: number | null } | null | undefined,
  deedOwnership: string | null | undefined,
): string {
  const key = (recorded?.key ?? "").trim().toLowerCase();
  // «ملكية تامة» (freehold) prints the deed's own ownership type (تامة / مشاع).
  if (!key || key === "freehold") return ownershipTypeDisplay(deedOwnership);
  const label = (recorded?.labelAr ?? "").trim() || ownershipTypeDisplay(key);
  const years = recorded?.remainingLeaseYears;
  return years != null && Number.isFinite(years) && years > 0
    ? `${label} — المدة المتبقية ${formatArabicYears(years)}`
    : label;
}

/** The D11 interest key as the report wording needs it: a usufruct right or leased land. */
function partialInterestKey(
  recorded: { key?: string | null } | null | undefined,
): "usufruct" | "leased_land" | null {
  const key = (recorded?.key ?? "").trim().toLowerCase();
  return key === "usufruct" || key === "leased_land" ? key : null;
}

const FULL_OWNERSHIP_ASSUMPTION = /أن العقار مطلق الملكية/;

/**
 * The org library's «يفترض أن العقار مطلق الملكية …» clause states the interest valued — for a
 * usufruct right or a building on leased land it is reworded to that interest.
 */
function assumptionsForInterest(
  bullets: string[] | null,
  recorded: { key?: string | null } | null | undefined,
): string[] | null {
  const interest = partialInterestKey(recorded);
  if (!bullets || !interest) return bullets;
  const phrase =
    interest === "usufruct"
      ? "أن حق المنفعة محل التقييم قائم وساري المفعول طوال مدته المتبقية"
      : "أن عقد إيجار الأرض المقامة عليها المباني قائم وساري المفعول طوال مدته المتبقية";
  return bullets.map((b) => b.replace(FULL_OWNERSHIP_ASSUMPTION, phrase));
}

function pickLength(
  survey: string | null | undefined,
  property: string | null | undefined,
): string {
  const s = (survey ?? "").trim();
  if (s) return s;
  return (property ?? "").trim();
}

/**
 * «وصف العقار»: the case specialist's «مكونات العقار» as written; the inspector's accepted text
 * only for transactions finished before the specialist wrote one.
 */
function reportPropertyDescription(
  specialistText: string | null | undefined,
  inspector: InspectorWorkspaceDraft | null | undefined,
): string {
  return (specialistText ?? "").trim() || reportInspectorPropertyDescription(inspector);
}

function surveyUsesNature(survey?: ValuationReportSurveyBounds | null): boolean {
  return survey?.deedMatchesNature === "no";
}

/**
 * Unified facade type («أنواع الواجهات»): the inspector's pick first, then the specialist's
 * pick in تعديل العقار. The old boundary type (شارع/قطعة…) is no longer used anywhere.
 */
function sideFacadeType(
  inspector: InspectorWorkspaceDraft | null | undefined,
  property: PoPropertyIntake | null | undefined,
  side: "north" | "south" | "east" | "west",
): string {
  const fromMatch = (inspector?.boundaryMatches?.[side]?.facade ?? "").trim();
  if (fromMatch) return fromMatch;
  const legacyKey = `boundaryFacade:${side}`;
  const fromFeature = (inspector?.featureValues?.[legacyKey] ?? "").trim();
  if (fromFeature) return fromFeature;
  return (property?.[`${side}FacadeFinishing`] ?? "").trim();
}

export function dash(value: string | null | undefined): string {
  const t = (value ?? "").trim();
  return t || "—";
}

/** Normalize template headings for matching — strip bidi marks and collapse whitespace. */
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

/** D9 — a retrospective valuation date as printed: «yyyy/mm/dd», or «start — end» for a period. */
export function retrospectiveDateLabel(
  retro: { date: string; dateEnd?: string | null } | null | undefined,
): string {
  const start = slashReportDate(retro?.date);
  const end = slashReportDate(retro?.dateEnd);
  return start && end ? `${start} — ${end}` : start;
}

function firstFilled(
  ...values: Array<string | null | undefined>
): string {
  for (const value of values) {
    const t = (value ?? "").trim();
    if (t) return t;
  }
  return "";
}

/** Display ISO yyyy-MM-dd as yyyy/MM/dd; leave Hijri or already-slashed text. */
function displayLicenseDate(
  ...values: Array<string | null | undefined>
): string {
  const raw = firstFilled(...values);
  return slashDateFromIso(raw) || raw;
}

/**
 * Practice-license cells next to «رقم ترخيص مزاولة المهنة».
 * Always from بيانات المنشأة (saved company fields, else ORG_COMPANY_DEFAULTS —
 * same fallback the settings UI shows). Personal evaluator license dates are
 * not used for these report cells.
 */
export function certifiedPracticeLicenseFromOrg(org: {
  company?: {
    practiceLicenseNumber?: string | null;
    practiceLicenseIssuedAt?: string | null;
    practiceLicenseExpiresAt?: string | null;
  } | null;
  evaluator?: {
    licenseNumber?: string | null;
    licenseIssuedAt?: string | null;
    licenseExpiresAt?: string | null;
    licenseExpiresHijri?: string | null;
  } | null;
}): { number: string; issuedAt: string; expiresAt: string } {
  const company = org.company ?? {};
  const firm = ORG_COMPANY_DEFAULTS;
  return {
    number: firstFilled(
      company.practiceLicenseNumber,
      firm.practiceLicenseNumber,
    ),
    issuedAt: displayLicenseDate(
      company.practiceLicenseIssuedAt,
      firm.practiceLicenseIssuedAt,
    ),
    expiresAt: displayLicenseDate(
      company.practiceLicenseExpiresAt,
      firm.practiceLicenseExpiresAt,
    ),
  };
}

function joinCoords(inspector?: InspectorWorkspaceDraft | null): string {
  const lat = (inspector?.mapLatitude ?? "").trim();
  const lng = (inspector?.mapLongitude ?? "").trim();
  if (!lat && !lng) return "";
  return [lat, lng].filter(Boolean).join(" ، ");
}

function subjectCoordsForReport(
  inspector: InspectorWorkspaceDraft | null | undefined,
): { lat: number; lng: number } | null {
  return resolveSubjectMapCoords({
    subjectLat: inspector?.mapLatitude,
    subjectLng: inspector?.mapLongitude,
  });
}

function googleMapOnly<T extends { contentType: string }>(img: T | null): T | null {
  return img && !img.contentType.includes("svg") ? img : null;
}

/** §16 — أسلوب التكلفة is valued by طريقة المقاول; the land component only when land is in scope. */
function contractorMethodLabel(
  costScopeKey: string | null | undefined,
  costBasisKey: string | null | undefined,
): string {
  const building =
    costBasisKey === "reproduction"
      ? "تكلفة إعادة الإنتاج ناقص الإهلاك"
      : "تكلفة الإحلال ناقص الإهلاك";
  return costScopeKey === "building_only"
    ? `طريقة المقاول: ${building}`
    : `طريقة المقاول: قيمة الأرض فضاءً بطريقة المقارنة + ${building}`;
}

/** Market / cost / income used: the saved approach settings when known, else the report's method choices. */
function approachesUsed(
  choices: EvaluatorReportChoices,
  input: {
    marketApproachEnabled?: boolean;
    costApproachEnabled?: boolean;
    incomeApproachEnabled?: boolean;
  },
): { market: boolean; cost: boolean; income: boolean } {
  const chosen = (key: string | undefined) => Boolean(key && key !== "__unused__");
  return {
    market: input.marketApproachEnabled ?? chosen(choices.marketMethodKey),
    cost: input.costApproachEnabled ?? chosen(choices.costMethodKey),
    income: input.incomeApproachEnabled ?? chosen(choices.incomeMethodKey),
  };
}

function methodsUsed(
  used: { market: boolean; cost: boolean; income: boolean },
  documents: DocumentIndicator[] = [],
): string {
  const bits: string[] = [];
  const fromDocument = (key: string) => documents.some((d) => d.approachKey === key);
  if (used.market || fromDocument("market")) {
    bits.push("أسلوب السوق");
  }
  if (used.cost || fromDocument("cost")) {
    bits.push("أسلوب التكلفة");
  }
  if (used.income || fromDocument("income")) {
    bits.push("أسلوب الدخل");
  }
  return bits.join(" و ");
}

/** «مستند ذو قيمة» indicators in the reconciliation: approach + the method the appraiser named. */
type DocumentIndicator = { approachKey: string; methodName: string };

function documentIndicators(
  recon: ValuationReconciliationDto | null | undefined,
): DocumentIndicator[] {
  return (recon?.methods ?? [])
    .filter((m) => m.valueDocumentAttachmentId && m.isIncluded !== false)
    .map((m) => ({
      approachKey: (m.documentApproachKey ?? "").toLowerCase(),
      methodName: (m.documentMethodName ?? "").trim(),
    }));
}

/** §16 cell of one approach: its internal method, else the methods named by documents. */
function approachMethodCell(
  internal: string | null,
  documents: DocumentIndicator[],
  approachKey: string,
): string {
  const named = documents.filter((d) => d.approachKey === approachKey).map((d) => d.methodName);
  const all = [...(internal ? [internal] : []), ...named];
  return all.length > 0 ? all.join(" · ") : "غير مستخدم";
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

/** One §25 line; the liquidation row also carries its rationale (4-cell row). */
export type FinalValueRow = {
  key: string;
  value: string;
  total?: boolean;
  rationale?: string;
  /** Label of the rationale cell beside a discount row («مبرر خصم التصفية» / «مبرر خصم البيع القسري»). */
  rationaleLabel?: string;
};

/**
 * The liquidation discount is named after the premise the appraiser chose: «التصفية المنظمة»
 * (orderly, the default) or «البيع القسري» (forced).
 */
export function liquidationDiscountLabels(premiseKey: string | null | undefined): {
  pct: string;
  rationale: string;
  after: string;
} {
  return premiseKey === "forced"
    ? { pct: "نسبة خصم البيع القسري", rationale: "مبرر خصم البيع القسري", after: "القيمة بعد خصم البيع القسري" }
    : { pct: "نسبة خصم التصفية المنظمة", rationale: "مبرر خصم التصفية المنظمة", after: "القيمة بعد خصم التصفية المنظمة" };
}

export type ValuationReportLiveFill = {
  cells: Record<string, string>;
  /** Saved approach-settings decision; never inferred from stale cost data. */
  costApproachEnabled: boolean;
  /** Cost scope from approach settings; hides §20 while retaining building-cost sheets. */
  costBuildingOnly: boolean;
  /** Saved market-approach decision — off removes §17–19 (comparables, map, adjustments). */
  marketApproachEnabled: boolean;
  /**
   * Approaches in use (market, cost). One approach ⇒ no reconciliation between indicators:
   * §24 keeps only the justification, the final value is that approach's indicator.
   */
  approachCount: number;
  /** D17 — income approach enabled: its section prints before §24 and its row joins the weights. */
  incomeApproachEnabled: boolean;
  /** D17 — the income section rows (inputs, EGI, NOI, cap rate, value, rationale). */
  incomeRows: IncomeSheetRow[];
  scopeBasis: string;
  scopeClient: string;
  /**
   * §2 extra statements under the scope table: the retrospective-date rationale (D9) and what
   * a building-only valuation covers.
   */
  scopeRows: Array<{ label: string; value: string }>;
  /**
   * §23 «العمر والإهلاك» notes under the ages: the appraiser's age rationales and, for a
   * building on leased land, that the life is capped at the remaining lease term (D11).
   */
  ageNotes: Array<{ label: string; value: string }>;
  basisDefinition: string;
  methodRow: [string, string, string];
  boundaries: Array<{
    name: string;
    bound: string;
    len: string;
    face: string;
  }>;
  /** §8 — the engineering survey supplies boundaries when a survey task exists, else intake. */
  boundariesSource?: "survey" | "intake";
  buildDescRows: Array<{ key: string; values: string[] }>;
  /** The specialist listed at least one component — §10 prints even on land. */
  componentsListed: boolean;
  serviceRows: Array<{ key: string; values: string[] }>;
  comparableRows: Array<{ key: string; values: string[] }>;
  /** §20 — decision A: plot, rate after adjustments, (discount), share, land value — in that order. */
  landValueRows: CostLandReportRow[];
  /** Appendix (A) — land_within_cost comps only. */
  landComparableRows: Array<{ key: string; values: string[] }>;
  landAppendixNote: string;
  /** §20 — land comparables inside the cost approach get their own adjustments table and map. */
  landAdjustmentRows: SheetTableRow[];
  landAdjustmentComparisonLabel: string;
  landAdjustmentNotes: string;
  landComparableMapSlot: ValuationReportSlotAttachment | null;
  landComparablesMapPins: ComparablesMapPin[];
  adjustmentRows: SheetTableRow[];
  adjustmentComparisonLabel: string;
  adjustmentNotes: string;
  surroundingsOther: string;
  /** §11 «أخرى» — the inspector/specialist free text «ملحقات أخرى». */
  attachmentsOther: string;
  costRows: Array<{ key: string; values: string[] }>;
  indirectRows: Array<{ key: string; values: string[] }>;
  indirectTotalLabel: string;
  reconRows: Array<{ key: string; values: string[] }>;
  finalDisplay: string;
  /**
   * §25 lines a reader can reproduce: the unrounded weighted value of §24, the liquidation
   * discount and the value after it (liquidation basis with a discount only), each «مستند ذو
   * قيمة» addition, then the one rounding step ending in the final value.
   */
  finalValueRows: FinalValueRow[];
  /** The exact final value behind finalDisplay — stamped on the banner so approval can check it. */
  finalValue: number | null;
  finalWords: string;
  /**
   * §25 «مستند ذو قيمة» additions: the property value after the liquidation discount
   * (unrounded), one line per added document, then the rounded total (= finalDisplay).
   */
  valueAdditions: Array<{ label: string; value: string }>;
  propertyValueAfterLiquidation: string;
  isLiquidation: boolean;
  /** §25 liquidation discount printed (liquidation basis or discount applied in reconciliation). */
  liquidationDiscountOn?: boolean;
  isLand: boolean;
  /** An apartment records no facades — the facade rows and the boundaries «الواجهات» column are not printed. */
  isApartment?: boolean;
  propertyDescription: string;
  reportWorkers: EvaluatorReportWorker[];
  /** §26 — assigned appraiser from work-order dispatch (fourth column). */
  assignedAppraiserName: string;
  /** Staff user id of the assigned appraiser — matches roster `staffUserId` before name. */
  assignedAppraiserId: string;
  /** §34 — up to 12 field photos (data URLs); null keeps that HTML slot empty. */
  photoSlots: Array<ValuationReportSlotAttachment | null>;
  /** §35 — survey document (image or PDF data URL). */
  surveySlot: ValuationReportSlotAttachment | null;
  /** §36 — deed document. */
  deedSlot: ValuationReportSlotAttachment | null;
  /** Pan/scale per slot id (image-slot {s,x,y}). */
  slotFrames: Record<string, { s: number; x: number; y: number }>;
  /** Final-review attachment row order (catalog keys). */
  printAttachmentOrder: string[];
  /** Selected attachment keys for print inclusion. */
  printAttachmentKeys: string[];
  /** §18 — uploaded site map or generated map from coords. */
  comparableMapSlot: ValuationReportSlotAttachment | null;
  /** §18 — pins for interactive Google Map in screen preview. */
  comparablesMapPins: ComparablesMapPin[];
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
  /** Report date as yyyy/mm/dd — replaces frozen sample dates in §31/§32. */
  reportDateSlash: string;
  /** §33 — "city - district" instead of the hardcoded "Jeddah - Al Sawari". */
  locationLabel: string;
  /** §33 upper — uploaded site map; print adds a Google hybrid view (zoom 15) when none. */
  satelliteMapSlot: ValuationReportSlotAttachment | null;
  /** §33 lower — Google satellite close-up (zoom 18); produced only at print time. */
  closeupMapSlot: ValuationReportSlotAttachment | null;
};

export function buildValuationReportLiveFill(input: {
  draft: EvaluatorSubmission;
  /** Source of truth is the saved approach settings, not the presence of cost rows. */
  costApproachEnabled?: boolean;
  /** Saved market-approach decision; undefined = legacy (follow the report's method choices). */
  marketApproachEnabled?: boolean;
  /** D17 — saved income-approach decision; undefined = legacy (follow the report's method choices). */
  incomeApproachEnabled?: boolean;
  /** D17 — the income approach (direct capitalisation) as the server computed it. */
  income?: ValuationIncomeApproachDto | null;
  costScopeKey?: string | null;
  /** "replacement" (default/إحلال) | "reproduction" (إعادة الإنتاج) — the appraiser's choice on البيانات الأساسية. */
  costBasisKey?: string | null;
  record?: PoIntakeRecord | null;
  property?: PoPropertyIntake | null;
  /**
   * Phase 5 (decision 2026-10-19): the live deeds of a linked property, in transaction order.
   * Two or more → the deed cells name them all; empty / one → the property's own deed prints.
   */
  transactionDeeds?: readonly Pick<
    TransactionDeedDto,
    "identifierType" | "deedNumber" | "deedDate" | "realEstateRegNumber" | "realEstateRegDate" | "isRemoved"
  >[] | null;
  inspector?: InspectorWorkspaceDraft | null;
  inventoryLines?: BuildingInventoryLineDto[] | null;
  /** «مكونات العقار» by the case specialist — printed verbatim as «وصف العقار». */
  specialistComponentsText?: string | null;
  market?: ValuationComparableSelectionListDto | null;
  /** Independent vacant-land comps for cost approach (appendix). */
  landMarket?: ValuationComparableSelectionListDto | null;
  cost?: ValuationCostApproachDto | null;
  recon?: ValuationReconciliationDto | null;
  clients?: Pick<ClientDto, "id" | "nameAr">[];
  /** The appraiser's saved valuation purpose key (approach settings) — D1. */
  purposeKey?: string | null;
  /** Labels from the org lists for the resolved keys (resolveReportValuationKeys). */
  purposeLabel?: string | null;
  basisLabel?: string | null;
  premiseLabel?: string | null;
  /** D9 — retrospective valuation: its date (yyyy-MM-dd) and the appraiser's rationale. */
  retrospective?: { date: string; dateEnd?: string | null; rationale: string } | null;
  /** D11 — ownership the appraiser recorded (key or Arabic label, remaining lease years). */
  ownership?: { key?: string | null; labelAr?: string | null; remainingLeaseYears?: number | null } | null;
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
  /** Assigned appraiser from work-order dispatch — fourth participants column. */
  assignedAppraiserName?: string | null;
  assignedAppraiserId?: string | null;
  survey?: ValuationReportSurveyBounds | null;
  photoSlots?: Array<ValuationReportSlotAttachment | null> | null;
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
  /** Printed into §29 when an external specialist was used. */
  externalSpecialistDetails?: string | null;
  finishingLuxuryText?: string | null;
  finishingMediumText?: string | null;
  finishingOrdinaryText?: string | null;
  keyInputsText?: string | null;
  professionalStandardsText?: string | null;
  independenceText?: string | null;
  termsText?: string | null;
  restrictionsText?: string | null;
  /** IVS standards effective date — fills {{ivsDate}} in the standards text. */
  ivsEffectiveDate?: string | null;
  /** Specialist case-study selection when not yet mirrored in reportChoices. */
  finishingLevel?: "" | "luxury" | "medium" | "ordinary" | "none";
}): ValuationReportLiveFill {
  const { draft, record, property, inspector } = input;
  const linkedDeeds = (input.transactionDeeds ?? []).filter((d) => !d.isRemoved);
  const linkedDeedLabels =
    linkedDeeds.length > 1
      ? linkedDeeds.map(transactionDeedLabelOf).join(" ، ")
      : "";
  const linkedDeedDates =
    linkedDeeds.length > 1
      ? linkedDeeds.map((d) => transactionDeedDateOf(d) || "—").join(" ، ")
      : "";
  const choices = draft.reportChoices ?? emptyReportChoices();
  const keys = resolveReportValuationKeys({
    record,
    recon: input.recon,
    // Not reportChoices.purposeKey: that is a seed from the assignment and goes stale.
    purposeKey: input.purposeKey,
  });
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
    (input.recon?.basisOfValueLabelAr ?? "").trim() ||
    (record
      ? basisOfValueLabelArForAssignment(record.assignmentType, sub)
      : "");
  const premise =
    (input.premiseLabel ?? "").trim() ||
    labelForPremiseKey(keys.premiseKey) ||
    (input.recon?.valuePremiseLabelAr ?? "").trim();
  const client = clientNameFromRecord(record, input.clients ?? []);
  const users = formatValuationReportUsers(record, input.clients ?? []);
  // D9 — a retrospective date (or period) is THE valuation date, whatever the draft holds.
  const appraisal = retrospectiveDateLabel(input.retrospective) || slashReportDate(
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
  const assetContext = {
    vacantLand: inspector?.vacantLand,
    assetSubject:
      property?.inspectedPropertyType ??
      inspector?.featureValues?.assetSubject,
    classification: property?.classification,
    propertyType:
      property?.effectivePropertyType ??
      property?.propertyType,
  };
  const isLand = isLandInspectionContext(assetContext);
  const isApartment = isApartmentInspectionContext(assetContext);
  const licenseDateRaw = (inspector?.buildLicenseDate ?? "").trim();
  const licenseDate =
    slashReportDate(licenseDateRaw) || licenseDateRaw;
  const reportAgeYears = reportPropertyAgeYearsFromLicense(licenseDateRaw);
  const reportAgeLabel =
    reportAgeYears == null ? "" : formatReportPropertyAgeYears(reportAgeYears);
  const subjectCoords = subjectCoordsForReport(inspector);
  const coordsLabel = subjectCoords
    ? formatSubjectCoordsLabel(subjectCoords.lat, subjectCoords.lng)
    : joinCoords(inspector);

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
      property?.effectivePropertyType ||
        property?.inspectedPropertyType ||
        inspector?.featureValues?.assetSubject ||
        property?.propertyType ||
        property?.classification ||
        inspector?.featureValues?.propertyUsage,
    ),
    "أساليب التقييم المستخدمة": dash(
      methodsUsed(approachesUsed(choices, input), documentIndicators(input.recon)),
    ),
    "حالة العقار": dash(inspector?.featureValues?.propertyCondition),
    "حالة الصك": dash(property?.deedStatus),
    "نوع الملكية": dash(ownershipCell(input.ownership, property?.ownershipType)),
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
    "إحداثيات الموقع": dash(coordsLabel),
    "رقم الصك": dash(linkedDeedLabels || property?.deedNumber),
    "تاريخ الصك": dash(linkedDeedDates || property?.deedDate),
    "رقم رخصة البناء": dash(inspector?.buildLicenseNumber),
    "تاريخ رخصة البناء": dash(licenseDate),
    ...(isLand
      ? {}
      : {
          // Report-only: years since license issue − 2 (not the inspector age field).
          "عمر البناء": dash(reportAgeLabel),
          "عمر العقار": dash(reportAgeLabel),
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
    "مبرر خصم التصفية": "—",
    "وصف العقار": dash(reportPropertyDescription(input.specialistComponentsText, inspector)),
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
  // §25 starts from the unrounded weighted value of §24 — the reader multiplies it out from
  // there; the one rounding step is printed on its own line (finalValueRows).
  const reconWeighted = input.recon?.weightedValue ?? reconFinal;
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
  // D1 — the liquidation discount prints only when the basis is liquidation AND a discount
  // above zero is set; a discount left over from before switching the basis never prints.
  const liquidationPct = input.recon
    ? Number(input.recon.liquidationDiscountPct) || 0
    : parseEvaluatorAmount(draft.forcedSaleDiscountPct.replace(/%/g, "")) ?? 0;
  const liqOn = isLiquidation && liquidationPct > 0;
  if (liqOn) {
    cells["نسبة خصم التصفية المنظمة"] = `${formatAmountNumberDisplay(liquidationPct)}٪`;
    cells["مبرر خصم التصفية"] = dash(input.recon?.liquidationDiscountRationale);
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
  cells["نوع الواجهة الشمالية"] = dash(
    sideFacadeType(inspector, property, "north"),
  );
  cells["نوع الواجهة الشرقية"] = dash(
    sideFacadeType(inspector, property, "east"),
  );
  cells["نوع الواجهة الجنوبية"] = dash(
    sideFacadeType(inspector, property, "south"),
  );
  cells["نوع الواجهة الغربية"] = dash(
    sideFacadeType(inspector, property, "west"),
  );
  // Legacy labels still present in older templates / tab sheets.
  cells["تشطيب الواجهة الشمالية"] = cells["نوع الواجهة الشمالية"];
  cells["تشطيب الواجهة الشرقية"] = cells["نوع الواجهة الشرقية"];
  cells["تشطيب الواجهة الجنوبية"] = cells["نوع الواجهة الجنوبية"];
  cells["تشطيب الواجهة الغربية"] = cells["نوع الواجهة الغربية"];
  const finLevel = finishingLevelLabel(choices.finishingLevel);
  if (finLevel) cells["مستوى التشطيب"] = finLevel;

  cells["التأثيرات البيئية"] = dash(esgCell(choices.esgEnv));
  cells["التأثيرات الاجتماعية"] = dash(esgCell(choices.esgSoc));
  cells["تأثيرات الحوكمة"] = dash(esgCell(choices.esgGov));
  // Legacy factor labels (older HTML templates) still resolve to the group notes.
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
  // D17 — the saved income approach wins over the legacy report-choice fields.
  const incomeSaved = input.income?.isSaved ? input.income : null;
  cells["دخل سنوي"] = dash(
    incomeSaved ? formatMoneyCell(incomeSaved.grossPotentialIncome) : choices.incomeAnnual,
  );
  cells["نسبة الشغور"] = dash(
    incomeSaved ? formatSheetPct(incomeSaved.vacancyCollectionLossPct) : choices.incomeVacancyPct,
  );
  cells["نسبة التشغيل"] = dash(
    incomeSaved ? formatSheetPct(incomeSaved.operatingExpensesPctOfEgi) : choices.incomeOpexPct,
  );
  cells["معدل الرسملة"] = dash(
    incomeSaved ? formatSheetPct(incomeSaved.capitalisationRatePct) : choices.incomeCapRatePct,
  );

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
        ? formatReportAgeText(inspector.propertyAgeYears)
        : input.cost?.actualAgeYears != null
          ? formatReportPropertyAgeYears(input.cost.actualAgeYears)
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

  // Market off ⇒ no property comparables anywhere (stale adopted rows must not print).
  const comps = input.marketApproachEnabled === false ? [] : adoptedComparables(input.market);
  comps.forEach((item, i) => {
    const n = i + 1;
    const c = item.comparable;
    cells[`المقارن (${n})`] = dash(c.comparablePropertyType);
  });

  // Always write the approving appraiser identity — "—" when empty so sample template data is not printed.
  cells["اسم المقيم المعتمد"] = dash(input.certifiedName ?? "");
  cells["رقم ترخيص مزاولة المهنة"] = dash(input.certifiedLicense ?? "");
  // The membership number is the valuer's own (الهيئة السعودية للمقيمين المعتمدين) — never the
  // firm's practice licence number in its place.
  cells["رقم العضوية"] = dash(input.certifiedMembershipNumber);
  cells["تاريخ الإصدار"] = dash(
    displayLicenseDate(input.certifiedIssuedAt),
  );
  cells["تاريخ الانتهاء"] = dash(
    displayLicenseDate(input.certifiedExpires),
  );
  cells["فرع التقييم"] = dash(input.valuationBranch ?? "");
  const memCat = membershipCategoryLabel(input.certifiedMembershipCategory);
  cells["فئة العضوية"] = memCat || "—";
  const role =
    (input.certifiedTitle ?? "").trim() || valuerRoleLabel("certified");
  if (role) cells["صفته"] = role;
  cells["تاريخ انتهاء العضوية"] = dash(displayLicenseDate(input.certifiedMembershipExpires));


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
  const landComps = adoptedComparables(input.landMarket);
  const landAdj = buildAdjustmentSheetRows(landComps, input.landMarket);
  const indirect = buildIndirectCostSheetRows(input.cost);

  const mapPins = collectComparablesMapPins({
    subjectLat: subjectCoords?.lat ?? inspector?.mapLatitude,
    subjectLng: subjectCoords?.lng ?? inspector?.mapLongitude,
    comps: comps.map((item, i) => ({
      latitude: item.comparable.latitude,
      longitude: item.comparable.longitude,
      label: String(i + 1),
    })),
  });
  // Only a real Google map prints — never the schematic SVG stand-in.
  const generatedMap = googleMapOnly(resolveComparablesMapImage(mapPins));
  const landMapPins = collectComparablesMapPins({
    subjectLat: subjectCoords?.lat ?? inspector?.mapLatitude,
    subjectLng: subjectCoords?.lng ?? inspector?.mapLongitude,
    comps: landComps.map((item, i) => ({
      latitude: item.comparable.latitude,
      longitude: item.comparable.longitude,
      label: String(i + 1),
    })),
  });
  const generatedLandMap =
    landComps.length > 0 ? googleMapOnly(resolveComparablesMapImage(landMapPins)) : null;
  const landComparableMapSlot: ValuationReportSlotAttachment | null = generatedLandMap
    ? {
        attachmentId: "generated-land-comps-map",
        url: generatedLandMap.url,
        contentType: generatedLandMap.contentType,
        fileName: generatedLandMap.fileName,
        labelAr: "خريطة مواقع مقارنات الأراضي",
        isImage: true,
      }
    : null;
  const used = approachesUsed(choices, input);
  const docIndicators = documentIndicators(input.recon);
  const additions = input.recon?.additions ?? [];
  const comparableMapSlot: ValuationReportSlotAttachment | null =
    input.siteMapSlot ??
    (generatedMap
      ? {
          attachmentId: "generated-comps-map",
          url: generatedMap.url,
          contentType: generatedMap.contentType,
          fileName: generatedMap.fileName,
          labelAr: "خريطة مواقع المقارنات",
          isImage: true,
        }
      : null);

  // §33 — the uploaded site map occupies the satellite slot; both Google views
  // (hybrid zoom 15 / satellite zoom 18) are fetched at print time by
  // materializePrintMapSlots. Screen preview mounts live Google maps instead.
  const satelliteMapSlot: ValuationReportSlotAttachment | null =
    input.siteMapSlot ?? null;
  const closeupMapSlot: ValuationReportSlotAttachment | null = null;

  return {
    cells,
    costApproachEnabled: input.costApproachEnabled === true,
    costBuildingOnly: input.costScopeKey === "building_only",
    marketApproachEnabled: input.marketApproachEnabled !== false,
    incomeApproachEnabled: used.income,
    incomeRows: buildIncomeSheetRows(input.income),
    approachCount:
      input.marketApproachEnabled === undefined && input.costApproachEnabled === undefined
        ? // No saved settings passed (legacy callers): count the reconciled approaches.
          (input.recon?.methods ?? []).filter((m) => m.isIncluded).length || 2
        : (used.market ? 1 : 0) + (used.cost ? 1 : 0) + (used.income ? 1 : 0) + docIndicators.length,
    scopeBasis: basis,
    scopeClient: client,
    ageNotes: isLand ? [] : buildAgeNotes(input.cost, partialInterestKey(input.ownership)),
    scopeRows: buildScopeRows({
      retrospective: input.retrospective,
      buildingOnly: input.costScopeKey === "building_only",
      ownership: cells["نوع الملكية"] ?? "",
    }),
    basisDefinition: resolveBasisDefinition(
      keys.valueBasisKey,
      isLiquidation,
      input.basisDefinition,
      keys.premiseKey,
    ),
    // Each approach names its internal method, or the method a «مستند ذو قيمة» indicator
    // carries (e.g. أسلوب الدخل — الطريقة المتبقية).
    methodRow: [
      approachMethodCell(used.market ? "طريقة المقارنة" : null, docIndicators, "market"),
      // أسلوب التكلفة — طريقة المقاول. Inside it the comparison method only estimates the
      // land (an input, not the market approach), so the market cell stays «غير مستخدم».
      approachMethodCell(
        used.cost ? contractorMethodLabel(input.costScopeKey, input.costBasisKey) : null,
        docIndicators,
        "cost",
      ),
      approachMethodCell(
        used.income ? "الرسملة المباشرة: صافي الدخل التشغيلي ÷ معدل الرسملة" : null,
        docIndicators,
        "income",
      ),
    ],
    boundariesSource: input.survey ? "survey" : "intake",
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
        face: sideFacadeType(inspector, property, "north"),
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
        face: sideFacadeType(inspector, property, "east"),
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
        face: sideFacadeType(inspector, property, "south"),
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
        face: sideFacadeType(inspector, property, "west"),
      },
    ],
    componentsListed: (input.inventoryLines ?? []).length > 0,
    // §10 «مكونات العقار»: description + area per listed component, then the built-up total.
    // (§09 «تفاصيل المساحات» was dropped from the report.)
    buildDescRows: [
      ...areas.descriptions.map((r) => ({
        key: r.key,
        values: r.values.map((v) => dashSheet(v)),
      })),
      { key: "مجموع مسطحات البناء", values: ["", dashSheet(areas.builtUpTotal)] },
    ],
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
          dashSheet(slashReportDate(c.transactionDate)),
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
          dashSheet(slashReportDate(c.transactionDate)),
          dashSheet(formatMoneyCell(eff.price)),
          dashSheet(formatMoneyCell(eff.pricePerSqm)),
          item.market
            ? dashSheet(formatSheetPct(item.market.effectiveWeightPct))
            : "—",
        ],
      };
    }),
    landValueRows: costLandReportRows(input.cost, isApartment),
    landAppendixNote: cells["إشارة الملحق"] || "",
    landAdjustmentRows: landAdj.rows,
    // The land table's output is an input to the cost formula — «قيمة الأرض», not an indicator;
    // like the matrix card it is unrounded (the final value is rounded once in §25).
    landAdjustmentComparisonLabel: LAND_VALUE_BEFORE_ROUNDING,
    landAdjustmentNotes: buildAdjustmentRationaleText(landComps),
    landComparableMapSlot,
    landComparablesMapPins: landComps.length > 0 ? landMapPins : [],
    adjustmentRows: adj.rows,
    // A land subject's comparison value is its land value — named as on the matrix card.
    adjustmentComparisonLabel: isLand ? LAND_VALUE_BEFORE_ROUNDING : adj.comparisonLabel,
    adjustmentNotes: buildAdjustmentRationaleText(comps),
    surroundingsOther: dash(surroundings["أخرى"]),
    attachmentsOther: dash(inspector?.featureValues?.[OTHER_ATTACHMENTS_KEY]),
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
    finalValueRows: buildFinalValueRows({
      recon: input.recon,
      weighted: reconWeighted != null && reconWeighted > 0 ? reconWeighted : (priceN ?? null),
      final: reconFinal != null && reconFinal > 0 ? reconFinal : (priceN ?? null),
      liquidation: liqOn
        ? {
            pct: liquidationPct,
            rationale: cells["مبرر خصم التصفية"] ?? "—",
            labels: liquidationDiscountLabels(keys.premiseKey),
          }
        : null,
    }),
    finalValue:
      reconFinal != null && reconFinal > 0
        ? reconFinal
        : priceN != null && priceN > 0
          ? priceN
          : null,
    finalWords:
      reconFinal != null && reconFinal > 0
        ? `فقط ${amountToArabicWords(reconFinal)} لا غير`
        : priceN != null && priceN > 0
          ? `فقط ${amountToArabicWords(priceN)} لا غير`
          : "—",
    valueAdditions: additions.map((a) => ({
      label: a.labelAr,
      value: formatMoneyCell(a.value),
    })),
    propertyValueAfterLiquidation:
      additions.length > 0 && input.recon?.propertyValueAfterLiquidation != null
        ? formatMoneyCell(input.recon.propertyValueAfterLiquidation)
        : "",
    isLiquidation,
    liquidationDiscountOn: liqOn,
    isLand,
    isApartment,
    propertyDescription: reportPropertyDescription(input.specialistComponentsText, inspector),
    reportWorkers: draft.reportWorkers ?? [],
    assignedAppraiserName: (input.assignedAppraiserName ?? "").trim(),
    assignedAppraiserId: (input.assignedAppraiserId ?? "").trim(),
    photoSlots: input.photoSlots ?? [],
    surveySlot: input.surveySlot ?? null,
    deedSlot: input.deedSlot ?? null,
    slotFrames: { ...(choices.reportSlotFrames ?? {}) },
    printAttachmentOrder: [...(choices.printAttachmentOrder ?? [])],
    printAttachmentKeys: [...(choices.printAttachmentKeys ?? [])],
    comparableMapSlot,
    comparablesMapPins: mapPins,
    searchScopeNotes: (draft.searchScopeNotes ?? "").trim(),
    researchScopeBullets: linesFromOrgText(input.researchScopeText),
    specialAssumptionBullets: assumptionsForInterest(
      resolveSpecialAssumptionBullets({
        selected: input.selectedSpecialAssumptions,
        library: input.specialAssumptionLibrary,
        toggles: choices.specialAssumptionOn,
        dropNoSpecialistClause: Boolean(input.externalSpecialistUsed),
        externalSpecialistDetails: input.externalSpecialistDetails,
      }),
      input.ownership,
    ),
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
    termsBullets: linesFromOrgText(
      applyReportDateToken(
        input.termsText,
        slashDateFromIso(draft.appraisalDate || draft.reportIssueDate),
      ),
    ),
    restrictionsBullets: linesFromOrgText(
      applyReportDateToken(
        input.restrictionsText,
        slashDateFromIso(draft.appraisalDate || draft.reportIssueDate),
      ),
    ),
    reportDateSlash: slashDateFromIso(
      draft.appraisalDate || draft.reportIssueDate,
    ),
    locationLabel: [property?.city, property?.district]
      .map((s) => (s ?? "").trim())
      .filter(Boolean)
      .join(" - "),
    satelliteMapSlot,
    closeupMapSlot,
    finishingLevel:
      choices.finishingLevel || input.finishingLevel || "",
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
 * When a specialist is used, prints the valuer's details text verbatim and drops the denial clause.
 */
export function resolveSpecialAssumptionBullets(input: {
  selected?: string[] | null;
  library?: string[] | null;
  toggles?: boolean[] | null;
  dropNoSpecialistClause?: boolean;
  externalSpecialistDetails?: string | null;
}): string[] | null {
  const details = (input.externalSpecialistDetails ?? "").trim();
  const specialistBullet =
    input.dropNoSpecialistClause && details ? details : null;

  const withSpecialist = (items: string[]): string[] => {
    if (!specialistBullet || items.includes(specialistBullet)) return items;
    return [specialistBullet, ...items];
  };

  if (input.selected !== undefined && input.selected !== null) {
    let items = input.selected.map((x) => x.trim()).filter(Boolean);
    if (input.dropNoSpecialistClause) {
      items = items.filter((item) => !isNoExternalSpecialistAssumption(item));
    }
    return withSpecialist(items);
  }
  const filtered = filterSpecialAssumptionBullets(input.library, input.toggles, {
    dropNoSpecialistClause: input.dropNoSpecialistClause,
  });
  if (filtered == null) return null;
  return withSpecialist(filtered);
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
  premiseKey?: string | null,
): string {
  const listed = (fromLists ?? "").trim();
  if (isLiquidation) {
    return listed || (premiseKey === "forced" ? FORCED_SALE_BASIS_DEFINITION : LIQUIDATION_BASIS_DEFINITION);
  }
  if (valueBasisKey === "market") {
    if (listed && !listed.includes("قيمة التصفية")) return listed;
    return MARKET_BASIS_DEFINITION;
  }
  if (listed && !listed.includes("قيمة التصفية")) return listed;
  return listed;
}

/** «لأقرب 10,000 ر.س.» for the reconciliation rounding exponent (10^n; 0 = nearest riyal). */
function roundingUnitLabel(decimals: number | null | undefined): string {
  const d = Math.min(Math.max(Math.trunc(Number(decimals) || 0), 0), 6);
  return d === 0 ? "لأقرب ريال" : `لأقرب ${formatAmountNumberDisplay(10 ** d)} ر.س.`;
}

/**
 * §25 «القيمة النهائية للعقار» — the server's pipeline (weighted → liquidation discount →
 * + document additions → rounded once) printed step by step, so every number follows from
 * the one above it.
 */
export function buildFinalValueRows(input: {
  recon?: ValuationReconciliationDto | null;
  /** Unrounded weighted value (§24), or the draft's price when nothing was reconciled. */
  weighted: number | null;
  final: number | null;
  liquidation: {
    pct: number;
    rationale: string;
    labels?: ReturnType<typeof liquidationDiscountLabels>;
  } | null;
}): FinalValueRow[] {
  const money = (n: number | null | undefined) =>
    n != null && Number.isFinite(n) && n > 0 ? formatMoneyCell(n) : "—";
  const rows: FinalValueRow[] = [{ key: "القيمة المرجّحة", value: money(input.weighted) }];
  let unrounded = input.weighted;
  if (input.liquidation) {
    const after =
      input.recon?.propertyValueAfterLiquidation ??
      (input.weighted != null ? input.weighted * (1 - input.liquidation.pct / 100) : null);
    const labels = input.liquidation.labels ?? liquidationDiscountLabels(null);
    rows.push({
      key: labels.pct,
      value: `${formatAmountNumberDisplay(input.liquidation.pct)}٪`,
      rationale: input.liquidation.rationale,
      rationaleLabel: labels.rationale,
    });
    rows.push({ key: labels.after, value: money(after) });
    unrounded = after;
  }
  const additions = input.recon?.additions ?? [];
  for (const a of additions) {
    rows.push({ key: `+ ${a.labelAr}`, value: formatMoneyCell(a.value) });
  }
  if (additions.length > 0 && unrounded != null) {
    unrounded += additions.reduce((sum, a) => sum + (Number(a.value) || 0), 0);
    rows.push({ key: "القيمة قبل التقريب", value: money(unrounded) });
  }
  const label = additions.length > 0 ? "القيمة الإجمالية" : "قيمة العقار";
  const rounded =
    input.recon != null &&
    input.final != null &&
    unrounded != null &&
    Math.abs(input.final - unrounded) >= 0.005;
  rows.push({
    key: rounded ? `${label} بعد التقريب (${roundingUnitLabel(input.recon?.finalRoundDecimals)})` : label,
    value: money(input.final),
    total: true,
  });
  return rows;
}

/** §2 statements: D9 retrospective rationale; the building-only scope (land not valued). */
function buildScopeRows(input: {
  retrospective?: { date: string; dateEnd?: string | null; rationale: string } | null;
  buildingOnly: boolean;
  /** «نوع الملكية» as printed — a leased-land / usufruct right is named in the scope. */
  ownership: string;
}): Array<{ label: string; value: string }> {
  const rows: Array<{ label: string; value: string }> = [];
  const retroDate = retrospectiveDateLabel(input.retrospective);
  const retroWhy = (input.retrospective?.rationale ?? "").trim();
  if (retroDate || retroWhy) {
    rows.push({
      label: "مبرر التقييم بأثر رجعي",
      value: [retroDate ? `القيمة كما في تاريخ التقييم ${retroDate}` : "", retroWhy]
        .filter(Boolean)
        .join(" — "),
    });
  }
  if (input.buildingOnly) {
    const ownership = /منفعة|مستأجر|حكر|إيجار/.test(input.ownership) ? ` (${input.ownership})` : "";
    rows.push({
      label: "نطاق التقييم",
      value: `يقتصر التقييم على المباني والتحسينات القائمة${ownership}، ولا تشمل القيمة الأرض.`,
    });
  }
  return rows;
}

/** §23 — age rationales and the D11 lease cap, as the appraiser saved them on the cost screen. */
function buildAgeNotes(
  cost: ValuationCostApproachDto | null | undefined,
  interest: "usufruct" | "leased_land" | null,
): Array<{ label: string; value: string }> {
  if (!cost) return [];
  const rows: Array<{ label: string; value: string }> = [];
  const actual = (cost.actualAgeRationale ?? "").trim();
  if (actual) rows.push({ label: "مبرر العمر الفعلي", value: actual });
  const economic = (cost.economicAgeRationale ?? "").trim();
  if (economic) rows.push({ label: "مبرر العمر الاقتصادي", value: economic });
  const lease = cost.remainingLeaseYears;
  if (cost.lifeCappedByLease && lease != null && lease > 0) {
    const life = cost.effectiveLifeYears;
    // The note names the interest the appraiser recorded (D11): a usufruct right is not a lease.
    const usufruct = interest === "usufruct";
    const term = usufruct ? "مدة حق المنفعة" : "مدة الإيجار";
    rows.push({
      label: `تحديد العمر ب${term}`,
      value:
        `${usufruct ? "المباني مقيّمة بموجب حق منفعة" : "المباني مقامة على أرض مستأجرة"}: ` +
        `حُسب الإهلاك على عمر ${formatArabicYears(life ?? lease)} ` +
        `لأنه لا يتجاوز ${term} المتبقية (${formatArabicYears(lease)}).`,
    });
  }
  return rows;
}
