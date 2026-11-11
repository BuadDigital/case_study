"use client";

/**
 * Memoised projections `ValuationWorkShell` renders from: the adopted sets,
 * their factor rows and auto narrative, and the two comparables tables (the
 * transaction's own rows). Distant comparables are left adopted — they may be flagged
 * in the bank table by distance, never written back as un-adopted.
 */
import { useMemo } from "react";
import {
  type ValuationComparableSelectionListDto,
  type ValuationCostApproachDto,
} from "@platform/api-client";
import {
  buildBankDisplayRows,
  parseSubjectAreaSqm,
  resolveSubjectCoordsForBank,
} from "./lib/bank-ranking";
import { buildFactorRows } from "./lib/market-save-mappers";
import {
  buildAutoNarrative,
  isSeedMarketAnalysisNotes,
  parseDecimal,
} from "./lib/shell-state";
import { type SubjectCoords, type SubjectHints } from "./lib/valuation-data-state";

export function useValuationWorkReadModels({
  hints,
  selection,
  landSelection,
  bankSubjectCoords,
  subjectArea,
  analysisNotes,
  cost,
}: {
  hints: SubjectHints;
  loading: boolean;
  valuationRequestId: string | null;
  selection: ValuationComparableSelectionListDto | null;
  landSelection: ValuationComparableSelectionListDto | null;
  bankSubjectCoords: SubjectCoords | null;
  subjectArea: string;
  analysisNotes: string;
  cost: ValuationCostApproachDto | null;
}) {
  const { property, intakeProperty } = hints;
  const adoptedMarket = useMemo(
    () => selection?.items.filter((i) => i.isAdopted) ?? [],
    [selection],
  );
  /** Cost-approach land table (land_within_cost) — data and adjustments independent of market approach. */
  const adoptedLand = useMemo(
    () => landSelection?.items.filter((i) => i.isAdopted) ?? [],
    [landSelection],
  );
  const subjectSpecs = useMemo(
    () => selection?.subjectSpecs ?? {},
    [selection],
  );

  const subjectCoordsForBank = useMemo(
    () =>
      bankSubjectCoords ??
      resolveSubjectCoordsForBank({
        locationMapUrl: intakeProperty?.locationMapUrl,
      }),
    [bankSubjectCoords, intakeProperty?.locationMapUrl],
  );

  const visibleAdoptedMarket = adoptedMarket;
  const visibleFactorRows = useMemo(
    () => buildFactorRows(visibleAdoptedMarket),
    [visibleAdoptedMarket],
  );
  const visibleAdoptedLand = adoptedLand;
  const visibleLandFactorRows = useMemo(
    () => buildFactorRows(visibleAdoptedLand),
    [visibleAdoptedLand],
  );

  const autoNarrative = useMemo(
    () =>
      buildAutoNarrative(
        visibleAdoptedMarket,
        visibleFactorRows,
        selection?.factorRationales,
      ),
    [visibleAdoptedMarket, visibleFactorRows, selection?.factorRationales],
  );
  // Seed placeholder (and empty) must not lock the field — always follow the table.
  const narrativeDirty =
    analysisNotes.trim().length > 0 &&
    !isSeedMarketAnalysisNotes(analysisNotes) &&
    analysisNotes.trim() !== autoNarrative.trim();

  const { rows: bankRows, distances: bankDistanceKm } = useMemo(
    () =>
      buildBankDisplayRows({
        selectionItems: selection?.items ?? [],
        subjectCoords: subjectCoordsForBank,
        subjectSqm: parseSubjectAreaSqm(subjectArea, property?.area),
      }),
    [selection?.items, subjectCoordsForBank, subjectArea, property?.area],
  );

  const { rows: landBankRows, distances: landBankDistanceKm } = useMemo(
    () =>
      buildBankDisplayRows({
        selectionItems: landSelection?.items ?? [],
        subjectCoords: subjectCoordsForBank,
        subjectSqm: cost?.landAreaSqm ?? parseSubjectAreaSqm(subjectArea, property?.area),
      }),
    [landSelection?.items, subjectCoordsForBank, cost?.landAreaSqm, subjectArea, property?.area],
  );

  const subjectAreaNum = parseDecimal(subjectArea) || null;

  return {
    adoptedLand,
    subjectSpecs,
    visibleAdoptedMarket,
    visibleAdoptedLand,
    visibleFactorRows,
    visibleLandFactorRows,
    autoNarrative,
    narrativeDirty,
    bankRows,
    bankDistanceKm,
    landBankRows,
    landBankDistanceKm,
    subjectAreaNum,
  };
}
