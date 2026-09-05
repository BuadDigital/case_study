/**
 * Pure payload builders and optimistic patches behind the valuation-work
 * command hooks: the market-approach save body, the adjustment-line lists
 * each matrix command writes, the weight patches, and the selection patches
 * applied before the server answers. No React, no I/O.
 */
import type {
  SaveValuationComparableMarketRequest,
  SaveValuationMarketApproachRequest,
  ValuationComparableSelectionDto,
  ValuationComparableSelectionListDto,
} from "@platform/api-client";
import {
  ensureLinesForSave,
  lineForSave,
  linePercent,
} from "./market-save-mappers";
import { JUSTIFICATION_MIN_LENGTH } from "./shell-utils";
import {
  LAND_WITHIN_COST,
  MARKET_CONTEXT,
  newAdjustmentLine,
  parseDecimal,
} from "./shell-state";

export type FactorRow = { factorKey: string; labelAr: string };
export type SavedLine = ReturnType<typeof lineForSave>;

/** The three market-approach fields the shell keeps as drafts. */
export type MarketApproachDraft = {
  subjectArea: string;
  adjustmentBasis: string;
  analysisNotes: string;
};

/** Market-approach save body — every settings command layers its own field on top of the drafts. */
export function marketApproachBody(
  draft: MarketApproachDraft,
  extra?: Partial<SaveValuationMarketApproachRequest>,
): SaveValuationMarketApproachRequest {
  const area = parseDecimal(draft.subjectArea);
  return {
    subjectAreaSqm: Number.isFinite(area) ? area : null,
    adjustmentBasis: draft.adjustmentBasis,
    analysisNotes: draft.analysisNotes.trim() || null,
    ...extra,
  };
}

/** subjSpec: set or clear the subject description for one difference factor. */
export function nextSubjectSpecs(
  specs: Record<string, string>,
  factorKey: string,
  text: string,
): Record<string, string> {
  const next = { ...specs };
  if (text.trim()) next[factorKey] = text.trim();
  else delete next[factorKey];
  return next;
}

/** Rule Q-8-2: a non-empty justification below the minimum length is rejected client-side. */
export function isJustificationTooShort(text: string): boolean {
  return text.length > 0 && text.length < JUSTIFICATION_MIN_LENGTH;
}

export const JUSTIFICATION_TOO_SHORT_MESSAGE = `المبرر أقصر من الحد الأدنى (${JUSTIFICATION_MIN_LENGTH} أحرف) — اكتب مبرراً جوهرياً (ق-8)`;

/** Context that owns a comparable selection — land table items belong to the cost approach. */
export function contextOfSelection(
  item: ValuationComparableSelectionDto,
  adoptedLand: ValuationComparableSelectionDto[],
): string {
  return adoptedLand.some((i) => i.id === item.id)
    ? LAND_WITHIN_COST
    : MARKET_CONTEXT;
}

/** Optimistic adoption flip for a comparable already linked to this valuation. */
export function withAdoptionFlag(
  prev: ValuationComparableSelectionListDto,
  comparablePropertyId: string,
  isAdopted: boolean,
): ValuationComparableSelectionListDto {
  return {
    ...prev,
    adoptedCount: Math.max(0, prev.adoptedCount + (isAdopted ? 1 : -1)),
    items: prev.items.map((i) =>
      i.comparablePropertyId === comparablePropertyId ? { ...i, isAdopted } : i,
    ),
  };
}

/** Optimistic ✓ flip of one factor across every adopted comparable of a selection. */
export function withFactorIncluded(
  prev: ValuationComparableSelectionListDto,
  factorKey: string,
  isIncluded: boolean,
): ValuationComparableSelectionListDto {
  return {
    ...prev,
    items: prev.items.map((it) =>
      it.isAdopted && it.market
        ? {
            ...it,
            market: {
              ...it.market,
              adjustmentLines: (it.market.adjustmentLines ?? []).map((l) =>
                l.factorKey === factorKey ? { ...l, isIncluded } : l,
              ),
            },
          }
        : it,
    ),
  };
}

/** The ✓ state of a factor is read from the first adopted comparable — missing line counts as on. */
export function isFactorIncluded(
  items: ValuationComparableSelectionDto[],
  factorKey: string,
): boolean {
  return (
    items[0]?.market?.adjustmentLines?.find((l) => l.factorKey === factorKey)
      ?.isIncluded !== false
  );
}

/** compEdit: parse a price/area override — blank or non-positive clears it. */
export function bankOverridePatch(
  item: ValuationComparableSelectionDto,
  field: "price" | "area",
  raw: string,
): Pick<
  SaveValuationComparableMarketRequest,
  "priceOverrideSar" | "areaOverrideSqm"
> {
  const parsed = parseDecimal(raw);
  const value = Number.isFinite(parsed) && parsed > 0 ? parsed : null;
  return {
    priceOverrideSar: field === "price" ? value : item.priceOverrideSar ?? null,
    areaOverrideSqm: field === "area" ? value : item.areaOverrideSqm ?? null,
  };
}

/** The comparable's stored lines, prepared for save unchanged. */
export function savedLines(item: ValuationComparableSelectionDto): SavedLine[] {
  return (item.market?.adjustmentLines ?? []).map((l, i) =>
    lineForSave(item, l, i),
  );
}

/** Matrix cell entry — missing rows are materialised so the save carries the full table. */
export function linesWithCellPercent(
  item: ValuationComparableSelectionDto,
  factorKey: string,
  percent: number,
  factorRows: FactorRow[],
): SavedLine[] {
  return ensureLinesForSave(item, factorKey, percent, factorRows).map((l, i) =>
    lineForSave(item, l, i),
  );
}

export function linesWithoutFactor(
  item: ValuationComparableSelectionDto,
  factorKey: string,
): SavedLine[] {
  return (item.market?.adjustmentLines ?? [])
    .filter((l) => l.factorKey !== factorKey)
    .map((l, i) => lineForSave(item, l, i));
}

/** Append a fresh 0% line — restored sequential items and added factors share it. */
export function linesWithFactorAppended(
  item: ValuationComparableSelectionDto,
  factorKey: string,
  labelAr: string,
): SavedLine[] {
  const existing = item.market?.adjustmentLines ?? [];
  return [
    ...existing.map((l, i) => lineForSave(item, l, i)),
    newAdjustmentLine(factorKey, labelAr, existing.length),
  ];
}

/** compSpec: comparable description for one factor — other lines keep theirs. */
export function linesWithDescription(
  item: ValuationComparableSelectionDto,
  factorKey: string,
  text: string,
): SavedLine[] {
  return (item.market?.adjustmentLines ?? []).map((l, i) => ({
    ...lineForSave(item, l, i),
    descriptionAr:
      l.factorKey === factorKey ? text.trim() || null : l.descriptionAr ?? null,
  }));
}

/**
 * Rule Q-8-1: per-comparable justification override. Writing an override alone does not
 * turn a “suggested” value into a stored manual percentage.
 */
export function linesWithRationaleOverride(
  item: ValuationComparableSelectionDto,
  factorKey: string,
  text: string,
  factorRows: FactorRow[],
): SavedLine[] {
  const rawLine = item.market?.adjustmentLines?.find(
    (l) => l.factorKey === factorKey,
  );
  return ensureLinesForSave(
    item,
    factorKey,
    linePercent(item, factorKey),
    factorRows,
  ).map((l, i) => ({
    ...lineForSave(item, l, i),
    percent:
      l.factorKey === factorKey && rawLine?.isSuggestedValue
        ? 0
        : lineForSave(item, l, i).percent,
    rationale: l.factorKey === factorKey ? text : l.rationale,
  }));
}

/** ✓ toggle for one factor — suggested flags are re-applied so the toggle does not freeze suggestions. */
export function linesWithIncluded(
  item: ValuationComparableSelectionDto,
  factorKey: string,
  isIncluded: boolean,
  factorRows: FactorRow[],
): SavedLine[] {
  const suggestedByKey = new Map(
    (item.market?.adjustmentLines ?? []).map((l) => [
      l.factorKey,
      l.isSuggestedValue === true,
    ]),
  );
  return ensureLinesForSave(
    item,
    factorKey,
    linePercent(item, factorKey),
    factorRows,
  ).map((l, i) => ({
    ...lineForSave(
      item,
      { ...l, isSuggestedValue: suggestedByKey.get(l.factorKey) ?? false },
      i,
    ),
    isIncluded: l.factorKey === factorKey ? isIncluded : l.isIncluded,
  }));
}

/** Comparables that do not carry a line for the factor yet — add/restore write only these. */
export function itemsMissingFactor(
  items: ValuationComparableSelectionDto[],
  factorKey: string,
): ValuationComparableSelectionDto[] {
  return items.filter(
    (item) =>
      !(item.market?.adjustmentLines ?? []).some(
        (l) => l.factorKey === factorKey,
      ),
  );
}

/** Manual weight entry — an empty rationale keeps the stored one. */
export function manualWeightPatch(
  item: ValuationComparableSelectionDto,
  rawPct: string,
  weightRationale: string,
): Partial<SaveValuationComparableMarketRequest> {
  return {
    weightIsManual: true,
    weightPct: parseDecimal(rawPct) || 0,
    weightOverrideRationale:
      weightRationale.trim() || item.market?.weightOverrideRationale || null,
  };
}

/** Back to the automatic weight suggestion. */
export const RESET_WEIGHTS_PATCH: Partial<SaveValuationComparableMarketRequest> = {
  weightIsManual: false,
  weightPct: null,
  weightOverrideRationale: null,
};
