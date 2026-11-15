import type {
  SaveValuationComparableMarketRequest,
  ValuationComparableAdjustmentLineDto,
  ValuationComparableSelectionDto,
} from "@platform/api-client";
import { createClientId } from "@platform/app-shared/lib/create-client-id";
import {
  AUTO_AREA_KEY,
  AUTO_AREA_KEYS,
  FACTOR_REGISTRY,
  LAND_AREA_KEY,
  SEQUENTIAL_SET,
  factorIncludedByDefault,
} from "./factor-registry";

// Derived from the factor registry — add a factor there once and it flows here automatically.
export const SEQUENTIAL_KEYS = SEQUENTIAL_SET;
export { AUTO_AREA_KEYS };

/**
 * The server's computed percent of an area line — the building's or the land's — or null for any
 * other factor. An area line is saved with this figure, never with a typed one.
 */
export function autoAreaPct(
  item: ValuationComparableSelectionDto,
  factorKey: string,
): number | null {
  if (factorKey === AUTO_AREA_KEY) return item.market?.suggestedAreaAdjustmentPct ?? null;
  if (factorKey === LAND_AREA_KEY) return item.market?.suggestedLandAreaAdjustmentPct ?? null;
  return null;
}

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
  return autoAreaPct(item, factorKey) ?? 0;
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
        id: createClientId("adj"),
        factorKey: f.factorKey,
        labelAr: f.labelAr,
        percent: autoAreaPct(item, f.factorKey) ?? 0,
        rationale: "",
        isIncluded: factorIncludedByDefault(f.factorKey),
        sortOrder: byKey.size,
      });
    }
  }
  const target = byKey.get(factorKey);
  if (target) {
    target.percent = autoAreaPct(item, factorKey) ?? percent;
    target.isIncluded = true;
    // An explicit entry clears the “suggested” state for this item.
    target.isSuggestedValue = false;
  }
  return Array.from(byKey.values()).map((l, i) => ({ ...l, sortOrder: i }));
}

/**
 * Prepare an adjustment line for save: area is pinned to the auto suggestion; “suggested”
 * values (unentered comparable type) are zeroed so a suggestion does not become a permanent manual entry.
 * IDs are always omitted — the API deletes previous rows then inserts, so reusing a stored
 * id collides with the tracked-deleted entities.
 */
export function lineForSave(
  item: ValuationComparableSelectionDto,
  l: ValuationComparableAdjustmentLineDto,
  i: number,
) {
  return {
    id: null,
    factorKey: l.factorKey,
    labelAr: l.labelAr,
    percent: AUTO_AREA_KEYS.has(l.factorKey)
      ? (autoAreaPct(item, l.factorKey) ?? l.percent)
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
    // Sent on every save: the server clears an override that is not sent.
    landAreaOverrideSqm: item.landAreaOverrideSqm ?? null,
    ...extra,
  };
}
