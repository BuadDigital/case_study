// ── Valuation fixes · 2026-10-25/26 ──────────────────────────────────────────────────────────
// Round 1 (5b554f4e)
//  • P5   Cost DTO: isSaved (saved zeros replace the starter defaults) and the actual / economic age
//         rationales, also on the save request.
//  • Cost DTO: remainingLeaseYears / lifeCappedByLease / effectiveLifeYears; settings DTO and save
//         request: ownershipInterestKey (+ label) and remainingLeaseYears.
//  • Cost DTO: appliedObsolescencePct (capped at 100%) and obsolescenceNeedsAlert (> 90%).
//  • Reconciliation incomeOpinionValue; the income toggle is no longer documented as deferred.
//  • Wording The garbled reconciliation 400 message is now «بيانات الترجيح غير صالحة».
// Round 2 (1b19bedc)
//  • A    subjectAreaSqm is the whole building plot on the land table; new apartmentLandShareSqm (list) and
//         buildingPlotAreaSqm (cost DTO and save request).
//  • Other failed responses go through serverFailure: a 503 (an unreachable service) now carries the
//         server's Arabic message instead of a bare «server» failure.
// ──────────────────────────────────────────────────────────────────────────────────────────────

import { authHeaders, getApiBase } from "./api-base";
import { repositoryFetch as fetch } from "./write-repository";
import type { ComparablePropertyDto } from "./comparable-properties";
import { parseJson, serverFailure } from "./parse-json";

export type ValuationComparableAdjustmentLineDto = {
  id: string;
  factorKey: string;
  labelAr: string;
  percent: number;
  rationale: string;
  /** compSpec: comparable description for this factor. */
  descriptionAr?: string | null;
  isIncluded: boolean;
  sortOrder: number;
  /** true = displayed value is a suggested default the valuer has not entered — shown as suggested. */
  isSuggestedValue?: boolean;
};

export type ValuationComparableMarketDto = {
  adjustmentLines: ValuationComparableAdjustmentLineDto[];
  sumSequentialPct: number;
  sumDifferencePct: number;
  sumIncludedPct: number;
  /** |factorsSum| > 40% — justification required (interactive form spec). */
  exceedsLargeAdjustmentThreshold: boolean;
  /** Deal age in months — shown for inference; market-conditions adjustment is manual. */
  dealAgeMonths: number;
  /** Default comparable-type adjustment: executed 0 · listing −5 · bid −8 · asking +6. */
  suggestedTransactionTypePct?: number;
  pricePerSqmAfterSequential: number;
  pricePerSqmAfterDifference: number;
  suggestedWeightPct: number;
  effectiveWeightPct: number;
  weightIsManual: boolean;
  weightPct?: number | null;
  /** 3 — required when weightIsManual. */
  weightOverrideRationale?: string | null;
 /** multiplier | amthal — table-wide auto choice. */
  areaAdjustmentMethod: string;
 /** Auto area adjustment % (amthal / multiplier). */
  suggestedAreaAdjustmentPct: number;
};

export type ValuationComparableSelectionDto = {
  id: string;
  valuationRequestId: string;
  comparablePropertyId: string;
  sortOrder: number;
  isAdopted: boolean;
  selectedByUserId?: string | null;
  selectedAtUtc: string;
  comparable: ComparablePropertyDto;
  market?: ValuationComparableMarketDto | null;
  /** compEdit: this valuation's price/area overrides for the comparable — does not touch the shared bank. */
  priceOverrideSar?: number | null;
  areaOverrideSqm?: number | null;
  /** Effective values after overrides. */
  effectivePriceSar?: number;
  effectiveAreaSqm?: number;
  effectivePricePerSqm?: number;
};

export type ValuationComparableSelectionListDto = {
  valuationRequestId: string;
  propertyId: string;
  /** market | land_within_cost */
  selectionContext?: string;
  adoptedCount: number;
  meetsMinimumAdoptedGate: boolean;
  weightsSumTo100: boolean;
  weightedPricePerSqm: number;
  /** Subject area — on the land table, the whole building plot. */
  subjectAreaSqm?: number | null;
  /** Land table only: the apartment's share the rate multiplies into the land value. */
  apartmentLandShareSqm?: number | null;
 /** price_per_sqm | whole_property. */
  adjustmentBasis: string;
  adjustmentBasisLabelAr: string;
  /** Per-m²: weighted × area. Whole-property: weighted — before rounding. */
  marketOpinionValueRaw?: number;
  /** Adjustments logic: after rounding to nearest 10^n. */
  marketOpinionValue: number;
  /** Frozen area factor % for this valuation. */
  areaFactorPct?: number;
  /** Frozen annual market rate % for mkt suggestion. */
  annualMarketRatePct?: number;
  /** Frozen market-value rounding exponent (10^n). */
  valueRoundDecimals?: number;
  analysisNotes?: string | null;
  /** subjSpec: subject-property descriptions per difference factor. */
  subjectSpecs?: Record<string, string>;
  /** factor-level justifications — comparable row holds allocation only. */
  factorRationales?: ValuationAdjustmentFactorRationaleDto[];
  items: ValuationComparableSelectionDto[];
};

/** Single adjustment-factor justification (covers all comparables). */
export type ValuationAdjustmentFactorRationaleDto = {
  selectionContext: string;
  factorKey: string;
  rationaleAr: string;
};

export type SaveValuationMarketApproachRequest = {
  subjectAreaSqm?: number | null;
 /** price_per_sqm (default) | whole_property. */
  adjustmentBasis?: string | null;
  areaFactorPct?: number | null;
  annualMarketRatePct?: number | null;
  valueRoundDecimals?: number | null;
  analysisNotes?: string | null;
  /** subjSpec — null keeps the stored value. */
  subjectSpecs?: Record<string, string> | null;
};

export type ValuationCostLineDto = {
  id: string;
  sourceInventoryLineId?: string | null;
  structureKind: string;
 /** defined item  — custom = free label. */
  itemKey: string;
  itemLabelAr: string;
  label: string;
  /** Quantity in the line's unit. */
  areaSqm: number;
  /** sqm | lm | count | lump. */
  unit: string;
  unitLabelAr: string;
  buildRatioPct?: number | null;
 /** quantity derives from first floor × count. */
  repeatedFloorCount?: number | null;
  unitCostSar: number;
  /** Effective unit cost — inherits first-floor SAR/m² when left empty on a repeating floor line. */
  effectiveUnitCostSar?: number;
  /** true = inherited from the first floor. */
  unitCostInherited?: boolean;
  /** Effective quantity after build ratio — floor area N m². */
  effectiveQuantity?: number;
  lineTotal: number;
  /** Price per m² after indirect costs. */
  netUnitRateWithIndirect?: number;
  rationale: string;
  isIncluded: boolean;
  sortOrder: number;
};

export type ValuationCostApproachDto = {
  valuationRequestId: string;
  propertyId: string;
  /** True once the appraiser saved — stored values (zeros included) replace the starter defaults. */
  isSaved?: boolean;
 /** weighted unit rate from land_within_cost comps. */
  landUnitRateFromMarket: number;
  landAreaSqm: number;
  /** true when land comps produced a unit rate. */
  landEstimateComplete?: boolean;
  useRestrictionDiscountPct: number;
  useRestrictionRationale?: string | null;
  apartmentLandShareSqm?: number | null;
  /** The whole building plot (m²) the land comparables are compared with; null = not entered. */
  buildingPlotAreaSqm?: number | null;
 /** computed. */
  landUnitRateAfterDiscount: number;
  landValueFromMarket: number;
  landImportedAtUtc?: string | null;
  directCostTotal: number;
 /** indirect costs. */
  indirectItems: ValuationIndirectCostItemDto[];
  financingAnnualRatePct: number;
  financingMonths: number;
  financingPct: number;
  indirectRatesSumPct: number;
  totalCostWithIndirect: number;
 /** age / depreciation. */
  actualAgeYears?: number | null;
  actualAgeRationale?: string | null;
  economicAgeYears?: number | null;
  economicAgeRationale?: string | null;
  lifeExtensionYears: number;
  lifeExtensionBasis?: string | null;
  functionalObsolescencePct: number;
  functionalObsolescenceRationale?: string | null;
  externalObsolescencePct: number;
  externalObsolescenceRationale?: string | null;
  extendedLifeYears: number;
  /** Remaining lease years capping the life (building-only on leased land); null otherwise. */
  remainingLeaseYears?: number | null;
  lifeCappedByLease?: boolean;
  /** Life physical depreciation is measured against (lease-capped when applies). */
  effectiveLifeYears?: number;
  physicalObsolescencePct?: number | null;
  /** Unclamped total (alerts read it). */
  totalObsolescencePct: number;
  /** Obsolescence applied to the cost — capped at 100%. */
  appliedObsolescencePct?: number;
  /** Total obsolescence above 90%. */
  obsolescenceNeedsAlert?: boolean;
  depreciationValue: number;
  buildingsValueAfterDepreciation: number;
  /** Method index by scope: land_and_building = land + buildings; building_only = buildings after depreciation. */
  costOpinionWithLand: number;
  costOpinionBuildingsOnly: number;
  /** land_and_building | building_only. */
  costScopeKey?: string;
  /** Σ effective quantity of m² lines in the floor-area group. */
  buildingAreaSqm?: number;
  analysisNotes?: string | null;
  lines: ValuationCostLineDto[];
};

type ValuationIndirectCostItemDto = {
  itemKey: string;
  labelAr: string;
  pct: number;
  rationale?: string | null;
  amount: number;
  sortOrder: number;
};

type SaveValuationIndirectCostItemRequest = {
  itemKey: string;
  pct: number;
  rationale?: string | null;
  sortOrder?: number;
};

type SaveValuationCostLineRequest = {
  id?: string | null;
  sourceInventoryLineId?: string | null;
  structureKind: string;
 /** defined item; custom needs a label. */
  itemKey?: string | null;
  label: string;
  areaSqm: number;
  /** sqm | lm | count | lump — omitted = item default. */
  unit?: string | null;
  buildRatioPct?: number | null;
  repeatedFloorCount?: number | null;
  unitCostSar: number;
  rationale?: string | null;
  isIncluded?: boolean;
  sortOrder?: number;
};

export type SaveValuationCostApproachRequest = {
  lines: SaveValuationCostLineRequest[];
  analysisNotes?: string | null;
  /** Refresh land unit rate from land_within_cost comps (not market). */
  refreshLandFromLandComps?: boolean;
 /** 0–100, default 0. */
  useRestrictionDiscountPct?: number;
 /** required when the discount is above zero. */
  useRestrictionRationale?: string | null;
 /** apartment share of land m². */
  apartmentLandShareSqm?: number | null;
  /** The whole building plot (m²); null clears it. */
  buildingPlotAreaSqm?: number | null;
 /** indirect costs. */
  indirectItems?: SaveValuationIndirectCostItemRequest[];
  financingAnnualRatePct?: number;
  financingMonths?: number;
 /** age / depreciation. */
  actualAgeYears?: number | null;
  actualAgeRationale?: string | null;
  economicAgeYears?: number | null;
  economicAgeRationale?: string | null;
  lifeExtensionYears?: number;
  lifeExtensionBasis?: string | null;
  functionalObsolescencePct?: number;
  functionalObsolescenceRationale?: string | null;
  externalObsolescencePct?: number;
  externalObsolescenceRationale?: string | null;
};

export type ValuationReconciliationMethodDto = {
  id?: string | null;
  approachKind: string;
  labelAr: string;
  approachValue: number;
  weightPct: number;
  suggestedWeightPct: number;
  contributionValue: number;
  rationale: string;
  isIncluded: boolean;
  sortOrder: number;
  /** Set on a «مستند ذو قيمة» indicator row (`doc:{id}`). */
  valueDocumentAttachmentId?: string | null;
  /** market / cost / income — approach of a document indicator. */
  documentApproachKey?: string | null;
  documentMethodName?: string | null;
};

/** An amount from a «مستند ذو قيمة» added to the property value after the discount. */
export type ValuationValueDocumentAdditionDto = {
  attachmentId: string;
  labelAr: string;
  value: number;
};

type ValuationMethodologyAlertOverrideDto = {
  code: string;
  overrideRationale?: string | null;
  acknowledged?: boolean;
};

export type ValuationReconciliationDto = {
  valuationRequestId: string;
  propertyId: string;
  marketOpinionValue: number;
  costOpinionWithLand: number;
  /** Income approach indicator (NOI ÷ cap rate); 0 until complete. Older servers omit it. */
  incomeOpinionValue?: number;
  methods: ValuationReconciliationMethodDto[];
  weightSumPct: number;
  weightsSumTo100: boolean;
  meetsMultiMethodGate: boolean;
  weightedValue: number;
  finalRoundDecimals: number;
  /** weighted → liquidation discount → + document additions → rounded once. */
  finalOpinionValue: number;
  finalOpinionBeforeLiquidation?: number;
  /** Property value after the liquidation discount, unrounded (section 25 first line). */
  propertyValueAfterLiquidation?: number;
  additions?: ValuationValueDocumentAdditionDto[];
  additionsTotal?: number;
  methodsRationale: string;
  basisOfValueKey?: string;
  basisOfValueLabelAr?: string | null;
  valuePremiseKey?: string | null;
  valuePremiseLabelAr?: string | null;
  liquidationDiscountPct: number;
  liquidationDiscountRationale?: string | null;
  liquidationDiscountApplied: boolean;
  methodologyAlertOverrides?: ValuationMethodologyAlertOverrideDto[];
};

type SaveValuationReconciliationMethodRequest = {
  id?: string | null;
  approachKind: string;
  weightPct: number;
  rationale?: string | null;
  isIncluded?: boolean;
  sortOrder?: number;
};

export type SaveValuationReconciliationRequest = {
  methods: SaveValuationReconciliationMethodRequest[];
  methodsRationale: string;
  finalRoundDecimals?: number;
  basisOfValueKey?: string | null;
  valuePremiseKey?: string | null;
  liquidationDiscountPct?: number;
  liquidationDiscountRationale?: string | null;
  methodologyAlertOverrides?: ValuationMethodologyAlertOverrideDto[] | null;
};

type SaveValuationComparableAdjustmentLineRequest = {
  id?: string | null;
  factorKey: string;
  labelAr?: string | null;
  percent: number;
  rationale?: string | null;
  /** compSpec: comparable description for this factor. */
  descriptionAr?: string | null;
  isIncluded?: boolean;
  sortOrder?: number;
};

export type SaveValuationComparableMarketRequest = {
  adjustmentLines: SaveValuationComparableAdjustmentLineRequest[];
  /** compEdit: override total property price — null clears the override. */
  priceOverrideSar?: number | null;
  /** compEdit: override comparable area (m²) — null clears the override. */
  areaOverrideSqm?: number | null;
  weightPct?: number | null;
  weightIsManual?: boolean;
  /** 3 — required when weightIsManual. */
  weightOverrideRationale?: string | null;
 /** multiplier (default) | amthal. */
  areaAdjustmentMethod?: string | null;
};

/** Screen 1 — applied approaches + cost basis/unit + adjustments eligibility. */
export type ValuationApproachSettingsDto = {
  valuationRequestId: string;
  propertyId: string;
  /** Operational type (inspector-confirmed when available). */
  propertyType: string;
  /** Original type captured when the valuation request was opened. */
  initialPropertyType?: string;
  /** Property type is land (any classification). */
  isLandPropertyType: boolean;
  /** Scope question: are there buildings/improvements to value? */
  hasStructuresToValue: boolean;
  /** Inspector-confirmed land disables the cost approach. */
  costApproachAllowed: boolean;
  marketApproachEnabled: boolean;
  costApproachEnabled: boolean;
  /** Income approach (direct capitalisation) — the appraiser may enable it. */
  incomeApproachEnabled: boolean;
  /** Freehold (default) | usufruct («حق منفعة») | leased_land («أرض مستأجرة»). */
  ownershipInterestKey?: string;
  /** «ملكية تامة» / «حق منفعة» / «أرض مستأجرة». */
  ownershipInterestLabelAr?: string;
  /** Years left on the usufruct / land lease — set for a leasehold interest only. */
  remainingLeaseYears?: number | null;
  /** replacement | reproduction. */
  costBasisKey: string;
  costBasisLabelAr: string;
  /** Cost-approach scope: land_and_building (default) | building_only. */
  costScopeKey?: string;
  costScopeLabelAr?: string;
  /** comparison_unit | quantity_survey | lump_sum | per_item. */
  costMeasurementUnitKey: string;
  costMeasurementUnitLabelAr: string;
  adjustmentsEditUnlocked: boolean;
  /** Valuation purpose — auction_liquidation | sale | judicial_execution | sale_purchase | financing | financial_reporting | litigation | other. */
  valuationPurposeKey: string;
  valuationPurposeLabelAr: string;
  valuationPurposeNote?: string | null;
  /** External specialist item (IVS 101) — not the assignment specialist or case-study specialist. */
  externalSpecialistUsed: boolean;
  externalSpecialistDetails?: string | null;
  /** Valuation date: issue (value issuance — automatic) | retrospective (manual backdate). */
  valuationDateMode: string;
  valuationDateModeLabelAr: string;
  retrospectiveDate?: string | null;
  /** yyyy-MM-dd — period end; empty = single date. */
  retrospectiveDateEnd?: string | null;
  /** Why the value is stated at a past date — printed in the report scope. */
  retrospectiveRationale?: string | null;
  /** Selected/added assumption items (frozen text). */
  selectedAssumptions: string[];
  /** Selection library from valuation-report settings tab. */
  assumptionLibrary: string[];
  /** false = property-type defaults (no row saved yet). */
  isSaved: boolean;
};

export type SaveValuationApproachSettingsRequest = {
  marketApproachEnabled: boolean;
  costApproachEnabled: boolean;
  incomeApproachEnabled?: boolean;
  costBasisKey?: string | null;
  /** land_and_building (default) | building_only. */
  costScopeKey?: string | null;
  costMeasurementUnitKey?: string | null;
  adjustmentsEditUnlocked?: boolean;
  /** Required (section 4j-5). */
  valuationPurposeKey?: string | null;
  valuationPurposeNote?: string | null;
  externalSpecialistUsed?: boolean;
  externalSpecialistDetails?: string | null;
  /** issue (default) | retrospective. */
  valuationDateMode?: string | null;
  /** yyyy-MM-dd — required for retrospective (or period start). */
  retrospectiveDate?: string | null;
  /** yyyy-MM-dd — period end; empty = single date. */
  retrospectiveDateEnd?: string | null;
  /** Required (≥ 10 characters) when valuationDateMode is retrospective; null keeps the stored one. */
  retrospectiveRationale?: string | null;
  /** Freehold | usufruct | leased_land — null keeps the stored interest. */
  ownershipInterestKey?: string | null;
  /** Required (> 0, ≤ 999) for usufruct / leased_land; ignored for freehold. */
  remainingLeaseYears?: number | null;
  selectedAssumptions?: string[] | null;
};

export type ValuationRequestLiteDto = {
  id: string;
  displayId: string;
  propId: string;
  area: string;
  type: string;
  appraiser: string;
  status: string;
  date: string;
};

export type SaveValuationRequestBody = {
  propId: string;
  area: string;
  type: string;
  appraiser: string;
  status?: string;
  date?: string;
};

export type ValuationSelectionsApiConfig = {
  baseUrl?: string;
  token: string;
};

type Result<T> =
  | { ok: true; data: T }
  | {
      ok: false;
      kind: "auth" | "network" | "server" | "validation" | "not_found" | "conflict";
      message?: string;
      errors?: Record<string, string>;
    };

// Local-calendar today (YYYY-MM-DD). api-client cannot import app-shared (it depends on us), so this
// mirrors todayIso there; toISOString would give yesterday between midnight and 03:00 Riyadh.
function localTodayIso(): string {
  const d = new Date();
  const p = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}`;
}

function firstValidationMessage(
  errors?: Record<string, string | string[]>,
): string | undefined {
  if (!errors) return undefined;
  const first = Object.values(errors)[0];
  return Array.isArray(first) ? first[0] : first;
}


export async function getOpenValuationRequestByProperty(
  config: ValuationSelectionsApiConfig,
  propertyId: string,
): Promise<Result<ValuationRequestLiteDto | null>> {
  const base = config.baseUrl ?? getApiBase();
  try {
    const res = await fetch(
      `${base}/api/valuation-requests/open-by-property/${encodeURIComponent(propertyId)}`,
      { headers: authHeaders(config.token, { accept: true }) },
    );
    if (res.status === 401) return { ok: false, kind: "auth" };
    if (res.status === 404 || res.status === 204) return { ok: true, data: null };
    if (!res.ok) return await serverFailure(res);
    const data = await parseJson<ValuationRequestLiteDto | null>(res);
    return { ok: true, data: data?.id ? data : null };
  } catch {
    return { ok: false, kind: "network" };
  }
}

export async function ensureOpenValuationRequestByProperty(
  config: ValuationSelectionsApiConfig,
  body: SaveValuationRequestBody,
): Promise<Result<ValuationRequestLiteDto>> {
  const base = config.baseUrl ?? getApiBase();
  const open = await getOpenValuationRequestByProperty(config, body.propId);
  if (open.ok && open.data) return { ok: true, data: open.data };
  if (!open.ok && (open.kind === "auth" || open.kind === "network")) return open;

  try {
    const today = localTodayIso();
    const res = await fetch(`${base}/api/valuation-requests/ensure-open`, {
      method: "POST",
      headers: authHeaders(config.token, { accept: true }),
      body: JSON.stringify({
        propId: body.propId,
        area: body.area.trim() || "—",
        type: body.type.trim() || "—",
        appraiser: body.appraiser.trim() || "—",
        status: body.status ?? "progress",
        date: body.date?.trim() || today,
      }),
    });
    if (res.status === 401) return { ok: false, kind: "auth" };
    if (res.status === 404) return { ok: false, kind: "not_found" };
    if (!res.ok) return await serverFailure(res);
    return { ok: true, data: await parseJson<ValuationRequestLiteDto>(res) };
  } catch {
    return { ok: false, kind: "network" };
  }
}

export async function listValuationComparableSelections(
  config: ValuationSelectionsApiConfig,
  valuationRequestId: string,
  selectionContext: string = "market",
): Promise<Result<ValuationComparableSelectionListDto>> {
  const base = config.baseUrl ?? getApiBase();
  try {
    const qs = new URLSearchParams();
    if (selectionContext) qs.set("selectionContext", selectionContext);
    const q = qs.toString();
    const res = await fetch(
      `${base}/api/valuation-requests/${valuationRequestId}/comparable-selections${q ? `?${q}` : ""}`,
      { headers: authHeaders(config.token, { accept: true }) },
    );
    if (res.status === 401) return { ok: false, kind: "auth" };
    if (res.status === 404) return { ok: false, kind: "not_found" };
    if (!res.ok) return await serverFailure(res);
    return { ok: true, data: await parseJson<ValuationComparableSelectionListDto>(res) };
  } catch {
    return { ok: false, kind: "network" };
  }
}

export async function setValuationComparableAdopted(
  config: ValuationSelectionsApiConfig,
  valuationRequestId: string,
  comparablePropertyId: string,
  isAdopted: boolean,
  selectionContext: string = "market",
): Promise<Result<ValuationComparableSelectionDto>> {
  const base = config.baseUrl ?? getApiBase();
  try {
    const qs = new URLSearchParams({ selectionContext });
    const res = await fetch(
      `${base}/api/valuation-requests/${valuationRequestId}/comparable-selections/${comparablePropertyId}/adopt?${qs}`,
      {
        method: "POST",
        headers: authHeaders(config.token, { accept: true }),
        body: JSON.stringify({ isAdopted, selectionContext }),
      },
    );
    if (res.status === 401) return { ok: false, kind: "auth" };
    if (res.status === 400) {
      const payload = (await res.json().catch(() => null)) as {
        message?: string;
      } | null;
      return {
        ok: false,
        kind: "validation",
        message: payload?.message ?? "تعذّر تحديث الاعتماد",
      };
    }
    if (!res.ok) return await serverFailure(res);
    return {
      ok: true,
      data: await parseJson<ValuationComparableSelectionDto>(res),
    };
  } catch {
    return { ok: false, kind: "network" };
  }
}

export async function saveValuationComparableMarket(
  config: ValuationSelectionsApiConfig,
  valuationRequestId: string,
  selectionId: string,
  body: SaveValuationComparableMarketRequest,
): Promise<Result<ValuationComparableSelectionDto>> {
  const base = config.baseUrl ?? getApiBase();
  try {
    const res = await fetch(
      `${base}/api/valuation-requests/${valuationRequestId}/comparable-selections/${selectionId}/market`,
      {
        method: "PUT",
        headers: authHeaders(config.token, { accept: true }),
        body: JSON.stringify(body),
      },
    );
    if (res.status === 401) return { ok: false, kind: "auth" };
    if (res.status === 403) {
      return {
        ok: false,
        kind: "auth",
        message: "ليست لديك صلاحية حفظ التسويات",
      };
    }
    if (res.status === 409) {
      const payload = (await res.json().catch(() => null)) as {
        detail?: string;
        message?: string;
      } | null;
      return {
        ok: false,
        kind: "conflict",
        message:
          payload?.detail ??
          payload?.message ??
          "تم تحديث السجل من طلب آخر. حدّث الصفحة ثم أعد المحاولة.",
      };
    }
    if (res.status === 400) {
      const payload = (await res.json().catch(() => null)) as {
        errors?: Record<string, string | string[]>;
        message?: string;
      } | null;
      return {
        ok: false,
        kind: "validation",
        message:
          firstValidationMessage(payload?.errors) ??
          payload?.message ??
          "بيانات التسوية غير صالحة",
        errors: payload?.errors as Record<string, string> | undefined,
      };
    }
    if (!res.ok) return await serverFailure(res);
    return {
      ok: true,
      data: await parseJson<ValuationComparableSelectionDto>(res),
    };
  } catch {
    return { ok: false, kind: "network" };
  }
}

/** save/clear single adjustment-factor justification — empty clears. */
export async function saveAdjustmentFactorRationale(
  config: ValuationSelectionsApiConfig,
  valuationRequestId: string,
  body: { selectionContext: string; factorKey: string; rationaleAr: string | null },
): Promise<Result<ValuationAdjustmentFactorRationaleDto>> {
  const base = config.baseUrl ?? getApiBase();
  try {
    const res = await fetch(
      `${base}/api/valuation-requests/${valuationRequestId}/adjustment-factor-rationale`,
      {
        method: "PUT",
        headers: authHeaders(config.token, { accept: true }),
        body: JSON.stringify(body),
      },
    );
    if (res.status === 401) return { ok: false, kind: "auth" };
    if (res.status === 400) {
      const payload = (await res.json().catch(() => null)) as {
        errors?: Record<string, string>;
        message?: string;
      } | null;
      return {
        ok: false,
        kind: "validation",
        message: payload?.errors
          ? Object.values(payload.errors)[0]
          : (payload?.message ?? "المبرر غير صالح"),
        errors: payload?.errors,
      };
    }
    if (!res.ok) return await serverFailure(res);
    return {
      ok: true,
      data: await parseJson<ValuationAdjustmentFactorRationaleDto>(res),
    };
  } catch {
    return { ok: false, kind: "network" };
  }
}

export async function saveValuationMarketApproach(
  config: ValuationSelectionsApiConfig,
  valuationRequestId: string,
  body: SaveValuationMarketApproachRequest,
): Promise<Result<ValuationComparableSelectionListDto>> {
  const base = config.baseUrl ?? getApiBase();
  try {
    const res = await fetch(
      `${base}/api/valuation-requests/${valuationRequestId}/market-approach`,
      {
        method: "PUT",
        headers: authHeaders(config.token, { accept: true }),
        body: JSON.stringify(body),
      },
    );
    if (res.status === 401) return { ok: false, kind: "auth" };
    if (res.status === 400) {
      const payload = (await res.json().catch(() => null)) as {
        errors?: Record<string, string>;
        message?: string;
      } | null;
      return {
        ok: false,
        kind: "validation",
        message:
          payload?.errors
            ? Object.values(payload.errors)[0]
            : payload?.message ?? "بيانات غير صالحة",
        errors: payload?.errors,
      };
    }
    if (!res.ok) return await serverFailure(res);
    return {
      ok: true,
      data: await parseJson<ValuationComparableSelectionListDto>(res),
    };
  } catch {
    return { ok: false, kind: "network" };
  }
}

export async function getValuationApproachSettings(
  config: ValuationSelectionsApiConfig,
  valuationRequestId: string,
): Promise<Result<ValuationApproachSettingsDto>> {
  const base = config.baseUrl ?? getApiBase();
  try {
    const res = await fetch(
      `${base}/api/valuation-requests/${valuationRequestId}/approach-settings`,
      { headers: authHeaders(config.token, { accept: true }) },
    );
    if (res.status === 401) return { ok: false, kind: "auth" };
    if (res.status === 404) return { ok: false, kind: "not_found" };
    if (!res.ok) return await serverFailure(res);
    return { ok: true, data: await parseJson<ValuationApproachSettingsDto>(res) };
  } catch {
    return { ok: false, kind: "network" };
  }
}

export async function saveValuationApproachSettings(
  config: ValuationSelectionsApiConfig,
  valuationRequestId: string,
  body: SaveValuationApproachSettingsRequest,
): Promise<Result<ValuationApproachSettingsDto>> {
  const base = config.baseUrl ?? getApiBase();
  try {
    const res = await fetch(
      `${base}/api/valuation-requests/${valuationRequestId}/approach-settings`,
      {
        method: "PUT",
        headers: authHeaders(config.token, { accept: true }),
        body: JSON.stringify(body),
      },
    );
    if (res.status === 401) return { ok: false, kind: "auth" };
    if (res.status === 400) {
      const payload = (await res.json().catch(() => null)) as {
        errors?: Record<string, string>;
        message?: string;
      } | null;
      return {
        ok: false,
        kind: "validation",
        message:
          payload?.errors
            ? Object.values(payload.errors)[0]
            : payload?.message ?? "بيانات إعدادات التقييم غير صالحة",
        errors: payload?.errors,
      };
    }
    if (!res.ok) return await serverFailure(res);
    return { ok: true, data: await parseJson<ValuationApproachSettingsDto>(res) };
  } catch {
    return { ok: false, kind: "network" };
  }
}

export async function getValuationCostApproach(
  config: ValuationSelectionsApiConfig,
  valuationRequestId: string,
): Promise<Result<ValuationCostApproachDto>> {
  const base = config.baseUrl ?? getApiBase();
  try {
    const res = await fetch(
      `${base}/api/valuation-requests/${valuationRequestId}/cost-approach`,
      { headers: authHeaders(config.token, { accept: true }) },
    );
    if (res.status === 401) return { ok: false, kind: "auth" };
    if (res.status === 404) return { ok: false, kind: "not_found" };
    if (!res.ok) return await serverFailure(res);
    return { ok: true, data: await parseJson<ValuationCostApproachDto>(res) };
  } catch {
    return { ok: false, kind: "network" };
  }
}

export async function saveValuationCostApproach(
  config: ValuationSelectionsApiConfig,
  valuationRequestId: string,
  body: SaveValuationCostApproachRequest,
): Promise<Result<ValuationCostApproachDto>> {
  const base = config.baseUrl ?? getApiBase();
  try {
    const res = await fetch(
      `${base}/api/valuation-requests/${valuationRequestId}/cost-approach`,
      {
        method: "PUT",
        headers: authHeaders(config.token, { accept: true }),
        body: JSON.stringify(body),
      },
    );
    if (res.status === 401) return { ok: false, kind: "auth" };
    if (res.status === 400) {
      const payload = (await res.json().catch(() => null)) as {
        errors?: Record<string, string>;
        message?: string;
      } | null;
      return {
        ok: false,
        kind: "validation",
        message:
          payload?.errors
            ? Object.values(payload.errors)[0]
            : payload?.message ?? "بيانات التكلفة غير صالحة",
        errors: payload?.errors,
      };
    }
    if (!res.ok) return await serverFailure(res);
    return { ok: true, data: await parseJson<ValuationCostApproachDto>(res) };
  } catch {
    return { ok: false, kind: "network" };
  }
}

export async function getValuationReconciliation(
  config: ValuationSelectionsApiConfig,
  valuationRequestId: string,
): Promise<Result<ValuationReconciliationDto>> {
  const base = config.baseUrl ?? getApiBase();
  try {
    const res = await fetch(
      `${base}/api/valuation-requests/${valuationRequestId}/reconciliation`,
      { headers: authHeaders(config.token, { accept: true }) },
    );
    if (res.status === 401) return { ok: false, kind: "auth" };
    if (res.status === 404) return { ok: false, kind: "not_found" };
    if (!res.ok) return await serverFailure(res);
    return { ok: true, data: await parseJson<ValuationReconciliationDto>(res) };
  } catch {
    return { ok: false, kind: "network" };
  }
}

export async function saveValuationReconciliation(
  config: ValuationSelectionsApiConfig,
  valuationRequestId: string,
  body: SaveValuationReconciliationRequest,
): Promise<Result<ValuationReconciliationDto>> {
  const base = config.baseUrl ?? getApiBase();
  try {
    const res = await fetch(
      `${base}/api/valuation-requests/${valuationRequestId}/reconciliation`,
      {
        method: "PUT",
        headers: authHeaders(config.token, { accept: true }),
        body: JSON.stringify(body),
      },
    );
    if (res.status === 401) return { ok: false, kind: "auth" };
    if (res.status === 400) {
      const payload = (await res.json().catch(() => null)) as {
        errors?: Record<string, string>;
        message?: string;
      } | null;
      return {
        ok: false,
        kind: "validation",
        message:
          payload?.errors
            ? Object.values(payload.errors)[0]
            : payload?.message ?? "بيانات الترجيح غير صالحة",
        errors: payload?.errors,
      };
    }
    if (!res.ok) return await serverFailure(res);
    return { ok: true, data: await parseJson<ValuationReconciliationDto>(res) };
  } catch {
    return { ok: false, kind: "network" };
  }
}

export type ValuationIssuanceGateItemDto = {
  code: string;
  labelAr: string;
  passed: boolean;
  isHard: boolean;
  isWarning: boolean;
  detailAr?: string | null;
};

export type ValuationMethodologyAlertItemDto = {
  number: number;
  code: string;
  labelAr: string;
  triggered: boolean;
  isHard: boolean;
  severityKind?: string;
  evaluated: boolean;
  blocksIssuance?: boolean;
  detailAr?: string | null;
  overrideRationale?: string | null;
  acknowledged?: boolean;
};

export type ValuationIssuanceGatesDto = {
  valuationRequestId: string;
  propertyId: string;
  allowsIssuance: boolean;
  gates: ValuationIssuanceGateItemDto[];
  blockingReasonsAr: string[];
  methodologyAlerts: ValuationMethodologyAlertItemDto[];
  methodologyAlertTriggeredCount: number;
  methodologyAlertsNoteAr: string;
};

export async function getValuationIssuanceGates(
  config: ValuationSelectionsApiConfig,
  valuationRequestId: string,
): Promise<Result<ValuationIssuanceGatesDto>> {
  const base = config.baseUrl ?? getApiBase();
  try {
    const res = await fetch(
      `${base}/api/valuation-requests/${valuationRequestId}/issuance-gates`,
      { headers: authHeaders(config.token, { accept: true }) },
    );
    if (res.status === 401) return { ok: false, kind: "auth" };
    if (res.status === 404) return { ok: false, kind: "not_found" };
    if (!res.ok) return await serverFailure(res);
    return { ok: true, data: await parseJson<ValuationIssuanceGatesDto>(res) };
  } catch {
    return { ok: false, kind: "network" };
  }
}

/* ─── two-phase issuance + deposit certificate ─── */

export type ValuationReportIssuanceStateDto = {
  valuationRequestId: string;
  /** draft | deposit_issued | final_issued */
  stage: string;
  allowsDepositIssue: boolean;
  blockingReasonsAr: string[];
  depositIssuedAtUtc?: string | null;
  depositCode?: string | null;
  certificateFileName?: string | null;
  certificateUploadedAtUtc?: string | null;
  finalIssuedAtUtc?: string | null;
  /** Supplement (r2): active valuation round number — 1 before any reopen. */
  version: number;
  /** Count of superseded cancelled copies still kept on the transaction file. */
  supersededCount: number;
};

async function postIssuance(
  config: ValuationSelectionsApiConfig,
  url: string,
  body?: unknown,
): Promise<Result<ValuationReportIssuanceStateDto>> {
  try {
    const res = await fetch(url, {
      method: "POST",
      headers: authHeaders(config.token, { accept: true }),
      body: body === undefined ? undefined : JSON.stringify(body),
    });
    if (res.status === 401) return { ok: false, kind: "auth" };
    if (res.status === 400 || res.status === 403 || res.status === 409) {
      const payload = (await res.json().catch(() => null)) as {
        errors?: Record<string, string | string[]>;
        message?: string;
        detail?: string;
      } | null;
      const errors = Object.fromEntries(
        Object.entries(payload?.errors ?? {}).map(([k, v]) => [k, Array.isArray(v) ? (v[0] ?? "") : v]),
      );
      return {
        ok: false,
        kind: "validation",
        message:
          Object.values(errors)[0] ??
          payload?.detail ??
          payload?.message ??
          "تعذّر تنفيذ خطوة الإصدار",
        errors,
      };
    }
    if (!res.ok) return await serverFailure(res);
    return { ok: true, data: await parseJson<ValuationReportIssuanceStateDto>(res) };
  } catch {
    return { ok: false, kind: "network" };
  }
}

/** Record certificate and code — generates final copy with certificate/code page in meta. */
export function registerDepositCertificate(
  config: ValuationSelectionsApiConfig,
  valuationRequestId: string,
  body: {
    depositCode: string;
    certificateFileName?: string | null;
    certificateContentType?: string | null;
    certificateContentBase64?: string | null;
  },
): Promise<Result<ValuationReportIssuanceStateDto>> {
  const base = config.baseUrl ?? getApiBase();
  return postIssuance(
    config,
    `${base}/api/valuation-requests/${valuationRequestId}/report-issuance/certificate`,
    body,
  );
}

/**
 * Supplement (r2): reopen valuation round after deposit — department supervisor
 * approval required; the active copy is marked superseded and remains on file.
 */
export function reopenReportIssuance(
  config: ValuationSelectionsApiConfig,
  valuationRequestId: string,
  reason: string,
): Promise<Result<ValuationReportIssuanceStateDto>> {
  const base = config.baseUrl ?? getApiBase();
  return postIssuance(
    config,
    `${base}/api/valuation-requests/${valuationRequestId}/report-issuance/reopen`,
    { reason },
  );
}

