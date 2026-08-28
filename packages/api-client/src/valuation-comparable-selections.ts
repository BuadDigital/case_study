import { getApiBase } from "./index";
import { repositoryFetch as fetch } from "./write-repository";
import type { ComparablePropertyDto } from "./comparable-properties";
import { parseJson } from "./parse-json";

export type ValuationComparableAdjustmentLineDto = {
  id: string;
  factorKey: string;
  labelAr: string;
  percent: number;
  rationale: string;
  /** compSpec: وصف المقارن لهذا العامل («وصف المقارن…»). */
  descriptionAr?: string | null;
  isIncluded: boolean;
  sortOrder: number;
  /** true = القيمة المعروضة افتراضي مقترح لم يدخله المقيّم — تُعرض بأسلوب «مقترح». */
  isSuggestedValue?: boolean;
};

export type ValuationComparableMarketDto = {
  adjustmentLines: ValuationComparableAdjustmentLineDto[];
  sumSequentialPct: number;
  sumDifferencePct: number;
  sumIncludedPct: number;
  /** |factorsSum| > 35% — التبرير إلزامي (مواصفة النموذج التفاعلي). */
  exceedsLargeAdjustmentThreshold: boolean;
  /** عمر الصفقة بالأشهر — يُعرض للاستدلال؛ تسوية ظروف السوق يدوية. */
  dealAgeMonths: number;
  /** افتراضي تسوية نوع المقارن: منفذة ٠ · عرض −٥ · حد −٨ · سوم +٦. */
  suggestedTransactionTypePct?: number;
  pricePerSqmAfterSequential: number;
  pricePerSqmAfterDifference: number;
  suggestedWeightPct: number;
  effectiveWeightPct: number;
  weightIsManual: boolean;
  weightPct?: number | null;
  /** Decision 19.3 — required when weightIsManual. */
  weightOverrideRationale?: string | null;
 /** multiplier | amthal — table-wide auto choice. */
  areaAdjustmentMethod: string;
 /** Auto area adjustment % (amthal/مضاعف). */
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
  /** compEdit: تجاوزات هذا التقييم لسعر/مساحة المقارن — لا تمس البنك المشترك. */
  priceOverrideSar?: number | null;
  areaOverrideSqm?: number | null;
  /** القيم الفعلية بعد التجاوزات. */
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
  subjectAreaSqm?: number | null;
 /** price_per_sqm | whole_property. */
  adjustmentBasis: string;
  adjustmentBasisLabelAr: string;
  /** Per-m²: weighted × area. Whole-property: weighted — قبل التقريب. */
  marketOpinionValueRaw?: number;
  /** منطق-التسويات: بعد التقريب لأقرب ١٠^ن. */
  marketOpinionValue: number;
  /** Frozen area factor ٪ for this valuation. */
  areaFactorPct?: number;
  /** Frozen annual market rate ٪ for mkt suggestion. */
  annualMarketRatePct?: number;
  /** Frozen أسّ تقريب قيمة السوق (١٠^ن). */
  valueRoundDecimals?: number;
  analysisNotes?: string | null;
  /** subjSpec: أوصاف العقار محل التقييم لكل عامل اختلاف. */
  subjectSpecs?: Record<string, string>;
  /** ق-8-1: مبررات على مستوى العامل — سطر المقارن يحمل التخصيص فقط. */
  factorRationales?: ValuationAdjustmentFactorRationaleDto[];
  items: ValuationComparableSelectionDto[];
};

/** ق-8-1: مبرر عامل التسوية الواحد (يغطي كل المقارنات). */
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
  /** subjSpec — null يبقي المخزّن. */
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
  /** تكلفة الوحدة الفعلية — ترث سعر متر «الدور الأول» عند تركها فارغة لبند المتكررة. */
  effectiveUnitCostSar?: number;
  /** true = «موروثة من الدور الأول». */
  unitCostInherited?: boolean;
  /** الكمية الفعلية بعد نسبة البناء — «المسطح N م²». */
  effectiveQuantity?: number;
  lineTotal: number;
  /** سعر المتر بعد غير المباشرة. */
  netUnitRateWithIndirect?: number;
  rationale: string;
  isIncluded: boolean;
  sortOrder: number;
};

export type ValuationCostApproachDto = {
  valuationRequestId: string;
  propertyId: string;
 /** weighted unit rate from land_within_cost comps. */
  landUnitRateFromMarket: number;
  landAreaSqm: number;
  /** true when land comps produced a unit rate. */
  landEstimateComplete?: boolean;
  useRestrictionDiscountPct: number;
  useRestrictionRationale?: string | null;
  apartmentLandShareSqm?: number | null;
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
  economicAgeYears?: number | null;
  lifeExtensionYears: number;
  lifeExtensionBasis?: string | null;
  functionalObsolescencePct: number;
  functionalObsolescenceRationale?: string | null;
  externalObsolescencePct: number;
  externalObsolescenceRationale?: string | null;
  extendedLifeYears: number;
  physicalObsolescencePct?: number | null;
  totalObsolescencePct: number;
  depreciationValue: number;
  buildingsValueAfterDepreciation: number;
  /** مؤشر الأسلوب وفق النطاق: أرض ومبنى = أرض + مبانٍ؛ مبنى فقط = المباني بعد الإهلاك. */
  costOpinionWithLand: number;
  costOpinionBuildingsOnly: number;
  /** land_and_building | building_only. */
  costScopeKey?: string;
  /** Σ الكمية الفعلية لبنود م² في مجموعة المسطحات. */
  buildingAreaSqm?: number;
  analysisNotes?: string | null;
  lines: ValuationCostLineDto[];
};

export type ValuationIndirectCostItemDto = {
  itemKey: string;
  labelAr: string;
  pct: number;
  rationale?: string | null;
  amount: number;
  sortOrder: number;
};

export type SaveValuationIndirectCostItemRequest = {
  itemKey: string;
  pct: number;
  rationale?: string | null;
  sortOrder?: number;
};

export type SaveValuationCostLineRequest = {
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
 /** indirect costs. */
  indirectItems?: SaveValuationIndirectCostItemRequest[];
  financingAnnualRatePct?: number;
  financingMonths?: number;
 /** age / depreciation. */
  actualAgeYears?: number | null;
  economicAgeYears?: number | null;
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
};

export type ValuationMethodologyAlertOverrideDto = {
  code: string;
  overrideRationale?: string | null;
  acknowledged?: boolean;
};

export type ValuationReconciliationDto = {
  valuationRequestId: string;
  propertyId: string;
  marketOpinionValue: number;
  costOpinionWithLand: number;
  methods: ValuationReconciliationMethodDto[];
  weightSumPct: number;
  weightsSumTo100: boolean;
  meetsMultiMethodGate: boolean;
  weightedValue: number;
  finalRoundDecimals: number;
  finalOpinionValue: number;
  finalOpinionBeforeLiquidation?: number;
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

export type SaveValuationReconciliationMethodRequest = {
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

export type ValuationComparableSelectionItemRequest = {
  comparablePropertyId: string;
  sortOrder?: number;
  isAdopted?: boolean;
};

export type SaveValuationComparableAdjustmentLineRequest = {
  id?: string | null;
  factorKey: string;
  labelAr?: string | null;
  percent: number;
  rationale?: string | null;
  /** compSpec: وصف المقارن لهذا العامل. */
  descriptionAr?: string | null;
  isIncluded?: boolean;
  sortOrder?: number;
};

export type SaveValuationComparableMarketRequest = {
  adjustmentLines: SaveValuationComparableAdjustmentLineRequest[];
  /** compEdit: تجاوز سعر العقار الإجمالي — null يمسح التجاوز. */
  priceOverrideSar?: number | null;
  /** compEdit: تجاوز مساحة المقارن (م²) — null يمسح التجاوز. */
  areaOverrideSqm?: number | null;
  weightPct?: number | null;
  weightIsManual?: boolean;
  /** Decision 19.3 — required when weightIsManual. */
  weightOverrideRationale?: string | null;
 /** multiplier (default) | amthal. */
  areaAdjustmentMethod?: string | null;
};

/** شاشة 1 — الأساليب المطبَّقة (ق-2/ق-3) + أساس/وحدة التكلفة + صلاحية التسويات. */
export type ValuationApproachSettingsDto = {
  valuationRequestId: string;
  propertyId: string;
  propertyType: string;
  /** نوع العقار «أرض» (بأي تصنيف). */
  isLandPropertyType: boolean;
  /** سؤال الحصر: هل توجد مبانٍ/إنشاءات يجب تقييمها؟ */
  hasStructuresToValue: boolean;
  /** ق-3 المعدَّل: أرض بلا إنشاءات وحدها تعطّل أسلوب التكلفة. */
  costApproachAllowed: boolean;
  marketApproachEnabled: boolean;
  costApproachEnabled: boolean;
  /** مؤجَّل — يُعرض «قيد الإنشاء» ولا يقبل التفعيل. */
  incomeApproachEnabled: boolean;
  /** replacement | reproduction. */
  costBasisKey: string;
  costBasisLabelAr: string;
  /** نطاق التقييم بالتكلفة: land_and_building (افتراضي) | building_only. */
  costScopeKey?: string;
  costScopeLabelAr?: string;
  /** comparison_unit | quantity_survey | lump_sum | per_item. */
  costMeasurementUnitKey: string;
  costMeasurementUnitLabelAr: string;
  adjustmentsEditUnlocked: boolean;
  /** الغرض من التقييم — auction_liquidation | sale | judicial_execution | sale_purchase | financing | financial_reporting | litigation | other. */
  valuationPurposeKey: string;
  valuationPurposeLabelAr: string;
  valuationPurposeNote?: string | null;
  /** بند الأخصائي الخارجي (IVS 101) — ليس أخصائي الإسناد ولا أخصائي دراسة الحالة. */
  externalSpecialistUsed: boolean;
  externalSpecialistDetails?: string | null;
  /** تاريخ التقييم: issue (إصدار القيمة — آلي) | retrospective (أثر رجعي يدوي). */
  valuationDateMode: string;
  valuationDateModeLabelAr: string;
  retrospectiveDate?: string | null;
  /** yyyy-MM-dd — نهاية الفترة؛ فارغ = تاريخ محدد. */
  retrospectiveDateEnd?: string | null;
  retrospectiveRationale?: string | null;
  /** بنود الافتراضات المنتقاة/المضافة (نصوص مجمّدة). */
  selectedAssumptions: string[];
  /** مكتبة الانتقاء من إعدادات تبويب تقرير التقييم. */
  assumptionLibrary: string[];
  /** false = property-type defaults (no row saved yet). */
  isSaved: boolean;
};

export type SaveValuationApproachSettingsRequest = {
  marketApproachEnabled: boolean;
  costApproachEnabled: boolean;
  incomeApproachEnabled?: boolean;
  costBasisKey?: string | null;
  /** land_and_building (افتراضي) | building_only. */
  costScopeKey?: string | null;
  costMeasurementUnitKey?: string | null;
  adjustmentsEditUnlocked?: boolean;
  /** إلزامي (§4ج-5). */
  valuationPurposeKey?: string | null;
  valuationPurposeNote?: string | null;
  externalSpecialistUsed?: boolean;
  externalSpecialistDetails?: string | null;
  /** issue (افتراضي) | retrospective. */
  valuationDateMode?: string | null;
  /** yyyy-MM-dd — إلزامي عند retrospective (أو بداية الفترة). */
  retrospectiveDate?: string | null;
  /** yyyy-MM-dd — نهاية الفترة؛ فارغ = تاريخ محدد. */
  retrospectiveDateEnd?: string | null;
  retrospectiveRationale?: string | null;
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
      kind: "auth" | "network" | "server" | "validation" | "not_found";
      message?: string;
      errors?: Record<string, string>;
    };

function headers(token: string): HeadersInit {
  return {
    Accept: "application/json",
    "Content-Type": "application/json",
    Authorization: `Bearer ${token}`,
  };
}


export async function getOpenValuationRequestByProperty(
  config: ValuationSelectionsApiConfig,
  propertyId: string,
): Promise<Result<ValuationRequestLiteDto | null>> {
  const base = config.baseUrl ?? getApiBase();
  try {
    const res = await fetch(
      `${base}/api/valuation-requests/open-by-property/${encodeURIComponent(propertyId)}`,
      { headers: headers(config.token) },
    );
    if (res.status === 401) return { ok: false, kind: "auth" };
    if (res.status === 404 || res.status === 204) return { ok: true, data: null };
    if (!res.ok) return { ok: false, kind: "server" };
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
    const today = new Date().toISOString().slice(0, 10);
    const res = await fetch(`${base}/api/valuation-requests/ensure-open`, {
      method: "POST",
      headers: headers(config.token),
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
    if (!res.ok) return { ok: false, kind: "server" };
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
      { headers: headers(config.token) },
    );
    if (res.status === 401) return { ok: false, kind: "auth" };
    if (res.status === 404) return { ok: false, kind: "not_found" };
    if (!res.ok) return { ok: false, kind: "server" };
    return { ok: true, data: await parseJson<ValuationComparableSelectionListDto>(res) };
  } catch {
    return { ok: false, kind: "network" };
  }
}

export async function replaceValuationComparableSelections(
  config: ValuationSelectionsApiConfig,
  valuationRequestId: string,
  items: ValuationComparableSelectionItemRequest[],
  selectionContext: string = "market",
): Promise<Result<ValuationComparableSelectionListDto>> {
  const base = config.baseUrl ?? getApiBase();
  try {
    const res = await fetch(
      `${base}/api/valuation-requests/${valuationRequestId}/comparable-selections`,
      {
        method: "PUT",
        headers: headers(config.token),
        body: JSON.stringify({ items, selectionContext }),
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
    if (!res.ok) return { ok: false, kind: "server" };
    return {
      ok: true,
      data: await parseJson<ValuationComparableSelectionListDto>(res),
    };
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
        headers: headers(config.token),
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
    if (!res.ok) return { ok: false, kind: "server" };
    return {
      ok: true,
      data: await parseJson<ValuationComparableSelectionDto>(res),
    };
  } catch {
    return { ok: false, kind: "network" };
  }
}

export async function removeValuationComparableSelection(
  config: ValuationSelectionsApiConfig,
  valuationRequestId: string,
  comparablePropertyId: string,
  selectionContext: string = "market",
): Promise<Result<null>> {
  const base = config.baseUrl ?? getApiBase();
  try {
    const qs = new URLSearchParams({ selectionContext });
    const res = await fetch(
      `${base}/api/valuation-requests/${valuationRequestId}/comparable-selections/${comparablePropertyId}?${qs}`,
      { method: "DELETE", headers: headers(config.token) },
    );
    if (res.status === 401) return { ok: false, kind: "auth" };
    if (!res.ok) return { ok: false, kind: "server" };
    return { ok: true, data: null };
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
        headers: headers(config.token),
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
            : payload?.message ?? "بيانات التسوية غير صالحة",
        errors: payload?.errors,
      };
    }
    if (!res.ok) return { ok: false, kind: "server" };
    return {
      ok: true,
      data: await parseJson<ValuationComparableSelectionDto>(res),
    };
  } catch {
    return { ok: false, kind: "network" };
  }
}

/** ق-8-1: حفظ/مسح مبرر عامل التسوية الواحد — فارغ يمسح؛ الحد الأدنى ١٠ أحرف (ق-8-2). */
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
        headers: headers(config.token),
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
    if (!res.ok) return { ok: false, kind: "server" };
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
        headers: headers(config.token),
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
    if (!res.ok) return { ok: false, kind: "server" };
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
      { headers: headers(config.token) },
    );
    if (res.status === 401) return { ok: false, kind: "auth" };
    if (res.status === 404) return { ok: false, kind: "not_found" };
    if (!res.ok) return { ok: false, kind: "server" };
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
        headers: headers(config.token),
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
    if (!res.ok) return { ok: false, kind: "server" };
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
      { headers: headers(config.token) },
    );
    if (res.status === 401) return { ok: false, kind: "auth" };
    if (res.status === 404) return { ok: false, kind: "not_found" };
    if (!res.ok) return { ok: false, kind: "server" };
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
        headers: headers(config.token),
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
    if (!res.ok) return { ok: false, kind: "server" };
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
      { headers: headers(config.token) },
    );
    if (res.status === 401) return { ok: false, kind: "auth" };
    if (res.status === 404) return { ok: false, kind: "not_found" };
    if (!res.ok) return { ok: false, kind: "server" };
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
        headers: headers(config.token),
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
            : payload?.message ?? "������ ������� ��� �����",
        errors: payload?.errors,
      };
    }
    if (!res.ok) return { ok: false, kind: "server" };
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
      { headers: headers(config.token) },
    );
    if (res.status === 401) return { ok: false, kind: "auth" };
    if (res.status === 404) return { ok: false, kind: "not_found" };
    if (!res.ok) return { ok: false, kind: "server" };
    return { ok: true, data: await parseJson<ValuationIssuanceGatesDto>(res) };
  } catch {
    return { ok: false, kind: "network" };
  }
}

export type ValuationReportSectionDto = {
  number: number;
  key: string;
  titleAr: string;
  bodyKind: string;
  included: boolean;
  previewText?: string | null;
  fields: Record<string, string | null | undefined>;
};

export type ValuationReportComparableRowDto = {
  index: number;
  comparablePropertyType: string;
  transactionCell: string;
  areaSqmDisplay: string;
  transactionDateDisplay: string;
  priceDisplay: string;
  pricePerSqmDisplay: string;
};

export type ValuationReportAdjustmentRowDto = {
  index: number;
  comparableLabel: string;
  sequentialPctDisplay: string;
  differencePctDisplay: string;
  weightPctDisplay: string;
  adjustedPricePerSqmDisplay: string;
};

export type ValuationReportReconMethodRowDto = {
  labelAr: string;
  approachValueDisplay: string;
  weightPctDisplay: string;
  contributionDisplay: string;
};

export type ValuationReportPrintedAttachmentDto = {
  attachmentId: string;
  contentUrl: string;
  contentType: string;
  dictionaryTypeKey: string;
  labelAr: string;
  fileName: string;
  reportSectionNumber: number;
  isImage: boolean;
  /** 11س — capture date, YYYY/MM/DD. */
  capturedAtDisplay?: string | null;
};

export type ValuationReportDocumentDto = {
  valuationRequestId: string;
  propertyId: string;
  displayId: string;
  hasStructuresToValue: boolean;
  marketApproachUsed: boolean;
  costApproachUsed: boolean;
  incomeApproachUsed: boolean;
  reportNumber?: string | null;
  reportDateDisplay: string;
 /** 90-day validity (advisory). */
  validUntilDisplay?: string | null;
  validityNoteAr?: string | null;
  reportDateHijriDisplay?: string;
  photoBudgetHintAr: string;
  valuerWordPlain: string;
  finalOpinionValue?: number | null;
  finalOpinionDisplay?: string | null;
  finalOpinionTafqit?: string | null;
  weightedValueDisplay?: string | null;
  methodsRationale?: string | null;
  allowsIssuance: boolean;
  textLayerNoteAr: string;
  approvedTemplateUrl?: string;
  /** Org-settings letterhead for the 3-slice render; null keeps the baked one. */
  letterheadImageUrl?: string | null;
  letterheadHeadMm?: number | null;
  letterheadFootTopMm?: number | null;
  letterheadPadMm?: number | null;
  letterheadPadStartMm?: number | null;
  stampWidthCm?: number | null;
  stampHeightCm?: number | null;
  marketMethodLabelAr: string;
  costMethodLabelAr: string;
  incomeMethodLabelAr: string;
  weightedPricePerSqmDisplay?: string | null;
  marketOpinionDisplay?: string | null;
  subjectAreaSqmDisplay?: string | null;
  landValueFromMarketDisplay?: string | null;
  costOpinionWithLandDisplay?: string | null;
  costOpinionBuildingsOnlyDisplay?: string | null;
  comparables: ValuationReportComparableRowDto[];
  adjustments: ValuationReportAdjustmentRowDto[];
  reconciliationMethods: ValuationReportReconMethodRowDto[];
  siteMapAttachments?: ValuationReportPrintedAttachmentDto[];
  photoAttachments?: ValuationReportPrintedAttachmentDto[];
  surveyAttachments?: ValuationReportPrintedAttachmentDto[];
  deedAttachments?: ValuationReportPrintedAttachmentDto[];
  sections: ValuationReportSectionDto[];
};

export async function getValuationReportDocument(
  config: ValuationSelectionsApiConfig,
  valuationRequestId: string,
): Promise<Result<ValuationReportDocumentDto>> {
  const base = config.baseUrl ?? getApiBase();
  try {
    const res = await fetch(
      `${base}/api/valuation-requests/${valuationRequestId}/report-document`,
      { headers: headers(config.token) },
    );
    if (res.status === 401) return { ok: false, kind: "auth" };
    if (res.status === 404) return { ok: false, kind: "not_found" };
    if (!res.ok) return { ok: false, kind: "server" };
    return { ok: true, data: await parseJson<ValuationReportDocumentDto>(res) };
  } catch {
    return { ok: false, kind: "network" };
  }
}

export async function getValuationReportPdf(
  config: ValuationSelectionsApiConfig,
  valuationRequestId: string,
): Promise<Result<Blob>> {
  const base = config.baseUrl ?? getApiBase();
  try {
    const res = await fetch(
      `${base}/api/valuation-requests/${valuationRequestId}/report-document/pdf`,
      { headers: { Authorization: `Bearer ${config.token}`, Accept: "application/pdf" } },
    );
    if (res.status === 401) return { ok: false, kind: "auth" };
    if (res.status === 404) return { ok: false, kind: "not_found" };
    if (!res.ok) return { ok: false, kind: "server" };
    return { ok: true, data: await res.blob() };
  } catch {
    return { ok: false, kind: "network" };
  }
}

/* ─── ق-6: الإصدار ثنائي المرحلة + شهادة الإيداع ─── */

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
  hasDepositPdf: boolean;
  hasFinalPdf: boolean;
};

export async function getReportIssuanceState(
  config: ValuationSelectionsApiConfig,
  valuationRequestId: string,
): Promise<Result<ValuationReportIssuanceStateDto>> {
  const base = config.baseUrl ?? getApiBase();
  try {
    const res = await fetch(
      `${base}/api/valuation-requests/${valuationRequestId}/report-issuance`,
      { headers: headers(config.token) },
    );
    if (res.status === 401) return { ok: false, kind: "auth" };
    if (res.status === 404) return { ok: false, kind: "not_found" };
    if (!res.ok) return { ok: false, kind: "server" };
    return { ok: true, data: await parseJson<ValuationReportIssuanceStateDto>(res) };
  } catch {
    return { ok: false, kind: "network" };
  }
}

async function postIssuance(
  config: ValuationSelectionsApiConfig,
  url: string,
  body?: unknown,
): Promise<Result<ValuationReportIssuanceStateDto>> {
  try {
    const res = await fetch(url, {
      method: "POST",
      headers: headers(config.token),
      body: body === undefined ? undefined : JSON.stringify(body),
    });
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
          : (payload?.message ?? "تعذّر تنفيذ خطوة الإصدار"),
        errors: payload?.errors,
      };
    }
    if (!res.ok) return { ok: false, kind: "server" };
    return { ok: true, data: await parseJson<ValuationReportIssuanceStateDto>(res) };
  } catch {
    return { ok: false, kind: "network" };
  }
}

/** ق-6-1: عند اكتمال الحواجب — تجميد كامل + توليد نسخة الإيداع (خانة الرمز فارغة). */
export function issueDepositVersion(
  config: ValuationSelectionsApiConfig,
  valuationRequestId: string,
): Promise<Result<ValuationReportIssuanceStateDto>> {
  const base = config.baseUrl ?? getApiBase();
  return postIssuance(
    config,
    `${base}/api/valuation-requests/${valuationRequestId}/report-issuance/deposit`,
  );
}

/** ق-6-3/4: تسجيل الشهادة والرمز — يولّد النسخة النهائية بصفحة الشهادة والرمز في الميتا. */
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

/** تنزيل نسخة الإيداع أو النسخة النهائية PDF. */
export async function getIssuancePdf(
  config: ValuationSelectionsApiConfig,
  valuationRequestId: string,
  kind: "deposit" | "final",
): Promise<Result<Blob>> {
  const base = config.baseUrl ?? getApiBase();
  try {
    const res = await fetch(
      `${base}/api/valuation-requests/${valuationRequestId}/report-issuance/${kind}-pdf`,
      { headers: { Authorization: `Bearer ${config.token}`, Accept: "application/pdf" } },
    );
    if (res.status === 401) return { ok: false, kind: "auth" };
    if (res.status === 404) return { ok: false, kind: "not_found" };
    if (!res.ok) return { ok: false, kind: "server" };
    return { ok: true, data: await res.blob() };
  } catch {
    return { ok: false, kind: "network" };
  }
}

export type ValuationReportFieldDto = {
  fieldKey: string;
  labelAr: string;
  valueType: string;
  valueTypeLabelAr: string;
  sourceKind: string;
  value?: string | null;
  filled: boolean;
  note?: string | null;
};

export type ValuationReportFieldPayloadDto = {
  valuationRequestId: string;
  displayId: string;
  propertyId: string;
  hasStructuresToValue: boolean;
  catalogCount: number;
  resolvableCount: number;
  filledCount: number;
  deferredCount: number;
  assetCount: number;
  packageNoteAr: string;
  fields: ValuationReportFieldDto[];
  valuesByFieldKey: Record<string, string>;
  /** Set when adopted comparables exceed the platform's 3 slots. */
  truncationNoteAr?: string | null;
};

export async function getValuationReportFieldPayload(
  config: ValuationSelectionsApiConfig,
  valuationRequestId: string,
): Promise<Result<ValuationReportFieldPayloadDto>> {
  const base = config.baseUrl ?? getApiBase();
  try {
    const res = await fetch(
      `${base}/api/valuation-requests/${valuationRequestId}/valuation-report-fields`,
      { headers: headers(config.token) },
    );
    if (res.status === 401) return { ok: false, kind: "auth" };
    if (res.status === 404) return { ok: false, kind: "not_found" };
    if (!res.ok) return { ok: false, kind: "server" };
    return { ok: true, data: await parseJson<ValuationReportFieldPayloadDto>(res) };
  } catch {
    return { ok: false, kind: "network" };
  }
}
