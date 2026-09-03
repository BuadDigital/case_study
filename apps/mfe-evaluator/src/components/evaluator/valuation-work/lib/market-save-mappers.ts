import type {
  SaveValuationComparableMarketRequest,
  ValuationComparableAdjustmentLineDto,
  ValuationComparableSelectionDto,
} from "@platform/api-client";
import {
  AUTO_AREA_KEY,
  FACTOR_REGISTRY,
  SEQUENTIAL_SET,
} from "./factor-registry";

// Derived from the factor registry — add a factor there once and it flows here automatically.
export const SEQUENTIAL_KEYS = SEQUENTIAL_SET;
export const AUTO_AREA_KEYS = new Set([AUTO_AREA_KEY]);
export const DEFAULT_DIFFERENCE_KEYS = new Set(
  Object.entries(FACTOR_REGISTRY)
    .filter(([k, d]) => !d.sequential && k !== AUTO_AREA_KEY)
    .map(([k]) => k),
);

export const STANDARD_FACTORS: { factorKey: string; labelAr: string }[] =
  Object.entries(FACTOR_REGISTRY).map(([factorKey, d]) => ({
    factorKey,
    labelAr: d.label,
  }));

export function buildFactorRows(
  adopted: ValuationComparableSelectionDto[],
): { factorKey: string; labelAr: string }[] {
  // Rows come from live data — a deleted sequential item (financing/type) stays deleted
  // until the restore chip brings it back; do not re-impose it here.
  const map = new Map<string, string>();
  const first = adopted[0]?.market?.adjustmentLines;
  if (first?.length) {
    for (const line of first) {
      map.set(
        line.factorKey,
        line.labelAr ||
          STANDARD_FACTORS.find((f) => f.factorKey === line.factorKey)?.labelAr ||
          line.factorKey,
      );
    }
  } else {
    for (const f of STANDARD_FACTORS) map.set(f.factorKey, f.labelAr);
  }
  for (const item of adopted) {
    for (const line of item.market?.adjustmentLines ?? []) {
      if (!map.has(line.factorKey)) map.set(line.factorKey, line.labelAr);
    }
  }
  return Array.from(map.entries()).map(([factorKey, labelAr]) => ({
    factorKey,
    labelAr,
  }));
}

export function linePercent(
  item: ValuationComparableSelectionDto,
  factorKey: string,
): number {
  const line = item.market?.adjustmentLines?.find((l) => l.factorKey === factorKey);
  if (line) return line.percent;
  if (factorKey === "area") return item.market?.suggestedAreaAdjustmentPct ?? 0;
  return 0;
}

export function ensureLinesForSave(
  item: ValuationComparableSelectionDto,
  factorKey: string,
  percent: number,
  factors: { factorKey: string; labelAr: string }[],
): ValuationComparableAdjustmentLineDto[] {
  const existing = item.market?.adjustmentLines ?? [];
  const byKey = new Map(existing.map((l) => [l.factorKey, { ...l }]));
  for (const f of factors) {
    if (!byKey.has(f.factorKey)) {
      byKey.set(f.factorKey, {
        id: crypto.randomUUID(),
        factorKey: f.factorKey,
        labelAr: f.labelAr,
        percent: f.factorKey === "area" ? (item.market?.suggestedAreaAdjustmentPct ?? 0) : 0,
        rationale: "",
        isIncluded: true,
        sortOrder: byKey.size,
      });
    }
  }
  const target = byKey.get(factorKey);
  if (target) {
    target.percent =
      factorKey === "area"
        ? (item.market?.suggestedAreaAdjustmentPct ?? percent)
        : percent;
    target.isIncluded = true;
    // An explicit entry clears the “suggested” state for this item.
    target.isSuggestedValue = false;
  }
  return Array.from(byKey.values()).map((l, i) => ({ ...l, sortOrder: i }));
}

/**
 * Prepare an adjustment line for save: area is pinned to the auto suggestion; “suggested”
 * values (unentered comparable type) are zeroed so a suggestion does not become a permanent manual entry.
 */
export function lineForSave(
  item: ValuationComparableSelectionDto,
  l: ValuationComparableAdjustmentLineDto,
  i: number,
) {
  return {
    id: l.id,
    factorKey: l.factorKey,
    labelAr: l.labelAr,
    percent:
      l.factorKey === "area"
        ? (item.market?.suggestedAreaAdjustmentPct ?? l.percent)
        : l.isSuggestedValue
          ? 0
          : l.percent,
    rationale: l.rationale,
    descriptionAr: l.descriptionAr ?? null,
    isIncluded: l.isIncluded,
    sortOrder: i,
  };
}

/** Adjustments save body while preserving weight and current compEdit overrides. */
export function marketSaveBody(
  item: ValuationComparableSelectionDto,
  lines: ReturnType<typeof lineForSave>[],
  extra?: Partial<SaveValuationComparableMarketRequest>,
) {
  return {
    adjustmentLines: lines,
    weightIsManual: item.market?.weightIsManual ?? false,
    weightPct: item.market?.weightIsManual ? item.market.weightPct ?? null : null,
    weightOverrideRationale: item.market?.weightOverrideRationale ?? null,
    areaAdjustmentMethod: item.market?.areaAdjustmentMethod ?? null,
    priceOverrideSar: item.priceOverrideSar ?? null,
    areaOverrideSqm: item.areaOverrideSqm ?? null,
    ...extra,
  };
}
