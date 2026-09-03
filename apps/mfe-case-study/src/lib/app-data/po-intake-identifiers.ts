/** PO intake — deed/identifier types, validation, formatting, restriction helpers. */

import { toLatinDigits } from "@platform/app-shared/lib/arabic-digits";

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

/** Survey lift not required for a unit inside a building. */
export function classificationRequiresSurvey(classification: string): boolean {
  return classification.trim() !== "وحدة داخل مبنى";
}

/** Registered title (title registry) — same intake signals that skip bourse. */
export function propertyHasRegisteredTitle(property: {
  realEstateRegNumber: string;
  identifierType: PropertyIdentifierType;
}): boolean {
  return propertySkipsBourse(property);
}

/** Engineering survey is skipped for unit-inside-building and for title registry. */
export function propertyRequiresSurvey(property: {
  classification: string;
  realEstateRegNumber: string;
  identifierType: PropertyIdentifierType;
}): boolean {
  return (
    classificationRequiresSurvey(property.classification) &&
    !propertyHasRegisteredTitle(property)
  );
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
export function formatPropertyDeedDisplay(property: {
  identifierType: PropertyIdentifierType;
  deedNumber: string;
  realEstateRegNumber: string;
}): string {
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

/** Soft cap aligned with DB `HasMaxLength(128)` — not a business length rule. */
export const PROPERTY_IDENTIFIER_MAX_LENGTH = 128;

/** @deprecated Prefer any non-empty digit string; kept for callers that still compare. */
export const DEED_NUMBER_DIGIT_LENGTH = 12;
/** @deprecated Prefer any non-empty digit string; kept for callers that still compare. */
export const REAL_ESTATE_REG_NUMBER_DIGIT_LENGTH = 16;

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
export { PROPERTY_IDENTIFIER_COLUMN_LABEL } from "@platform/app-shared/domain/property-labels";

/** Digits only — length is free (up to DB max). */
export function sanitizePropertyIdentifierInput(
  value: string,
  _identifierType?: PropertyIdentifierType,
): string {
  return toLatinDigits(value)
    .replace(/\D/g, "")
    .slice(0, PROPERTY_IDENTIFIER_MAX_LENGTH);
}

export function normalizePropertyIdentifierNumber(
  value: string,
  identifierType?: PropertyIdentifierType,
): string {
  return sanitizePropertyIdentifierInput(value, identifierType);
}

export function validatePropertyIdentifierNumber(
  identifierType: PropertyIdentifierType,
  value: string,
): string | undefined {
  const label = propertyIdentifierFieldLabel(identifierType);
  const digits = normalizePropertyIdentifierNumber(value, identifierType);
  if (!digits) return `${label} مطلوب`;
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
export function formatPropertyRestrictionsLine(property: {
  restrictionsPresent: string;
  restrictionType: string;
  restrictionOtherReason: string;
}): string {
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
