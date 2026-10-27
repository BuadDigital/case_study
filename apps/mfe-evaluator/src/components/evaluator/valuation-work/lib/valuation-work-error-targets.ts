// ── Valuation fixes · 2026-10-25/26 ──────────────────────────────────────────────────────────
// Round 1 (5b554f4e)
//  • D11  Server errors for ownershipInterestKey and remainingLeaseYears point at their boxes on the
//         basics screen.
//  • D9   retrospectiveRationale points at «مبرر التقييم بأثر رجعي».
//  • Income  Income-screen targets (D17) for every input and the cap-rate rationale; new
//            INCOME_FIELD_ERROR_KEYS maps screen fields to the server's keys.
// Round 2 (1b19bedc)
//  • Bounds  The matrix header's bounds (area factor, annual market rate, rounding) and the cost totals
//            («lines») point at their tables.
//  • A    buildingPlotAreaSqm points at the new plot-area box.
//  • B    Cost rationales (use restriction, life extension, functional / external obsolescence) and
//         methodologyAlertOverrides.<code> errors point at their boxes; an alert override goes to the
//         screen whose panel shows it (alertOverrideTarget) and sorts after the listed fields.
// ──────────────────────────────────────────────────────────────────────────────────────────────

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
import { methodologyAlertGroup } from "./methodology-alerts";

type ValuationWorkErrorTarget = {
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

type ResolvedValuationWorkError = {
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
  { key: "ownershipInterestKey", targetId: "as-ownership-interest", screen: "basic" },
  {
    key: "remainingLeaseYears",
    targetId: "as-remaining-lease-years",
    fallbackTargetId: "as-ownership-interest",
    screen: "basic",
  },
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
  {
    key: "retrospectiveRationale",
    targetId: "as-retro-rationale",
    fallbackTargetId: "as-valuation-date",
    screen: "basic",
  },

  /* ─── طريقة المقارنة — المقارنات وجدول التسويات ─── */
  { key: "weightPct", targetId: "mx-adjustments", screen: "market" },
  { key: "weightOverrideRationale", targetId: "mx-adjustments", screen: "market" },
  { key: "areaOverrideSqm", targetId: "mx-adjustments", screen: "market" },
  { key: "priceOverrideSar", targetId: "mx-adjustments", screen: "market" },
  { key: "areaAdjustmentMethod", targetId: "mx-adjustments", screen: "market" },
  // Round 2 — the matrix header's bounds (area factor, annual market rate, rounding).
  { key: "areaFactorPct", targetId: "mx-adjustments", screen: "market" },
  { key: "annualMarketRatePct", targetId: "mx-adjustments", screen: "market" },
  { key: "valueRoundDecimals", targetId: "mx-adjustments", screen: "market" },
  { key: "adjustmentLines[].factorKey", targetId: "mx-adjustments", screen: "market" },
  { key: "adjustmentLines[].labelAr", targetId: "mx-adjustments", screen: "market" },
  { key: "adjustmentLines[].percent", targetId: "mx-adjustments", screen: "market" },
  { key: "adjustmentLines[].rationale", targetId: "mx-adjustments", screen: "market" },
  { key: "rationaleAr", targetId: "mx-adjustments", screen: "market" },
  { key: "items[].comparablePropertyId", targetId: "mx-adjustments", screen: "market" },

  /* ─── طريقة المقاول — أسلوب التكلفة ─── */
  { key: "useRestrictionDiscountPct", targetId: "cost-useRestrictionPct", screen: "cost" },
  { key: "useRestrictionRationale", targetId: "cost-useRestrictionRationale", screen: "cost" },
  // The cost totals (amount × quantity) out of range: the lines table as a whole.
  { key: "lines", targetId: "cost-lines", screen: "cost" },
  { key: "apartmentLandShareSqm", targetId: "cost-apartmentLandShare", screen: "cost" },
  { key: "buildingPlotAreaSqm", targetId: "cost-buildingPlotArea", screen: "cost" },
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
  {
    key: "lifeExtensionBasis",
    targetId: "cost-lifeExtensionBasis",
    fallbackTargetId: "cost-age",
    screen: "cost",
  },
  {
    key: "functionalObsolescenceRationale",
    targetId: "cost-functionalObsRationale",
    fallbackTargetId: "cost-age",
    screen: "cost",
  },
  {
    key: "externalObsolescenceRationale",
    targetId: "cost-externalObsRationale",
    fallbackTargetId: "cost-age",
    screen: "cost",
  },

  /* ─── أسلوب الدخل (رسملة مباشرة) — D17 ─── */
  { key: "grossPotentialIncome", targetId: "income-grossPotentialIncome", screen: "income" },
  { key: "vacancyCollectionLossPct", targetId: "income-vacancyPct", screen: "income" },
  { key: "otherIncome", targetId: "income-otherIncome", screen: "income" },
  { key: "operatingExpensesMode", targetId: "income-inputs", screen: "income" },
  {
    key: "operatingExpensesAmount",
    targetId: "income-opexAmount",
    fallbackTargetId: "income-inputs",
    screen: "income",
  },
  {
    key: "operatingExpensesPct",
    targetId: "income-opexPct",
    fallbackTargetId: "income-inputs",
    screen: "income",
  },
  { key: "capitalisationRatePct", targetId: "income-capRatePct", screen: "income" },
  { key: "capRateRationale", targetId: "income-capRateRationale", screen: "income" },

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
  buildingPlotArea: "buildingPlotAreaSqm",
  financingMonths: "financingMonths",
  financingRate: "financingAnnualRatePct",
  actualAge: "actualAgeYears",
  economicAge: "economicAgeYears",
  lifeExtension: "lifeExtensionYears",
  functionalObs: "functionalObsolescencePct",
  externalObs: "externalObsolescencePct",
  useRestrictionRationale: "useRestrictionRationale",
  functionalObsRationale: "functionalObsolescenceRationale",
  externalObsRationale: "externalObsolescenceRationale",
  lifeExtensionBasis: "lifeExtensionBasis",
};

/** D17 — income screen field → the server key its validation answers with. */
export const INCOME_FIELD_ERROR_KEYS = {
  grossPotentialIncome: "grossPotentialIncome",
  vacancyPct: "vacancyCollectionLossPct",
  otherIncome: "otherIncome",
  opexAmount: "operatingExpensesAmount",
  opexPct: "operatingExpensesPct",
  capRatePct: "capitalisationRatePct",
  capRateRationale: "capRateRationale",
} as const;

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

const ALERT_OVERRIDE_PREFIX = "methodologyAlertOverrides.";

/**
 * `methodologyAlertOverrides.m17_large_adjustments` (decision B: a short override rationale) →
 * that alert's rationale box, on the screen whose panel shows the alert.
 */
function alertOverrideTarget(key: string): ValuationWorkErrorTarget | null {
  if (!key.startsWith(ALERT_OVERRIDE_PREFIX)) return null;
  const code = key.slice(ALERT_OVERRIDE_PREFIX.length);
  const number = Number(/^m(\d+)/i.exec(code)?.[1] ?? Number.NaN);
  const group = Number.isFinite(number) ? methodologyAlertGroup(number) : "general";
  return {
    key,
    targetId: `alert-override-${code}`,
    screen: group === "general" ? "final" : group,
  };
}

/** The registry key for an error key, with its index when the key is indexed. */
function matchTarget(
  key: string,
): { target: ValuationWorkErrorTarget; index: string | null } | null {
  const alert = alertOverrideTarget(key);
  if (alert) return { target: alert, index: null };
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
    const listed = VALUATION_WORK_ERROR_TARGETS.indexOf(match.target);
    // Alert overrides are not in the list: they come after every listed field.
    const at = listed < 0 ? VALUATION_WORK_ERROR_TARGETS.length : listed;
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
