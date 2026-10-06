"use client";

/**
 * Memoised projections `ValuationWorkShell` renders from: the adopted sets,
 * their factor rows and auto narrative, the two bank display tables, and the
 * bank text search. Distant comparables are left adopted — they may be flagged
 * in the bank table by distance, never written back as un-adopted.
 */
import { useCallback, useMemo, useRef } from "react";
import {
  type ComparablePropertyDto,
  type ValuationComparableSelectionListDto,
  type ValuationCostApproachDto,
} from "@platform/api-client";
import {
  BANK_DISPLAY_LIMIT,
  BANK_SEARCH_DISPLAY_LIMIT,
  buildBankDisplayRows,
  fetchBankCandidates,
  isVacantLandComparable,
  parseSubjectAreaSqm,
  resolveSubjectCoordsForBank,
} from "./lib/bank-ranking";
import { buildFactorRows } from "./lib/market-save-mappers";
import { apiConfig } from "./lib/shell-utils";
import {
  buildAutoNarrative,
  isSeedMarketAnalysisNotes,
  parseDecimal,
} from "./lib/shell-state";
import {
  type BankFetchOptions,
  type SubjectCoords,
  type SubjectHints,
  subjectIdentity,
} from "./lib/valuation-data-state";

export function useValuationWorkReadModels({
  hints,
  selection,
  landSelection,
  candidates,
  bankSubjectCoords,
  subjectArea,
  analysisNotes,
  cost,
  resolveBankFetchOpts,
  applyBankResult,
  bankSearch,
  bankRadiusKm,
}: {
  hints: SubjectHints;
  loading: boolean;
  valuationRequestId: string | null;
  selection: ValuationComparableSelectionListDto | null;
  landSelection: ValuationComparableSelectionListDto | null;
  candidates: ComparablePropertyDto[];
  bankSubjectCoords: SubjectCoords | null;
  bankSearch: string;
  /** The radius the appraiser picked for the bank table; `null` = all. */
  bankRadiusKm: number | null;
  subjectArea: string;
  analysisNotes: string;
  cost: ValuationCostApproachDto | null;
  reload: (opts?: {
    silent?: boolean;
    scope?: "full" | "derived";
  }) => Promise<void>;
  resolveBankFetchOpts: (search?: string) => Promise<BankFetchOptions>;
  applyBankResult: (
    rows: ComparablePropertyDto[],
    subjectCoords: SubjectCoords | null,
    search?: string,
  ) => void;
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

  const { city: subjectCity, district: subjectDistrict } = subjectIdentity(hints);
  const subjectCoordsForBank = useMemo(
    () =>
      bankSubjectCoords ??
      resolveSubjectCoordsForBank({
        city: subjectCity || undefined,
        district: subjectDistrict || undefined,
        deedNumber:
          property?.deedNumber || intakeProperty?.deedNumber || undefined,
        locationMapUrl: intakeProperty?.locationMapUrl,
      }),
    [
      bankSubjectCoords,
      subjectCity,
      subjectDistrict,
      property?.deedNumber,
      intakeProperty?.deedNumber,
      intakeProperty?.locationMapUrl,
    ],
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

  const searching = bankSearch.length > 0;
  const {
    rows: bankRows,
    distances: bankDistanceKm,
    beyond: bankBeyond,
  } = useMemo(
    () =>
      buildBankDisplayRows({
        selectionItems: selection?.items ?? [],
        candidates,
        subjectCity: subjectCity || undefined,
        subjectCoords: subjectCoordsForBank,
        subjectSqm: parseSubjectAreaSqm(subjectArea, property?.area),
        limit: searching ? BANK_SEARCH_DISPLAY_LIMIT : BANK_DISPLAY_LIMIT,
        nearbyOnly: !searching,
        radiusKm: bankRadiusKm,
      }),
    [
      selection?.items,
      candidates,
      bankRadiusKm,
      subjectCity,
      subjectCoordsForBank,
      subjectArea,
      property?.area,
      searching,
    ],
  );

  const landCandidates = useMemo(
    () =>
      candidates.filter((c) => isVacantLandComparable(c.comparablePropertyType)),
    [candidates],
  );
  const {
    rows: landBankRows,
    distances: landBankDistanceKm,
    beyond: landBankBeyond,
  } = useMemo(
    () =>
      buildBankDisplayRows({
        selectionItems: landSelection?.items ?? [],
        candidates: landCandidates,
        subjectCity: subjectCity || undefined,
        subjectCoords: subjectCoordsForBank,
        subjectSqm: cost?.landAreaSqm ?? parseSubjectAreaSqm(subjectArea, property?.area),
        limit: searching ? BANK_SEARCH_DISPLAY_LIMIT : BANK_DISPLAY_LIMIT,
        nearbyOnly: !searching,
        radiusKm: bankRadiusKm,
      }),
    [
      bankRadiusKm,
      landSelection?.items,
      landCandidates,
      subjectCity,
      subjectCoordsForBank,
      cost?.landAreaSqm,
      subjectArea,
      property?.area,
      searching,
    ],
  );

  const subjectAreaNum = parseDecimal(subjectArea) || null;

  const subjectAreaRef = useRef(subjectArea);
  subjectAreaRef.current = subjectArea;
  const searchGen = useRef(0);
  /** Bank search — fetches bank candidates only instead of a full screen reload (7 calls). */
  const onSearchBank = useCallback(
    (search: string) => {
      void (async () => {
        const gen = ++searchGen.current;
        const config = apiConfig();
        if (!config) return;
        const bankOpts = await resolveBankFetchOpts(search);
        bankOpts.subjectSqm = parseSubjectAreaSqm(
          subjectAreaRef.current,
          property?.area,
        );
        const res = await fetchBankCandidates(config, bankOpts);
        if (!res.ok || gen !== searchGen.current) return;
        applyBankResult(res.data, res.subjectCoords, search);
      })();
    },
    [resolveBankFetchOpts, property?.area, applyBankResult],
  );

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
    bankBeyond,
    landBankRows,
    landBankDistanceKm,
    landBankBeyond,
    subjectAreaNum,
    onSearchBank,
  };
}
