import {
  formatDateAr,
  formatPropertyLocation,
  type PoIntakeRecord,
  type PoPropertyIntake,
} from "./po-intake-data";
import type { PropertyDetailPartySubmission } from "./property-detail-party-submissions";
import type {
  PropertyDetailDocumentEntry,
  PropertyDetailDocumentSection,
} from "./property-detail-documents";
import type {
  InfathFieldState,
  InfathFieldType,
  InfathRoleKey,
  InfathUploadAttachment,
  InfathUploadField,
  InfathUploadModel,
  InfathUploadSection,
  InfathUploadStats,
} from "./infath-upload-types";
import {
  INFAZ_UPLOAD_UNRESOLVED_POINTS,
} from "./infath-upload-types";
import { INFATH_FIELD_LABELS as L } from "./infath-field-labels";
import { parseLocaleNumber } from "@platform/app-shared/format/number";
import {
  linkedPropertyDeeds,
  transactionDeedLabelOf,
  type BuildingInventoryLineDto,
  type TransactionDetailDto,
  type ValuationApproachSettingsDto,
  type ValuationCostApproachDto,
  type ValuationReconciliationDto,
} from "@platform/api-client";
import { infathBuildingAreasFromComponents } from "./specialist-components";
import {
  isApartmentInspectionContext,
  isLandInspectionContext,
  propertyUsageValue,
} from "@platform/app-shared/app-data/inspector-workspace-data";
import {
  orderPropertyPhotos,
  photoClassOf,
  type PropertyPhotoMarks,
} from "@platform/app-shared/app-data/property-detail-document-types";
import { fmt, fmtMax } from "@platform/app-shared/format/number";
import { PropertyKeysStatuses } from "@platform/api-client";
import { downloadAttachmentBlobOnce } from "@platform/app-shared/app-data/attachment-blob-cache";
import { prototypeModulesApiConfig } from "@platform/app-shared/app-data/modules-api-config";

/** Court visit + key envelope inputs for Infath (from tasks / keys gate). */
export type InfathOpsContext = {
  courtVisitCompletedAt?: string | null;
  courtVisitResultKind?: string | null;
  courtVisitAssigneeName?: string | null;
  keysStatus?: string | null;
  keyAvailable?: boolean;
  envelopeId?: string | null;
  /** Authority deposit code for the report — entered by the specialist in the Infath basket. */
  depositCode?: string | null;
  /** Deposit-certificate attachment name. */
  depositCertificateName?: string | null;
  /** The approved report's date (yyyy-MM-dd) — «تاريخ إصدار التقرير» is that, not the hand-over day. */
  reportDate?: string | null;
};

function partyField(
  party: PropertyDetailPartySubmission | null | undefined,
  label: string,
): string {
  return party?.fields.find((f) => f.label === label)?.value?.trim() ?? "";
}

function partyRemark(
  party: PropertyDetailPartySubmission | null | undefined,
  label: string,
): string {
  return party?.remarks.find((r) => r.label === label)?.value?.trim() ?? "";
}

/** Inspection/survey feed Infath only after specialist accept.
 *  Appraisal feeds after the valuer submits the report — specialist receive
 *  stamp is not a value/Infath gate. */
export function partyPackageFeedsInfath(
  party: PropertyDetailPartySubmission | null | undefined,
): PropertyDetailPartySubmission | null {
  if (!party?.hasData) return null;
  if (party.roleKey === "appraisal") {
    const status = (party.packageStatus ?? "").toLowerCase();
    const submitted =
      Boolean(party.submittedAtUtc?.trim()) ||
      status === "submitted" ||
      status === "completed" ||
      status === "reopened";
    return submitted ? party : null;
  }
  const stamp = party.acceptedAtUtc?.trim();
  if (!stamp) return null;
  return party;
}

function txt(
  id: string,
  label: string,
  value: string,
  role: InfathRoleKey,
  type: InfathFieldType = "text",
  state: InfathFieldState = "",
): InfathUploadField {
  return { id, label, value: value.trim(), role, type, state };
}

function area(
  id: string,
  label: string,
  value: string,
  role: InfathRoleKey,
  state: InfathFieldState = "",
): InfathUploadField {
  return txt(id, label, value, role, "area", state);
}

function sel(
  id: string,
  label: string,
  value: string,
  role: InfathRoleKey,
  state: InfathFieldState = "",
): InfathUploadField {
  return txt(id, label, value, role, "sel", state);
}

function auto(
  id: string,
  label: string,
  value: string,
  role: InfathRoleKey = "SY",
): InfathUploadField {
  return txt(id, label, value, role, "auto");
}

/**
 * Fields that have no answer on bare land: the building fields of «بيانات الأصل», the rows the inspector's land
 * screen never asks (`LAND_HIDDEN_INSPECTOR_FEATURE_KEYS`: facade, occupancy, landscaping…), the wells count
 * (components are not listed for land), the building areas of «الحدود والأطوال», the buildings value and the
 * interior photos.
 * Edge cases: added 2026-11-04 — facade, wells, landscaping, occupancy, floors and the basement / annex /
 * buildings totals read «— غير مُدخل —» on land, as if the inspector had skipped them.
 */
const BUILDING_ONLY_FIELD_IDS = new Set([
  "facade",
  "wells",
  "landscaping",
  "occupancy",
  "floors",
  "basement-total",
  "annex-total",
  "buildings-total",
  "build-value",
  "int-photo",
  "built-area",
  "build-license",
  "build-license-date",
  "rooms",
  "halls",
  "units",
  "baths",
  "age",
  "showrooms",
  "towers",
  "kitchen",
  "car-entrance",
  "basement",
  "elevator",
  "pool",
  "central-ac",
  "tanks",
  "build-state",
]);

export const INFATH_NOT_APPLICABLE_LAND = "لا ينطبق — أرض";
/** Buildings value of a property valued «أرض فقط». */
export const INFATH_NOT_APPLICABLE_LAND_ONLY_SCOPE = "لا ينطبق — التقييم للأرض فقط";
/** Land value of a property valued «مباني فقط». */
export const INFATH_NOT_APPLICABLE_BUILDING_ONLY_SCOPE = "لا ينطبق — التقييم للمباني فقط";

/**
 * On bare land (asset «أرض», no listed components) the empty building fields read «لا ينطبق — أرض».
 *
 * How it works: only fields in BUILDING_ONLY_FIELD_IDS that are still empty are rewritten, and their
 * «missing» state is cleared so the stats do not count them as gaps.
 *
 * Edge cases: a value the inspector did enter is kept as is. Added 2026-10-28 — a land package
 * listed rooms, age, elevator… as «— غير مُدخل —», as if data were missing.
 */
function markBuildingFieldsNotApplicable(sections: InfathUploadSection[]): void {
  markFieldsNotApplicable(sections, BUILDING_ONLY_FIELD_IDS, INFATH_NOT_APPLICABLE_LAND);
}

const APARTMENT_NA_FIELD_IDS = new Set(["facade"]);

export const INFATH_NOT_APPLICABLE_APARTMENT = "لا ينطبق — شقة";

/** Rewrites the still-empty fields among `ids` to `label` and clears their «missing» state. */
function markFieldsNotApplicable(
  sections: InfathUploadSection[],
  ids: ReadonlySet<string>,
  label: string,
): void {
  for (const section of sections) {
    section.fields = section.fields.map((field) =>
      ids.has(field.id) && !field.value ? { ...field, value: label, state: "" } : field,
    );
  }
}

function ref(id: string, label: string, value: string): InfathUploadField {
  return txt(id, label, value, "SY", "ref");
}

function file(
  id: string,
  label: string,
  value: string,
  role: InfathRoleKey,
): InfathUploadField {
  return txt(id, label, value, role, "file");
}

/** Typed text → number by the shared rule («12,5» → 12.5, «١٢٥٠» → 1250, units dropped). */
function parseNumber(raw: string): number | null {
  const n = parseLocaleNumber(raw);
  return Number.isFinite(n) ? n : null;
}

function firstNonEmpty(...values: (string | undefined | null)[]): string {
  for (const value of values) {
    const trimmed = value?.trim() ?? "";
    if (trimmed) return trimmed;
  }
  return "";
}

function surveyOrPropertyField(
  survey: PropertyDetailPartySubmission | null | undefined,
  propertyValue: string | undefined,
  label: string,
): string {
  return firstNonEmpty(partyField(survey, label), propertyValue);
}

function formatMoney(n: number): string {
  return fmt(n, 0);
}

/**
 * Typed documents match by their governed type only (so «تقرير تقييم المنقولات» is never taken
 * for the valuation report); untyped rows still match by name.
 */
function findDoc(
  sections: PropertyDetailDocumentSection[],
  matchers: (name: string) => boolean,
  typeKeys: readonly string[] = [],
): PropertyDetailDocumentEntry | null {
  for (const section of sections) {
    for (const doc of section.documents) {
      if (doc.documentTypeKey) {
        if (typeKeys.includes(doc.documentTypeKey)) return doc;
        continue;
      }
      if (matchers(doc.name) || matchers(doc.fileName)) return doc;
    }
  }
  return null;
}

/** Files of the upload sheet that do not come from the property's documents list. */
export type InfathAttachmentSources = {
  /** The transaction's case-study report has been issued — its PDF is printed when the row is downloaded. */
  caseStudyReportIssued?: boolean;
  /** The transaction has a survey task. Without one the survey row says «لا يوجد رفع مساحي». */
  hasSurveyTask?: boolean;
  /**
   * The generated final valuation report (the approved report with the deposit code + the certificate page) —
   * the only file the «تقرير التقييم المعتمد» row and field take.
   */
  finalReport?: PropertyDetailDocumentEntry | null;
  /** The deposit certificate stored with the valuation report's issuance. */
  depositCertificate?: PropertyDetailDocumentEntry | null;
  /** The keys handover proof uploaded for the property. */
  keysProof?: PropertyDetailDocumentEntry | null;
};

function hasFile(doc: PropertyDetailDocumentEntry | null | undefined): boolean {
  return Boolean(doc?.attachmentId?.trim() || doc?.dataUrl);
}

/** The inspector's photos Enfaz takes as «صور الأصل من الخارج» and «… من الداخل». */
export type InfathPhotoBundles = {
  exterior: PropertyDetailDocumentEntry[];
  interior: PropertyDetailDocumentEntry[];
};

/**
 * Splits the inspector's photos into Enfaz's exterior and interior bundles.
 *
 * How it works: takes the inspector photos of the documents list (`inspection-photo` images with a file), in the
 * photos tab's order, and files each by its class (`photoClassOf`: the coordinator's / study's choice, else the
 * suggested one) — Omar 2026-11-08: the exterior file carries the meters, the interior one the movables.
 *
 * Edge cases: a photo classed «محيط العقار» (kept inside the system) or «مستند» (made a property document) goes to
 * neither bundle; a photo whose file is missing is skipped. Fixed 2026-11-08: the meters, services and documentary
 * shots were the report's section 3 and fell out of both files. Added 2026-11-04 — the «صور الأصل» rows read
 * «غير مُدخل» while the property had photos.
 */
export function infathPhotoBundles(
  sections: PropertyDetailDocumentSection[],
  marks?: PropertyPhotoMarks | null,
): InfathPhotoBundles {
  const photos = orderPropertyPhotos(
    sections
      .flatMap((section) => section.documents)
      .filter(
        (doc) =>
          doc.kind === "image" &&
          doc.documentTypeKey === "inspection-photo" &&
          (hasFile(doc) || Boolean(doc.inspectionPhoto?.attachment.attachmentId?.trim())),
      ),
    marks,
  );
  return {
    exterior: photos.filter((photo) => photoClassOf(photo, marks) === "exterior"),
    interior: photos.filter((photo) => photoClassOf(photo, marks) === "interior"),
  };
}

/**
 * One «صور الأصل» attachment row: ready when the bundle has photos (its PDF is printed on download), else missing —
 * or `not-needed` with `notNeededNote` (interior photos of bare land).
 */
function photoBundleRow(
  id: string,
  name: string,
  infathTarget: string,
  photos: PropertyDetailDocumentEntry[],
  deedNumber: string,
  notNeededNote = "",
): InfathUploadAttachment {
  if (photos.length > 0) {
    const fileName = deedNumber.trim() ? `${name} - ${deedNumber.trim()}.pdf` : `${name}.pdf`;
    return {
      id,
      name,
      infathTarget,
      status: "ready",
      document: { id, name, fileName, source: "المعاين الميداني", kind: "pdf" },
      photos,
    };
  }
  if (notNeededNote) {
    return { id, name, infathTarget, status: "not-needed", statusNote: notNeededNote, document: null };
  }
  return { id, name, infathTarget, status: "missing", document: null };
}

/**
 * The «مرفقات الرفع» rows: which file each Enfaz slot takes and whether it can be downloaded now.
 *
 * How it works: the valuation report, the survey report and the deed are looked up in the property's documents
 * (by governed type, then by name); the case-study report, the deposit certificate and the keys proof come from
 * `sources`. A row is `ready` when there is a file to download — a stored file id or the generated bytes — or,
 * for the case-study report, when the report is issued (its PDF is printed on download).
 *
 * Edge cases and how they were fixed:
 * - The case-study report was searched among uploaded documents by the word «دراسة»; the issued report is never
 *   uploaded, so the row was «غير متوفر» on every transaction. It now follows the report's issued status.
 * - Rows were ready only with bytes already in this browser, so a deed stored on the server read «غير متوفر»
 *   elsewhere; a stored file id is enough now (it is fetched on download).
 * - The deposit certificate row had no file at all, so its button never worked; it now takes the stored
 *   certificate.
 * - No survey task → «لا يوجد رفع مساحي» instead of «عند الحاجة»; a survey task without its report → «غير متوفر».
 * - 2026-11-04: the exterior / interior photo bundles are rows too (as Enfaz's form lists them), ready when the
 *   inspector took such photos; bare land has no interior photos («لا ينطبق — أرض»).
 */
function buildAttachments(
  sections: PropertyDetailDocumentSection[],
  keysReceived: boolean,
  sources: InfathAttachmentSources,
  deedNumber: string,
  photos: InfathPhotoBundles,
  bareLand: boolean,
): InfathUploadAttachment[] {
  const appraisal = sources.finalReport ?? null;
  const survey = findDoc(
    sections,
    (n) => n.includes("رفع") || n.includes("مساح"),
    ["survey"],
  );
  const deed = findDoc(
    sections,
    (n) => n.includes("صك") || n.includes("سجل"),
    ["deed", "bourse-deed", "real-estate-registry"],
  );
  const certificate = sources.depositCertificate ?? null;
  const keysProof = sources.keysProof ?? null;
  const caseStudyFile = deedNumber.trim()
    ? `تقرير دراسة الحالة - ${deedNumber.trim()}.pdf`
    : "تقرير دراسة الحالة.pdf";

  const surveyRow: InfathUploadAttachment = hasFile(survey)
    ? { id: "survey", name: "تقرير الرفع المساحي", infathTarget: "مرفق الرفع المساحي", status: "ready", document: survey }
    : sources.hasSurveyTask
      ? { id: "survey", name: "تقرير الرفع المساحي", infathTarget: "مرفق الرفع المساحي", status: "missing", document: null }
      : {
          id: "survey",
          name: "تقرير الرفع المساحي",
          infathTarget: "مرفق الرفع المساحي",
          status: "not-needed",
          statusNote: "لا يوجد رفع مساحي",
          document: null,
        };

  const items: InfathUploadAttachment[] = [
    {
      id: "case-study",
      name: "تقرير دراسة الحالة",
      infathTarget: "تقرير دراسة الحالة",
      status: sources.caseStudyReportIssued ? "ready" : "missing",
      document: sources.caseStudyReportIssued
        ? {
            id: "case-study-report",
            name: "تقرير دراسة الحالة",
            fileName: caseStudyFile,
            source: "أخصائي دراسة الحالة",
            kind: "pdf",
          }
        : null,
    },
    {
      id: "appraisal",
      name: "تقرير التقييم المعتمد",
      infathTarget: "مرفق التقييم المعتمد",
      status: hasFile(appraisal) ? "ready" : "missing",
      document: appraisal,
    },
    surveyRow,
    photoBundleRow(
      "interior-photos",
      "صور الأصل من الداخل",
      "صورة الأصل من الداخل",
      photos.interior,
      deedNumber,
      bareLand ? INFATH_NOT_APPLICABLE_LAND : "",
    ),
    photoBundleRow("exterior-photos", "صور الأصل من الخارج", "صورة الأصل من الخارج", photos.exterior, deedNumber),
    {
      id: "deed",
      name: "صك ملكية الأصل",
      infathTarget: "صورة صك ملكية الأصل",
      status: hasFile(deed) ? "ready" : "missing",
      document: deed,
    },
    {
      id: "deposit-certificate",
      name: "شهادة إيداع التقرير",
      infathTarget: "شهادة الإيداع",
      status: hasFile(certificate) ? "ready" : "missing",
      document: certificate,
    },
  ];

  if (keysReceived) {
    items.push({
      id: "keys-proof",
      name: "إثبات استلام المفتاح",
      infathTarget: "إثبات استلام المفتاح",
      status: hasFile(keysProof) ? "ready" : "conditional",
      conditional: true,
      document: keysProof,
    });
  }

  return items;
}

function isInfathFieldCopyable(field: InfathUploadField): boolean {
  return (
    Boolean(field.value) &&
    (field.type === "text" || field.type === "area")
  );
}

function computeStats(sections: InfathUploadSection[]): InfathUploadStats {
  let conflicts = 0;
  let missing = 0;
  let unresolved = 0;
  let attachments = 0;

  for (const section of sections) {
    for (const field of [...section.fields, ...section.areas]) {
      const state = field.state ?? "";
      const hasValue = Boolean(field.value);
      if (state === "cf") conflicts += 1;
      if (state === "ms" || !hasValue) missing += 1;
      if (state === "un") unresolved += 1;
      if (field.type === "file" && hasValue) attachments += 1;
    }
  }

  return { conflicts, missing, unresolved, attachments };
}

function countInfathCopyableFields(model: InfathUploadModel): number {
  let total = 0;
  for (const section of model.sections) {
    for (const field of [...section.fields, ...section.areas]) {
      if (isInfathFieldCopyable(field)) total += 1;
    }
  }
  return total;
}

/**
 * Report data the appraiser no longer types into the package: the certified appraiser's identity comes from the
 * organization settings (the same identity the printed report carries).
 */
export type InfathReportContext = {
  appraiserName?: string;
  appraiserLicenseNumber?: string;
  appraiserLicenseDate?: string;
  /** The valuation's effective date when retrospective (yyyy-MM-dd, or «start – end»); absent = issue date. */
  valuationDate?: string;
  /** The approaches the appraiser switched on (e.g. «أسلوب السوق و أسلوب التكلفة»), as the report lists them. */
  approachesUsed?: string;
  /** The valuation's own results for «تقدير القيمة» (see infathValuationFigures); absent = the package's figures. */
  valuation?: InfathValuationFigures | null;
};

/** What Enfaz's «تقدير القيمة» takes, from the valuation's results (not the appraiser's package). */
export type InfathValuationFigures = {
  /** «إجمالي قيمة العقار»: the concluded value — before the forced-sale discount when one applies. */
  totalValue: number;
  /** «نسبة خصم البيع القسري» in %, only when the value basis applies the discount. */
  forcedDiscountPct: number | null;
  /** «قيمة البيع القسري»: the final value after that discount; null without one. */
  forcedSaleValue: number | null;
  /** «قيمة الأرض»; null when the valuation does not split it (market approach only). */
  landValue: number | null;
  /** «قيمة المباني»; null when the valuation does not split it. */
  buildingsValue: number | null;
  /** Shown instead of a land value the valuation's scope has none of («مباني فقط»); "" otherwise. */
  landNote: string;
  /** Shown instead of a buildings value the scope has none of (bare land, «أرض فقط»); "" otherwise. */
  buildingsNote: string;
};

function positiveAmount(n: number | null | undefined): number | null {
  return n != null && Number.isFinite(n) && n > 0 ? n : null;
}

/**
 * Enfaz's «تقدير القيمة» from the valuation's reconciliation, cost approach and settings.
 *
 * How it works:
 * - total = the final value (القيمة النهائية); when the basis applies the liquidation discount, the total is the
 *   value before it (plus any «مستند ذو قيمة» additions) and the final value is «قيمة البيع القسري» — so Enfaz's
 *   «الإجمالي × (1 − الخصم)» gives the final value back.
 * - bare land or the «أرض فقط» scope: land = total, buildings «لا ينطبق»;
 *   «مباني فقط»: buildings = total, land «لا ينطبق».
 * - land with buildings: land and buildings come from the cost approach (land value, buildings after
 *   depreciation) when it is switched on; market approach alone → both null (the split is not known).
 *
 * Edge cases: no reconciliation or no positive final value → null (the sheet then falls back to the package).
 * A land estimate still incomplete gives no land value. Fixed 2026-11-04: the sheet summed the package's
 * land + buildings, which the new valuation screens leave at «0», so every figure read 0 next to a final value
 * of 2,227,000.
 */
export function infathValuationFigures(input: {
  settings?: Pick<
    ValuationApproachSettingsDto,
    "costApproachEnabled" | "costScopeKey" | "isLandPropertyType" | "hasStructuresToValue"
  > | null;
  recon?: Pick<
    ValuationReconciliationDto,
    | "finalOpinionValue"
    | "finalOpinionBeforeLiquidation"
    | "additionsTotal"
    | "liquidationDiscountApplied"
    | "liquidationDiscountPct"
  > | null;
  cost?: Pick<
    ValuationCostApproachDto,
    "landValueFromMarket" | "landEstimateComplete" | "buildingsValueAfterDepreciation"
  > | null;
}): InfathValuationFigures | null {
  const recon = input.recon ?? null;
  const finalValue = positiveAmount(recon?.finalOpinionValue);
  if (!recon || finalValue == null) return null;
  const pct = positiveAmount(recon.liquidationDiscountPct);
  const discounted = Boolean(recon.liquidationDiscountApplied) && pct != null;
  const before = positiveAmount(recon.finalOpinionBeforeLiquidation);
  // The value before the forced-sale discount. Since 2026-11-10 the server's «before liquidation» already
  // includes the «مستند ذو قيمة» additions (it equals the final value when no discount applies), so the
  // additions are no longer added here — adding them again counted them twice.
  const totalValue = discounted && before != null ? before : finalValue;
  const forced = {
    totalValue,
    forcedDiscountPct: discounted ? pct : null,
    forcedSaleValue: discounted ? finalValue : null,
  };
  const settings = input.settings ?? null;
  const scope = settings?.costScopeKey?.trim() ?? "";
  const bareLand = Boolean(settings?.isLandPropertyType) && !settings?.hasStructuresToValue;
  if (bareLand || scope === "land_only") {
    return {
      ...forced,
      landValue: totalValue,
      buildingsValue: null,
      landNote: "",
      buildingsNote: bareLand ? INFATH_NOT_APPLICABLE_LAND : INFATH_NOT_APPLICABLE_LAND_ONLY_SCOPE,
    };
  }
  if (scope === "building_only") {
    return {
      ...forced,
      landValue: null,
      buildingsValue: totalValue,
      landNote: INFATH_NOT_APPLICABLE_BUILDING_ONLY_SCOPE,
      buildingsNote: "",
    };
  }
  const cost = settings?.costApproachEnabled ? (input.cost ?? null) : null;
  return {
    ...forced,
    landValue:
      cost && cost.landEstimateComplete !== false ? positiveAmount(cost.landValueFromMarket) : null,
    buildingsValue: cost ? positiveAmount(cost.buildingsValueAfterDepreciation) : null,
    landNote: "",
    buildingsNote: "",
  };
}

type InfathEstimateCell = { value: string; state: InfathFieldState };

/** The «تقدير القيمة» rows as the sheet prints them. */
type InfathValueEstimate = {
  land: InfathEstimateCell;
  buildings: InfathEstimateCell;
  total: string;
  forcedDiscount: string;
  forcedSale: string;
};

/**
 * The «تقدير القيمة» rows: from the valuation's results when they were read, else from the appraiser's package.
 *
 * How it works:
 * - With `figures` (see infathValuationFigures): every row comes from them; a value the scope has none of shows its
 *   note («لا ينطبق — …»).
 * - Without: the package's land and buildings when above 0, the total = «سعر التقييم» (the final value), else
 *   land + buildings; the forced-sale value = total × (1 − the package's discount).
 * - Land and buildings that do not add up to the total (the cost approach's split under a weighted final value)
 *   are marked «un» so the specialist checks them before Enfaz sums them.
 *
 * Edge cases and how they were fixed (2026-11-04): the package's land and buildings are «0» by default and were
 * summed into a total of 0 even when the final value was 2,227,000; a «0» now reads as not entered and the total
 * is never 0 while a final value exists. Bare land without figures takes the total as its land value. A discount
 * left in the package after the basis changed is ignored once the figures say the basis has none.
 */
function infathValueEstimate(input: {
  figures: InfathValuationFigures | null;
  appraisalPrice: string;
  landValue: string;
  buildingValue: string;
  forcedDiscount: string;
  bareLand: boolean;
}): InfathValueEstimate {
  const { figures } = input;
  const packageAmount = (raw: string) => positiveAmount(parseNumber(raw));
  const packageLand = packageAmount(input.landValue);
  const packageBuildings = packageAmount(input.buildingValue);
  const total =
    figures?.totalValue ??
    packageAmount(input.appraisalPrice) ??
    (packageLand != null || packageBuildings != null ? (packageLand ?? 0) + (packageBuildings ?? 0) : null);
  const land = figures
    ? figures.landValue
    : (packageLand ?? (input.bareLand ? total : null));
  const buildings = figures ? figures.buildingsValue : packageBuildings;
  const splitDiffers =
    total != null && (land != null || buildings != null) && Math.abs((land ?? 0) + (buildings ?? 0) - total) > 1;
  const cell = (amount: number | null, note: string): InfathEstimateCell =>
    amount != null
      ? { value: formatMoney(amount), state: splitDiffers ? "un" : "" }
      : { value: note, state: note ? "" : "ms" };

  let forcedDiscount: string;
  let forcedSale: string;
  if (figures) {
    forcedDiscount = figures.forcedDiscountPct != null ? `${fmtMax(figures.forcedDiscountPct, 2)}%` : "";
    forcedSale = figures.forcedSaleValue != null ? formatMoney(figures.forcedSaleValue) : "";
  } else {
    forcedDiscount = input.forcedDiscount.trim();
    const pct = forcedDiscount ? parseNumber(forcedDiscount.replace("%", "")) : null;
    forcedSale = total != null && pct != null ? formatMoney(Math.round(total * (1 - pct / 100))) : "";
  }

  return {
    land: cell(land, figures?.landNote ?? ""),
    buildings: cell(buildings, figures?.buildingsNote ?? ""),
    total: total != null ? formatMoney(total) : "",
    forcedDiscount,
    forcedSale,
  };
}

/**
 * The other deeds of this deed's transaction, as «أرقام صكوك الأصول المرتبطة» lists them.
 *
 * How it works: the live deeds of a transaction with two or more (`linkedPropertyDeeds`), minus this deed, by their
 * label (registry number for a registry deed, else the deed number).
 *
 * Edge cases: `undefined` (not loaded yet) → null, so the sheet does not claim «لا» early; no transaction (older
 * rows) or a single live deed → [] («لا»). Added 2026-11-04 — «الأصول المرتبطة» read «غير مُدخل» for a one-deed
 * transaction.
 */
export function infathLinkedDeedLabels(
  transaction: Pick<TransactionDetailDto, "deeds"> | null | undefined,
  propertyId: string,
): string[] | null {
  if (transaction === undefined) return null;
  return linkedPropertyDeeds(transaction)
    .filter((deed) => deed.propertyId !== propertyId)
    .map(transactionDeedLabelOf);
}

/**
 * «الأسلوب المستخدم» for Enfaz — every approach the valuation used, joined as the report's
 * «أساليب التقييم المستخدمة» joins them.
 * How it works: market and cost from the valuation's approach settings (income is not built yet).
 * Edge cases: none switched on → "" (the panel then falls back to the appraiser's package).
 * Fixed 2026-10-28: market + cost used to send only «طريقة المقارنة» (the first method chosen).
 */
export function infathApproachesUsed(settings: {
  marketApproachEnabled?: boolean | null;
  costApproachEnabled?: boolean | null;
}): string {
  const names: string[] = [];
  if (settings.marketApproachEnabled) names.push("أسلوب السوق");
  if (settings.costApproachEnabled) names.push("أسلوب التكلفة");
  return names.join(" و ");
}

export function buildInfathUploadModel(input: {
  record: PoIntakeRecord;
  property: PoPropertyIntake;
  parties: Record<string, PropertyDetailPartySubmission | undefined> | null;
  documentSections: PropertyDetailDocumentSection[];
  /** Court visits + key gate (ops/keys product — not legacy GR package). */
  opsContext?: InfathOpsContext | null;
  /** The specialist's «جدول المكونات» — source of the building areas. */
  componentLines?: BuildingInventoryLineDto[] | null;
  /** What the appraiser's old package used to carry, now read from where it lives (see InfathReportContext). */
  reportContext?: InfathReportContext | null;
  /** Upload files that are not in the documents list (case-study report, certificate, keys proof, survey task). */
  attachmentSources?: InfathAttachmentSources | null;
  /**
   * The other deeds of this deed's transaction (see infathLinkedDeedLabels): [] = a one-deed transaction,
   * null / absent = not known yet.
   */
  linkedDeedLabels?: string[] | null;
}): InfathUploadModel {
  const { record, property, parties, documentSections } = input;
  const ops = input.opsContext ?? null;
  // Gate party packages into Infath only after specialist acceptance.
  const inspection = partyPackageFeedsInfath(parties?.inspection ?? null);
  const survey = partyPackageFeedsInfath(parties?.survey ?? null);
  const appraisal = partyPackageFeedsInfath(parties?.appraisal ?? null);
  const specialist = parties?.specialist ?? null;
  const context = input.reportContext ?? null;
  // Building areas: the specialist's components table; the inspector's old fields only as fallback.
  const componentAreas = infathBuildingAreasFromComponents(input.componentLines ?? []);
  const areaField = (fromTable: string, label: string) =>
    fromTable || partyField(inspection, label);

  const reportNumber =
    partyField(appraisal, "رقم التقرير") ||
    partyField(appraisal, L.reportNumber) ||
    "";
  const coords =
    partyField(inspection, L.mapCoords) ||
    partyField(survey, "الإحداثيات") ||
    "";

  const inspectionDate = partyField(inspection, L.inspectionDate);
  // A retrospective valuation is as of its own date, not the date the package was sent (2026-10-28).
  const retrospectiveDate = (context?.valuationDate ?? "")
    .split(" – ")
    .map((d) => (/^\d{4}-\d{2}-\d{2}$/.test(d.trim()) ? formatDateAr(d.trim()) : d.trim()))
    .filter(Boolean)
    .join(" – ");
  const appraisalDate =
    retrospectiveDate || partyField(appraisal, L.appraisalDate) || partyField(appraisal, "تاريخ الإرسال");
  const visitDate = ops?.courtVisitCompletedAt?.trim()
    ? formatDateAr(ops.courtVisitCompletedAt.trim().slice(0, 10))
    : "";
  const visitDateForReport = inspectionDate || visitDate;
  const appraisalPrice = partyField(appraisal, "سعر التقييم");
  const packageLandValue = partyField(appraisal, L.landValue);
  const packageBuildingValue = partyField(appraisal, L.buildingValue);
  // Only once the valuation feeds Enfaz — the approaches are switched on long before it is final.
  const valuationMethod =
    (appraisal ? context?.approachesUsed?.trim() : "") || partyField(appraisal, L.valuationMethod);
  const valueBasis = partyField(appraisal, L.valueBasis);
  const forcedDiscountRaw = partyField(appraisal, L.forcedDiscount);
  // The approved report's date wins; the appraiser's package keeps the day he handed it over
  // (A→Z 2026-11-04: the two differ whenever the approval falls on a later day).
  const approvedReportDate = ops?.reportDate?.trim() ?? "";
  const reportIssueDate = approvedReportDate
    ? formatDateAr(approvedReportDate)
    : partyField(appraisal, L.reportIssueDate);
  const zoneStatus = partyField(inspection, L.zoneStatus);
  // The use the inspector recorded. Neither the type nor the classification stands in for it, and an
  // old inspection still holding a classification reads as missing.
  const inspectedUsage = propertyUsageValue(partyField(inspection, L.propertyUsage));
  // The specialist's own answer wins; else the transaction says it: other live deeds → «نعم», none → «لا».
  const linkedDeedLabels = input.linkedDeedLabels ?? null;
  const linkedAssetsAnswer =
    partyField(specialist, L.linkedAssets) ||
    (linkedDeedLabels == null ? "" : linkedDeedLabels.length > 0 ? "نعم" : "لا");
  const linkedDeedNumbers =
    partyField(specialist, L.linkedDeedNumbers) ||
    (linkedDeedLabels == null ? "" : linkedDeedLabels.length > 0 ? linkedDeedLabels.join("، ") : "لا يوجد");
  const workerName =
    partyField(appraisal, "المشارك في إعداد التقرير") ||
    partyField(appraisal, "المقيم العقاري") ||
    partyField(appraisal, "اسم المقيّم") ||
    context?.appraiserName?.trim() ||
    "";
  const workerLicense = context?.appraiserLicenseNumber?.trim() ?? "";
  const licenseDateRaw = context?.appraiserLicenseDate?.trim() ?? "";
  const workerLicenseDate = /^\d{4}-\d{2}-\d{2}/.test(licenseDateRaw)
    ? formatDateAr(licenseDateRaw.slice(0, 10))
    : licenseDateRaw;
  // The approved report is the generated final report only — never the appraiser's old stored file.
  const appraisalDocument = input.attachmentSources?.finalReport ?? null;
  const appraisalNotes = partyRemark(appraisal, "ملاحظات المقيّم");
  const keysReceived =
    ops?.keysStatus === PropertyKeysStatuses.Received ||
    ops?.courtVisitResultKind === "received" ||
    Boolean(ops?.keyAvailable);
  const keysReceivedSel = keysReceived
    ? "نعم"
    : ops?.keysStatus === PropertyKeysStatuses.NotRequired
      ? "لا"
      : ops?.keysStatus
        ? "لا"
        : "";
  const specialistRemarks =
    partyRemark(specialist, "ملاحظات") ||
    specialist?.remarks.map((r) => r.value).join("\n") ||
    "";

  const landArea = property.area.trim()
    ? `${property.area.trim()} م²`
    : partyField(inspection, "المساحة الفعلية");

  // Bare land: the inspector's asset (else the bourse type) is land and the specialist listed no components.
  const bareLand =
    isLandInspectionContext({
      assetSubject: partyField(inspection, L.assetSubject),
      classification: property.classification,
      propertyType: property.propertyType,
    }) && (input.componentLines ?? []).length === 0;

  const estimate = infathValueEstimate({
    figures: appraisal ? (context?.valuation ?? null) : null,
    appraisalPrice,
    landValue: packageLandValue,
    buildingValue: packageBuildingValue,
    forcedDiscount: forcedDiscountRaw,
    bareLand,
  });

  const attachments = buildAttachments(
    documentSections,
    keysReceived,
    input.attachmentSources ?? {},
    property.deedNumber,
    infathPhotoBundles(documentSections, property.photoMarks),
    bareLand,
  );
  // A file field names the attachment row's PDF once that row is ready, so the field downloads through the row.
  const readyAttachmentFile = (id: string): string => {
    const row = attachments.find((a) => a.id === id);
    return row?.status === "ready" ? (row.document?.fileName ?? "") : "";
  };

  const deedAreaNum = parseNumber(property.area);
  const siteAreaNum = parseNumber(partyField(inspection, "المساحة الفعلية"));
  const areaDiff =
    deedAreaNum != null && siteAreaNum != null
      ? deedAreaNum === siteAreaNum
        ? "لا"
        : "نعم"
      : "";

  const sections: InfathUploadSection[] = [
    {
      id: "report-meta",
      num: "1",
      title: "بيانات التقرير",
      fields: [
        txt(
          "visit-date",
          L.inspectionDate,
          visitDateForReport,
          "MA",
          "text",
          visitDateForReport ? "" : "un",
        ),
        txt("appraisal-date", L.appraisalDate, appraisalDate, "EV"),
        sel(
          "method",
          L.valuationMethod,
          valuationMethod,
          "EV",
          valuationMethod ? "" : "ms",
        ),
        txt("appraiser-title", L.appraiserAddress, partyField(appraisal, L.appraiserAddress), "SY", "text", partyField(appraisal, L.appraiserAddress) ? "" : "un"),
        txt("appraiser-phone", L.appraiserPhone, partyField(appraisal, L.appraiserPhone), "SY", "text", partyField(appraisal, L.appraiserPhone) ? "" : "un"),
        txt("issue-date", L.reportIssueDate, reportIssueDate, "EV", "text", reportIssueDate ? "" : "ms"),
      ],
      areas: [],
    },
    {
      id: "scope",
      num: "2",
      title: "نطاق العمل",
      fields: [
        auto("report-no", "رقم التقرير", reportNumber),
        txt(
          "deposit-code",
          L.depositCode,
          ops?.depositCode?.trim() || "",
          "EV",
          "text",
          ops?.depositCode?.trim() ? "" : "ms",
        ),
        sel(
          "value-basis",
          L.valueBasis,
          valueBasis,
          "EV",
          valueBasis ? "" : "ms",
        ),
        auto("independence", L.independenceDeclared, "مُؤكَّد", "EV"),
      ],
      areas: [],
    },
    {
      id: "asset",
      num: "3",
      title: "بيانات الأصل",
      fields: [
        sel(
          "asset-type",
          L.assetSubject,
          partyField(inspection, L.assetSubject) || partyField(inspection, "نوع العقار") || property.classification,
          "MA",
        ),
        sel("facade", L.facade, partyField(inspection, L.facade), "MA", partyField(inspection, L.facade) ? "" : "un"),
        txt("street-width", L.streetWidth, partyField(inspection, L.streetWidth), "MA", "text", partyField(inspection, L.streetWidth) ? "" : "ms"),
        // «مساحة البناء» = the floors of the specialist's components table (never the land area); the annexes and
        // basements join it only in «إجمالي مساحة المباني» (section 4). A villa of 180 + 180 m² floors and a 60 m²
        // annex on a 360 m² plot reads 360 here and 420 there (A→Z #86, 2026-11-04: not a bug).
        txt("built-area", L.builtArea, areaField(componentAreas.builtArea, L.builtArea), "MA", "text", areaField(componentAreas.builtArea, L.builtArea) ? "" : "ms"),
        txt("build-license", L.buildLicenseNumber, partyField(inspection, L.buildLicenseNumber), "MA"),
        txt("build-license-date", L.buildLicenseDate, partyField(inspection, L.buildLicenseDate), "MA"),
        sel(
          "usage",
          L.propertyUsage,
          inspectedUsage,
          "MA",
          inspectedUsage ? "" : "ms",
        ),
        txt("street-name", L.streetName, partyField(inspection, L.streetName), "MA"),
        sel(
          "zone-status",
          L.zoneStatus,
          zoneStatus,
          "GR",
          zoneStatus ? "" : "ms",
        ),
        txt("main-street", L.mainStreet, partyField(inspection, L.mainStreet), "MA"),
        txt("map", L.mapCoords, coords, "MA", "text", coords ? "" : "ms"),
        txt("rooms", L.roomCount, partyField(inspection, L.roomCount), "MA"),
        txt("halls", L.hallCount, partyField(inspection, L.hallCount), "MA"),
        txt("units", L.unitCount, partyField(inspection, L.unitCount), "MA"),
        txt("baths", L.bathroomCount, partyField(inspection, L.bathroomCount), "MA"),
        txt("age", L.propertyAge, partyField(inspection, L.propertyAge), "MA"),
        txt("showrooms", L.showroomCount, partyField(inspection, L.showroomCount), "MA"),
        txt("towers", L.towerCount, partyField(inspection, L.towerCount), "MA", "text", partyField(inspection, L.towerCount) ? "" : "ms"),
        txt("wells", L.wellCount, partyField(inspection, L.wellCount), "MA"),
        sel(
          "kitchen",
          L.kitchen,
          partyField(inspection, L.kitchen),
          "MA",
          partyField(inspection, L.kitchen) ? "" : "ms",
        ),
        sel(
          "car-entrance",
          L.carEntrance,
          partyField(inspection, L.carEntrance),
          "MA",
          partyField(inspection, L.carEntrance) ? "" : "ms",
        ),
        sel(
          "basement",
          L.hasBasement,
          partyField(inspection, L.hasBasement),
          "MA",
          partyField(inspection, L.hasBasement) ? "" : "ms",
        ),
        sel(
          "elevator",
          L.hasElevator,
          partyField(inspection, L.hasElevator),
          "MA",
          partyField(inspection, L.hasElevator) ? "" : "ms",
        ),
        sel(
          "pool",
          L.hasPool,
          partyField(inspection, L.hasPool),
          "MA",
          partyField(inspection, L.hasPool) ? "" : "ms",
        ),
        sel(
          "fence",
          L.hasFence,
          partyField(inspection, L.hasFence),
          "MA",
          partyField(inspection, L.hasFence) ? "" : "ms",
        ),
        sel(
          "central-ac",
          L.hasCentralAc,
          partyField(inspection, L.hasCentralAc),
          "MA",
          partyField(inspection, L.hasCentralAc) ? "" : "ms",
        ),
        sel(
          "tanks",
          L.hasTanks,
          partyField(inspection, L.hasTanks),
          "MA",
          partyField(inspection, L.hasTanks) ? "" : "ms",
        ),
        sel(
          "landscaping",
          L.hasLandscaping,
          partyField(inspection, L.hasLandscaping),
          "MA",
          partyField(inspection, L.hasLandscaping) ? "" : "ms",
        ),
        sel(
          "build-state",
          L.buildState,
          partyField(inspection, L.buildState) || partyField(inspection, "الحالة الإنشائية"),
          "MA",
        ),
        sel(
          "occupancy",
          L.occupancyState,
          partyField(inspection, L.occupancyState) || partyField(inspection, "العقار مؤجر"),
          "MA",
        ),
        sel("district-state", L.districtState, partyField(inspection, L.districtState), "MA"),
        sel(
          "movables",
          L.movables,
          partyField(inspection, L.movables) || partyField(inspection, "منقولات داخل العقار"),
          "MA",
        ),
        sel(
          "demand",
          L.demandLevel,
          partyField(appraisal, L.demandLevel) || partyField(inspection, "نشاط السوق"),
          "EV",
        ),
        sel("services", L.services, partyField(inspection, L.services), "MA"),
        sel("amenities", L.amenities, partyField(inspection, L.amenities), "MA"),
      ],
      areas: [
        area(
          "movables-desc",
          L.movablesDescription,
          partyField(inspection, L.movablesDescription),
          "MA",
        ),
        area("desc", L.propertyDescription, partyRemark(inspection, L.propertyDescription), "MA"),
        area("pros-cons", L.districtProsCons, partyRemark(inspection, L.districtProsCons) || partyRemark(inspection, "ملاحظات سوقية"), "MA"),
        area("access", L.accessRoute, partyRemark(inspection, L.accessRoute) || partyField(inspection, "إمكانية الوصول"), "MA"),
        area("asset-notes", L.assetNotes, partyRemark(inspection, L.assetNotes) || partyRemark(inspection, "ملاحظات عامة"), "MA"),
      ],
      // «الأصيل» (the principal source) read as a typo; the open question is which party is this section's source.
      badge: "مصدر البيانات غير محسوم",
    },
    {
      id: "boundaries",
      num: "4",
      title: "الحدود والأطوال للأصل",
      fields: [
        txt("land-area", "مساحة الأرض", landArea, "BR"),
        txt(
          "north",
          L.northBoundary,
          surveyOrPropertyField(survey, property.northBoundary, L.northBoundary),
          "EN",
        ),
        txt(
          "north-len",
          L.northLength,
          surveyOrPropertyField(survey, property.northBoundaryLengthM, L.northLength),
          "EN",
        ),
        txt(
          "south",
          L.southBoundary,
          surveyOrPropertyField(survey, property.southBoundary, L.southBoundary),
          "EN",
        ),
        txt(
          "south-len",
          L.southLength,
          surveyOrPropertyField(survey, property.southBoundaryLengthM, L.southLength),
          "EN",
        ),
        txt(
          "east",
          L.eastBoundary,
          surveyOrPropertyField(survey, property.eastBoundary, L.eastBoundary),
          "EN",
        ),
        txt(
          "east-len",
          L.eastLength,
          surveyOrPropertyField(survey, property.eastBoundaryLengthM, L.eastLength),
          "EN",
        ),
        txt(
          "west",
          L.westBoundary,
          surveyOrPropertyField(survey, property.westBoundary, L.westBoundary),
          "EN",
        ),
        txt(
          "west-len",
          L.westLength,
          surveyOrPropertyField(survey, property.westBoundaryLengthM, L.westLength),
          "EN",
        ),
        txt("floors", L.buildingFloors, areaField(componentAreas.buildingFloors, L.buildingFloors), "MA", "text", areaField(componentAreas.buildingFloors, L.buildingFloors) ? "" : "un"),
        txt("basement-total", L.basementTotal, areaField(componentAreas.basementTotal, L.basementTotal), "MA", "text", areaField(componentAreas.basementTotal, L.basementTotal) ? "" : "un"),
        txt("annex-total", L.annexTotal, areaField(componentAreas.annexTotal, L.annexTotal), "MA", "text", areaField(componentAreas.annexTotal, L.annexTotal) ? "" : "un"),
        txt("buildings-total", L.buildingsTotal, areaField(componentAreas.buildingsTotal, L.buildingsTotal), "MA", "text", areaField(componentAreas.buildingsTotal, L.buildingsTotal) ? "" : "un"),
      ],
      areas: [],
    },
    {
      id: "linked",
      num: "5",
      title: "الأصول المرتبطة",
      fields: [
        sel(
          "linked-q",
          L.linkedAssets,
          linkedAssetsAnswer,
          "SP",
          linkedAssetsAnswer ? "" : "ms",
        ),
        txt("linked-deeds", L.linkedDeedNumbers, linkedDeedNumbers, "SY", "auto"),
      ],
      areas: [
        area("linked-notes", L.linkedAssetsNotes, partyRemark(specialist, L.linkedAssetsNotes), "SP"),
      ],
    },
    {
      id: "valuation",
      num: "6",
      title: "تقدير القيمة",
      fields: [
        txt("land-value", L.landValue, estimate.land.value, "EV", "text", estimate.land.state),
        txt("build-value", L.buildingValue, estimate.buildings.value, "EV", "text", estimate.buildings.state),
        auto("total-value", L.totalValue, estimate.total),
        txt(
          "forced-pct",
          L.forcedDiscount,
          estimate.forcedDiscount,
          "EV",
          "text",
          estimate.forcedDiscount ? "" : "ms",
        ),
        auto("forced-value", L.forcedSaleValue, estimate.forcedSale),
      ],
      areas: [],
    },
    {
      id: "photos",
      num: "7",
      title: "صور الأصل",
      fields: [
        txt("site-text", L.siteLocation, coords || formatPropertyLocation(property), "MA"),
        // The same readiness as the «مرفقات الرفع» rows (fixed 2026-11-04: these read «غير مُدخل» beside a
        // deed row that said «جاهز»).
        file(
          "ext-photo",
          L.exteriorPhotos,
          readyAttachmentFile("exterior-photos") || partyField(inspection, L.exteriorPhotos),
          "MA",
        ),
        file(
          "int-photo",
          L.interiorPhotos,
          readyAttachmentFile("interior-photos") || partyField(inspection, L.interiorPhotos),
          "MA",
        ),
        file("plan-photo", L.planPhoto, partyField(appraisal, L.planPhoto), "EN"),
        file(
          "deed-photo",
          L.deedPhoto,
          readyAttachmentFile("deed") || (property.realEstateRegFileName?.trim() ?? ""),
          "BR",
        ),
      ],
      areas: [],
    },
    {
      id: "workers",
      num: "8",
      title: "بيانات العاملين على التقرير",
      fields: [
        txt("worker-name", "الاسم", workerName, "EV", "text", workerName ? "" : "ms"),
        txt("worker-license", "رقم الترخيص", workerLicense, "EV", "text", workerLicense ? "" : "un"),
        txt("worker-license-date", "تاريخ الترخيص", workerLicenseDate, "EV", "text", workerLicenseDate ? "" : "un"),
        file("worker-license-file", "مرفق الترخيص", "", "EV"),
      ],
      areas: [],
    },
    {
      id: "search-scope",
      num: "9",
      title: "نطاق البحث",
      fields: [],
      areas: [area(
          "search",
          L.searchScope,
          partyRemark(appraisal, L.searchScope) || appraisalNotes,
          "EV",
        )],
    },
    {
      id: "keys",
      num: "10",
      title: "استلام المفاتيح",
      fields: [
        sel(
          "keys-received",
          L.keysReceived,
          keysReceivedSel,
          "GR",
        ),
        ...(keysReceived
          ? [
              file(
                "keys-proof",
                L.keysProof,
                ops?.envelopeId?.trim()
                  ? `ظرف: ${ops.envelopeId.trim()}`
                  : "",
                "GR",
              ),
            ]
          : []),
      ],
      areas: [],
    },
    {
      id: "other",
      num: "11",
      title: "معلومات أخرى",
      fields: [],
      areas: [area("other-notes", L.otherNotes, partyRemark(specialist, L.otherNotes) || specialistRemarks, "SP")],
    },
    {
      id: "closing",
      num: "12",
      title: "البيانات الختامية",
      fields: [],
      areas: [
        area(
          "closing-notes",
          L.closingNotes,
          partyRemark(specialist, L.closingNotes),
          "SP",
        ),
      ],
    },
    {
      id: "appraisal-file",
      num: "13",
      title: "مرفق التقييم المعتمد",
      fields: [
        file(
          "signed-appraisal",
          L.signedAppraisal,
          // The generated final report only. The appraiser's package still names the old
          // system-generated TQ-….pdf (Arabic as boxes, raw field keys); falling back to that name let
          // the field's download button find the old file again, so there is no fallback.
          appraisalDocument?.fileName ?? "",
          "EV",
        ),
        // Only the certificate's file name is known here; the certificate page itself is merged into the final report PDF.
        file(
          "deposit-certificate",
          L.depositCertificate,
          ops?.depositCertificateName?.trim() || "",
          "EV",
        ),
      ],
      areas: [],
    },
    {
      id: "survey-conditional",
      num: "4أ",
      title: "الرفع المساحي (شرطي)",
      conditional: true,
      fields: [
        txt("site-area", L.onSiteArea, partyField(survey, L.onSiteArea) || landArea, "EN"),
        ref("deed-area-ref", L.deedAreaRef, landArea),
        auto("area-diff", L.areaDiff, areaDiff),
        file(
          "survey-file",
          L.surveyFile,
          partyField(survey, L.surveyFile) || partyField(survey, "تقرير الرفع المساحي"),
          "EN",
        ),
      ],
      areas: [
        area(
          "survey-notes",
          L.surveyNotes,
          partyRemark(survey, L.surveyNotes) || partyRemark(survey, "ملاحظة الإرجاع"),
          "EN",
        ),
      ],
    },
  ];

  if (bareLand) markBuildingFieldsNotApplicable(sections);
  // An apartment records no facade (see isApartmentInspectionContext) — the empty row is «لا ينطبق», not missing.
  if (
    isApartmentInspectionContext({
      classification: property.classification,
      propertyType: property.propertyType,
      assetSubject: partyField(inspection, L.assetSubject),
    })
  ) {
    markFieldsNotApplicable(sections, APARTMENT_NA_FIELD_IDS, INFATH_NOT_APPLICABLE_APARTMENT);
  }
  const stats = computeStats(sections);

  const model: InfathUploadModel = {
    sections,
    attachments,
    stats,
    copyableTotal: 0,
    unresolvedPoints: INFAZ_UPLOAD_UNRESOLVED_POINTS,
  };
  model.copyableTotal = countInfathCopyableFields(model);

  return model;
}

export async function copyInfathText(text: string): Promise<boolean> {
  if (navigator.clipboard?.writeText) {
    try {
      await navigator.clipboard.writeText(text);
      return true;
    } catch {
      /* fallback */
    }
  }
  const textarea = document.createElement("textarea");
  textarea.value = text;
  document.body.appendChild(textarea);
  textarea.select();
  try {
    const copied = document.execCommand("copy");
    document.body.removeChild(textarea);
    return copied;
  } catch {
    document.body.removeChild(textarea);
    return false;
  }
}

/** Saves bytes under a file name through a temporary object URL. */
export function saveInfathBlob(blob: Blob, fileName: string): void {
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = fileName;
  anchor.click();
  // Give the browser time to start the download before the URL is released.
  setTimeout(() => URL.revokeObjectURL(url), 60_000);
}

/**
 * Downloads one document of the upload sheet; resolves to whether a file was saved.
 *
 * How it works: a stored file (`attachmentId`) is fetched from the attachments service and saved under the
 * document's file name; otherwise the bytes already in `dataUrl` are saved.
 *
 * Edge cases and how they were fixed: this used to save `dataUrl` only. For a PDF that is the first-page preview
 * picture, so the «deed» saved was an image; and a file that this browser had not previewed could not be
 * downloaded at all. The stored file now always wins. A failed fetch resolves `false` so the caller can say so.
 */
export async function downloadInfathDocument(
  doc: PropertyDetailDocumentEntry | null | undefined,
): Promise<boolean> {
  if (!doc) return false;
  const fileName = doc.fileName || doc.name;
  const attachmentId = doc.attachmentId?.trim();
  if (attachmentId) {
    const config = prototypeModulesApiConfig();
    if (!config) return false;
    const res = await downloadAttachmentBlobOnce(config, attachmentId);
    if (!res.ok) return false;
    saveInfathBlob(res.data, fileName);
    return true;
  }
  if (!doc.dataUrl) return false;
  const anchor = document.createElement("a");
  anchor.href = doc.dataUrl;
  anchor.download = fileName;
  anchor.click();
  return true;
}
