/**
 * Decision A (round 2) — the land figures inside the cost approach, shared by the cost screen and the
 * printed report: the land comparables are adjusted against the whole plot (`landAreaSqm`), and the
 * adjusted rate (after any use-restriction discount) multiplies the apartment's share when one is set,
 * else the plot. Every printed line multiplies out to the next.
 */
import type { ValuationCostApproachDto } from "@platform/api-client";

import { formatAmountNumberDisplay } from "./arabic-amount-words";

type CostLand = Pick<
  ValuationCostApproachDto,
  | "landAreaSqm"
  | "apartmentLandShareSqm"
  | "landUnitRateFromMarket"
  | "useRestrictionDiscountPct"
  | "landUnitRateAfterDiscount"
  | "landValueFromMarket"
  | "landEstimateComplete"
>;

/** The area the land rate multiplies: the apartment's share when set, else the plot. */
export function costLandMultiplierSqm(
  cost: Pick<CostLand, "landAreaSqm" | "apartmentLandShareSqm">,
): number {
  const share = Number(cost.apartmentLandShareSqm) || 0;
  return share > 0 ? share : Number(cost.landAreaSqm) || 0;
}

/** What that area is called next to the rate. */
export function costLandMultiplierLabel(
  cost: Pick<CostLand, "apartmentLandShareSqm">,
): string {
  return (Number(cost.apartmentLandShareSqm) || 0) > 0 ? "حصة الشقة" : "مساحة الأرض";
}

/**
 * The apartment's land-table hint: which plot the comparables are compared with and which share the
 * rate multiplies — or where to enter them (the cost screen's «قيمة الأرض» card).
 */
export function apartmentLandHint(
  cost: Pick<ValuationCostApproachDto, "buildingPlotAreaSqm" | "apartmentLandShareSqm"> | null | undefined,
): string {
  const plot = Number(cost?.buildingPlotAreaSqm) || 0;
  const share = Number(cost?.apartmentLandShareSqm) || 0;
  if (!(plot > 0)) {
    return "أدخل مساحة أرض العمارة كاملة في بطاقة «قيمة الأرض» أدناه — بها تُسوّى مساحة المقارنات، وحصة الشقة تُضرب في سعر المتر";
  }
  const shareText = share > 0 ? `حصة الشقة ${formatAmountNumberDisplay(share)} م²` : "حصة الشقة (أدخلها أدناه)";
  return `تُقارن الأراضي بمساحة أرض العمارة كاملة ${formatAmountNumberDisplay(plot)} م² — وقيمة الأرض = سعر المتر × ${shareText}`;
}

export type CostLandReportRow = { key: string; value: string; total?: boolean };

function money(n: number | null | undefined): string {
  return n != null && Number.isFinite(n) && n > 0 ? formatAmountNumberDisplay(n) : "—";
}

/**
 * §20 «قيمة الأرض (أسلوب التكلفة)» in the order the figures multiply: plot area, rate after
 * adjustments, (use-restriction discount and the rate after it), the apartment's share, the land value
 * before rounding (rate × area, unrounded) and the land value carried into the cost approach.
 */
export function costLandReportRows(
  cost: CostLand | null | undefined,
  isApartment = false,
): CostLandReportRow[] {
  if (!cost) return [];
  const share = Number(cost.apartmentLandShareSqm) || 0;
  const sharedLand = share > 0 || isApartment;
  const complete = cost.landEstimateComplete !== false && cost.landUnitRateFromMarket > 0;
  const discount = Number(cost.useRestrictionDiscountPct) || 0;
  const multiplier = costLandMultiplierSqm(cost);
  const rateAfterDiscount = Number.isFinite(cost.landUnitRateAfterDiscount)
    ? cost.landUnitRateAfterDiscount
    : cost.landUnitRateFromMarket;
  const beforeRounding = complete ? rateAfterDiscount * multiplier : null;
  return [
    {
      key: sharedLand ? "مساحة أرض العمارة كاملة (م²)" : "مساحة الأرض (م²)",
      value: money(cost.landAreaSqm),
    },
    { key: "سعر المتر بعد التسويات (ر.س./م²)", value: complete ? money(cost.landUnitRateFromMarket) : "—" },
    ...(discount > 0
      ? [
          { key: "خصم تقييد الاستخدام", value: `${discount.toFixed(2)}٪` },
          {
            key: "سعر المتر بعد الخصم (ر.س./م²)",
            value: complete ? money(rateAfterDiscount) : "—",
          },
        ]
      : []),
    ...(sharedLand ? [{ key: "حصة الشقة من الأرض (م²)", value: money(share) }] : []),
    { key: "قيمة الأرض قبل التقريب", value: money(beforeRounding) },
    { key: "قيمة الأرض", value: complete ? money(cost.landValueFromMarket) : "—", total: true },
  ];
}
