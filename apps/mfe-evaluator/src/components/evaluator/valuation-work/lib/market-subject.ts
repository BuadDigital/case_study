/**
 * What the market approach compares the subject as (2026-10-29 ruling): land with land per m² of land,
 * a building with buildings as a whole property — its price includes its land, which is not mentioned.
 * Pure rules; the backend twin is `MarketAdjustmentBasisKeys.DefaultFor` / `PriorValuationBankRules`.
 */
import type { BuildingInventoryLineDto } from "@platform/api-client";
import { textLooksLikeApartment } from "@platform/app-shared/app-data/inspector-workspace-data";
import { parseLocaleNumber } from "@platform/app-shared/format/number";
import { areasFromInventory } from "../../../../lib/evaluator/valuation-report-sheet-facts";

export type MarketSubjectKind = "land" | "unit" | "building";
export type MarketAdjustmentBasis = "price_per_sqm" | "whole_property";

/**
 * The subject's kind for the market approach.
 * How it works: the appraiser's scope decides first — «أرض فقط» is land. A land deed is land unless the
 * specialist's inventory has a floor area (أرض تجارية + مستودع valued with its buildings is a building).
 * An apartment is a unit; anything else is a building.
 * Edge cases: before the settings load (no scope) the property type alone decides.
 */
export function marketSubjectKind({
  costScopeKey,
  isLandPropertyType,
  propertyType,
  builtUpSqm,
}: {
  costScopeKey?: string | null;
  isLandPropertyType?: boolean | null;
  propertyType?: string | null;
  builtUpSqm?: number | null;
}): MarketSubjectKind {
  if ((costScopeKey ?? "").trim() === "land_only") return "land";
  if (isLandPropertyType && !(builtUpSqm != null && builtUpSqm > 0)) return "land";
  if (textLooksLikeApartment(propertyType)) return "unit";
  return "building";
}

/** The basis a market table with no area yet opens on — whole property for anything built. */
export function defaultMarketBasis(kind: MarketSubjectKind): MarketAdjustmentBasis {
  return kind === "land" ? "price_per_sqm" : "whole_property";
}

/** How the subject's area is named in the market table and report. */
export function marketSubjectAreaLabel(kind: MarketSubjectKind): string {
  if (kind === "building") return "مسطح البناء";
  if (kind === "unit") return "مساحة الشقة";
  return "مساحة الأرض";
}

/**
 * The area the market table measures the subject by: the deed area for land and for an apartment
 * (its own unit area), the floor area for a building. "" when a building has no floor area yet —
 * never the land area under a floor-area label.
 */
export function marketSubjectArea(
  kind: MarketSubjectKind,
  { deedArea, builtUpSqm }: { deedArea: string; builtUpSqm: number | null },
): string {
  if (kind !== "building") return deedArea;
  return builtUpSqm != null && builtUpSqm > 0 ? String(builtUpSqm) : "";
}

/** «مجموع مسطحات البناء» from the specialist's inventory — the same total the report prints. */
export function builtUpSqmFromInventory(
  lines: BuildingInventoryLineDto[] | null | undefined,
): number | null {
  const total = parseLocaleNumber(areasFromInventory(lines).builtUpTotal);
  return Number.isFinite(total) && total > 0 ? total : null;
}

/** Why the per-m² basis cannot be picked: the subject has no area to multiply. */
export function perSqmBlockedMessage(kind: MarketSubjectKind): string {
  return kind === "building"
    ? "مسطح البناء غير متوفر من جدول الحصر — أكمله أو قارن على قيمة العقار كاملة"
    : `${marketSubjectAreaLabel(kind)} غير متوفرة — لا يمكن المقارنة على سعر المتر`;
}
