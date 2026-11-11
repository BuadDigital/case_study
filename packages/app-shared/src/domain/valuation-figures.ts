/**
 * The figures of the navy card under «حالة الأطراف» (Omar 2026-11-11): the district's land rate by
 * use, and the valuation's land, buildings and property values as the appraiser works. Pure — the
 * reads are in `query/property-valuation-figures-query.ts`.
 */
import type {
  ComparablePropertyDto,
  ValuationApproachSettingsDto,
  ValuationComparableSelectionListDto,
  ValuationCostApproachDto,
  ValuationReconciliationDto,
} from "@platform/api-client";
import { comparableKindFromType } from "../app-data/comparable-entry";

/** A figure not known yet (nothing valued, nothing recorded) is null — the card shows «—». */
export type ValuationFigures = {
  landRate: number | null;
  landValue: number | null;
  buildingRate: number | null;
  buildingsValue: number | null;
  propertyValue: number | null;
};

export const NO_VALUATION_FIGURES: ValuationFigures = {
  landRate: null,
  landValue: null,
  buildingRate: null,
  buildingsValue: null,
  propertyValue: null,
};

function positive(n: number | null | undefined): number | null {
  return typeof n === "number" && Number.isFinite(n) && n > 0 ? n : null;
}

/**
 * The valuation's figures from what the appraiser saved so far.
 *
 * How it works:
 * - a land (nothing built to value): its value is the market approach's opinion, its rate that
 *   value over the valued area;
 * - any other property with the cost approach on: the land's rate and value are the cost
 *   approach's land estimate, the buildings' value is the cost after depreciation and their rate
 *   that value over the built area;
 * - the property's value is the final opinion.
 * Edge cases: a zero or missing number is «not known yet» (null). The buildings' figures wait for
 * the appraiser's first save of the cost approach — before it the server answers with starter
 * defaults that are not his work. With the cost approach off, a stored cost row is ignored.
 */
export function valuationFigures(input: {
  settings: ValuationApproachSettingsDto | null;
  cost: ValuationCostApproachDto | null;
  recon: ValuationReconciliationDto | null;
  /** The market table — read only for a land. */
  market: ValuationComparableSelectionListDto | null;
}): ValuationFigures {
  const { settings, cost, recon, market } = input;
  const figures: ValuationFigures = {
    ...NO_VALUATION_FIGURES,
    propertyValue: positive(recon?.finalOpinionValue),
  };
  if (settings?.isLandPropertyType) {
    const value = positive(market?.marketOpinionValue);
    const area = positive(market?.subjectAreaSqm);
    figures.landValue = value;
    figures.landRate = value && area ? value / area : null;
    return figures;
  }
  if (!cost || settings?.costApproachEnabled === false) return figures;
  if (cost.landEstimateComplete !== false) {
    figures.landRate = positive(cost.landUnitRateAfterDiscount);
    figures.landValue = positive(cost.landValueFromMarket);
  }
  if (cost.isSaved) {
    const buildings = positive(cost.buildingsValueAfterDepreciation);
    const builtArea = positive(cost.buildingAreaSqm);
    figures.buildingsValue = buildings;
    figures.buildingRate = buildings && builtArea ? buildings / builtArea : null;
  }
  return figures;
}

/** The district's land rate for one use, and how many bank comparables it is the mean of. */
export type DistrictLandRate = { rate: number | null; count: number };
export type DistrictLandRates = { residential: DistrictLandRate; commercial: DistrictLandRate };

const RESIDENTIAL = "سكني";
const COMMERCIAL = "تجاري";

function norm(text: string | null | undefined): string {
  return (text ?? "").trim();
}

/** The use a comparable counts under: its recorded use, else the one its type names («أرض سكنية»). */
function comparableUse(comparable: ComparablePropertyDto): string {
  const usage = norm(comparable.usage);
  if (usage) return usage;
  const type = norm(comparable.comparablePropertyType);
  if (type.includes(RESIDENTIAL)) return RESIDENTIAL;
  return type.includes(COMMERCIAL) ? COMMERCIAL : "";
}

/**
 * «سعر المنطقة (س)» / «سعر المنطقة (ت)»: the mean price per m² of the bank's land comparables in
 * the property's district, residential and commercial apart.
 *
 * How it works: lands only — a building's rate is per m² of floor area and is not the district's
 * land price. A comparable counts when it is active, not set aside by a quality tag (anomalous,
 * unreliable, duplicate), in the same district — and the same city when both are known — and
 * carries a price per m².
 * Edge cases: no such comparable gives a null rate with a count of 0; a mixed use («سكني تجاري»)
 * counts under neither; an empty district gives nothing.
 */
export function districtLandRates(
  comparables: readonly ComparablePropertyDto[],
  place: { district: string | null | undefined; city?: string | null },
): DistrictLandRates {
  const district = norm(place.district);
  const city = norm(place.city);
  const sums = { [RESIDENTIAL]: { total: 0, count: 0 }, [COMMERCIAL]: { total: 0, count: 0 } };
  for (const c of district ? comparables : []) {
    if (c.isActive === false || c.isExcludedFromSuggestions) continue;
    if (norm(c.district) !== district) continue;
    if (city && norm(c.city) && norm(c.city) !== city) continue;
    if (comparableKindFromType(c.comparablePropertyType) !== "land") continue;
    const rate = positive(c.pricePerSqm);
    const use = comparableUse(c);
    if (!rate || (use !== RESIDENTIAL && use !== COMMERCIAL)) continue;
    sums[use].total += rate;
    sums[use].count += 1;
  }
  const mean = ({ total, count }: { total: number; count: number }): DistrictLandRate => ({
    rate: count > 0 ? total / count : null,
    count,
  });
  return { residential: mean(sums[RESIDENTIAL]), commercial: mean(sums[COMMERCIAL]) };
}
