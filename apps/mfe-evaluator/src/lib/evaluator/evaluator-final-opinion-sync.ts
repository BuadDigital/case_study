/**
 * What the appraiser's package (evaluator draft) takes from the reconciliation — the price and
 * the liquidation discount the hand-over sends — and when the legacy land + building sum may
 * still stand in for the price. Pure; used by EvaluatorWindow.
 */
import { parseLocaleNumber } from "@platform/app-shared/format/number";
import { computePropertyTotal } from "./value-estimation";

/**
 * The draft patch for a reconciliation's final value.
 *
 * How it works: the price is the rounded final value; the discount is ALWAYS written — the
 * reconciliation's % when it applies (liquidation basis), "0" when it does not. Returns null when
 * the value is not a positive number or when the draft already holds both, so a load that brings
 * nothing new writes nothing.
 *
 * Edge cases: no extras → the discount is treated as not applied ("0"). Fixed 2026-11-10: the
 * discount was written only when it applied, so switching the basis to market left a stale 20٪ in
 * the package (and the hand-over).
 */
export function finalOpinionDraftPatch(
  value: number,
  extras: { liquidationDiscountPct: number; liquidationDiscountApplied: boolean } | undefined,
  current: { evaluatorPrice?: string | null; forcedSaleDiscountPct?: string | null },
): { evaluatorPrice: string; forcedSaleDiscountPct: string } | null {
  if (!Number.isFinite(value) || value <= 0) return null;
  const evaluatorPrice = String(Math.round(value));
  const forcedSaleDiscountPct = extras?.liquidationDiscountApplied
    ? String(extras.liquidationDiscountPct ?? 0)
    : "0";
  if (
    (current.evaluatorPrice ?? "") === evaluatorPrice &&
    (current.forcedSaleDiscountPct ?? "") === forcedSaleDiscountPct
  ) {
    return null;
  }
  return { evaluatorPrice, forcedSaleDiscountPct };
}

/**
 * The legacy price fill on load: the manual land + building sum when the draft has no price yet.
 *
 * How it works: only when the property has NO valuation request (`hasValuationRequest === false`)
 * — with one, the reconciliation's final value is the price (synced by finalOpinionDraftPatch).
 * Returns the sum as text, or null when nothing should be written.
 *
 * Edge cases: an unknown answer (lookup failed → null) counts as «has one» — never guess the
 * legacy sum over a real valuation. Fixed 2026-11-10: the sum was written on every load, even
 * over valuations whose price comes from the reconciliation.
 */
export function legacyLandBuildingPrice(
  loaded: { landValue?: string | null; buildingValue?: string | null; evaluatorPrice?: string | null },
  hasValuationRequest: boolean | null,
): string | null {
  if (hasValuationRequest !== false) return null;
  const summed = computePropertyTotal(loaded.landValue ?? "", loaded.buildingValue ?? "");
  const currentTotal = parseLocaleNumber(loaded.evaluatorPrice || "0");
  if (summed <= 0) return null;
  if (Number.isFinite(currentTotal) && currentTotal !== 0) return null;
  return String(summed);
}
