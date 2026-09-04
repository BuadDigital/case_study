/**
 * Pure rules behind `AdjustmentsMatrix` — which rows the table shows, the
 * comparison-basis readouts under it and the alert panel. No React, no I/O.
 */
import type {
  ValuationComparableSelectionDto,
  ValuationComparableSelectionListDto,
} from "@platform/api-client";

import {
  AUTO_AREA_KEY,
  SEQUENTIAL_KEYS,
  SEQUENTIAL_SET,
  factorDescriptor,
} from "./factor-registry";

export type MatrixAlert = { kind: "error" | "ok"; title: string; body: string };

export type MatrixBasisView = {
  basis: string;
  /** Adjustments are per square metre unless the basis is the whole property. */
  isUnit: boolean;
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
    const fromUi = Number(String(subjectArea ?? "").replace(",", "."));
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
    pricePerSqmDisplay,
    opinionRaw: selection.marketOpinionValueRaw ?? selection.marketOpinionValue,
    opinionFinal: selection.marketOpinionValue,
    areaMethod:
      adopted[0]?.market?.areaAdjustmentMethod === "multiplier"
        ? "طريقة المضاعف — آلية"
        : "طريقة الأمثال — آلية",
    areaFactor: selection.areaFactorPct ?? 5,
  };
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

export type MatrixFactorRows = {
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

/** Catalog factors not already on the table — the “add factor” row options. */
export function addableFactorOptions(
  catalogFactors: { factorKey: string; labelAr: string }[] | undefined,
  differenceKeys: string[],
): { factorKey: string; labelAr: string }[] {
  return (catalogFactors ?? []).filter(
    (f) =>
      !differenceKeys.includes(f.factorKey) &&
      !SEQUENTIAL_SET.has(f.factorKey) &&
      f.factorKey !== AUTO_AREA_KEY,
  );
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
  if (Math.round(weightsSum) !== 100) {
    alerts.push({
      kind: "error",
      title: `مجموع الأوزان ${Math.round(weightsSum * 100) / 100}٪ ≠ ١٠٠٪`,
      body: "عدّل الأوزان اليدوية أو أعد الضبط للاقتراح الآلي.",
    });
  }
  for (const c of adopted.filter(
    (i) => i.market?.exceedsLargeAdjustmentThreshold,
  )) {
    alerts.push({
      kind: "error",
      title: `المقارن ${c.comparable.referenceCode} — مجموع التسويات ${formatPct(c.market?.sumDifferencePct ?? 0)}`,
      body: "تجاوز ±٣٥٪ — التبرير إلزامي، مع مراجعة صلاحية المقارن أصلاً.",
    });
  }
  if (alerts.length === 0) {
    alerts.push({
      kind: "ok",
      title: "لا تنبيهات",
      body: "الأوزان مضبوطة على ١٠٠٪ ولا مقارن تجاوز حدود التسوية.",
    });
  }
  return alerts;
}
