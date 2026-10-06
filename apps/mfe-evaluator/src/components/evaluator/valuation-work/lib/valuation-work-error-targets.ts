/**
 * Save-time validation errors on the appraiser's valuation screens → the DOM
 * control that caused them, plus the screen that control lives on.
 *
 * The valuation services answer a failed write with a flat `errors` map keyed
 * by the request field (`methodsRationale`, `lines[2].unitCostSar`), and the
 * ASP.NET model-state 400 answers with the DTO property name in Pascal case
 * (`MethodsRationale: ["…"]`). Both shapes normalize here, so a failed save can
 * mark its own field red and jump to it the way «البيانات الأولية» and نموذج
 * المعاينة already do — instead of only naming the tab in a toast.
 *
 * No React, no I/O.
 */

import type { ValuationWorkScreenId } from "./shell-state";

export type ValuationWorkErrorTarget = {
  /**
   * Server field key. An indexed key is written with an empty subscript
   * (`lines[].unitCostSar`) and matches any index.
   */
  key: string;
  /** Element id to mark and scroll to. `{i}` takes the index of an indexed key. */
  targetId: string;
  /** Where to look when the exact control is not rendered (collapsed row, long table). */
  fallbackTargetId?: string;
  /** Screen that owns the control. */
  screen: ValuationWorkScreenId;
};

export type ResolvedValuationWorkError = {
  key: string;
  message: string;
  targetId: string;
  fallbackTargetId?: string;
  screen: ValuationWorkScreenId;
};

/**
 * Document order per screen, screens in work order. The first matching entry
 * wins, so the most specific key comes first.
 */
export const VALUATION_WORK_ERROR_TARGETS: readonly ValuationWorkErrorTarget[] = [
  /* ─── البيانات الأساسية — إعدادات الأساليب ─── */
  { key: "costScopeKey", targetId: "as-scope", screen: "basic" },
  { key: "appliedApproaches", targetId: "as-approaches", screen: "basic" },
  { key: "costApproachEnabled", targetId: "as-approaches", screen: "basic" },
  { key: "incomeApproachEnabled", targetId: "as-approaches", screen: "basic" },
  { key: "marketApproachEnabled", targetId: "as-approaches", screen: "basic" },
  { key: "costBasisKey", targetId: "as-cost-basis", fallbackTargetId: "as-approaches", screen: "basic" },
  {
    key: "costMeasurementUnitKey",
    targetId: "as-cost-unit",
    fallbackTargetId: "as-approaches",
    screen: "basic",
  },
  { key: "valuationPurposeKey", targetId: "as-approaches", screen: "basic" },
  { key: "valuationPurposeNote", targetId: "as-approaches", screen: "basic" },
  { key: "valuationDateMode", targetId: "as-valuation-date", screen: "basic" },
  {
    key: "retrospectiveDate",
    targetId: "as-retro-date",
    fallbackTargetId: "as-retro-date-from",
    screen: "basic",
  },
  { key: "retrospectiveDateEnd", targetId: "as-retro-date-to", screen: "basic" },

  /* ─── طريقة المقارنة — المقارنات وجدول التسويات ─── */
  { key: "weightPct", targetId: "mx-adjustments", screen: "market" },
  { key: "weightOverrideRationale", targetId: "mx-adjustments", screen: "market" },
  { key: "areaOverrideSqm", targetId: "mx-adjustments", screen: "market" },
  { key: "priceOverrideSar", targetId: "mx-adjustments", screen: "market" },
  { key: "areaAdjustmentMethod", targetId: "mx-adjustments", screen: "market" },
  { key: "adjustmentLines[].factorKey", targetId: "mx-adjustments", screen: "market" },
  { key: "adjustmentLines[].labelAr", targetId: "mx-adjustments", screen: "market" },
  { key: "adjustmentLines[].percent", targetId: "mx-adjustments", screen: "market" },
  { key: "adjustmentLines[].rationale", targetId: "mx-adjustments", screen: "market" },
  { key: "rationaleAr", targetId: "mx-adjustments", screen: "market" },
  { key: "items[].comparablePropertyId", targetId: "mx-adjustments", screen: "market" },

  /* ─── طريقة المقاول — أسلوب التكلفة ─── */
  { key: "useRestrictionDiscountPct", targetId: "cost-useRestrictionPct", screen: "cost" },
  { key: "apartmentLandShareSqm", targetId: "cost-apartmentLandShare", screen: "cost" },
  {
    key: "lines[].label",
    targetId: "cost-line-{i}-label",
    fallbackTargetId: "cost-lines",
    screen: "cost",
  },
  {
    key: "lines[].unit",
    targetId: "cost-line-{i}-unit",
    fallbackTargetId: "cost-lines",
    screen: "cost",
  },
  {
    key: "lines[].areaSqm",
    targetId: "cost-line-{i}-areaSqm",
    fallbackTargetId: "cost-lines",
    screen: "cost",
  },
  {
    key: "lines[].unitCostSar",
    targetId: "cost-line-{i}-unitCostSar",
    fallbackTargetId: "cost-lines",
    screen: "cost",
  },
  {
    key: "lines[].buildRatioPct",
    targetId: "cost-line-{i}-buildRatioPct",
    fallbackTargetId: "cost-lines",
    screen: "cost",
  },
  {
    key: "lines[].repeatedFloorCount",
    targetId: "cost-line-{i}-repeatedFloorCount",
    fallbackTargetId: "cost-lines",
    screen: "cost",
  },
  // The request drops untouched rows, so an index cannot be mapped back to a
  // rendered row — the card is the honest target.
  { key: "indirectItems[].itemKey", targetId: "cost-indirect", screen: "cost" },
  { key: "indirectItems[].pct", targetId: "cost-indirect", screen: "cost" },
  { key: "financingMonths", targetId: "cost-financingMonths", screen: "cost" },
  { key: "financingAnnualRatePct", targetId: "cost-financingRate", screen: "cost" },
  { key: "actualAgeYears", targetId: "cost-actualAge", fallbackTargetId: "cost-age", screen: "cost" },
  {
    key: "economicAgeYears",
    targetId: "cost-economicAge",
    fallbackTargetId: "cost-age",
    screen: "cost",
  },
  {
    key: "lifeExtensionYears",
    targetId: "cost-lifeExtension",
    fallbackTargetId: "cost-age",
    screen: "cost",
  },
  {
    key: "functionalObsolescencePct",
    targetId: "cost-functionalObs",
    fallbackTargetId: "cost-age",
    screen: "cost",
  },
  {
    key: "externalObsolescencePct",
    targetId: "cost-externalObs",
    fallbackTargetId: "cost-age",
    screen: "cost",
  },

  /* ─── رأي القيمة النهائي — الترجيح ─── */
  {
    key: "methods[].weightPct",
    targetId: "final-method-weight-{i}",
    fallbackTargetId: "final-recon",
    screen: "final",
  },
  {
    key: "methods[].approachKind",
    targetId: "final-method-{i}",
    fallbackTargetId: "final-recon",
    screen: "final",
  },
  { key: "basisOfValueKey", targetId: "final-inf-total", screen: "final" },
  { key: "valuePremiseKey", targetId: "final-inf-total", screen: "final" },
  { key: "liquidationDiscountPct", targetId: "final-inf-discount", screen: "final" },
  {
    key: "liquidationDiscountRationale",
    targetId: "final-inf-discount-rationale",
    screen: "final",
  },
  { key: "finalRoundDecimals", targetId: "final-round-decimals", screen: "final" },
  { key: "methodsRationale", targetId: "final-methods-rationale", screen: "final" },
] as const;

/** Client-side field name → the server key its validation answers with. */
export const COST_FIELD_ERROR_KEYS: Readonly<Record<string, string>> = {
  useRestrictionPct: "useRestrictionDiscountPct",
  apartmentLandShare: "apartmentLandShareSqm",
  financingMonths: "financingMonths",
  financingRate: "financingAnnualRatePct",
  actualAge: "actualAgeYears",
  economicAge: "economicAgeYears",
  lifeExtension: "lifeExtensionYears",
  functionalObs: "functionalObsolescencePct",
  externalObs: "externalObsolescencePct",
};

const INDEXED_KEY = /^(.+)\[(\d+)\](.*)$/;

function camelCaseFirst(key: string): string {
  if (!key) return key;
  return key.charAt(0).toLowerCase() + key.slice(1);
}

/** `Methods[0].WeightPct` → `methods[0].weightPct`; `MethodsRationale` → `methodsRationale`. */
function normalizeKey(raw: string): string {
  return raw
    .split(".")
    .map((part) => camelCaseFirst(part.trim()))
    .join(".");
}

/**
 * One flat `{ key: message }` map out of either wire shape — the services'
 * flat strings or model state's string arrays. Keys keep their index.
 */
export function normalizeValuationWorkErrors(
  raw: Record<string, string | string[]> | null | undefined,
): Record<string, string> {
  if (!raw) return {};
  const out: Record<string, string> = {};
  for (const [key, value] of Object.entries(raw)) {
    const message = Array.isArray(value)
      ? value.find((v) => typeof v === "string" && v.trim())
      : value;
    if (typeof message !== "string" || !message.trim()) continue;
    out[normalizeKey(key)] = message.trim();
  }
  return out;
}

/** The registry key for an error key, with its index when the key is indexed. */
function matchTarget(
  key: string,
): { target: ValuationWorkErrorTarget; index: string | null } | null {
  for (const target of VALUATION_WORK_ERROR_TARGETS) {
    if (target.key === key) return { target, index: null };
  }
  const indexed = INDEXED_KEY.exec(key);
  if (!indexed) return null;
  const generic = `${indexed[1]}[]${indexed[3]}`;
  for (const target of VALUATION_WORK_ERROR_TARGETS) {
    if (target.key === generic) return { target, index: indexed[2]! };
  }
  return null;
}

/**
 * First error (registry order) that has a control to point at. Unknown keys
 * keep their message for the toast but have no target.
 */
export function firstValuationWorkError(
  errors: Record<string, string>,
): ResolvedValuationWorkError | null {
  let best: { at: number; resolved: ResolvedValuationWorkError } | null = null;
  for (const [key, message] of Object.entries(errors)) {
    if (!message?.trim()) continue;
    const match = matchTarget(key);
    if (!match) continue;
    const at = VALUATION_WORK_ERROR_TARGETS.indexOf(match.target);
    if (best && best.at <= at) continue;
    const index = match.index ?? "";
    best = {
      at,
      resolved: {
        key,
        message: message.trim(),
        targetId: match.target.targetId.replace("{i}", index),
        fallbackTargetId: match.target.fallbackTargetId?.replace("{i}", index),
        screen: match.target.screen,
      },
    };
  }
  return best?.resolved ?? null;
}

/** Any message on the map — targeted first, then whatever the server sent. */
export function valuationWorkErrorMessage(
  errors: Record<string, string>,
): string | null {
  const targeted = firstValuationWorkError(errors);
  if (targeted) return targeted.message;
  for (const value of Object.values(errors)) {
    if (value?.trim()) return value.trim();
  }
  return null;
}

export const VALUATION_WORK_SCREEN_LABELS: Readonly<
  Record<ValuationWorkScreenId, string>
> = {
  basic: "البيانات الأساسية",
  market: "طريقة المقارنة",
  cost: "طريقة المقاول",
  final: "رأي القيمة النهائي",
  review: "المراجعة النهائية",
};
