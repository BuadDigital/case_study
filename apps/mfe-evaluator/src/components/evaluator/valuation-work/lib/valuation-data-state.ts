// ── Valuation fixes · 2026-10-25/26 ──────────────────────────────────────────────────────────
// Round 2 (1b19bedc)
//  • Frozen  subjectAreaSyncPlan sends nothing while writes are frozen (package handed over) — every visit
//            used to fire a PUT the server refused. Comment: the sync writes the market header only; the
//            building plot lives on the cost approach.
// ──────────────────────────────────────────────────────────────────────────────────────────────

/**
 * Pure derivations behind `useValuationWorkData`: screen gating from the saved
 * approach settings, the subject identity and bank-fetch options assembled
 * from the property hints, the subject-area sync decision, the far-comparable
 * detection and the small mappers the loader uses. No React, no I/O.
 */
import type {
  SaveValuationMarketApproachRequest,
  ValuationApproachSettingsDto,
  ValuationComparableSelectionDto,
} from "@platform/api-client";
import type { PoPropertyIntake } from "@platform/app-shared/app-data/po-intake-data";
import {
  filterSelectionNearSubject,
  parseSubjectAreaSqm,
  type fetchBankCandidates,
} from "./bank-ranking";
import { parseDecimal, type ValuationWorkPropertyHint } from "./shell-state";
import { parseLatLng } from "@platform/app-shared/domain/geo";

export type SubjectCoords = { lat: number; lng: number };
export type BankFetchOptions = Parameters<typeof fetchBankCandidates>[1];

export type SubjectHints = {
  districtHint?: string;
  property?: ValuationWorkPropertyHint;
  intakeProperty?: PoPropertyIntake | null;
};

/** Approach screens appear only after settings are saved and the approach is enabled. */
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

type ApproachKind = "market" | "cost";

/** Saved comparable/cost work — used to warn before hiding an approach tab. */
export function approachWorkPresence(opts: {
  adoptedMarketCount: number;
  adoptedLandCount: number;
  costLineCount: number;
}): { hasMarketWork: boolean; hasCostWork: boolean } {
  return {
    hasMarketWork: opts.adoptedMarketCount > 0,
    hasCostWork: opts.costLineCount > 0 || opts.adoptedLandCount > 0,
  };
}

/** Approaches the next save would hide that already have work (data is kept). */
export function approachesDisabledWithWork(input: {
  savedMarketEnabled: boolean;
  savedCostEnabled: boolean;
  nextMarketEnabled: boolean;
  nextCostEnabled: boolean;
  hasMarketWork: boolean;
  hasCostWork: boolean;
}): ApproachKind[] {
  const out: ApproachKind[] = [];
  if (
    input.savedMarketEnabled &&
    !input.nextMarketEnabled &&
    input.hasMarketWork
  ) {
    out.push("market");
  }
  if (input.savedCostEnabled && !input.nextCostEnabled && input.hasCostWork) {
    out.push("cost");
  }
  return out;
}

export function disableApproachConfirmCopy(kinds: ApproachKind[]): string | null {
  if (kinds.length === 0) return null;
  const parts: string[] = [];
  if (kinds.includes("market")) {
    parts.push(
      "سيُخفى تبويب طريقة المقارنة ولن يدخل الرأي النهائي. بيانات المقارنات تبقى إن أعدت تفعيل أسلوب السوق.",
    );
  }
  if (kinds.includes("cost")) {
    parts.push(
      "سيُخفى تبويب طريقة المقاول ولن يدخل الرأي النهائي. بنود التكلفة ومقارنات الأرض تبقى إن أعدت تفعيل أسلوب التكلفة.",
    );
  }
  return parts.join(" ");
}

/** Checkboxes start empty until the valuer picks an approach, or until a saved row is loaded. */
export function initialApproachToggles(
  settings: ValuationApproachSettingsDto | null,
): { market: boolean; cost: boolean } {
  if (!settings?.isSaved) return { market: false, cost: false };
  return {
    market: Boolean(settings.marketApproachEnabled),
    cost:
      Boolean(settings.costApproachEnabled) &&
      (settings.costApproachAllowed ?? true),
  };
}

/** Why the open valuation request could not be resolved — shown in place of the screens. */
export function openFailureMessage(kind: string): string {
  if (kind === "auth") return "يلزم تسجيل الدخول";
  if (kind === "network") return "تعذّر الاتصال بخدمة التقييم";
  return "تعذّر فتح طلب التقييم — يُنشأ عند توزيع المعاملة على المقيّم.";
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
  return parseLatLng(inspector?.mapLatitude, inspector?.mapLongitude);
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

/**
 * Subject-area draft on a full load: the area the subject is measured by (its deed area, or a
 * building's floor area) wins over the stored market-approach area.
 * Edge cases: a building with no floor area yet shows nothing (`storedFallback` false) — its stored
 * area may still be the land area from before the 2026-10-29 ruling.
 */
export function initialSubjectArea(
  subjectArea: string,
  selection: { subjectAreaSqm?: number | null },
  { storedFallback = true }: { storedFallback?: boolean } = {},
): string {
  if (subjectArea || !storedFallback) return subjectArea;
  return selection.subjectAreaSqm != null ? String(selection.subjectAreaSqm) : "";
}

/**
 * Whether the server's market-approach area must be overwritten with the subject's area —
 * once per (request, area), and never when the server already matches. It writes the market
 * header only: the land table's building plot lives on the cost approach and is
 * never part of this body. Nothing is sent while writes are frozen (the appraiser's package is
 * handed over) — the server refuses it, and every visit used to fire that refused PUT.
 * The first sync (no area stored yet) also sets `firstBasis` — whole property for a building —
 * so a new market table opens on the basis its subject is compared on; later syncs keep the
 * appraiser's basis.
 */
export function subjectAreaSyncPlan({
  requestId,
  subjectArea,
  selection,
  lastSyncKey,
  writesFrozen = false,
  firstBasis,
}: {
  requestId: string;
  subjectArea: string;
  selection: {
    subjectAreaSqm?: number | null;
    adjustmentBasis: string;
    analysisNotes?: string | null;
  };
  lastSyncKey: string | null;
  writesFrozen?: boolean;
  firstBasis?: string;
}): { syncKey: string; body: SaveValuationMarketApproachRequest } | null {
  const areaNum = parseDecimal(subjectArea);
  const serverArea = selection.subjectAreaSqm;
  const syncKey = `${requestId}:${areaNum}`;
  if (
    writesFrozen ||
    !subjectArea ||
    !Number.isFinite(areaNum) ||
    areaNum <= 0 ||
    (serverArea != null && Math.abs(Number(serverArea) - areaNum) <= 0.001) ||
    lastSyncKey === syncKey
  ) {
    return null;
  }
  const basis = (serverArea == null ? firstBasis : undefined) || selection.adjustmentBasis;
  return {
    syncKey,
    body: {
      subjectAreaSqm: areaNum,
      adjustmentBasis: basis || "price_per_sqm",
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

/** Liquidation extras copied from reconciliation into the evaluator submit draft. */
type FinalOpinionDraftSyncExtras = {
  liquidationDiscountPct: number;
  liquidationDiscountApplied: boolean;
};

export type FinalOpinionChangeHandler = (
  finalOpinionValue: number,
  extras?: FinalOpinionDraftSyncExtras,
) => void;

export function finalOpinionSyncExtrasFromRecon(dto: {
  liquidationDiscountPct: number;
  liquidationDiscountApplied: boolean;
}): FinalOpinionDraftSyncExtras {
  return {
    liquidationDiscountPct: dto.liquidationDiscountPct,
    liquidationDiscountApplied: dto.liquidationDiscountApplied,
  };
}
