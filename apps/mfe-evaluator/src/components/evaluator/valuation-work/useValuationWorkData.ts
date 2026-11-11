// ── Valuation fixes · 2026-10-25/26 ──────────────────────────────────────────────────────────
// Round 2 (1b19bedc)
//  • Frozen  After hand-over (editLocked) no background market-approach PUTs: the subject-area sync gets
//            writesFrozen and the seeded notes are not written.
// ──────────────────────────────────────────────────────────────────────────────────────────────

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
import { useLatestRef } from "@platform/app-shared/hooks/use-latest-ref";
import { useQueryClient } from "@tanstack/react-query";
import { appDataKeys } from "@platform/app-shared/query/app-data-keys";
import { ensureOrganizationSettingsLoaded } from "@platform/app-shared/organization/organization-settings-cache";
import {
  ensureOpenValuationRequestByProperty,
  listValuationComparableSelections,
  saveValuationMarketApproach,
  getValuationCostApproach,
  getValuationApproachSettings,
  getValuationReconciliation,
  getValuationIssuanceGates,
  getBuildingInventory,
  type ValuationComparableSelectionListDto,
  type ValuationApproachSettingsDto,
  type ValuationCostApproachDto,
  type ValuationReconciliationDto,
  type ValuationIssuanceGatesDto,
} from "@platform/api-client";
import { useToast } from "@platform/ui-kit";
import type { PoPropertyIntake } from "@platform/app-shared/app-data/po-intake-property-model";
import { fetchInspectorWorkspace } from "../../../lib/case-study-bridge";
import { scheduleInvalidateEvaluatorReportOutput } from "../../../lib/evaluator/evaluator-report-output-cache";
import { resolveSubjectCoordsForBank } from "./lib/bank-ranking";
import { apiConfig } from "./lib/shell-utils";
import {
  LAND_WITHIN_COST,
  MARKET_CONTEXT,
  isSeedMarketAnalysisNotes,
  officialValuationDateOf,
  type ValuationWorkPropertyHint,
} from "./lib/shell-state";
import { deedNatureMatchBlocksValuation } from "./lib/deed-nature-match-gate";
import {
  approachAvailability,
  buildBankFetchOptions,
  finalOpinionSyncExtrasFromRecon,
  hasPositiveFinalOpinion,
  initialSubjectArea,
  inspectorPinOf,
  openFailureMessage,
  openRequestBody,
  subjectAreaSyncPlan,
  type FinalOpinionChangeHandler,
  type SubjectCoords,
} from "./lib/valuation-data-state";
import {
  builtUpSqmFromInventory,
  defaultMarketBasis,
  marketSubjectArea,
  marketSubjectKind,
  type MarketSubjectKind,
} from "./lib/market-subject";
import { createReloadSequence, ignoreSideFailure, runReload } from "./lib/reload-sequence";
import type { ReloadOptions, ReloadTicket } from "./lib/reload-sequence";
import { useValuationSectionSaves } from "./useValuationSectionSaves";
import { useValuationWorkReadModels } from "./useValuationWorkReadModels";

type ValuationWorkDataParams = {
  propertyId: string;
  /** Reads the specialist's inventory — a building's market area is its floor area. */
  poNumber?: string;
  inspectionTaskId?: string | null;
  assignmentType?: string;
  districtHint?: string;
  property?: ValuationWorkPropertyHint;
  intakeProperty?: PoPropertyIntake | null;
  onFinalOpinionChange?: FinalOpinionChangeHandler;
  /** The appraiser's form is closed (submitted, or the inspection went back for correction). */
  editLocked?: boolean;
};

export function useValuationWorkData({
  propertyId,
  poNumber = "",
  inspectionTaskId = null,
  assignmentType,
  districtHint,
  property,
  intakeProperty = null,
  onFinalOpinionChange,
  editLocked = false,
}: ValuationWorkDataParams) {
  const { showToast } = useToast();
  const queryClient = useQueryClient();
  const onFinalOpinionChangeRef = useLatestRef(onFinalOpinionChange);
  const editLockedRef = useLatestRef(editLocked); // handed over: no background market-approach PUTs

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
  // The subject's location (inspector's pin, else the intake map link) — the distance column and
  // the «إضافة مقارن» map read it.
  const [bankSubjectCoords, setBankSubjectCoords] = useState<SubjectCoords | null>(null);
  const [subjectArea, setSubjectArea] = useState("");
  const [adjustmentBasis, setAdjustmentBasis] = useState("price_per_sqm");
  const [analysisNotes, setAnalysisNotes] = useState("");

  const [approachSettings, setApproachSettings] =
    useState<ValuationApproachSettingsDto | null>(null);
  const approachSettingsRef = useLatestRef(approachSettings);
  /** «مجموع مسطحات البناء» from the specialist's inventory — null until read or when none is listed. */
  const [builtUpSqm, setBuiltUpSqm] = useState<number | null>(null);

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

  const subjectAreaSyncedRef = useRef<string | null>(null);

  /** The subject's area (deed area, or a building's floor area) wins over a stale market-approach
      area on the server — sync once per (request, area) so it does not repeat on every load. */
  async function syncSubjectArea(
    config: NonNullable<ReturnType<typeof apiConfig>>,
    requestId: string,
    subjectArea: string,
    firstBasis: string,
    sel: ValuationComparableSelectionListDto,
    live: () => boolean,
    forceBasis?: string,
  ) {
    const plan = subjectAreaSyncPlan({
      requestId,
      subjectArea,
      selection: sel,
      lastSyncKey: subjectAreaSyncedRef.current,
      writesFrozen: editLockedRef.current,
      firstBasis,
      forceBasis,
    });
    if (!plan) return;
    subjectAreaSyncedRef.current = plan.syncKey;
    const syncRes = await saveValuationMarketApproach(config, requestId, plan.body);
    if (!syncRes.ok || !live()) return;
    setSelection(syncRes.data);
    setAdjustmentBasis(syncRes.data.adjustmentBasis || "price_per_sqm");
  }

  const resolveBankFetchOpts = useCallback(
    async () => {
      const inspectorTaskId = inspectionTaskId?.trim() || "";
      const inspector = inspectorTaskId
        ? await fetchInspectorWorkspace(inspectorTaskId)
        : null;
      return buildBankFetchOptions({
        propertyId,
        subjectArea,
        pin: inspectorPinOf(inspector),
        districtHint,
        property,
        intakeProperty,
      });
    },
    // The individual fields are the inputs on purpose: the property objects come
    // from queries and change identity on every refetch, which would refire the
    // bank search for untouched fields.
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [
      inspectionTaskId,
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

  // Only the latest reload, still on the property it started for, writes state.
  const [reloadSeq] = useState(createReloadSequence);
  const propertyIdRef = useLatestRef(propertyId);

  const load = useCallback(
    async (ticket: ReloadTicket) => {
    const { opts } = ticket;
    let requestId = valuationRequestIdRef.current;
    // The request id is checked too: a property switch clears it before the next load.
    const live = () =>
      reloadSeq.isLatest(ticket, propertyIdRef.current) &&
      (!requestId || valuationRequestIdRef.current === requestId);
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
    if (!requestId) {
      const open = await ensureOpenValuationRequestByProperty(
        config,
        openRequestBody(propertyId, { districtHint, property }),
      );
      if (!live()) return;
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
    // The tables show the transaction's own comparables (they come with the selections above); the
    // bank is not asked here. Only the subject's location is resolved.
    const subjectP = derivedOnly ? null : resolveBankFetchOpts();
    const costP = getValuationCostApproach(config, requestId);
    const reconP = getValuationReconciliation(config, requestId);
    const gatesP = getValuationIssuanceGates(config, requestId);
    const settingsP = derivedOnly
      ? null
      : getValuationApproachSettings(config, requestId);
    const inventoryP =
      hydrateEdits && poNumber.trim()
        ? getBuildingInventory(config, poNumber, propertyId)
        : null;

    // Side batches: a failure leaves the previous rows; the main batches below surface errors.
    void landP.then((r) => live() && setLandSelection(r.ok ? r.data : null), ignoreSideFailure);
    if (subjectP) {
      void subjectP.then((subject) => {
        if (live()) setBankSubjectCoords(resolveSubjectCoordsForBank(subject));
      }, ignoreSideFailure);
    }
    void gatesP.then((r) => live() && setGates(r.ok ? r.data : null), ignoreSideFailure);

    const [selRes, costRes, reconRes, settingsRes, inventoryRes] = await Promise.all([
      selP,
      costP,
      reconP,
      settingsP,
      inventoryP,
    ]);
    if (!live()) return;

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
      // A building is measured by its floor area, land and an apartment by the deed (2026-10-29).
      const builtUp = inventoryRes?.ok ? builtUpSqmFromInventory(inventoryRes.data.lines) : builtUpSqm;
      if (inventoryRes?.ok) setBuiltUpSqm(builtUp);
      const settings = settingsRes?.ok ? settingsRes.data : approachSettingsRef.current;
      const kind = marketSubjectKind({
        costScopeKey: settings?.costScopeKey,
        isLandPropertyType: settings?.isLandPropertyType,
        propertyType: settings?.propertyType || property?.propertyType,
        builtUpSqm: builtUp,
      });
      const measuredArea = marketSubjectArea(kind, {
        deedArea: property?.area?.trim() || "",
        builtUpSqm: builtUp,
      });
      setSubjectArea(
        initialSubjectArea(measuredArea, selRes.data, { storedFallback: kind !== "building" }),
      );
      setAdjustmentBasis(selRes.data.adjustmentBasis || "price_per_sqm");
      const loadedNotes = selRes.data.analysisNotes ?? "";
      // Drop demo seed filler so تحليل التسويات follows the adjustments table.
      const seedNotes = isSeedMarketAnalysisNotes(loadedNotes);
      setAnalysisNotes(seedNotes ? "" : loadedNotes);
      if (seedNotes && !editLockedRef.current) {
        void saveValuationMarketApproach(config, requestId, {
          subjectAreaSqm: selRes.data.subjectAreaSqm ?? null,
          adjustmentBasis: selRes.data.adjustmentBasis || "price_per_sqm",
          analysisNotes: null,
        }).then((res) => {
          if (res.ok && live()) setSelection(res.data);
        }, ignoreSideFailure);
      }
      // Table drafts live inside their components — nothing to clear here.
      await syncSubjectArea(
        config,
        requestId,
        measuredArea,
        defaultMarketBasis(kind),
        selRes.data,
        live,
      );
      if (!live()) return;
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
        onFinalOpinionChangeRef.current?.(
          reconRes.data.finalOpinionValue,
          finalOpinionSyncExtrasFromRecon(reconRes.data),
        );
      }
    } else {
      setRecon(null);
      setReconHydrateKey((k) => k + 1);
    }
    // Market / cost / recon just refreshed — drop the printed-report cache (debounced).
    scheduleInvalidateEvaluatorReportOutput(queryClient);
    },
    // Field-level inputs on purpose — see `resolveBankFetchOpts` above.
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [
    propertyId,
    poNumber,
    builtUpSqm,
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
    queryClient,
    reloadSeq,
    ],
  );

  // The figures card under «حالة الأطراف» (Omar 2026-11-11) reads the valuation's values from the
  // server: whenever a reload or a section's save brings new ones here, it reads them again at once.
  useEffect(() => {
    void queryClient.invalidateQueries({
      queryKey: appDataKeys.propertyValuationFigures(propertyId.trim()),
    });
  }, [queryClient, propertyId, cost, recon, selection, landSelection]);

  const reload = useCallback(
    (opts?: ReloadOptions) =>
      runReload(reloadSeq, { propertyId, opts }, () => propertyIdRef.current, load, () => {
        setLoading(false); // a rejected call must not leave the skeleton up forever
        setError("تعذّر تحميل بيانات التقييم — أعد المحاولة");
      }),
    [load, propertyId, propertyIdRef, reloadSeq],
  );

  const reloadRef = useLatestRef(reload);

  const sectionSaves = useValuationSectionSaves({
    setCost,
    setRecon,
    setApproachSettings,
    setSettingsHydrateKey,
    reloadRef,
    onFinalOpinionChangeRef,
  });

  // Initial + property identity — avoid re-running when parent passes a new callback each render.
  // The shell sits in an <Activity>: coming back from «تقرير التقييم» re-runs this effect for
  // the same property. Then refresh silently — a full load showed the skeleton and re-seeded
  // every section's drafts on each return.
  const fullLoadRef = useRef<{ propertyId: string; done: boolean } | null>(null);
  // Warm the organization-settings cache so the adoption cap reads the saved value.
  useEffect(() => void ensureOrganizationSettingsLoaded().catch(() => undefined), []);

  useEffect(() => {
    const last = fullLoadRef.current;
    if (last?.propertyId === propertyId) {
      if (last.done) void reloadRef.current({ silent: true });
      return;
    }
    const current = { propertyId, done: false };
    fullLoadRef.current = current;
    valuationRequestIdRef.current = null;
    subjectAreaSyncedRef.current = null;
    void reloadRef.current().finally(() => {
      current.done = true;
    });
  }, [propertyId, reloadRef]);

  const { settingsSaved, marketEnabled, costEnabled } =
    approachAvailability(approachSettings);
  const marketKind = marketSubjectKind({
    costScopeKey: approachSettings?.costScopeKey,
    isLandPropertyType: approachSettings?.isLandPropertyType,
    propertyType: approachSettings?.propertyType || property?.propertyType,
    builtUpSqm,
  });

  // The scope decides the kind (أرض فقط ↔ أرض مع المباني): a change re-measures area or floor area
  // and moves the basis to the new kind's, once the screen has loaded. A later sync keeps the
  // appraiser's own choice.
  const lastMarketKindRef = useRef<MarketSubjectKind | null>(null);
  useEffect(() => {
    const prev = lastMarketKindRef.current;
    lastMarketKindRef.current = marketKind;
    if (prev == null || prev === marketKind || loading) return;
    const area = marketSubjectArea(marketKind, {
      deedArea: property?.area?.trim() || "",
      builtUpSqm,
    });
    setSubjectArea(area);
    const config = apiConfig();
    const requestId = valuationRequestIdRef.current;
    if (!config || !requestId || !selection) return;
    const basis = defaultMarketBasis(marketKind);
    void syncSubjectArea(
      config,
      requestId,
      area,
      basis,
      selection,
      () => valuationRequestIdRef.current === requestId,
      basis,
    );
    // Only a change of kind re-measures; the other inputs are read as they are now.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [marketKind]);
  // Deed/nature match is enforced at issuance only — it no longer holds up the appraiser's work.
  const deedMatchPending = deedNatureMatchBlocksValuation(gates);
  // Adjustment / cost tables go read-only once the form is closed.
  const adjustmentsLocked = editLocked;

  const readModels = useValuationWorkReadModels({
    hints: { districtHint, property, intakeProperty },
    loading,
    valuationRequestId,
    selection,
    landSelection,
    bankSubjectCoords,
    subjectArea,
    analysisNotes,
    cost,
  });

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
    approachSettings,
    marketKind,
    builtUpSqm,
    settingsHydrateKey,
    cost,
    costHydrateKey,
    recon,
    reconHydrateKey,
    gates,
    officialValuationDate,
    reload,
    bankSubjectCoords,
    ...sectionSaves,
    settingsSaved,
    marketEnabled,
    costEnabled,
    adjustmentsLocked,
    deedMatchPending,
    ...readModels,
  };
}

export type ValuationWorkData = ReturnType<typeof useValuationWorkData>;
