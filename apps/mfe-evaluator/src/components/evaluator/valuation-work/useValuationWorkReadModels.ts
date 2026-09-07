"use client";

/**
 * Memoised projections `ValuationWorkShell` renders from: the adopted sets
 * filtered to the subject's radius, their factor rows and auto narrative, the
 * two bank display tables, and the bank text search. Also the guard that
 * un-adopts comparables that sit too far from the subject.
 */
import { useCallback, useEffect, useMemo, useRef } from "react";
import {
  setValuationComparableAdopted,
  type ComparablePropertyDto,
  type ValuationComparableSelectionListDto,
  type ValuationCostApproachDto,
} from "@platform/api-client";
import {
  BANK_DISPLAY_LIMIT,
  BANK_SEARCH_DISPLAY_LIMIT,
  buildBankDisplayRows,
  fetchBankCandidates,
  filterSelectionNearSubject,
  isVacantLandComparable,
  parseSubjectAreaSqm,
  resolveSubjectCoordsForBank,
} from "./lib/bank-ranking";
import { buildFactorRows } from "./lib/market-save-mappers";
import { apiConfig } from "./lib/shell-utils";
import {
  LAND_WITHIN_COST,
  MARKET_CONTEXT,
  buildAutoNarrative,
  farUnadoptSignature,
  parseDecimal,
} from "./lib/shell-state";
import {
  farAdoptedItems,
  subjectIdentity,
  type BankFetchOptions,
  type SubjectCoords,
  type SubjectHints,
} from "./lib/valuation-data-state";

export function useValuationWorkReadModels({
  hints,
  loading,
  valuationRequestId,
  selection,
  landSelection,
  candidates,
  bankSubjectCoords,
  subjectArea,
  analysisNotes,
  cost,
  reload,
  resolveBankFetchOpts,
  applyBankResult,
  bankSearch,
}: {
  hints: SubjectHints;
  loading: boolean;
  valuationRequestId: string | null;
  selection: ValuationComparableSelectionListDto | null;
  landSelection: ValuationComparableSelectionListDto | null;
  candidates: ComparablePropertyDto[];
  bankSubjectCoords: SubjectCoords | null;
  bankSearch: string;
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

  const visibleAdoptedMarket = useMemo(
    () =>
      filterSelectionNearSubject(
        adoptedMarket,
        subjectCity || undefined,
        subjectCoordsForBank,
      ),
    [adoptedMarket, subjectCity, subjectCoordsForBank],
  );
  const visibleFactorRows = useMemo(
    () => buildFactorRows(visibleAdoptedMarket),
    [visibleAdoptedMarket],
  );
  const visibleAdoptedLand = useMemo(
    () =>
      filterSelectionNearSubject(
        adoptedLand,
        subjectCity || undefined,
        subjectCoordsForBank,
      ),
    [adoptedLand, subjectCity, subjectCoordsForBank],
  );
  const visibleLandFactorRows = useMemo(
    () => buildFactorRows(visibleAdoptedLand),
    [visibleAdoptedLand],
  );

  const autoNarrative = useMemo(
    () => buildAutoNarrative(visibleAdoptedMarket, visibleFactorRows),
    [visibleAdoptedMarket, visibleFactorRows],
  );
  const narrativeDirty = analysisNotes.trim().length > 0;

  /** Drop adopted comps that are too far from the subject (e.g. demo Riyadh seed on a Jeddah case). */
  const autoUnadoptFarRef = useRef<string | null>(null);
  useEffect(() => {
    const config = apiConfig();
    if (!config || !valuationRequestId || loading) return;
    if (!subjectCoordsForBank && !subjectCity) return;

    const farMarket = selection
      ? farAdoptedItems(adoptedMarket, subjectCity, subjectCoordsForBank)
      : [];
    const farLand = landSelection
      ? farAdoptedItems(adoptedLand, subjectCity, subjectCoordsForBank)
      : [];
    if (farMarket.length === 0 && farLand.length === 0) return;

    const signature = farUnadoptSignature(
      valuationRequestId,
      farMarket,
      farLand,
    );
    if (autoUnadoptFarRef.current === signature) return;
    autoUnadoptFarRef.current = signature;

    void (async () => {
      for (const item of farMarket) {
        await setValuationComparableAdopted(
          config,
          valuationRequestId,
          item.comparablePropertyId,
          false,
          MARKET_CONTEXT,
        );
      }
      for (const item of farLand) {
        await setValuationComparableAdopted(
          config,
          valuationRequestId,
          item.comparablePropertyId,
          false,
          LAND_WITHIN_COST,
        );
      }
      await reload({ silent: true, scope: "full" });
    })();
  }, [
    loading,
    valuationRequestId,
    selection,
    landSelection,
    adoptedMarket,
    adoptedLand,
    subjectCity,
    subjectCoordsForBank,
    reload,
  ]);

  const searching = bankSearch.length > 0;
  const { rows: bankRows, distances: bankDistanceKm } = useMemo(
    () =>
      buildBankDisplayRows({
        selectionItems: selection?.items ?? [],
        candidates,
        subjectCity: subjectCity || undefined,
        subjectCoords: subjectCoordsForBank,
        subjectSqm: parseSubjectAreaSqm(subjectArea, property?.area),
        limit: searching ? BANK_SEARCH_DISPLAY_LIMIT : BANK_DISPLAY_LIMIT,
        nearbyOnly: !searching,
      }),
    [
      selection?.items,
      candidates,
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
  const { rows: landBankRows, distances: landBankDistanceKm } = useMemo(
    () =>
      buildBankDisplayRows({
        selectionItems: landSelection?.items ?? [],
        candidates: landCandidates,
        subjectCity: subjectCity || undefined,
        subjectCoords: subjectCoordsForBank,
        subjectSqm: cost?.landAreaSqm ?? parseSubjectAreaSqm(subjectArea, property?.area),
        limit: searching ? BANK_SEARCH_DISPLAY_LIMIT : BANK_DISPLAY_LIMIT,
        nearbyOnly: !searching,
      }),
    [
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
    landBankRows,
    landBankDistanceKm,
    subjectAreaNum,
    onSearchBank,
  };
}
