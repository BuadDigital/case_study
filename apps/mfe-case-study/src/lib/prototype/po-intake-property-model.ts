/** PO intake — property/contact model, empty factory, status/location labels. */

import {
  PropertyListRowStatuses,
  type PropertyListRowStatus,
} from "@platform/api-client";
import type { AssignmentType } from "./po-intake-assignment";
import type { PropertyIdentifierType } from "./po-intake-identifiers";
import {
  clearPropertyBoundaryFields,
  type PropertyBoundaryDescKey,
  type PropertyBoundaryLenKey,
} from "./po-intake-boundaries";

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

/** Role dropdown options — keeps transaction values (e.g. «ضابط») even if not in the catalog. */
export function contactRoleSelectOptions(currentRole?: string): string[] {
  const role = currentRole?.trim() ?? "";
  if (role && !(CONTACT_ROLE_OPTIONS as readonly string[]).includes(role)) {
    return [role, ...CONTACT_ROLE_OPTIONS];
  }
  return [...CONTACT_ROLE_OPTIONS];
}

export type PoContact = {
  name: string;
  /** Officer capacity — required */
  role: string;
  phone: string;
};

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
  /** Numbering workshop: internal transaction reference TX-{year}-{5-digit seq}. */
  referenceNumber?: string | null;
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
  /** Effective ownership type from the API ("" until loaded). */
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
  partitionMinutesNumber: string;
  partitionMinutesDate: string;
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
    partitionMinutesNumber: "",
    partitionMinutesDate: "",
    finishingType: "",
    finishingStructure: "",
    bourseDataCompleted: false,
    isRemoved: false,
    removalReason: "",
    removedAtUtc: "",
    contacts: [{ name: "", role: "", phone: "" }],
  };
}
