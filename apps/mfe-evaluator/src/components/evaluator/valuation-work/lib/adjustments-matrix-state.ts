/**
 * Pure rules behind `AdjustmentsMatrix` — which rows the table shows, the
 * comparison-basis readouts under it and the alert panel. No React, no I/O.
 */
import type {
  ValuationComparableSelectionDto,
  ValuationComparableSelectionListDto,
} from "@platform/api-client";
import { fmtMax, parseLocaleNumber } from "@platform/app-shared/format/number";

import {
  AUTO_AREA_KEY,
  FACTOR_REGISTRY,
  SEQUENTIAL_KEYS,
  SEQUENTIAL_SET,
  factorDescriptor,
} from "./factor-registry";
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
  /** What the output multiplies — decision A: an apartment's land is the rate × its share of the plot. */
  outputFormula: string;
  pricePerSqmDisplay: number | null;
  opinionRaw: number | null;
  opinionFinal: number | null;
  areaMethod: string;
  areaFactor: number;
};

/** Comparison-basis readouts shown in the matrix header and output strip. */
export function matrixBasisView(
  selection: ValuationComparableSelectionListDto,
  adopted: ValuationComparableSelectionDto[],
  subjectArea: string,
): MatrixBasisView {
  const basis = selection.adjustmentBasis || "price_per_sqm";
  const isUnit = basis !== "whole_property";
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
    const opinion =
      selection.marketOpinionValue ?? selection.weightedPricePerSqm ?? 0;
    pricePerSqmDisplay = area > 0 && opinion > 0 ? opinion / area : null;
  }
  return {
    basis,
    isUnit,
    outputLabel:
      selection.selectionContext === LAND_WITHIN_COST
        ? "قيمة الأرض قبل التقريب"
        : "قيمة العقار قبل التقريب",
    outputFormula: matrixOutputFormula(selection, isUnit),
    pricePerSqmDisplay,
    opinionRaw: selection.marketOpinionValueRaw ?? selection.marketOpinionValue,
    opinionFinal: selection.marketOpinionValue,
    // D7: no area adjustment on the whole-property basis (the server sends 0).
    areaMethod: !isUnit
      ? "لا تسوية مساحة — المقارنة على قيمة العقار كاملة"
      : adopted[0]?.market?.areaAdjustmentMethod === "multiplier"
        ? "طريقة المضاعف — آلية"
        : "طريقة الأمثال — آلية",
    areaFactor: selection.areaFactorPct ?? 5,
  };
}

function matrixOutputFormula(
  selection: ValuationComparableSelectionListDto,
  isUnit: boolean,
): string {
  if (!isUnit) return "أساس الكل — بلا ضرب في المساحة (يساوي المتوسط المرجّح)";
  if (selection.selectionContext !== LAND_WITHIN_COST) return "سعر المتر بعد التسوية × مساحة العقار";
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
    differenceKeys: factorKeysFromData.filter(
      (k) => !SEQUENTIAL_SET.has(k) && k !== AUTO_AREA_KEY,
    ),
  };
}

/** Catalog + default difference factors not already on the table — the “add factor” row options. */
export function addableFactorOptions(
  differenceKeys: string[],
): { factorKey: string; labelAr: string }[] {
  const out: { factorKey: string; labelAr: string }[] = [];
  for (const [factorKey, d] of Object.entries(FACTOR_REGISTRY)) {
    if (d.sequential || factorKey === AUTO_AREA_KEY) continue;
    out.push({ factorKey, labelAr: d.label });
  }
  return out.filter((f) => !differenceKeys.includes(f.factorKey));
}

/**
 * D4 gross adjustment: Σ|%| of the included sequential and difference lines (the server sends the
 * area line with its computed %). +30/−30 nets to 0 but is a 60٪ adjustment.
 */
export function grossAdjustmentPct(item: ValuationComparableSelectionDto): number {
  const lines = item.market?.adjustmentLines ?? [];
  const sum = lines
    .filter((l) => l.isIncluded)
    .reduce((s, l) => s + Math.abs(Number(l.percent) || 0), 0);
  return Math.round(sum * 100) / 100;
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
