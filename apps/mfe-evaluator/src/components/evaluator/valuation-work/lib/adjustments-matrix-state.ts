// ── Valuation fixes · 2026-10-25/26 ──────────────────────────────────────────────────────────
// Round 1 (5b554f4e)
//  • Wording  New outputLabel: «قيمة الأرض قبل التقريب» only for the land table inside the cost approach,
//             «قيمة العقار قبل التقريب» otherwise.
//  • On the whole-property basis the area method reads «لا تسوية مساحة — المقارنة على قيمة العقار كاملة».
//  • New grossAdjustmentPct (Σ|%| of included lines); the ±40٪ alert shows net and gross and says it
//         fires on either.
// Round 2 (1b19bedc)
//  • A    New outputFormula (matrixOutputFormula): for an apartment's land, rate × the apartment's share
//         of the plot, with the area adjustment against the whole building plot area.
// ──────────────────────────────────────────────────────────────────────────────────────────────

/**
 * Pure rules behind `AdjustmentsMatrix` — which rows the table shows, the
 * comparison-basis readouts under it and the alert panel. No React, no I/O.
 */
import { AreaMethodChoices } from "@platform/api-client";
import type {
  ValuationComparableSelectionDto,
  ValuationComparableSelectionListDto,
} from "@platform/api-client";
import { fmt, fmtMax, parseLocaleNumber } from "@platform/app-shared/format/number";

import {
  AUTO_AREA_KEYS,
  FACTOR_REGISTRY,
  SEQUENTIAL_KEYS,
  SEQUENTIAL_SET,
  factorDescriptor,
} from "./factor-registry";
import type { AreaCashRateSource, AreaMethodCellProps } from "./area-cash-rates";
import type { AreaLine } from "./matrix-actions";
import { marketSubjectAreaLabel, type MarketSubjectKind } from "./market-subject";
import { weightsSumTo100 } from "./weights";

/** The land table inside the cost approach (shell-state's LAND_WITHIN_COST). */
const LAND_WITHIN_COST = "land_within_cost";

export type MatrixAlert = { kind: "error" | "ok"; title: string; body: string };

export type MatrixBasisView = {
  basis: string;
  /** Adjustments are per square metre unless the basis is the whole property. */
  isUnit: boolean;
  /** «قيمة الأرض» only for the land table inside the cost approach — the market table values the property. */
  outputLabel: string;
  /** What the output multiplies —: an apartment's land is the rate × its share of the plot. */
  outputFormula: string;
  pricePerSqmDisplay: number | null;
  /** What the per-m² readout is a metre of — «ما يعادل متر البناء» for a building on the whole basis. */
  pricePerSqmLabel: string;
  /** How the subject's area is named: «مساحة الأرض» / «مسطح البناء» / «مساحة الشقة». */
  subjectAreaLabel: string;
  opinionRaw: number | null;
  opinionFinal: number | null;
  /** The line under the value: the rounded market value (market table) or why the land stays raw. */
  roundingNote: string;
  areaMethod: string;
  areaFactor: number;
  /**
   * A built subject's table (2026-11-15): two area rows — the building's and the land's — each
   * with its own factor and method, and a ✓ to leave one of them out.
   */
  twoAreas: boolean;
  /** The first area row's name: «المساحة», or the building's / the apartment's on a two-row table. */
  areaRowLabel: string;
  landAreaMethod: string;
  landAreaFactor: number;
  /** The subject's land area the land row compares with (typed, else the deed's); null when unknown. */
  subjectLandArea: number | null;
  /** Under the subject's land area: where the figure came from. */
  subjectLandAreaNote: string;
  /** The appraiser's pick per area row — "" while the table chooses automatically (2026-11-16). */
  areaMethodChoice: string;
  landAreaMethodChoice: string;
  /** The cash method can be offered: a whole-value table with area rows. */
  cashAllowed: boolean;
  /** The method in force is cash on that row. */
  areaIsCash: boolean;
  landAreaIsCash: boolean;
  /** The rate per m² each cash row multiplies; null while not entered. */
  areaCashRate: number | null;
  landAreaCashRate: number | null;
};

/**
 * What: the line under an area row's name — which method is in force and who chose it.
 * How it works: «طريقة المضاعف — آلية» while the table chooses; «— اختيار المقيّم» once the appraiser
 * picked it (2026-11-16); a cash row says what it multiplies.
 * Edge cases: a cash pick on a per-m² table is not in force there — the table's automatic choice is,
 * so the line says «آلية» (found in the browser run: it said «اختيار المقيّم» beside «آلي»).
 */
function areaMethodLabel(method: string | null | undefined, chosen: string | null | undefined): string {
  if (method === AreaMethodChoices.Cash) return "مبلغ نقدي = فرق المساحة × سعر المتر";
  const name = method === AreaMethodChoices.Multiplier ? "طريقة المضاعف" : "طريقة الأمثال";
  return `${name} — ${chosen && chosen === method ? "اختيار المقيّم" : "آلية"}`;
}

/** Comparison-basis readouts shown in the matrix header and output strip. */
export function matrixBasisView(
  selection: ValuationComparableSelectionListDto,
  adopted: ValuationComparableSelectionDto[],
  subjectArea: string,
  /** The market table's subject (2026-10-29); the land table inside the cost approach is always land. */
  subjectKind: MarketSubjectKind = "land",
): MatrixBasisView {
  const kind = selection.selectionContext === LAND_WITHIN_COST ? "land" : subjectKind;
  const subjectAreaLabel = marketSubjectAreaLabel(kind);
  const basis = selection.adjustmentBasis || "price_per_sqm";
  const isUnit = basis !== "whole_property";
  const twoAreas = selection.twoAreaAdjustments === true;
  const subjectLandArea =
    selection.subjectLandAreaSqm != null && selection.subjectLandAreaSqm > 0
      ? selection.subjectLandAreaSqm
      : null;
  /** When basis is property value: weightedPricePerSqm holds the total — per-sqm = total ÷ area. */
  let pricePerSqmDisplay: number | null = selection.weightedPricePerSqm ?? null;
  if (!isUnit) {
    // Transaction area (from the UI) wins over a stale server value when they differ.
    const fromUi = parseLocaleNumber(subjectArea);
    const area =
      (Number.isFinite(fromUi) && fromUi > 0 ? fromUi : null) ??
      (selection.subjectAreaSqm != null && selection.subjectAreaSqm > 0
        ? selection.subjectAreaSqm
        : null) ??
      0;
    // The unrounded value: the per-m² readout must not move with the 10,000 rounding.
    const opinion =
      selection.marketOpinionValueRaw ?? selection.marketOpinionValue ?? selection.weightedPricePerSqm ?? 0;
    pricePerSqmDisplay = area > 0 && opinion > 0 ? opinion / area : null;
  }
  return {
    basis,
    isUnit,
    outputLabel:
      selection.selectionContext === LAND_WITHIN_COST
        ? "قيمة الأرض قبل التقريب"
        : "قيمة العقار قبل التقريب",
    outputFormula: matrixOutputFormula(selection, isUnit, subjectAreaLabel),
    pricePerSqmDisplay,
    pricePerSqmLabel:
      isUnit || kind === "land" ? "قيمة المتر المربع" : `ما يعادل متر ${kind === "unit" ? "الشقة" : "البناء"}`,
    subjectAreaLabel,
    opinionRaw: selection.marketOpinionValueRaw ?? selection.marketOpinionValue,
    opinionFinal: selection.marketOpinionValue,
    roundingNote: matrixRoundingNote(selection),
    // A table with one area row has no area adjustment on the whole-property basis (the server
    // sends 0); a built subject's two rows apply on either basis.
    areaMethod:
      !isUnit && !twoAreas
        ? "لا تسوية مساحة — المقارنة على قيمة العقار كاملة"
        : areaMethodLabel(adopted[0]?.market?.areaAdjustmentMethod, selection.areaAdjustmentMethodChoice),
    areaFactor: selection.areaFactorPct ?? 5,
    twoAreas,
    areaRowLabel: !twoAreas ? "المساحة" : kind === "unit" ? "مساحة الشقة" : "مساحة المباني",
    landAreaMethod: areaMethodLabel(
      adopted[0]?.market?.landAreaAdjustmentMethod,
      selection.landAreaAdjustmentMethodChoice,
    ),
    landAreaFactor: selection.landAreaFactorPct ?? 5,
    areaMethodChoice: selection.areaAdjustmentMethodChoice ?? "",
    landAreaMethodChoice: selection.landAreaAdjustmentMethodChoice ?? "",
    cashAllowed: selection.cashAreaAdjustmentAllowed === true,
    areaIsCash: adopted[0]?.market?.areaAdjustmentMethod === AreaMethodChoices.Cash,
    landAreaIsCash: adopted[0]?.market?.landAreaAdjustmentMethod === AreaMethodChoices.Cash,
    areaCashRate: selection.areaCashRateSar ?? null,
    landAreaCashRate: selection.landAreaCashRateSar ?? null,
    subjectLandArea,
    subjectLandAreaNote:
      subjectLandArea == null
        ? "أدخل مساحة الأرض"
        : selection.subjectLandAreaIsManual
          ? "مساحة الأرض — مُدخلة"
          : "مساحة الأرض — من الصك",
  };
}

/** Where each area row's cash rate can come from — the land comparables, the cost approach. */
export type AreaCashRateSources = { area: AreaCashRateSource | null; land: AreaCashRateSource | null };

/** What one area row's method picker shows (2026-11-16) — shared by the table and the phone cards. */
export function areaMethodCellProps(
  view: Pick<
    MatrixBasisView,
    | "areaMethodChoice"
    | "landAreaMethodChoice"
    | "cashAllowed"
    | "areaIsCash"
    | "landAreaIsCash"
    | "areaCashRate"
    | "landAreaCashRate"
  >,
  line: AreaLine,
  sources?: AreaCashRateSources,
): AreaMethodCellProps {
  const land = line === "land";
  return {
    choice: land ? view.landAreaMethodChoice : view.areaMethodChoice,
    cashAllowed: view.cashAllowed,
    isCash: land ? view.landAreaIsCash : view.areaIsCash,
    cashRate: land ? view.landAreaCashRate : view.areaCashRate,
    rateSource: sources?.[line] ?? null,
  };
}

/**
 * «لأقرب 10,000 ر.س» for the request's rounding exponent (`valueRoundDecimals`, 10^n); 0 → «لأقرب ريال».
 * A missing setting reads as the server default (4).
 */
export function roundStepLabel(valueRoundDecimals: number | null | undefined): string {
  const d = Math.min(6, Math.max(0, Math.trunc(valueRoundDecimals ?? 4)));
  return d === 0 ? "لأقرب ريال" : `لأقرب ${fmt(10 ** d)} ر.س`;
}

/**
 * What: the line under the matrix value.
 * How it works: the market table shows the server's rounded `marketOpinionValue` — the figure the
 * reconciliation and the report read — beside the unrounded one above it. The land table inside the
 * cost approach is never rounded (the cost approach reads its rate), so it says so.
 * Edge cases and what was fixed (2026-11-10): the server never applied the rounding setting and this
 * line promised «التقريب مرة واحدة بعد الترجيح النهائي»; the market value is rounded now, so the screen
 * shows the same rounded figure. When both figures are equal (already round, or a deposited request that
 * keeps its unrounded value) the line just says the value enters the reconciliation as it is.
 */
export function matrixRoundingNote(selection: ValuationComparableSelectionListDto): string {
  if (selection.selectionContext === LAND_WITHIN_COST) {
    return "بلا تقريب هنا — قيمة الأرض مُدخل في أسلوب التكلفة";
  }
  const raw = selection.marketOpinionValueRaw ?? selection.marketOpinionValue;
  const rounded = selection.marketOpinionValue;
  if (rounded == null || raw == null || rounded === raw) {
    return "هذه القيمة تدخل الترجيح كما هي";
  }
  return `بعد التقريب (${roundStepLabel(selection.valueRoundDecimals)}): ${fmt(rounded)} ر.س — القيمة التي تدخل الترجيح`;
}

function matrixOutputFormula(
  selection: ValuationComparableSelectionListDto,
  isUnit: boolean,
  subjectAreaLabel: string,
): string {
  if (!isUnit) return "أساس الكل — بلا ضرب في المساحة (يساوي المتوسط المرجّح)";
  if (selection.selectionContext !== LAND_WITHIN_COST) return `سعر المتر بعد التسوية × ${subjectAreaLabel}`;
  const share = selection.apartmentLandShareSqm ?? 0;
  const plot = selection.subjectAreaSqm ?? 0;
  if (share > 0) {
    return `سعر المتر بعد التسوية × حصة الشقة ${fmtMax(share)} م² — تسوية المساحة على أرض العمارة كاملة ${plot > 0 ? `${fmtMax(plot)} م²` : "(أدخلها في بطاقة قيمة الأرض)"}`;
  }
  return "سعر المتر بعد التسوية × مساحة الأرض";
}

/** Factor keys in the order the adopted comparables' lines introduce them. */
export function factorKeysFromLines(
  adopted: ValuationComparableSelectionDto[],
): string[] {
  const keys: string[] = [];
  const seen = new Set<string>();
  for (const item of adopted) {
    for (const line of item.market?.adjustmentLines ?? []) {
      if (seen.has(line.factorKey)) continue;
      seen.add(line.factorKey);
      keys.push(line.factorKey);
    }
  }
  return keys;
}

type MatrixFactorRows = {
  sequentialKeys: string[];
  /** Deletable sequential rows the evaluator removed — shown as restore chips. */
  removedSequential: string[];
  differenceKeys: string[];
};

/** Sequential rows come from the registry; a deleted one hides and offers a restore chip. */
export function matrixFactorRows(
  factorKeysFromData: string[],
): MatrixFactorRows {
  return {
    sequentialKeys: SEQUENTIAL_KEYS.filter(
      (k) => factorDescriptor(k)?.alwaysPresent || factorKeysFromData.includes(k),
    ),
    removedSequential: SEQUENTIAL_KEYS.filter(
      (k) =>
        !factorDescriptor(k)?.alwaysPresent && !factorKeysFromData.includes(k),
    ),
    // The area rows (the building's, and a built subject's land) are drawn on their own.
    differenceKeys: factorKeysFromData.filter(
      (k) => !SEQUENTIAL_SET.has(k) && !AUTO_AREA_KEYS.has(k),
    ),
  };
}

/** Catalog + default difference factors not already on the table — the “add factor” row options. */
export function addableFactorOptions(
  differenceKeys: string[],
): { factorKey: string; labelAr: string }[] {
  const out: { factorKey: string; labelAr: string }[] = [];
  for (const [factorKey, d] of Object.entries(FACTOR_REGISTRY)) {
    if (d.sequential || AUTO_AREA_KEYS.has(factorKey)) continue;
    out.push({ factorKey, labelAr: d.label });
  }
  return out.filter((f) => !differenceKeys.includes(f.factorKey));
}

/**
 * Gross adjustment: Σ|%| of the included sequential and difference lines (the server sends the
 * area line with its computed %). +30/−30 nets to 0 but is a 60٪ adjustment.
 */
export function grossAdjustmentPct(item: ValuationComparableSelectionDto): number {
  const lines = item.market?.adjustmentLines ?? [];
  const sum = lines
    .filter((l) => l.isIncluded)
    .reduce((s, l) => s + Math.abs(Number(l.percent) || 0), 0);
  return Math.round(sum * 100) / 100;
}

/**
 * One figure of the market price chain, as the matrix and the summary strip show it.
 *
 * How it works: on the per-m² basis the figure is a rate, so it keeps up to two decimals; on the
 * whole-property basis it is a property value and stays in whole riyals.
 *
 * Edge cases: farm land trades at a few riyals a metre, where a whole number misleads: 4.5 printed
 * as 5, and 5 × the area did not equal the value beside it. Empty → "—".
 */
export function fmtChainValue(value: number | null | undefined, isUnit: boolean): string {
  return isUnit ? fmtMax(value) : fmt(value);
}

export function afterWeightValue(item: ValuationComparableSelectionDto): number {
  const m = item.market;
  if (!m) return 0;
  return (m.pricePerSqmAfterDifference * m.effectiveWeightPct) / 100;
}

/** Alerts panel — interactive-form spec (alerts). */
export function buildMatrixAlerts(
  adopted: ValuationComparableSelectionDto[],
  formatPct: (n: number) => string,
): MatrixAlert[] {
  const alerts: MatrixAlert[] = [];
  const weightsSum = adopted.reduce(
    (s, i) => s + (i.market?.effectiveWeightPct ?? 0),
    0,
  );
  if (!weightsSumTo100(weightsSum)) {
    alerts.push({
      kind: "error",
      title: `مجموع الأوزان النسبية ${Math.round(weightsSum * 100) / 100}٪ ≠ 100٪`,
      body: "عدّل الأوزان اليدوية أو أعد الضبط للاقتراح الآلي.",
    });
  }
  for (const c of adopted.filter(
    (i) => i.market?.exceedsLargeAdjustmentThreshold,
  )) {
    alerts.push({
      kind: "error",
      title: `المقارن ${c.comparable.referenceCode} — صافي التسويات ${formatPct(c.market?.sumDifferencePct ?? 0)} · الإجمالي ${formatPct(grossAdjustmentPct(c)).replace(/^\+/, "")}`,
      body: "تجاوز ±40٪ على الصافي أو على إجمالي التسويات (بالقيمة المطلقة) — التبرير إلزامي، مع مراجعة صلاحية المقارن أصلاً.",
    });
  }
  if (alerts.length === 0) {
    alerts.push({
      kind: "ok",
      title: "لا تنبيهات",
      body: "الأوزان مضبوطة على 100٪ ولا مقارن تجاوز حدود التسوية.",
    });
  }
  return alerts;
}
