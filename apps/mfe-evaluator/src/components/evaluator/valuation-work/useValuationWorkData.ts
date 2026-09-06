"use client";

/**
 * Everything `ValuationWorkShell` loads: the open valuation request, the two
 * comparable selections, the comparables bank, cost / reconciliation / gates
 * batches and the approach settings. The memoised projections come from
 * `useValuationWorkReadModels`, the section post-save hooks from
 * `useValuationSectionSaves`; commands live in `useValuationWorkCommands`.
 * This hook owns the state all of them mutate.
 */
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  ensureOpenValuationRequestByProperty,
  listValuationComparableSelections,
  saveValuationMarketApproach,
  getValuationCostApproach,
  getValuationApproachSettings,
  getValuationReconciliation,
  getValuationIssuanceGates,
  getDifferenceFactorCatalog,
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
import { fetchBankCandidates } from "./lib/bank-ranking";
import { apiConfig } from "./lib/shell-utils";
import {
  LAND_WITHIN_COST,
  MARKET_CONTEXT,
  buildFactorCatalog,
  officialValuationDateOf,
  type ValuationWorkNavAvailability,
  type ValuationWorkPropertyHint,
} from "./lib/shell-state";
import {
  approachAvailability,
  buildBankFetchOptions,
  hasPositiveFinalOpinion,
  initialSubjectArea,
  inspectorPinOf,
  openFailureMessage,
  openRequestBody,
  subjectAreaSyncPlan,
  type SubjectCoords,
} from "./lib/valuation-data-state";
import { useValuationSectionSaves } from "./useValuationSectionSaves";
import { useValuationWorkReadModels } from "./useValuationWorkReadModels";

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
  const [bankSubjectCoords, setBankSubjectCoords] = useState<SubjectCoords | null>(null);
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

  /** Subject transaction area from the property wins over stale market-approach area on the server —
      sync once per (request, area) so it does not repeat on every load. */
  async function syncSubjectAreaFromTransaction(
    config: NonNullable<ReturnType<typeof apiConfig>>,
    requestId: string,
    transactionArea: string,
    sel: ValuationComparableSelectionListDto,
  ) {
    const plan = subjectAreaSyncPlan({
      requestId,
      transactionArea,
      selection: sel,
      lastSyncKey: subjectAreaSyncedRef.current,
    });
    if (!plan) return;
    subjectAreaSyncedRef.current = plan.syncKey;
    const syncRes = await saveValuationMarketApproach(config, requestId, plan.body);
    if (syncRes.ok) setSelection(syncRes.data);
  }

  const resolveBankFetchOpts = useCallback(
    async (search?: string) => {
      const inspector = propertyId.trim()
        ? await fetchInspectorWorkspace(propertyId.trim())
        : null;
      return buildBankFetchOptions({
        search,
        propertyId,
        subjectArea,
        pin: inspectorPinOf(inspector),
        districtHint,
        property,
        intakeProperty,
      });
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
  const applyBankResult = useCallback(
    (rows: ComparablePropertyDto[], subjectCoords: SubjectCoords | null) => {
      setCandidates(rows);
      setBankSubjectCoords(subjectCoords);
    },
    [],
  );

  /** Everything the open-request failure clears — sections reseed their drafts via the hydrate keys. */
  function resetForOpenFailure(kind: string) {
    setLoading(false);
    valuationRequestIdRef.current = null;
    setValuationRequestId(null);
    setDisplayId(null);
    setSelection(null);
    setLandSelection(null);
    setCost(null);
    setRecon(null);
    setCostHydrateKey((k) => k + 1);
    setReconHydrateKey((k) => k + 1);
    setGates(null);
    setError(openFailureMessage(kind));
  }

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
      const open = await ensureOpenValuationRequestByProperty(
        config,
        openRequestBody(propertyId, { districtHint, property }),
      );
      if (!open.ok) {
        resetForOpenFailure(open.kind);
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
        applyBankResult(bankRes.data, bankRes.subjectCoords);
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
      setSubjectArea(initialSubjectArea(transactionArea, selRes.data));
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
      if (hasPositiveFinalOpinion(reconRes.data.finalOpinionValue)) {
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

  const sectionSaves = useValuationSectionSaves({
    showToast,
    setSaving,
    setCost,
    setRecon,
    setApproachSettings,
    setSettingsHydrateKey,
    approachSettings,
    valuationRequestIdRef,
    reloadRef,
    onFinalOpinionChangeRef,
  });

  // Initial + property identity — avoid re-running when parent passes a new callback each render.
  useEffect(() => {
    valuationRequestIdRef.current = null;
    subjectAreaSyncedRef.current = null;
    void reloadRef.current();
  }, [propertyId]);

  const { settingsSaved, marketEnabled, costEnabled } =
    approachAvailability(approachSettings);
  const adjustmentsLocked = false;

  const readModels = useValuationWorkReadModels({
    hints: { districtHint, property, intakeProperty },
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
  });

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
    ...sectionSaves,
    settingsSaved,
    marketEnabled,
    costEnabled,
    adjustmentsLocked,
    ...readModels,
  };
}

export type ValuationWorkData = ReturnType<typeof useValuationWorkData>;
