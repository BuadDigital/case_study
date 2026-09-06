/**
 * Pure derivations behind `useValuationWorkData`: screen gating from the saved
 * approach settings, the subject identity and bank-fetch options assembled
 * from the property hints, the subject-area sync decision, the far-comparable
 * detection and the small mappers the loader uses. No React, no I/O.
 */
import type {
  SaveValuationApproachSettingsRequest,
  SaveValuationMarketApproachRequest,
  ValuationApproachSettingsDto,
  ValuationComparableSelectionDto,
} from "@platform/api-client";
import type { PoPropertyIntake } from "@case-study/mfe/lib/app-data/po-intake-data";
import {
  filterSelectionNearSubject,
  parseSubjectAreaSqm,
  type fetchBankCandidates,
} from "./bank-ranking";
import { parseDecimal, type ValuationWorkPropertyHint } from "./shell-state";

export type SubjectCoords = { lat: number; lng: number };
export type BankFetchOptions = Parameters<typeof fetchBankCandidates>[1];

export type SubjectHints = {
  districtHint?: string;
  property?: ValuationWorkPropertyHint;
  intakeProperty?: PoPropertyIntake | null;
};

/** Rule Q-2: approach screens appear only after settings are saved and the approach is enabled. */
export function approachAvailability(
  settings: ValuationApproachSettingsDto | null,
): { settingsSaved: boolean; marketEnabled: boolean; costEnabled: boolean } {
  const settingsSaved = settings?.isSaved ?? false;
  return {
    settingsSaved,
    marketEnabled: settingsSaved && (settings?.marketApproachEnabled ?? true),
    costEnabled:
      settingsSaved &&
      (settings?.costApproachEnabled ?? true) &&
      (settings?.costApproachAllowed ?? true),
  };
}

/** Why the open valuation request could not be resolved — shown in place of the screens. */
export function openFailureMessage(kind: string): string {
  if (kind === "auth") return "يلزم تسجيل الدخول";
  if (kind === "network") return "تعذّر الاتصال بخدمة التقييم";
  return "تعذّر فتح طلب التقييم — يُنشأ عند توزيع المعاملة على المقيم.";
}

/** Body for ensure-open: the district hint wins over the property district here. */
export function openRequestBody(
  propertyId: string,
  { districtHint, property }: SubjectHints,
): { propId: string; area: string; type: string; appraiser: string } {
  return {
    propId: propertyId.trim(),
    area: districtHint?.trim() || property?.district?.trim() || "—",
    type: property?.propertyType?.trim() || "—",
    appraiser: "—",
  };
}

/** City and district used to filter comparables around the subject. */
export function subjectIdentity({
  districtHint,
  property,
  intakeProperty,
}: SubjectHints): { city: string; district: string } {
  return {
    city: property?.city?.trim() || intakeProperty?.city?.trim() || "",
    district:
      property?.district?.trim() ||
      districtHint?.trim() ||
      intakeProperty?.district?.trim() ||
      "",
  };
}

/** The field-inspection map pin, when it was actually placed (0,0 is the unset default). */
export function inspectorPinOf(
  inspector: { mapLatitude?: string | null; mapLongitude?: string | null } | null,
): SubjectCoords | null {
  const lat = Number(inspector?.mapLatitude);
  const lng = Number(inspector?.mapLongitude);
  const placed =
    Number.isFinite(lat) && Number.isFinite(lng) && !(lat === 0 && lng === 0);
  return placed ? { lat, lng } : null;
}

/** Bank query for the subject — property hints first, intake fallbacks, inspector pin when placed. */
export function buildBankFetchOptions({
  search,
  propertyId,
  subjectArea,
  pin,
  districtHint,
  property,
  intakeProperty,
}: SubjectHints & {
  search?: string;
  propertyId: string;
  subjectArea: string;
  pin: SubjectCoords | null;
}): BankFetchOptions {
  return {
    q: search?.trim() || undefined,
    propertyId: propertyId.trim() || undefined,
    district:
      property?.district?.trim() ||
      districtHint?.trim() ||
      intakeProperty?.district?.trim() ||
      undefined,
    city: property?.city || intakeProperty?.city || undefined,
    deedNumber: property?.deedNumber || intakeProperty?.deedNumber || undefined,
    locationMapUrl: intakeProperty?.locationMapUrl,
    propertyType: property?.propertyType?.trim() || undefined,
    subjectSqm: parseSubjectAreaSqm(subjectArea, property?.area),
    latitude: pin ? pin.lat : null,
    longitude: pin ? pin.lng : null,
  };
}

/** Subject-area draft on a full load: the transaction area wins over the stored market-approach area. */
export function initialSubjectArea(
  transactionArea: string,
  selection: { subjectAreaSqm?: number | null },
): string {
  return (
    transactionArea ||
    (selection.subjectAreaSqm != null ? String(selection.subjectAreaSqm) : "")
  );
}

/**
 * Whether the server's market-approach area must be overwritten with the transaction area —
 * once per (request, area), and never when the server already matches.
 */
export function subjectAreaSyncPlan({
  requestId,
  transactionArea,
  selection,
  lastSyncKey,
}: {
  requestId: string;
  transactionArea: string;
  selection: {
    subjectAreaSqm?: number | null;
    adjustmentBasis: string;
    analysisNotes?: string | null;
  };
  lastSyncKey: string | null;
}): { syncKey: string; body: SaveValuationMarketApproachRequest } | null {
  const txNum = parseDecimal(transactionArea);
  const serverArea = selection.subjectAreaSqm;
  const syncKey = `${requestId}:${txNum}`;
  if (
    !transactionArea ||
    !Number.isFinite(txNum) ||
    txNum <= 0 ||
    (serverArea != null && Math.abs(Number(serverArea) - txNum) <= 0.001) ||
    lastSyncKey === syncKey
  ) {
    return null;
  }
  return {
    syncKey,
    body: {
      subjectAreaSqm: txNum,
      adjustmentBasis: selection.adjustmentBasis || "price_per_sqm",
      analysisNotes: selection.analysisNotes ?? null,
    },
  };
}

/** Adopted comparables that fall outside the subject's radius (e.g. a demo Riyadh seed on a Jeddah case). */
export function farAdoptedItems(
  adopted: ValuationComparableSelectionDto[],
  subjectCity: string,
  subjectCoords: SubjectCoords | null,
): ValuationComparableSelectionDto[] {
  return adopted.filter(
    (item) =>
      filterSelectionNearSubject([item], subjectCity || undefined, subjectCoords)
        .length === 0,
  );
}

/** A reconciliation carries a usable value opinion only when it is a positive number. */
export function hasPositiveFinalOpinion(value: unknown): value is number {
  return typeof value === "number" && value > 0;
}

/** Cost basis/unit saved from the cost screen — layered on the last saved settings. */
export function costBasisUnitSettingsBody(
  s: ValuationApproachSettingsDto,
  basisKey: string,
  unitKey: string,
): SaveValuationApproachSettingsRequest {
  return {
    marketApproachEnabled: s.marketApproachEnabled,
    costApproachEnabled: s.costApproachEnabled,
    incomeApproachEnabled: false,
    costBasisKey: basisKey,
    costScopeKey: s.costScopeKey,
    costMeasurementUnitKey: unitKey,
    adjustmentsEditUnlocked: s.adjustmentsEditUnlocked,
    valuationPurposeKey: s.valuationPurposeKey,
    valuationPurposeNote: s.valuationPurposeNote ?? null,
    externalSpecialistUsed: s.externalSpecialistUsed,
    externalSpecialistDetails: s.externalSpecialistDetails ?? null,
    valuationDateMode: s.valuationDateMode,
    retrospectiveDate: s.retrospectiveDate ?? null,
    retrospectiveDateEnd: s.retrospectiveDateEnd ?? null,
    retrospectiveRationale: null,
    selectedAssumptions: s.selectedAssumptions ?? [],
  };
}
