/**
 * The rate per m² a cash area line starts from (2026-11-16, Taqeem curriculum 105 examples 16–17:
 * the area difference × the rate per m² of similar property, added in riyals on a whole-value table).
 * No React, no I/O.
 */
import type { ValuationCostApproachDto } from "@platform/api-client";
import type { AreaLine } from "./matrix-actions";

type CostRates = Pick<
  ValuationCostApproachDto,
  "landUnitRateFromMarket" | "landEstimateComplete" | "buildingsValueAfterDepreciation" | "buildingAreaSqm"
>;

/** A rate the line can start from, and where it comes from. */
export type AreaCashRateSource = { rate: number; label: string };

/** What an area row's method picker needs (2026-11-16). */
export type AreaMethodCellProps = {
  /** The appraiser's pick — "" while the table chooses automatically. */
  choice: string;
  /** «مبلغ نقدي» is offered — a whole-value table only. */
  cashAllowed: boolean;
  /** The method in force is cash. */
  isCash: boolean;
  cashRate: number | null;
  /** Where a rate can come from, shown under the rate. */
  rateSource: AreaCashRateSource | null;
};

const round2 = (n: number) => Math.round(n * 100) / 100;

/**
 * What: the rate per m² a cash area line is seeded with, and its source label.
 * How it works: the land line takes the land comparables' adjusted rate (the land table of this
 * valuation, «سعر متر الأرض بعد التسويات»); the building line takes the cost approach's buildings
 * after depreciation ÷ the building floor area — the curriculum's own figure for a building (example 11).
 * Edge cases: no adopted land comparables, no priced cost lines or no floor area → null, and the
 * appraiser types the rate.
 */
export function areaCashRateSource(
  cost: CostRates | null | undefined,
  line: AreaLine,
): AreaCashRateSource | null {
  if (!cost) return null;
  if (line === "land") {
    const rate = Number(cost.landUnitRateFromMarket) || 0;
    if (cost.landEstimateComplete === false || !(rate > 0)) return null;
    return { rate: round2(rate), label: "من جدول مقارنات الأراضي" };
  }
  const value = Number(cost.buildingsValueAfterDepreciation) || 0;
  const area = Number(cost.buildingAreaSqm) || 0;
  if (!(value > 0) || !(area > 0)) return null;
  return { rate: round2(value / area), label: "من أسلوب التكلفة بعد الإهلاك" };
}
