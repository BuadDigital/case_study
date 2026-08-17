import { getApiBase } from "./index";
import type { ComparablePropertyDto } from "./comparable-properties";

export type ValuationComparableAdjustmentLineDto = {
  id: string;
  factorKey: string;
  labelAr: string;
  percent: number;
  rationale: string;
  isIncluded: boolean;
  sortOrder: number;
};

export type ValuationComparableMarketDto = {
  adjustmentLines: ValuationComparableAdjustmentLineDto[];
  sumSequentialPct: number;
  sumDifferencePct: number;
  sumIncludedPct: number;
  exceedsLargeAdjustmentThreshold: boolean;
  dealAgeMonths: number;
  pricePerSqmAfterSequential: number;
  pricePerSqmAfterDifference: number;
  suggestedWeightPct: number;
  effectiveWeightPct: number;
  weightIsManual: boolean;
  weightPct?: number | null;
  /** Decision 19.3 — required when weightIsManual. */
  weightOverrideRationale?: string | null;
 /** multiplier | amthal. */
  areaAdjustmentMethod: string;
 /** computed suggestion (provisional until v3). */
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
};

export type ValuationComparableSelectionListDto = {
  valuationRequestId: string;
  propertyId: string;
  adoptedCount: number;
  meetsMinimumAdoptedGate: boolean;
  weightsSumTo100: boolean;
  weightedPricePerSqm: number;
  subjectAreaSqm?: number | null;
 /** price_per_sqm | whole_property. */
  adjustmentBasis: string;
  adjustmentBasisLabelAr: string;
  marketOpinionValue: number;
  analysisNotes?: string | null;
  items: ValuationComparableSelectionDto[];
};

export type SaveValuationMarketApproachRequest = {
  subjectAreaSqm?: number | null;
 /** price_per_sqm (default) | whole_property. */
  adjustmentBasis?: string | null;
  analysisNotes?: string | null;
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
  lineTotal: number;
  rationale: string;
  isIncluded: boolean;
  sortOrder: number;
};

export type ValuationCostApproachDto = {
  valuationRequestId: string;
  propertyId: string;
 /** market weighted unit rate imported at land import (locked). */
  landUnitRateFromMarket: number;
  landAreaSqm: number;
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
  costOpinionWithLand: number;
  costOpinionBuildingsOnly: number;
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
  importLandFromMarket?: boolean;
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
  isIncluded?: boolean;
  sortOrder?: number;
};

export type SaveValuationComparableMarketRequest = {
  adjustmentLines: SaveValuationComparableAdjustmentLineRequest[];
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
  /** comparison_unit | quantity_survey | lump_sum | per_item. */
  costMeasurementUnitKey: string;
  costMeasurementUnitLabelAr: string;
  adjustmentsEditUnlocked: boolean;
  /** الغرض من التقييم (§4ج-5) — judicial_execution | sale_purchase | financing | financial_reporting | litigation | other. */
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
  costMeasurementUnitKey?: string | null;
  adjustmentsEditUnlocked?: boolean;
  /** إلزامي (§4ج-5). */
  valuationPurposeKey?: string | null;
  valuationPurposeNote?: string | null;
  externalSpecialistUsed?: boolean;
  externalSpecialistDetails?: string | null;
  /** issue (افتراضي) | retrospective. */
  valuationDateMode?: string | null;
  /** yyyy-MM-dd — إلزامي عند retrospective. */
  retrospectiveDate?: string | null;
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

async function parseJson<T>(res: Response): Promise<T> {
  return (await res.json()) as T;
}

export async function getOpenValuationRequestByProperty(
  config: ValuationSelectionsApiConfig,
  propertyId: string,
): Promise<Result<ValuationRequestLiteDto>> {
  const base = config.baseUrl ?? getApiBase();
  try {
    const res = await fetch(
      `${base}/api/valuation-requests/open-by-property/${encodeURIComponent(propertyId)}`,
      { headers: headers(config.token) },
    );
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
): Promise<Result<ValuationComparableSelectionListDto>> {
  const base = config.baseUrl ?? getApiBase();
  try {
    const res = await fetch(
      `${base}/api/valuation-requests/${valuationRequestId}/comparable-selections`,
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
): Promise<Result<ValuationComparableSelectionListDto>> {
  const base = config.baseUrl ?? getApiBase();
  try {
    const res = await fetch(
      `${base}/api/valuation-requests/${valuationRequestId}/comparable-selections`,
      {
        method: "PUT",
        headers: headers(config.token),
        body: JSON.stringify({ items }),
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
): Promise<Result<ValuationComparableSelectionDto>> {
  const base = config.baseUrl ?? getApiBase();
  try {
    const res = await fetch(
      `${base}/api/valuation-requests/${valuationRequestId}/comparable-selections/${comparablePropertyId}/adopt`,
      {
        method: "POST",
        headers: headers(config.token),
        body: JSON.stringify({ isAdopted }),
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
): Promise<Result<null>> {
  const base = config.baseUrl ?? getApiBase();
  try {
    const res = await fetch(
      `${base}/api/valuation-requests/${valuationRequestId}/comparable-selections/${comparablePropertyId}`,
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

export type ValuationReportFieldDto = {
  code: string;
  labelAr: string;
  fieldKey: string;
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
  valuesByCode: Record<string, string>;
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
