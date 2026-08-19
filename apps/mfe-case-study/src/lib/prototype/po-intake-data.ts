/** PO intake wizard — steps and reference lists (from system requirements v1.2). */

import {
  basisOfValueKeyForAssignment,
  basisOfValueLabelArForAssignment,
  valuationPurposeKeyForAssignment,
  valuationPurposeLabelArForAssignment,
} from "@platform/app-shared/prototype/assignment-valuation-defaults";
import { getCachedOrganizationSla } from "@platform/app-shared/organization/organization-settings-cache";
import {
  INFATH_SEED_CLIENT_ID,
  NABR_SEED_CLIENT_ID,
  PropertyListRowStatuses,
  type PropertyListRowStatus,
} from "@platform/api-client";

export function formatPoDisplay(poNumber: string): string {
  const n = poNumber.trim();
  if (!n) return "";
  if (/^PO[-\s]/i.test(n)) return n;
  return `PO-${n}`;
}

export const ASSIGNMENT_TYPE_OPTIONS = [
  "تنفيذ",
  "تركات",
  "قطاع خاص",
] as const;

export type AssignmentType = (typeof ASSIGNMENT_TYPE_OPTIONS)[number];

/** Primary classification on the work order (spec v2). */
export const ASSIGNMENT_PRIMARY_OPTIONS = ["تنفيذ", "خاص"] as const;
export type AssignmentPrimary = (typeof ASSIGNMENT_PRIMARY_OPTIONS)[number];

/** Subtype shown in the UI — stored as AssignmentType. */
export type AssignmentSecondary = "تنفيذ" | "تركات" | "خاص";

export function assignmentPrimary(type: AssignmentType): AssignmentPrimary {
  return type === "قطاع خاص" ? "خاص" : "تنفيذ";
}

export function assignmentSecondary(type: AssignmentType): AssignmentSecondary {
  if (type === "تركات") return "تركات";
  if (type === "قطاع خاص") return "خاص";
  return "تنفيذ";
}

export function assignmentCompositeTag(type: AssignmentType): string {
  return `${assignmentPrimary(type)} / ${assignmentSecondary(type)}`;
}

export function secondaryOptionsForPrimary(
  primary: AssignmentPrimary,
): AssignmentSecondary[] {
  return primary === "خاص" ? ["خاص"] : ["تنفيذ", "تركات"];
}

export function assignmentTypeFromParts(
  primary: AssignmentPrimary,
  secondary: AssignmentSecondary,
): AssignmentType {
  if (primary === "خاص" || secondary === "خاص") return "قطاع خاص";
  if (secondary === "تركات") return "تركات";
  return "تنفيذ";
}

/** Infath + خاص: Nabr is the sub-client and extra report user. */
export function showsValuationReportUserField(
  type: AssignmentType | "",
  clientId: string,
): boolean {
  return (
    isInfathClient(clientId) &&
    type !== "" &&
    assignmentPrimary(type) === "خاص"
  );
}

export function isInfathClient(clientId: string): boolean {
  return clientId.trim() === INFATH_SEED_CLIENT_ID;
}

export function isNabrClient(clientId: string): boolean {
  return clientId.trim() === NABR_SEED_CLIENT_ID;
}

/** Nabr is Infath's sub-client for now — not a peer work-order client. */
export function isSelectableWorkOrderClient(
  clientId: string,
  currentClientId = "",
): boolean {
  return !isNabrClient(clientId) || clientId === currentClientId;
}

/** Infath's known sub-client. Direct-Nabr-as-peer-client is deferred. */
export const INFATH_SUB_CLIENT_IDS = [NABR_SEED_CLIENT_ID] as const;

export function showsSubClientField(
  type: AssignmentType | "",
  clientId: string,
): boolean {
  return showsValuationReportUserField(type, clientId);
}

export function defaultSubClientId(): string {
  return NABR_SEED_CLIENT_ID;
}

export function subClientIdFromReportUsers(
  reportUserClientIds: string[] | undefined,
): string {
  const match = (reportUserClientIds ?? []).find((id) =>
    (INFATH_SUB_CLIENT_IDS as readonly string[]).includes(id),
  );
  return match ?? defaultSubClientId();
}

export const VALUATION_REPORT_USER_OPTION_LABEL =
  "مركز الإسناد والتصفية (إنفاذ) و شركة نبر العقارية";

/**
 * Infath + تنفيذ → none (report is Infath alone).
 * Infath + خاص → Nabr (usage: Infath client + Nabr report user).
 */
export function reportUserClientIdsForAssignment(
  type: AssignmentType | "",
  clientId: string,
  subClientId: string = NABR_SEED_CLIENT_ID,
): string[] {
  if (!showsValuationReportUserField(type, clientId)) return [];
  return [subClientId.trim() || NABR_SEED_CLIENT_ID];
}

export const VALUATION_PURPOSE_AUCTION_LIQUIDATION =
  "البيع بالمزاد العلني لغرض التصفية";
export const VALUATION_PURPOSE_SALE = "البيع";
export const VALUE_BASIS_MARKET = "القيمة السوقية";
export const VALUE_BASIS_LIQUIDATION = "قيمة التصفية";

export function valuationPurposeForAssignment(
  type: AssignmentType,
  subClientId?: string,
): {
  key: string;
  label: string;
} {
  return {
    key: valuationPurposeKeyForAssignment(type, subClientId),
    label: valuationPurposeLabelArForAssignment(type, subClientId),
  };
}

export function basisOfValueForAssignment(
  type: AssignmentType,
  subClientId?: string,
): {
  key: string;
  label: string;
} {
  return {
    key: basisOfValueKeyForAssignment(type, subClientId),
    label: basisOfValueLabelArForAssignment(type, subClientId),
  };
}

/** Court path: request number + court/circuit + assignment decision + visits/keys. */
export function isCourtAssignmentPath(type: AssignmentType): boolean {
  return type === "تنفيذ";
}

export function requiresAssignmentDecree(type: AssignmentType): boolean {
  return isCourtAssignmentPath(type);
}

/** Court and circuit — execution path only. */
export function showsCourtFields(type: AssignmentType): boolean {
  return isCourtAssignmentPath(type);
}

export function requiresRequestNumberField(type: AssignmentType): boolean {
  return isCourtAssignmentPath(type);
}

/** Contact officer required for execution and estates; optional for private sector. */
export function requiresContacts(type: AssignmentType): boolean {
  return type !== "قطاع خاص";
}

export function businessDaysForAssignmentType(type: AssignmentType): number {
  // Defaults 4/10; overridden by OrganizationSettings when the cache is warm.
  const sla = getCachedOrganizationSla();
  return type === "قطاع خاص"
    ? Math.max(1, sla.privateSectorBusinessDays)
    : Math.max(1, sla.defaultBusinessDays);
}

export const DEED_STATUS_OPTIONS = ["فعال", "موقوف", "قيد التحقق"] as const;

/** Bourse data — deed validity before path completion. */
export type BourseDeedVitality = "active" | "inactive";

export const BOURSE_DEED_VITALITY_ACTIVE = "الصك فعال";
export const BOURSE_DEED_VITALITY_INACTIVE = "الصك غير فعال";
export const BOURSE_OBSTRUCTION_LABEL = "متعذر";

export const RESTRICTIONS_PRESENT_OPTIONS = [
  { value: "yes", label: "توجد قيود" },
  { value: "no", label: "لا توجد قيود" },
] as const;

export const RESTRICTION_TYPE_OPTIONS = [
  { value: "mortgaged", label: "مرهون" },
  { value: "seized", label: "محجوز" },
  { value: "suspended", label: "موقوف" },
  { value: "other", label: "أخرى" },
] as const;

export type RestrictionTypeValue =
  (typeof RESTRICTION_TYPE_OPTIONS)[number]["value"];

const RESTRICTION_TYPE_VALUE_SET = new Set<string>(
  RESTRICTION_TYPE_OPTIONS.map((o) => o.value),
);

/** Restriction types stored comma-separated — multi-select support. */
export function parseRestrictionTypes(value: string): RestrictionTypeValue[] {
  const seen = new Set<string>();
  const out: RestrictionTypeValue[] = [];
  for (const part of value.split(/[,،]/)) {
    const v = part.trim().toLowerCase();
    if (!v || !RESTRICTION_TYPE_VALUE_SET.has(v) || seen.has(v)) continue;
    seen.add(v);
    out.push(v as RestrictionTypeValue);
  }
  return out;
}

export function joinRestrictionTypes(
  values: readonly string[],
): string {
  const seen = new Set<string>();
  const out: string[] = [];
  for (const raw of values) {
    const v = raw.trim().toLowerCase();
    if (!v || !RESTRICTION_TYPE_VALUE_SET.has(v) || seen.has(v)) continue;
    seen.add(v);
    out.push(v);
  }
  return out.join(",");
}

export function hasRestrictionType(
  stored: string,
  type: RestrictionTypeValue,
): boolean {
  return parseRestrictionTypes(stored).includes(type);
}

export function toggleRestrictionType(
  stored: string,
  type: RestrictionTypeValue,
): string {
  const current = parseRestrictionTypes(stored);
  const next = current.includes(type)
    ? current.filter((t) => t !== type)
    : [...current, type];
  return joinRestrictionTypes(next);
}

export const BOUNDARIES_AVAILABILITY_OPTIONS = [
  { value: "deed", label: "موضحة في الصك" },
  { value: "bourse", label: "موضحة في البورصة" },
  { value: "doc", label: "مستند خارجي" },
  { value: "no", label: "غير متوفرة" },
] as const;

/** Mock courts and circuits — replace with supervisor-managed list. */
export const COURTS_BY_CITY: Record<
  string,
  { court: string; circuits: string[] }[]
> = {
  "مكة المكرمة": [
    {
      court: "محكمة التنفيذ بمكة المكرمة",
      circuits: ["الدائرة الأولى", "الدائرة الثانية"],
    },
    {
      court: "محكمة الاستئناف بمكة المكرمة",
      circuits: ["دائرة الأحوال"],
    },
  ],
  جدة: [
    {
      court: "محكمة التنفيذ بجدة",
      circuits: ["الدائرة الأولى", "الدائرة الثانية", "الدائرة الثالثة"],
    },
  ],
  الرياض: [
    {
      court: "محكمة التنفيذ بالرياض",
      circuits: ["الدائرة الأولى", "الدائرة الثانية"],
    },
  ],
  الطائف: [
    { court: "محكمة التنفيذ بالطائف", circuits: ["الدائرة الأولى"] },
  ],
};

/** Demo deed number — shows incomplete status on the property list. */
export const INCOMPLETE_CONTACT_MARKER_PHONE = "0500000000";

export const CONTACT_ROLE_OPTIONS = [
  "مالك",
  "وكيل",
  "ممثل قانوني",
  "وارث",
  "وصي",
  "شاهد",
  "أخرى",
] as const;

export type PoContact = {
  name: string;
  /** Officer capacity — required */
  role: string;
  phone: string;
};

/** Survey lift not required for a unit inside a building. */
export function classificationRequiresSurvey(classification: string): boolean {
  return classification.trim() !== "وحدة داخل مبنى";
}

export type PropertyIdentifierType = "deed" | "real_estate_reg" | "bourse_inquiry";

export const BOURSE_INQUIRY_IDENTIFIER_STATUS = "قيد الدراسة";

export function isBourseInquiryIdentifier(
  type: PropertyIdentifierType,
): boolean {
  return type === "bourse_inquiry";
}

/** Registered title — skips bourse and goes straight to transaction distribution. */
export function skipsBourseForIdentifier(
  type: PropertyIdentifierType,
): boolean {
  return type === "real_estate_reg";
}

/** Skip bourse when real-estate registration number is filled. */
export function propertySkipsBourse(property: {
  realEstateRegNumber: string;
  identifierType: PropertyIdentifierType;
}): boolean {
  return (
    property.realEstateRegNumber.trim().length > 0 ||
    skipsBourseForIdentifier(property.identifierType)
  );
}

export function parsePropertyIdentifierType(
  value: string | undefined,
): PropertyIdentifierType {
  if (value === "real_estate_reg") return "real_estate_reg";
  if (value === "bourse_inquiry") return "bourse_inquiry";
  return "deed";
}

export function identifierTypeLabel(type: PropertyIdentifierType): string {
  if (type === "real_estate_reg") return "تسجيل عيني";
  if (type === "bourse_inquiry") return "البورصة العقاريه";
  return "صك ملكية";
}

/** Display label — deed number, else registration; under-study for empty bourse path. */
export function formatPropertyDeedDisplay(
  property: Pick<
    PoPropertyIntake,
    "identifierType" | "deedNumber" | "realEstateRegNumber"
  >,
): string {
  const deed = property.deedNumber.trim();
  if (deed && !deed.startsWith("INQ-")) return deed;
  const reg = property.realEstateRegNumber?.trim() ?? "";
  if (reg) return reg;
  if (
    isBourseInquiryIdentifier(property.identifierType) ||
    deed.startsWith("INQ-")
  ) {
    return BOURSE_INQUIRY_IDENTIFIER_STATUS;
  }
  return deed || "—";
}

export function formatPendingBourseDeedDisplay(item: {
  identifierType?: string;
  deedNumber: string;
  realEstateRegNumber?: string;
}): string {
  return formatPropertyDeedDisplay({
    identifierType: parsePropertyIdentifierType(item.identifierType),
    deedNumber: item.deedNumber,
    realEstateRegNumber: item.realEstateRegNumber ?? "",
  });
}

export const DEED_NUMBER_DIGIT_LENGTH = 12;
export const REAL_ESTATE_REG_NUMBER_DIGIT_LENGTH = 16;

const ARABIC_DIGITS = "٠١٢٣٤٥٦٧٨٩";

function toLatinDigits(value: string): string {
  return value.replace(/[٠-٩]/g, (ch) => String(ARABIC_DIGITS.indexOf(ch)));
}

export function requiredPropertyIdentifierDigitLength(
  identifierType: PropertyIdentifierType,
): number {
  return identifierType === "real_estate_reg"
    ? REAL_ESTATE_REG_NUMBER_DIGIT_LENGTH
    : DEED_NUMBER_DIGIT_LENGTH;
}

export function propertyIdentifierFieldLabel(
  identifierType: PropertyIdentifierType,
): string {
  return identifierType === "real_estate_reg"
    ? "تسجيل عيني"
    : "رقم الصك";
}

/** Table column headers — includes deed and registered title. */
export const PROPERTY_IDENTIFIER_COLUMN_LABEL = "رقم الصك/التسجيل العيني";

/** Digits only — used while typing (max length enforced). */
export function sanitizePropertyIdentifierInput(
  value: string,
  identifierType: PropertyIdentifierType,
): string {
  const maxLen = requiredPropertyIdentifierDigitLength(identifierType);
  return toLatinDigits(value).replace(/\D/g, "").slice(0, maxLen);
}

export function normalizePropertyIdentifierNumber(
  value: string,
  identifierType: PropertyIdentifierType,
): string {
  return sanitizePropertyIdentifierInput(value, identifierType);
}

export function validatePropertyIdentifierNumber(
  identifierType: PropertyIdentifierType,
  value: string,
): string | undefined {
  const label = propertyIdentifierFieldLabel(identifierType);
  const requiredLen = requiredPropertyIdentifierDigitLength(identifierType);
  const digits = normalizePropertyIdentifierNumber(value, identifierType);
  if (!digits) return `${label} مطلوب`;
  if (digits.length !== requiredLen) {
    return `${label} يجب أن يكون ${requiredLen} رقماً`;
  }
  return undefined;
}

export function restrictionsPresentLabel(value: string): string {
  const v = value.trim();
  if (!v) return "";
  return (
    RESTRICTIONS_PRESENT_OPTIONS.find((o) => o.value === v)?.label ?? v
  );
}

/** Unified display for restrictions + type + other reason. */
export function formatPropertyRestrictionsLine(
  property: Pick<
    PoPropertyIntake,
    "restrictionsPresent" | "restrictionType" | "restrictionOtherReason"
  >,
): string {
  const present = property.restrictionsPresent.trim().toLowerCase();
  if (present === "no") return "لا توجد قيود";
  if (present !== "yes") return restrictionsPresentLabel(property.restrictionsPresent);

  const types = parseRestrictionTypes(property.restrictionType);
  if (types.length === 0) return "توجد قيود";

  const labels = types.map((t) => {
    if (t === "other") {
      const reason = property.restrictionOtherReason.trim();
      return reason ? `أخرى — ${reason}` : "أخرى";
    }
    return RESTRICTION_TYPE_OPTIONS.find((o) => o.value === t)?.label ?? t;
  });
  return labels.join(" · ");
}

export function boundariesAvailabilityLabel(value: string): string {
  const v = value.trim();
  if (!v) return "";
  return (
    BOUNDARIES_AVAILABILITY_OPTIONS.find((o) => o.value === v)?.label ?? v
  );
}

/** Shown on deed / bourse / external doc — boundary details optional. */
export function boundariesDetailFieldsOptional(value: string): boolean {
  const v = value.trim().toLowerCase();
  return v === "deed" || v === "bourse" || v === "doc";
}

export function boundariesMarkedUnavailable(value: string): boolean {
  return value.trim().toLowerCase() === "no";
}

/** Boundary and length input rows — bourse stage (specialist). */
export const PROPERTY_BOUNDARY_ROWS = [
  {
    descKey: "northBoundary",
    lenKey: "northBoundaryLengthM",
    typeKey: "northBoundaryType",
    facadeKey: "northFacadeFinishing",
    label: "الحد الشمالي",
  },
  {
    descKey: "southBoundary",
    lenKey: "southBoundaryLengthM",
    typeKey: "southBoundaryType",
    facadeKey: "southFacadeFinishing",
    label: "الحد الجنوبي",
  },
  {
    descKey: "eastBoundary",
    lenKey: "eastBoundaryLengthM",
    typeKey: "eastBoundaryType",
    facadeKey: "eastFacadeFinishing",
    label: "الحد الشرقي",
  },
  {
    descKey: "westBoundary",
    lenKey: "westBoundaryLengthM",
    typeKey: "westBoundaryType",
    facadeKey: "westFacadeFinishing",
    label: "الحد الغربي",
  },
] as const;

export const PROPERTY_BOUNDARY_TYPE_OPTIONS = [
  { value: "", label: "—" },
  { value: "street", label: "شارع" },
  { value: "plot", label: "قطعة" },
  { value: "passage", label: "ممر" },
  { value: "rail", label: "سكة" },
] as const;

export const PROPERTY_FINISHING_TYPE_OPTIONS = [
  { value: "", label: "—" },
  { value: "luxury", label: "فاخر" },
  { value: "medium", label: "متوسط" },
  { value: "ordinary", label: "عادي" },
  { value: "none", label: "بدون تشطيب" },
] as const;

export const PROPERTY_FINISHING_STRUCTURE_OPTIONS = [
  { value: "", label: "—" },
  { value: "concrete", label: "خرساني" },
  { value: "metal", label: "معدني" },
  { value: "mixed", label: "مختلط" },
  { value: "other", label: "أخرى" },
] as const;

export type PropertyBoundaryDescKey =
  (typeof PROPERTY_BOUNDARY_ROWS)[number]["descKey"];
export type PropertyBoundaryLenKey =
  (typeof PROPERTY_BOUNDARY_ROWS)[number]["lenKey"];
export type PropertyBoundaryTypeKey =
  (typeof PROPERTY_BOUNDARY_ROWS)[number]["typeKey"];
export type PropertyBoundaryFacadeKey =
  (typeof PROPERTY_BOUNDARY_ROWS)[number]["facadeKey"];

export function clearPropertyBoundaryFields(): Pick<
  PoPropertyIntake,
  | PropertyBoundaryDescKey
  | PropertyBoundaryLenKey
  | PropertyBoundaryTypeKey
  | PropertyBoundaryFacadeKey
> {
  return {
    northBoundary: "",
    northBoundaryLengthM: "",
    northBoundaryType: "",
    northFacadeFinishing: "",
    southBoundary: "",
    southBoundaryLengthM: "",
    southBoundaryType: "",
    southFacadeFinishing: "",
    eastBoundary: "",
    eastBoundaryLengthM: "",
    eastBoundaryType: "",
    eastFacadeFinishing: "",
    westBoundary: "",
    westBoundaryLengthM: "",
    westBoundaryType: "",
    westFacadeFinishing: "",
  };
}

/** Approximate map link from city and district (until a precise site URL is provided). */
export function approximatePropertyMapSearchUrl(
  property: Pick<PoPropertyIntake, "city" | "district">,
): string | null {
  const query = [property.district.trim(), property.city.trim(), "السعودية"]
    .filter(Boolean)
    .join("، ");
  if (!query) return null;
  return `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(query)}`;
}

const CITY_GEO: Record<string, [number, number]> = {
  الرياض: [24.7136, 46.6753],
  جدة: [21.4858, 39.1925],
  "مكة المكرمة": [21.3891, 39.8579],
  مكة: [21.3891, 39.8579],
  الطائف: [21.2703, 40.4158],
  الدمام: [26.4207, 50.0888],
  المدينة: [24.5247, 39.5692],
  "المدينة المنورة": [24.5247, 39.5692],
  الخبر: [26.2172, 50.1971],
  أبها: [18.2164, 42.5053],
  تبوك: [28.3838, 36.555],
  حائل: [27.5114, 41.7208],
  بريدة: [26.326, 43.975],
  نجران: [17.5656, 44.2289],
  جازان: [16.8894, 42.5706],
};

/**
 * Approximate lat/lng for OSM embed (city centroid + deed-based jitter).
 * Matches Case Study.html CITY_GEO heuristic until real coordinates exist.
 */
export function approximatePropertyGeo(
  property: Pick<PoPropertyIntake, "city" | "deedNumber">,
): { lat: number; lng: number } | null {
  const city = property.city.trim();
  if (!city) return null;
  const base = CITY_GEO[city] ?? [24.7136, 46.6753];
  let seed = 0;
  const deed = property.deedNumber.trim() || city;
  for (let i = 0; i < deed.length; i += 1) {
    seed += deed.charCodeAt(i) * (i + 1);
  }
  return {
    lat: base[0] + ((seed % 37) - 18) / 1000,
    lng: base[1] + ((seed % 53) - 26) / 1000,
  };
}

function formatDmsComponent(dec: number, pos: string, neg: string): string {
  const a = Math.abs(dec);
  const d = Math.floor(a);
  const m = Math.floor((a - d) * 60);
  const s = ((a - d) * 60 - m) * 60;
  return `${d}°${m}'${s.toFixed(1)}"${dec >= 0 ? pos : neg}`;
}

/** Case Study.html coord DMS line under the map. */
export function formatGeoDms(lat: number, lng: number): string {
  return `${formatDmsComponent(lat, "N", "S")} ${formatDmsComponent(lng, "E", "W")}`;
}

/** Decimal coords for display / clipboard (HTML coord-copy). */
export function formatGeoDec(lat: number, lng: number): string {
  return `${lat.toFixed(6)}, ${lng.toFixed(6)}`;
}

/** Short property description under the main photo (HTML property description). */
export function buildPropertyDescriptionLine(
  property: Pick<
    PoPropertyIntake,
    "propertyType" | "classification" | "area" | "district" | "bourseDataCompleted"
  >,
  inspectorDescription?: string,
): string {
  const fromInspector = inspectorDescription?.trim();
  if (fromInspector) return fromInspector;
  if (!property.bourseDataCompleted) {
    return "يُحدَّث وصف العقار بعد اكتمال استعلام البورصة وتقرير المعاين.";
  }
  const parts = [
    property.propertyType.trim(),
    property.classification.trim(),
  ].filter(Boolean);
  const head = parts.join(" ");
  const area = property.area.trim()
    ? `مساحة ${property.area.trim()} م²`
    : "";
  const district = property.district.trim()
    ? `بحي ${property.district.trim()}`
    : "";
  const body = [head, area, district].filter(Boolean).join("، ");
  if (!body) return "يُحدَّث الوصف التفصيلي من تقرير المعاين.";
  return `${body}. يُحدَّث الوصف التفصيلي من تقرير المعاين.`;
}

/** Case Study.html PSTATUS labels for the property hero. */
export type PropertyUiStatus = PropertyListRowStatus;

export function propertyUiStatusLabel(status: PropertyUiStatus): string {
  switch (status) {
    case PropertyListRowStatuses.Progress:
      return "قيد العمل";
    case PropertyListRowStatuses.Done:
      return "مكتمل";
    case PropertyListRowStatuses.Fail:
      return "متعذر";
    case PropertyListRowStatuses.Incomplete:
      return "ناقص";
    default:
      return "جديد";
  }
}

export function propertyUiStatusTone(
  status: PropertyUiStatus,
): "teal" | "amber" | "red" | "gray" {
  if (status === PropertyListRowStatuses.Done) return "teal";
  if (status === PropertyListRowStatuses.Fail) return "red";
  if (
    status === PropertyListRowStatuses.Progress ||
    status === PropertyListRowStatuses.Incomplete
  )
    return "amber";
  return "gray";
}

/** Ownership status — derived temporarily until a dedicated API field exists. */
export function ownershipStatusLabel(
  property: Pick<PoPropertyIntake, "ownerName" | "deedStatus">,
): string {
  if (property.deedStatus.trim()) return property.deedStatus.trim();
  if (property.ownerName.trim()) return "مسجّل";
  return "";
}

/** Any field filled on bourse inquiry (even before save-and-complete). */
export function hasBourseDetailFields(
  property: Pick<
    PoPropertyIntake,
    | "city"
    | "district"
    | "classification"
    | "propertyType"
    | "area"
    | "deedStatus"
    | "restrictionsPresent"
    | "boundariesAvailability"
    | "boundariesExternalDocName"
    | "planNumber"
    | "plotNumber"
    | PropertyBoundaryDescKey
    | PropertyBoundaryLenKey
  >,
): boolean {
  return Boolean(
    property.city.trim() ||
      property.district.trim() ||
      property.classification.trim() ||
      property.propertyType.trim() ||
      property.area.trim() ||
      property.deedStatus.trim() ||
      property.restrictionsPresent.trim() ||
      property.boundariesAvailability.trim() ||
      property.boundariesExternalDocName.trim() ||
      property.planNumber.trim() ||
      property.plotNumber.trim() ||
      property.northBoundary.trim() ||
      property.northBoundaryLengthM.trim() ||
      property.southBoundary.trim() ||
      property.southBoundaryLengthM.trim() ||
      property.eastBoundary.trim() ||
      property.eastBoundaryLengthM.trim() ||
      property.westBoundary.trim() ||
      property.westBoundaryLengthM.trim(),
  );
}

export function formatPropertyLocation(
  property: Pick<PoPropertyIntake, "city" | "district" | "bourseDataCompleted">,
): string {
  const loc = [property.city, property.district]
    .map((s) => s.trim())
    .filter(Boolean)
    .join(" · ");
  if (loc) return loc;
  if (!property.bourseDataCompleted) return "بانتظار البورصة";
  return "";
}

export function formatPropertyTypeLine(property: Pick<
  PoPropertyIntake,
  "classification" | "propertyType"
>): string {
  const typeLabel = property.propertyType.trim() || property.classification.trim();
  if (property.classification.trim() && property.propertyType.trim()) {
    return `${property.classification.trim()} · ${property.propertyType.trim()}`;
  }
  return typeLabel || "";
}

export type PoPropertyIntake = {
  id: string;
  identifierType: PropertyIdentifierType;
  deedNumber: string;
  requestNumber: string;
  /** When false, request number may be skipped (not required). */
  hasRequestNumber: boolean;
  assignmentMandateNumber: string;
  assignmentMandateDate: string;
  deedDate: string;
  /** Real-estate registration number — registered-title path. */
  realEstateRegNumber: string;
  /** Real-estate registration date — registered-title path. */
  realEstateRegDate: string;
  ownerName: string;
 /** traditional | registered_title ("" = use suggestion). */
  deedKind: string;
  suggestedDeedKind: string;
 /** JSON array [{name, sharePct}] (flat-draft representation). */
  ownersJson: string;
  /** Effective نوع الملكية from the API ("" until loaded). */
  ownershipType: string;
  suggestedOwnershipType: string;
  ownershipTypeIsManual: boolean;
  restrictionsPresent: string;
  restrictionType: string;
  restrictionOtherReason: string;
  boundariesAvailability: string;
  boundariesExternalDocName: string;
  northBoundary: string;
  northBoundaryLengthM: string;
  northBoundaryType: string;
  northFacadeFinishing: string;
  southBoundary: string;
  southBoundaryLengthM: string;
  southBoundaryType: string;
  southFacadeFinishing: string;
  eastBoundary: string;
  eastBoundaryLengthM: string;
  eastBoundaryType: string;
  eastFacadeFinishing: string;
  westBoundary: string;
  westBoundaryLengthM: string;
  westBoundaryType: string;
  westFacadeFinishing: string;
  city: string;
  /** Region name snapshot from the catalog. */
  region: string;
  district: string;
  deedStatus: string;
  area: string;
  court: string;
  circuit: string;
  /** Courts catalog — court ref (optional). */
  courtId: string;
  /** Courts catalog — circuit ref (optional). */
  circuitId: string;
  /** Regions catalog — region ref. */
  regionId: string;
  /** Cities catalog — city ref. */
  cityId: string;
  /** Districts catalog — district ref (optional until approved). */
  districtId: string;
  classification: string;
  propertyType: string;
  assignmentDocFileNames: string[];
  delegationLetterFileNames: string[];
  otherDocumentFileNames: string[];
  realEstateRegFileName: string;
  /** Ownership deed image — initial-data attachment (optional). */
  deedOwnershipFileName: string;
  /** Deed image from bourse — bourse-inquiry attachment (required). */
  bourseDeedImageFileName: string;
  planNumber: string;
  planName: string;
  plotNumber: string;
  blockNumber: string;
  locationMapUrl: string;
  finishingType: string;
  finishingStructure: string;
  bourseDataCompleted: boolean;
  /** Soft-deleted from active queues — still listed on PO properties. */
  isRemoved: boolean;
  removalReason: string;
  removedAtUtc: string;
  contacts: PoContact[];
};

export type PoIntakeRecord = {
  id: string;
  poNumber: string;
  assignmentType: AssignmentType;
  promulgationDate: string;
  receivedFromEnfathAt: string;
  /** Receipt time (HH:mm) — optional; used in due-date calculation */
  receivedFromEnfathTime: string;
  assignmentSpecialist: string;
  assignmentSpecialistEmail: string;
  expectedPropertyCount: number;
  /** Optional text — properties region */
  propertiesRegion: string;
  /** Optional text — work-order description */
  workOrderDescription: string;
  /** Registered client id — required on create/update */
  clientId: string;
 /** report users (0..n) from the client registry. */
  reportUserClientIds: string[];
  /** Denormalized client name from API when available */
  clientNameAr?: string;
  dueDateAt: string;
  properties: PoPropertyIntake[];
  createdAtUtc: string;
};

function newPropertyId(): string {
  if (typeof crypto !== "undefined" && "randomUUID" in crypto) {
    return crypto.randomUUID();
  }
  return `p-${Date.now()}-${Math.random().toString(36).slice(2, 9)}`;
}

export function emptyProperty(): PoPropertyIntake {
  return {
    id: newPropertyId(),
    identifierType: "deed",
    deedNumber: "",
    requestNumber: "",
    hasRequestNumber: true,
    assignmentMandateNumber: "",
    assignmentMandateDate: "",
    deedDate: "",
    realEstateRegNumber: "",
    realEstateRegDate: "",
    ownerName: "",
    deedKind: "",
    suggestedDeedKind: "",
    ownersJson: "",
    ownershipType: "",
    suggestedOwnershipType: "",
    ownershipTypeIsManual: false,
    restrictionsPresent: "",
    restrictionType: "",
    restrictionOtherReason: "",
    boundariesAvailability: "",
    boundariesExternalDocName: "",
    ...clearPropertyBoundaryFields(),
    city: "",
    region: "",
    district: "",
    deedStatus: "",
    area: "",
    court: "",
    circuit: "",
    courtId: "",
    circuitId: "",
    regionId: "",
    cityId: "",
    districtId: "",
    classification: "",
    propertyType: "",
    assignmentDocFileNames: [],
    delegationLetterFileNames: [],
    otherDocumentFileNames: [],
    realEstateRegFileName: "",
    deedOwnershipFileName: "",
    bourseDeedImageFileName: "",
    planNumber: "",
    planName: "",
    plotNumber: "",
    blockNumber: "",
    locationMapUrl: "",
    finishingType: "",
    finishingStructure: "",
    bourseDataCompleted: false,
    isRemoved: false,
    removalReason: "",
    removedAtUtc: "",
    contacts: [{ name: "", role: "", phone: "" }],
  };
}

const WORKDAY_START_HOUR = 8;
const WORKDAY_END_HOUR = 17;
const BUSINESS_DAYS_REQUIRED = 4;

export function isBusinessDay(d: Date): boolean {
  const day = d.getDay();
  return day >= 0 && day <= 4;
}

function isWithinBusinessHours(d: Date): boolean {
  const h = d.getHours();
  return h >= WORKDAY_START_HOUR && h < WORKDAY_END_HOUR;
}

function parseReceivedDateTime(receivedIso: string, time?: string): Date | null {
  if (!receivedIso) return null;
  const parts = receivedIso.split("-").map(Number);
  if (parts.length !== 3 || parts.some((n) => Number.isNaN(n))) return null;
  const [y, m, day] = parts;
  const t = time?.trim() || "10:00";
  const [hh, mm] = t.split(":").map(Number);
  const hour = Number.isFinite(hh) ? hh : 10;
  const minute = Number.isFinite(mm) ? mm : 0;
  const d = new Date(y, m - 1, day, hour, minute, 0);
  return Number.isNaN(d.getTime()) ? null : d;
}

function formatLocalIsoDate(d: Date): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

/** Start point: after-hours/holiday receipt → next business day (later). */
export function getEffectiveStartDate(received: Date): Date {
  if (isBusinessDay(received) && isWithinBusinessHours(received)) {
    const start = new Date(received);
    start.setHours(0, 0, 0, 0);
    return start;
  }
  const cursor = new Date(received);
  if (!isBusinessDay(cursor) || received.getHours() >= WORKDAY_END_HOUR) {
    cursor.setDate(cursor.getDate() + 1);
  }
  while (!isBusinessDay(cursor)) {
    cursor.setDate(cursor.getDate() + 1);
  }
  cursor.setHours(0, 0, 0, 0);
  return cursor;
}

/** 4 business days (Sun–Thu) — receipt day counts as day 1 if before 17:00; after 17:00 it does not. */
function addBusinessDaysFromEffectiveStart(start: Date, count: number): Date {
  const d = new Date(start);
  let remaining = count;
  while (remaining > 0) {
    if (isBusinessDay(d)) remaining -= 1;
    if (remaining > 0) d.setDate(d.getDate() + 1);
  }
  return d;
}

/** Business days from Infath receipt date/time (4 execution/estates, 10 private). */
export function computeBusinessDueDate(
  receivedIso: string,
  receivedTime?: string,
  businessDays: number = BUSINESS_DAYS_REQUIRED,
): string {
  const received = parseReceivedDateTime(receivedIso, receivedTime);
  if (!received) return "";
  const effective = getEffectiveStartDate(received);
  const days =
    Number.isFinite(businessDays) && businessDays >= 1
      ? Math.floor(businessDays)
      : BUSINESS_DAYS_REQUIRED;
  const due = addBusinessDaysFromEffectiveStart(effective, days);
  return formatLocalIsoDate(due);
}

/** SLA deadline on the due business day — end of workday (17:00 local). */
export function dueDateToDeadline(dueIso: string): Date | null {
  const trimmed = dueIso.trim();
  if (!trimmed) return null;
  const parts = trimmed.split("-").map(Number);
  if (parts.length !== 3 || parts.some((n) => Number.isNaN(n))) return null;
  const [y, m, day] = parts;
  const d = new Date(y, m - 1, day, WORKDAY_END_HOUR, 0, 0, 0);
  return Number.isNaN(d.getTime()) ? null : d;
}

export function isPastDue(dueIso: string): boolean {
  if (!dueIso) return false;
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const due = new Date(`${dueIso}T12:00:00`);
  return due < today;
}

/** DD/MM/YYYY with Western digits (0-9) for Arabic UI. */
export function formatDateAr(iso: string): string {
  if (!iso) return "—";
  const day = iso.trim().slice(0, 10);
  const parts = day.split("-").map(Number);
  if (parts.length === 3 && !parts.some((n) => Number.isNaN(n))) {
    const [y, m, d] = parts;
    const dd = String(d).padStart(2, "0");
    const mm = String(m).padStart(2, "0");
    return `${dd}/${mm}/${y}`;
  }
  const parsed = new Date(`${iso}T12:00:00`);
  if (Number.isNaN(parsed.getTime())) return iso;
  const dd = String(parsed.getDate()).padStart(2, "0");
  const mm = String(parsed.getMonth() + 1).padStart(2, "0");
  const y = parsed.getFullYear();
  return `${dd}/${mm}/${y}`;
}
