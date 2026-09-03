"use client";

/**
 * Everything `ValuationWorkShell` loads and derives: the open valuation request,
 * the two comparable selections, the comparables bank, cost / reconciliation /
 * gates batches, and the memoised projections the screens render from. Commands
 * live in `useValuationWorkCommands`; this hook owns the state they mutate.
 */
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  ensureOpenValuationRequestByProperty,
  listValuationComparableSelections,
  saveValuationMarketApproach,
  getValuationCostApproach,
  getValuationApproachSettings,
  saveValuationApproachSettings,
  getValuationReconciliation,
  getValuationIssuanceGates,
  getDifferenceFactorCatalog,
  setValuationComparableAdopted,
  type ComparablePropertyDto,
  type DifferenceFactorDefinitionDto,
  type ValuationComparableSelectionListDto,
  type ValuationApproachSettingsDto,
  type ValuationCostApproachDto,
  type ValuationReconciliationDto,
  type ValuationIssuanceGatesDto,
} from "@platform/api-client";
import { useToast } from "@platform/ui-kit";
import type { PoPropertyIntake } from "@case-study/mfe/lib/app-data/po-intake-data";
import { fetchInspectorWorkspace } from "@case-study/mfe/lib/app-data/inspector-workspace-reads";
import {
  BANK_DISPLAY_LIMIT,
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
  buildFactorCatalog,
  farUnadoptSignature,
  officialValuationDateOf,
  parseDecimal,
  type ValuationWorkNavAvailability,
  type ValuationWorkPropertyHint,
} from "./lib/shell-state";

export type ValuationWorkDataParams = {
  propertyId: string;
  assignmentType?: string;
  districtHint?: string;
  property?: ValuationWorkPropertyHint;
  intakeProperty?: PoPropertyIntake | null;
  onFinalOpinionChange?: (finalOpinionValue: number) => void;
  onNavAvailabilityChange?: (nav: ValuationWorkNavAvailability) => void;
};

export function useValuationWorkData({
  propertyId,
  assignmentType,
  districtHint,
  property,
  intakeProperty = null,
  onFinalOpinionChange,
  onNavAvailabilityChange,
}: ValuationWorkDataParams) {
  const { showToast } = useToast();
  const onFinalOpinionChangeRef = useRef(onFinalOpinionChange);
  onFinalOpinionChangeRef.current = onFinalOpinionChange;
  const onNavAvailabilityChangeRef = useRef(onNavAvailabilityChange);
  onNavAvailabilityChangeRef.current = onNavAvailabilityChange;

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [valuationRequestId, setValuationRequestId] = useState<string | null>(null);
  // Sync request-id ref so reload skips ensure-open on every silent refresh.
  const valuationRequestIdRef = useRef<string | null>(null);
  const [displayId, setDisplayId] = useState<string | null>(null);
  const [selection, setSelection] =
    useState<ValuationComparableSelectionListDto | null>(null);
  const [landSelection, setLandSelection] =
    useState<ValuationComparableSelectionListDto | null>(null);
  const [candidates, setCandidates] = useState<ComparablePropertyDto[]>([]);
  const [bankSubjectCoords, setBankSubjectCoords] = useState<{
    lat: number;
    lng: number;
  } | null>(null);
  const [subjectArea, setSubjectArea] = useState("");
  const [adjustmentBasis, setAdjustmentBasis] = useState("price_per_sqm");
  const [analysisNotes, setAnalysisNotes] = useState("");
  const [factorDefinitions, setFactorDefinitions] = useState<Record<string, string>>({});
  const [catalogFactorOptions, setCatalogFactorOptions] = useState<
    { factorKey: string; labelAr: string }[]
  >([]);

  const [approachSettings, setApproachSettings] =
    useState<ValuationApproachSettingsDto | null>(null);

  const [cost, setCost] = useState<ValuationCostApproachDto | null>(null);
  /** Cost drafts hydrate inside CostApproachSection — key bumps on full load only. */
  const [costHydrateKey, setCostHydrateKey] = useState(0);
  /** Reconciliation drafts hydrate inside FinalOpinionSection — same key mechanism. */
  const [reconHydrateKey, setReconHydrateKey] = useState(0);
  /** Settings drafts hydrate inside ApproachSettingsSection — bumps on full load and settings save. */
  const [settingsHydrateKey, setSettingsHydrateKey] = useState(0);

  const [recon, setRecon] = useState<ValuationReconciliationDto | null>(null);
  const [gates, setGates] = useState<ValuationIssuanceGatesDto | null>(null);

  const officialValuationDate = useMemo(
    () => officialValuationDateOf(approachSettings),
    [approachSettings],
  );

  useEffect(() => {
    const config = apiConfig();
    if (!config) return;
    void getDifferenceFactorCatalog(config).then((res) => {
      if (!res.ok) return;
      const { definitions, addable } = buildFactorCatalog(
        res.data.factors as DifferenceFactorDefinitionDto[],
      );
      setFactorDefinitions(definitions);
      setCatalogFactorOptions(addable);
    });
  }, []);

  const subjectAreaSyncedRef = useRef<string | null>(null);
  const autoUnadoptFarRef = useRef<string | null>(null);

  /** Subject transaction area from the property wins over stale market-approach area on the server —
      sync once per (request, area) so it does not repeat on every load. */
  async function syncSubjectAreaFromTransaction(
    config: NonNullable<ReturnType<typeof apiConfig>>,
    requestId: string,
    transactionArea: string,
    sel: ValuationComparableSelectionListDto,
  ) {
    const txNum = parseDecimal(transactionArea);
    const serverArea = sel.subjectAreaSqm;
    const syncKey = `${requestId}:${txNum}`;
    if (
      !transactionArea ||
      !Number.isFinite(txNum) ||
      txNum <= 0 ||
      (serverArea != null && Math.abs(Number(serverArea) - txNum) <= 0.001) ||
      subjectAreaSyncedRef.current === syncKey
    ) {
      return;
    }
    subjectAreaSyncedRef.current = syncKey;
    const syncRes = await saveValuationMarketApproach(config, requestId, {
      subjectAreaSqm: txNum,
      adjustmentBasis: sel.adjustmentBasis || "price_per_sqm",
      analysisNotes: sel.analysisNotes ?? null,
    });
    if (syncRes.ok) setSelection(syncRes.data);
  }

  const resolveBankFetchOpts = useCallback(
    async (search?: string) => {
      const inspector = propertyId.trim()
        ? await fetchInspectorWorkspace(propertyId.trim())
        : null;
      const lat = Number(inspector?.mapLatitude);
      const lng = Number(inspector?.mapLongitude);
      const hasInspectorPin =
        Number.isFinite(lat) &&
        Number.isFinite(lng) &&
        !(lat === 0 && lng === 0);
      return {
        q: search?.trim() || undefined,
        propertyId: propertyId.trim() || undefined,
        district:
          property?.district?.trim() ||
          districtHint?.trim() ||
          intakeProperty?.district?.trim() ||
          undefined,
        city: property?.city || intakeProperty?.city || undefined,
        deedNumber:
          property?.deedNumber || intakeProperty?.deedNumber || undefined,
        locationMapUrl: intakeProperty?.locationMapUrl,
        propertyType: property?.propertyType?.trim() || undefined,
        subjectSqm: parseSubjectAreaSqm(subjectArea, property?.area),
        latitude: hasInspectorPin ? lat : null,
        longitude: hasInspectorPin ? lng : null,
      };
    },
    [
      propertyId,
      districtHint,
      property?.district,
      property?.city,
      property?.deedNumber,
      property?.propertyType,
      property?.area,
      intakeProperty?.city,
      intakeProperty?.deedNumber,
      intakeProperty?.district,
      intakeProperty?.locationMapUrl,
      subjectArea,
    ],
  );

  const reload = useCallback(
    async (opts?: { silent?: boolean; scope?: "full" | "derived" }) => {
    const config = apiConfig();
    if (!config) {
      setLoading(false);
      setError("يلزم تسجيل الدخول");
      return;
    }
    if (!propertyId.trim()) {
      setLoading(false);
      setError("لا يوجد معرّف عقار");
      return;
    }

    if (!opts?.silent) setLoading(true);
    // Silent reload refreshes server data only and leaves user drafts alone —
    // Rewriting fields while typing caused stuttering and lost text.
    const hydrateEdits = !opts?.silent;
    // “derived” scope: after a save that does not change settings or bank candidates — skip refetching them.
    const derivedOnly = opts?.scope === "derived";
    setError(null);

    // Open request is known after the first load — skip ensure-open on every refresh.
    let requestId = valuationRequestIdRef.current;
    if (!requestId) {
      const open = await ensureOpenValuationRequestByProperty(config, {
        propId: propertyId.trim(),
        area: districtHint?.trim() || property?.district?.trim() || "—",
        type: property?.propertyType?.trim() || "—",
        appraiser: "—",
      });
      if (!open.ok) {
        setLoading(false);
        valuationRequestIdRef.current = null;
        setValuationRequestId(null);
        setDisplayId(null);
        setSelection(null);
        setLandSelection(null);
        setCost(null);
        setRecon(null);
        // Cost and final-opinion sections reseed their drafts via their hydrate keys.
        setCostHydrateKey((k) => k + 1);
        setReconHydrateKey((k) => k + 1);
        setGates(null);
        if (open.kind === "auth") setError("يلزم تسجيل الدخول");
        else if (open.kind === "network") setError("تعذّر الاتصال بخدمة التقييم");
        else setError("تعذّر فتح طلب التقييم — يُنشأ عند توزيع المعاملة على المقيم.");
        return;
      }

      requestId = open.data.id;
      valuationRequestIdRef.current = requestId;
      setValuationRequestId(open.data.id);
      setDisplayId(open.data.displayId);
    }

    // Apply each response as it arrives — adoption flag does not wait on the slowest call (issuance gates).
    const selP = listValuationComparableSelections(config, requestId, MARKET_CONTEXT);
    const landP = listValuationComparableSelections(config, requestId, LAND_WITHIN_COST);
    // Display bank: within 3 km of subject (district coords when known), nearest first — up to 6 rows.
    // Text search is a separate call inside the bank table (searchBank) — not routed here.
    const bankP = derivedOnly
      ? null
      : resolveBankFetchOpts().then((bankOpts) =>
          fetchBankCandidates(config, bankOpts),
        );
    const costP = getValuationCostApproach(config, requestId);
    const reconP = getValuationReconciliation(config, requestId);
    const gatesP = getValuationIssuanceGates(config, requestId);
    const settingsP = derivedOnly
      ? null
      : getValuationApproachSettings(config, requestId);

    void landP.then((landSelRes) =>
      setLandSelection(landSelRes.ok ? landSelRes.data : null),
    );
    if (bankP) {
      void bankP.then((bankRes) => {
        if (!bankRes.ok) return;
        setCandidates(bankRes.data);
        setBankSubjectCoords(bankRes.subjectCoords);
      });
    }
    void gatesP.then((gatesRes) => setGates(gatesRes.ok ? gatesRes.data : null));

    const [selRes, costRes, reconRes] = await Promise.all([selP, costP, reconP]);
    const settingsRes = settingsP ? await settingsP : null;

    setLoading(false);

    if (settingsRes) {
      if (settingsRes.ok) {
        setApproachSettings(settingsRes.data);
        // Hydrate settings drafts inside ApproachSettingsSection — new key on every full load.
        if (hydrateEdits) setSettingsHydrateKey((k) => k + 1);
      } else {
        setApproachSettings(null);
        setSettingsHydrateKey((k) => k + 1);
      }
    }

    if (!selRes.ok) {
      setError("تعذّر تحميل المقارنات المختارة");
      return;
    }
    setSelection(selRes.data);
    if (hydrateEdits) {
      const transactionArea = property?.area?.trim() || "";
      setSubjectArea(
        transactionArea ||
          (selRes.data.subjectAreaSqm != null
            ? String(selRes.data.subjectAreaSqm)
            : ""),
      );
      setAdjustmentBasis(selRes.data.adjustmentBasis || "price_per_sqm");
      setAnalysisNotes(selRes.data.analysisNotes ?? "");
      // Table drafts live inside their components — nothing to clear here.
      await syncSubjectAreaFromTransaction(
        config,
        requestId,
        transactionArea,
        selRes.data,
      );
    }

    if (costRes.ok) {
      setCost(costRes.data);
      // Hydrate cost drafts inside CostApproachSection — new key on every full load.
      if (hydrateEdits) setCostHydrateKey((k) => k + 1);
    } else {
      setCost(null);
      setCostHydrateKey((k) => k + 1);
    }

    if (reconRes.ok) {
      setRecon(reconRes.data);
      // Hydrate reconciliation drafts inside FinalOpinionSection — new key on every full load.
      if (hydrateEdits) setReconHydrateKey((k) => k + 1);
      if (
        typeof reconRes.data.finalOpinionValue === "number" &&
        reconRes.data.finalOpinionValue > 0
      ) {
        onFinalOpinionChangeRef.current?.(reconRes.data.finalOpinionValue);
      }
    } else {
      setRecon(null);
      setReconHydrateKey((k) => k + 1);
    }
    },
    [
    propertyId,
    districtHint,
    assignmentType,
    subjectArea,
    property?.area,
    property?.district,
    property?.propertyType,
    property?.city,
    property?.deedNumber,
    intakeProperty?.city,
    intakeProperty?.deedNumber,
    intakeProperty?.locationMapUrl,
    resolveBankFetchOpts,
    ],
  );

  const reloadRef = useRef(reload);
  reloadRef.current = reload;

  /** After cost save: update the batch and silent-reload — no loading-skeleton flash. */
  const onCostSaved = useCallback((dto: ValuationCostApproachDto) => {
    setCost(dto);
    void reloadRef.current({ silent: true, scope: "derived" });
  }, []);
  /** After reconciliation save: update the batch, notify value opinion, and silent-reload. */
  const onReconSaved = useCallback((dto: ValuationReconciliationDto) => {
    setRecon(dto);
    if (
      typeof dto.finalOpinionValue === "number" &&
      dto.finalOpinionValue > 0
    ) {
      onFinalOpinionChangeRef.current?.(dto.finalOpinionValue);
    }
    void reloadRef.current({ silent: true, scope: "derived" });
  }, []);
  const approachSettingsRef = useRef(approachSettings);
  approachSettingsRef.current = approachSettings;
  /** After settings save: update the batch, reseed settings drafts, and silent-reload derived data. */
  const onSettingsSaved = useCallback((dto: ValuationApproachSettingsDto) => {
    setApproachSettings(dto);
    setSettingsHydrateKey((k) => k + 1);
    void reloadRef.current({ silent: true, scope: "derived" });
  }, []);
  /** Save cost basis/unit from the cost screen — layered on the last saved settings. */
  const onSaveCostBasisUnit = useCallback(
    async (basisKey: string, unitKey: string) => {
      const config = apiConfig();
      const s = approachSettingsRef.current;
      const requestId = valuationRequestIdRef.current;
      if (!config || !requestId || !s) return;
      setSaving(true);
      const res = await saveValuationApproachSettings(config, requestId, {
        marketApproachEnabled: s.marketApproachEnabled,
        costApproachEnabled: s.costApproachEnabled,
        incomeApproachEnabled: false,
        costBasisKey: basisKey,
        costScopeKey: s.costScopeKey,
        costMeasurementUnitKey: unitKey,
        adjustmentsEditUnlocked: s.adjustmentsEditUnlocked,
        valuationPurposeKey: s.valuationPurposeKey,
        valuationPurposeNote: s.valuationPurposeNote ?? null,
        externalSpecialistUsed: s.externalSpecialistUsed,
        externalSpecialistDetails: s.externalSpecialistDetails ?? null,
        valuationDateMode: s.valuationDateMode,
        retrospectiveDate: s.retrospectiveDate ?? null,
        retrospectiveDateEnd: s.retrospectiveDateEnd ?? null,
        retrospectiveRationale: null,
        selectedAssumptions: s.selectedAssumptions ?? [],
      });
      setSaving(false);
      if (!res.ok) {
        showToast(res.message ?? "تعذّر بدء التقييم", "error");
        return;
      }
      showToast("تم حفظ أساس ووحدة التكلفة", "success");
      setApproachSettings(res.data);
      setSettingsHydrateKey((k) => k + 1);
      void reloadRef.current({ silent: true, scope: "derived" });
    },
    [showToast],
  );
  // Initial + property identity — avoid re-running when parent passes a new callback each render.
  useEffect(() => {
    valuationRequestIdRef.current = null;
    subjectAreaSyncedRef.current = null;
    void reloadRef.current();
  }, [propertyId]);

  const settingsSaved = approachSettings?.isSaved ?? false;
  const marketEnabled = settingsSaved && (approachSettings?.marketApproachEnabled ?? true);
  const costEnabled =
    settingsSaved &&
    (approachSettings?.costApproachEnabled ?? true) &&
    (approachSettings?.costApproachAllowed ?? true);
  const adjustmentsLocked = false;

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

  const subjectCity =
    property?.city?.trim() || intakeProperty?.city?.trim() || "";
  const subjectDistrict =
    property?.district?.trim() ||
    districtHint?.trim() ||
    intakeProperty?.district?.trim() ||
    "";
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
  useEffect(() => {
    const config = apiConfig();
    if (!config || !valuationRequestId || loading) return;
    if (!subjectCoordsForBank && !subjectCity) return;

    const farMarket = selection
      ? adoptedMarket.filter(
          (item) =>
            filterSelectionNearSubject(
              [item],
              subjectCity || undefined,
              subjectCoordsForBank,
            ).length === 0,
        )
      : [];
    const farLand = landSelection
      ? adoptedLand.filter(
          (item) =>
            filterSelectionNearSubject(
              [item],
              subjectCity || undefined,
              subjectCoordsForBank,
            ).length === 0,
        )
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

  const { rows: bankRows, distances: bankDistanceKm } = useMemo(
    () =>
      buildBankDisplayRows({
        selectionItems: selection?.items ?? [],
        candidates,
        subjectCity: subjectCity || undefined,
        subjectCoords: subjectCoordsForBank,
        subjectSqm: parseSubjectAreaSqm(subjectArea, property?.area),
        limit: BANK_DISPLAY_LIMIT,
      }),
    [
      selection?.items,
      candidates,
      subjectCity,
      subjectCoordsForBank,
      subjectArea,
      property?.area,
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
        limit: BANK_DISPLAY_LIMIT,
      }),
    [
      landSelection?.items,
      landCandidates,
      subjectCity,
      subjectCoordsForBank,
      cost?.landAreaSqm,
      subjectArea,
      property?.area,
    ],
  );

  const subjectAreaNum = parseDecimal(subjectArea) || null;

  const subjectAreaRef = useRef(subjectArea);
  subjectAreaRef.current = subjectArea;
  /** Bank search — fetches bank candidates only instead of a full screen reload (7 calls). */
  const onSearchBank = useCallback(
    (search: string) => {
      void (async () => {
        const config = apiConfig();
        if (!config) return;
        const bankOpts = await resolveBankFetchOpts(search);
        bankOpts.subjectSqm = parseSubjectAreaSqm(
          subjectAreaRef.current,
          property?.area,
        );
        const res = await fetchBankCandidates(config, bankOpts);
        if (!res.ok) return;
        setCandidates(res.data);
        setBankSubjectCoords(res.subjectCoords);
      })();
    },
    [resolveBankFetchOpts, property?.area],
  );

  useEffect(() => {
    onNavAvailabilityChangeRef.current?.({
      market: marketEnabled,
      cost: costEnabled,
    });
  }, [marketEnabled, costEnabled]);

  return {
    showToast,
    loading,
    saving,
    setSaving,
    error,
    valuationRequestId,
    displayId,
    selection,
    setSelection,
    landSelection,
    setLandSelection,
    subjectArea,
    setSubjectArea,
    adjustmentBasis,
    setAdjustmentBasis,
    analysisNotes,
    setAnalysisNotes,
    factorDefinitions,
    catalogFactorOptions,
    approachSettings,
    settingsHydrateKey,
    cost,
    costHydrateKey,
    recon,
    reconHydrateKey,
    gates,
    officialValuationDate,
    reload,
    onCostSaved,
    onReconSaved,
    onSettingsSaved,
    onSaveCostBasisUnit,
    settingsSaved,
    marketEnabled,
    costEnabled,
    adjustmentsLocked,
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

export type ValuationWorkData = ReturnType<typeof useValuationWorkData>;
