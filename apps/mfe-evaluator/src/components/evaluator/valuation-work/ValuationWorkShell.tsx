"use client";

import {
  Activity,
  Suspense,
  lazy,
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import {
  ensureOpenValuationRequestByProperty,
  listValuationComparableSelections,
  saveValuationComparableMarket,
  saveAdjustmentFactorRationale,
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
  type ValuationComparableSelectionDto,
  type ValuationComparableSelectionListDto,
  type ValuationApproachSettingsDto,
  type ValuationCostApproachDto,
  type ValuationReconciliationDto,
  type ValuationIssuanceGatesDto,
} from "@platform/api-client";
import { getAuthSession } from "@platform/auth-client";
import {
  InlineLoadingSkeleton,
  Spinner,
  cn,
  opsLetterCard,
  useToast,
} from "@platform/ui-kit";
import type { PoPropertyIntake } from "@case-study/mfe/lib/prototype/po-intake-data";
import type {
  EvaluatorReportChoices,
  EvaluatorSubmission,
} from "../../../lib/evaluator/evaluator-window-data";
import { createEvaluatorDraft } from "../../../lib/evaluator/evaluator-window-data";
import { fetchInspectorWorkspace } from "@case-study/mfe/lib/prototype/inspector-workspace-storage";

import {
  Card,
  CardPad,
  GhostBtn,
  PrimaryBtn,
} from "./atoms";
import { ApproachSettingsSection } from "./ApproachSettingsSection";
import { ComparablesBankTable } from "./ComparablesBankTable";
import {
  BANK_DISPLAY_LIMIT,
  buildBankDisplayRows,
  fetchBankCandidates,
  filterSelectionNearSubject,
  isVacantLandComparable,
  parseSubjectAreaSqm,
  resolveSubjectCoordsForBank,
} from "./lib/bank-ranking";
import {
  AUTO_AREA_KEYS,
  DEFAULT_DIFFERENCE_KEYS,
  SEQUENTIAL_KEYS,
  STANDARD_FACTORS,
  buildFactorRows,
  ensureLinesForSave,
  lineForSave,
  linePercent,
  marketSaveBody,
} from "./lib/market-save-mappers";
import {
  runMatrixAction,
  type MatrixDispatch,
} from "./lib/matrix-actions";
import { apiConfig, fmt, JUSTIFICATION_MIN_LENGTH } from "./lib/shell-utils";

const EvaluatorFinalReviewTab = lazy(() =>
  import("../EvaluatorFinalReviewTab").then((m) => ({
    default: m.EvaluatorFinalReviewTab,
  })),
);
const AdjustmentsMatrix = lazy(() =>
  import("./AdjustmentsMatrix").then((m) => ({ default: m.AdjustmentsMatrix })),
);
const CostApproachSection = lazy(() =>
  import("./CostApproachSection").then((m) => ({
    default: m.CostApproachSection,
  })),
);
const CostBasisUnitCard = lazy(() =>
  import("./CostApproachSection").then((m) => ({
    default: m.CostBasisUnitCard,
  })),
);
const FinalOpinionSection = lazy(() =>
  import("./FinalOpinionSection").then((m) => ({
    default: m.FinalOpinionSection,
  })),
);

const LAND_WITHIN_COST = "land_within_cost";
const MARKET_CONTEXT = "market";
/** Interactive-form spec: “N of 5 adopted”. */
const MAX_ADOPTED_COMPARABLES = 5;

export type ValuationWorkScreenId =
  | "basic"
  | "market"
  | "cost"
  | "final"
  | "review";

export type ValuationWorkNavAvailability = {
  market: boolean;
  cost: boolean;
};

export type ValuationWorkPropertyHint = {
  area?: string;
  district?: string;
  city?: string;
  deedNumber?: string;
  propertyType?: string;
  classification?: string | null;
};

export type ValuationWorkShellProps = {
  propertyId: string;
  poNumber?: string;
  assignmentType?: string;
  districtHint?: string;
  onFinalOpinionChange?: (finalOpinionValue: number) => void;
  property?: ValuationWorkPropertyHint;
  /** Full intake row when available (final-review screen). */
  intakeProperty?: PoPropertyIntake | null;
  draft?: EvaluatorSubmission;
  disabled?: boolean;
  fieldErrors?: Record<string, string>;
  onDraftPatch?: (patch: {
    evaluatorPrice?: string;
    forcedSaleDiscountPct?: string;
  }) => void;
  onReportChoicesPatch?: (patch: Partial<EvaluatorReportChoices>) => void;
  onSubmit?: () => void;
  submitting?: boolean;
  showSubmit?: boolean;
  /** Controlled screen when embedded in EvaluatorWindow top tabs. */
  screen?: ValuationWorkScreenId;
  onScreenChange?: (screen: ValuationWorkScreenId) => void;
  /** Hide inner header/nav — top ValTabBar owns navigation. */
  embeddedInTopTabs?: boolean;
  /** Notify parent which approach tabs should appear (Rule Q-2). */
  onNavAvailabilityChange?: (nav: ValuationWorkNavAvailability) => void;
};

/**
 * Appraiser valuation work shell — matches the sales-comparison valuation design docs.
 * Horizontal screen nav (MFE already has app sidebar).
 */
export function ValuationWorkShell({
  propertyId,
  poNumber,
  assignmentType,
  districtHint,
  onFinalOpinionChange,
  property,
  intakeProperty = null,
  draft,
  disabled = false,
  fieldErrors,
  onDraftPatch,
  onReportChoicesPatch,
  onSubmit,
  submitting = false,
  showSubmit = false,
  screen: screenProp,
  onScreenChange,
  embeddedInTopTabs = false,
  onNavAvailabilityChange,
}: ValuationWorkShellProps) {
  const { showToast } = useToast();
  const onFinalOpinionChangeRef = useRef(onFinalOpinionChange);
  onFinalOpinionChangeRef.current = onFinalOpinionChange;
  const onNavAvailabilityChangeRef = useRef(onNavAvailabilityChange);
  onNavAvailabilityChangeRef.current = onNavAvailabilityChange;
  const [internalScreen, setInternalScreen] =
    useState<ValuationWorkScreenId>("basic");
  const screenControlled = screenProp != null;
  const screen = screenControlled ? screenProp : internalScreen;
  const setScreen = useCallback(
    (id: ValuationWorkScreenId) => {
      if (!screenControlled) setInternalScreen(id);
      onScreenChange?.(id);
    },
    [onScreenChange, screenControlled],
  );
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

  // Official valuation date from saved settings — not from unsaved drafts.
  const officialValuationDate = useMemo(() => {
    if (approachSettings?.valuationDateMode !== "retrospective") return null;
    const start = approachSettings.retrospectiveDate?.trim();
    if (!start) return null;
    const end = approachSettings.retrospectiveDateEnd?.trim();
    return end ? `${start} — ${end}` : start;
  }, [approachSettings]);
  const valDate = officialValuationDate ?? "عند الاعتماد";

  useEffect(() => {
    const config = apiConfig();
    if (!config) return;
    void getDifferenceFactorCatalog(config).then((res) => {
      if (!res.ok) return;
      const map: Record<string, string> = {};
      const addable: { factorKey: string; labelAr: string }[] = [];
      for (const f of res.data.factors as DifferenceFactorDefinitionDto[]) {
        if (!f.isActive) continue;
        map[f.key] = f.excludesAr
          ? `${f.definitionAr}\nلا يشمل: ${f.excludesAr}`
          : f.definitionAr;
        if (!DEFAULT_DIFFERENCE_KEYS.has(f.key) && f.key !== "area") {
          addable.push({ factorKey: f.key, labelAr: f.labelAr });
        }
      }
      setFactorDefinitions(map);
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
    const txNum = Number(transactionArea.replace(",", "."));
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

  /** Context that owns the comparable selection — picks the correct factor list. */
  function contextOfItem(item: ValuationComparableSelectionDto): string {
    return adoptedLand.some((i) => i.id === item.id)
      ? LAND_WITHIN_COST
      : MARKET_CONTEXT;
  }
  function adoptedFor(context: string) {
    return context === LAND_WITHIN_COST ? visibleAdoptedLand : visibleAdoptedMarket;
  }
  function factorRowsFor(context: string) {
    return context === LAND_WITHIN_COST ? visibleLandFactorRows : visibleFactorRows;
  }

  /**
   * Interactive-form spec (buildNarrative): adjustments analysis text is generated from factor
   * justifications (“not justified” when empty) until the appraiser edits it manually.
   */
  const autoNarrative = useMemo(() => {
    if (!visibleAdoptedMarket.length) {
      return "لم تُعتمد أي مقارنة بعد؛ يلزم اعتماد مقارن واحد على الأقل لتكوين رأي القيمة.";
    }
    const first = visibleAdoptedMarket[0]?.market?.adjustmentLines ?? [];
    const bullets: string[] = [];
    for (const f of visibleFactorRows) {
      const line = first.find((l) => l.factorKey === f.factorKey);
      const just = (line?.rationale ?? "").trim();
      bullets.push(`• ${f.labelAr || f.factorKey} — ${just || "لم يتم تبريره"}`);
    }
    const weightJust = (
      visibleAdoptedMarket[0]?.market?.weightOverrideRationale ?? ""
    ).trim();
    bullets.push(`• الوزن النسبي — ${weightJust || "لم يتم تبريره"}`);
    return `مبررات التسويات:\n${bullets.join("\n")}`;
  }, [visibleAdoptedMarket, visibleFactorRows]);
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

    const signature = `${valuationRequestId}:m${farMarket
      .map((i) => i.comparablePropertyId)
      .sort()
      .join(",")}:l${farLand
      .map((i) => i.comparablePropertyId)
      .sort()
      .join(",")}`;
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

  const subjectAreaNum = Number(subjectArea.replace(",", ".")) || null;

  /* ─── Stable handlers for the comparables bank — so table memo holds across shell re-renders.
     Function declarations below are hoisted, so references here are valid. ─── */
  const adoptRef = useRef(adopt);
  adoptRef.current = adopt;
  const saveBankOverrideRef = useRef(saveBankOverride);
  saveBankOverrideRef.current = saveBankOverride;
  const subjectAreaRef = useRef(subjectArea);
  subjectAreaRef.current = subjectArea;
  const onAdoptMarket = useCallback((comparableId: string, adopted: boolean) => {
    void adoptRef.current(comparableId, adopted, MARKET_CONTEXT);
  }, []);
  const onAdoptLand = useCallback((comparableId: string, adopted: boolean) => {
    void adoptRef.current(comparableId, adopted, LAND_WITHIN_COST);
  }, []);
  const onSaveBankOverride = useCallback(
    (
      item: ValuationComparableSelectionDto,
      field: "price" | "area",
      raw: string,
    ) => saveBankOverrideRef.current(item, field, raw),
    [],
  );
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

  const navItems: {
    id: ValuationWorkScreenId;
    label: string;
    badge?: number;
    show: boolean;
  }[] = [
    { id: "basic", label: "البيانات الأساسية", show: true },
    {
      id: "market",
      label: "طريقة المقارنة",
      badge: visibleAdoptedMarket.length || undefined,
      show: marketEnabled,
    },
    {
      id: "cost",
      label: "طريقة المقاول",
      show: costEnabled,
    },
    { id: "final", label: "رأي القيمة النهائي", show: true },
    { id: "review", label: "المراجعة النهائية", show: true },
  ];

  /** Active screen is derived during render — hiding an approach in settings moves selection immediately. */
  const visibleScreenIds = navItems.filter((n) => n.show).map((n) => n.id);
  const effectiveScreen: ValuationWorkScreenId = visibleScreenIds.includes(
    screen,
  )
    ? screen
    : (visibleScreenIds[0] ?? "basic");

  /** Screen mounts only after first visit — then stays mounted (hidden) so drafts are not lost. */
  const visitedScreensRef = useRef<Set<ValuationWorkScreenId>>(new Set());
  visitedScreensRef.current.add(effectiveScreen);
  const screenMode = (id: ValuationWorkScreenId) =>
    !loading && effectiveScreen === id ? "visible" : "hidden";

  useEffect(() => {
    if (!screenControlled) return;
    if (screen !== effectiveScreen) onScreenChange?.(effectiveScreen);
  }, [effectiveScreen, onScreenChange, screen, screenControlled]);

  async function adopt(
    compId: string,
    isAdopted: boolean,
    context: string = MARKET_CONTEXT,
  ) {
    const config = apiConfig();
    if (!config || !valuationRequestId) return;
    // Interactive-form spec: max 5 adopted comparables per table.
    if (isAdopted) {
      const adoptedNow =
        context === MARKET_CONTEXT
          ? visibleAdoptedMarket.length
          : visibleAdoptedLand.length;
      if (adoptedNow >= MAX_ADOPTED_COMPARABLES) {
        showToast("الحد الأقصى ٥ مقارنات معتمدة — ألغِ اعتماد مقارن أولاً", "error");
        return;
      }
    }
    // Optimistic flag flip when the comp is already linked to this valuation.
    const setter = context === MARKET_CONTEXT ? setSelection : setLandSelection;
    const current =
      context === MARKET_CONTEXT ? selection : landSelection;
    const alreadyLinked = current?.items.some(
      (i) => i.comparablePropertyId === compId,
    );
    if (alreadyLinked) {
      setter((prev) => {
        if (!prev) return prev;
        return {
          ...prev,
          adoptedCount: Math.max(0, prev.adoptedCount + (isAdopted ? 1 : -1)),
          items: prev.items.map((i) =>
            i.comparablePropertyId === compId ? { ...i, isAdopted } : i,
          ),
        };
      });
    }
    const res = await setValuationComparableAdopted(
      config,
      valuationRequestId,
      compId,
      isAdopted,
      context,
    );
    if (!res.ok) {
      showToast(res.message ?? "تعذّر تحديث الاعتماد", "error");
      await reload({ silent: true, scope: "derived" });
      return;
    }
    await reload({
      silent: true,
      scope: alreadyLinked ? "derived" : "full",
    });
  }

  async function saveSubjectArea() {
    const config = apiConfig();
    if (!config || !valuationRequestId) return;
    setSaving(true);
    const area = Number(subjectArea.replace(",", "."));
    const res = await saveValuationMarketApproach(config, valuationRequestId, {
      subjectAreaSqm: Number.isFinite(area) ? area : null,
      adjustmentBasis,
      analysisNotes: analysisNotes.trim() || null,
    });
    setSaving(false);
    if (!res.ok) {
      showToast(res.message ?? "تعذّر حفظ مساحة العقار", "error");
      return;
    }
    setSelection(res.data);
    showToast("تم حفظ رأي أسلوب السوق", "success");
  }

  async function saveMatrixCell(
    item: ValuationComparableSelectionDto,
    factorKey: string,
    raw: string,
  ): Promise<boolean> {
    const config = apiConfig();
    if (!config || !valuationRequestId || adjustmentsLocked) return false;
    const percent = Number(String(raw).replace(",", ".")) || 0;
    const lines = ensureLinesForSave(
      item,
      factorKey,
      percent,
      factorRowsFor(contextOfItem(item)),
    );
    setSaving(true);
    const res = await saveValuationComparableMarket(
      config,
      valuationRequestId,
      item.id,
      marketSaveBody(item, lines.map((l, i) => lineForSave(item, l, i))),
    );
    setSaving(false);
    if (!res.ok) {
      showToast(res.message ?? "تعذّر حفظ التسوية", "error");
      return false;
    }
    await reload({ silent: true, scope: "derived" });
    return true;
  }

  /** compEdit: save price/area override for this valuation only — does not touch the shared bank.
   * Returns true on success — the bank table clears its local draft then. */
  async function saveBankOverride(
    item: ValuationComparableSelectionDto,
    field: "price" | "area",
    raw: string,
  ): Promise<boolean> {
    const config = apiConfig();
    if (!config || !valuationRequestId) return false;
    const parsed = Number(String(raw).replace(",", "."));
    const value = Number.isFinite(parsed) && parsed > 0 ? parsed : null;
    const lines = (item.market?.adjustmentLines ?? []).map((l, i) =>
      lineForSave(item, l, i),
    );
    setSaving(true);
    const res = await saveValuationComparableMarket(
      config,
      valuationRequestId,
      item.id,
      marketSaveBody(item, lines, {
        priceOverrideSar:
          field === "price" ? value : item.priceOverrideSar ?? null,
        areaOverrideSqm:
          field === "area" ? value : item.areaOverrideSqm ?? null,
      }),
    );
    setSaving(false);
    if (!res.ok) {
      showToast(res.message ?? "تعذّر حفظ تعديل المقارن", "error");
      return false;
    }
    await reload({ silent: true, scope: "derived" });
    return true;
  }

  /** compSpec: comparable description for a given difference factor — one cell per comparable. */
  async function saveCellDescription(
    item: ValuationComparableSelectionDto,
    factorKey: string,
    text: string,
  ) {
    const config = apiConfig();
    if (!config || !valuationRequestId || adjustmentsLocked) return;
    const lines = (item.market?.adjustmentLines ?? []).map((l, i) => ({
      ...lineForSave(item, l, i),
      descriptionAr:
        l.factorKey === factorKey ? text.trim() || null : l.descriptionAr ?? null,
    }));
    setSaving(true);
    const res = await saveValuationComparableMarket(
      config,
      valuationRequestId,
      item.id,
      marketSaveBody(item, lines),
    );
    setSaving(false);
    if (!res.ok) {
      showToast(res.message ?? "تعذّر حفظ وصف المقارن", "error");
      return;
    }
    await reload({ silent: true, scope: "derived" });
  }

  /** subjSpec: subject-property description for a difference factor — subject column. */
  async function saveSubjectSpec(factorKey: string, text: string) {
    const config = apiConfig();
    if (!config || !valuationRequestId) return;
    const next = { ...subjectSpecs };
    if (text.trim()) next[factorKey] = text.trim();
    else delete next[factorKey];
    const area = Number(subjectArea.replace(",", "."));
    setSaving(true);
    const res = await saveValuationMarketApproach(config, valuationRequestId, {
      subjectAreaSqm: Number.isFinite(area) ? area : null,
      adjustmentBasis,
      analysisNotes: analysisNotes.trim() || null,
      subjectSpecs: next,
    });
    setSaving(false);
    if (!res.ok) {
      showToast(res.message ?? "تعذّر حفظ وصف العقار", "error");
      return;
    }
    setSelection(res.data);
  }

  /** Remove a sequential adjustment (financing/type) from the table — restorable via the restore chip. */
  async function removeSequentialFactor(
    factorKey: string,
    context: string = MARKET_CONTEXT,
  ) {
    if (factorKey === "market") return;
    const config = apiConfig();
    if (!config || !valuationRequestId || adjustmentsLocked) return;
    setSaving(true);
    const results = await Promise.all(
      adoptedFor(context).map((item) => {
        const lines = (item.market?.adjustmentLines ?? [])
          .filter((l) => l.factorKey !== factorKey)
          .map((l, i) => lineForSave(item, l, i));
        return saveValuationComparableMarket(
          config,
          valuationRequestId,
          item.id,
          marketSaveBody(item, lines),
        );
      }),
    );
    setSaving(false);
    const failed = results.find((r) => !r.ok);
    if (failed && !failed.ok) {
      showToast(failed.message ?? "تعذّر حذف البند", "error");
      await reload({ silent: true, scope: "derived" });
      return;
    }
    await reload({ silent: true, scope: "derived" });
  }

  /** Restore a deleted sequential adjustment to its default values. */
  async function restoreSequentialFactor(
    factorKey: string,
    context: string = MARKET_CONTEXT,
  ) {
    const config = apiConfig();
    if (!config || !valuationRequestId || adjustmentsLocked) return;
    const label =
      STANDARD_FACTORS.find((f) => f.factorKey === factorKey)?.labelAr ?? factorKey;
    setSaving(true);
    const results = await Promise.all(
      adoptedFor(context)
        .filter(
          (item) =>
            !(item.market?.adjustmentLines ?? []).some(
              (l) => l.factorKey === factorKey,
            ),
        )
        .map((item) => {
          const existing = item.market?.adjustmentLines ?? [];
          const lines = [
            ...existing.map((l, i) => lineForSave(item, l, i)),
            {
              id: crypto.randomUUID(),
              factorKey,
              labelAr: label,
              percent: 0,
              rationale: "",
              descriptionAr: null,
              isIncluded: true,
              sortOrder: existing.length,
            },
          ];
          return saveValuationComparableMarket(
            config,
            valuationRequestId,
            item.id,
            marketSaveBody(item, lines),
          );
        }),
    );
    setSaving(false);
    const failed = results.find((r) => !r.ok);
    if (failed && !failed.ok) {
      showToast(failed.message ?? "تعذّر استعادة البند", "error");
      await reload({ silent: true, scope: "derived" });
      return;
    }
    await reload({ silent: true, scope: "derived" });
  }

  async function saveWeight(
    item: ValuationComparableSelectionDto,
    rawPct: string,
    weightRationale: string,
  ): Promise<boolean> {
    const config = apiConfig();
    if (!config || !valuationRequestId || adjustmentsLocked) return false;
    const pct = Number(rawPct.replace(",", ".")) || 0;
    const lines = (item.market?.adjustmentLines ?? []).map((l, i) =>
      lineForSave(item, l, i),
    );
    setSaving(true);
    const res = await saveValuationComparableMarket(
      config,
      valuationRequestId,
      item.id,
      marketSaveBody(item, lines, {
        weightIsManual: true,
        weightPct: pct,
        weightOverrideRationale:
          weightRationale.trim() ||
          item.market?.weightOverrideRationale ||
          null,
      }),
    );
    setSaving(false);
    if (!res.ok) {
      showToast(res.message ?? "تعذّر حفظ الوزن", "error");
      return false;
    }
    await reload({ silent: true, scope: "derived" });
    return true;
  }

  async function resetWeights(
    context: string = MARKET_CONTEXT,
  ): Promise<boolean> {
    const config = apiConfig();
    if (!config || !valuationRequestId || adjustmentsLocked) return false;
    setSaving(true);
    const results = await Promise.all(
      adoptedFor(context).map((item) => {
        const lines = (item.market?.adjustmentLines ?? []).map((l, i) =>
          lineForSave(item, l, i),
        );
        return saveValuationComparableMarket(
          config,
          valuationRequestId,
          item.id,
          marketSaveBody(item, lines, {
            weightIsManual: false,
            weightPct: null,
            weightOverrideRationale: null,
          }),
        );
      }),
    );
    setSaving(false);
    const failed = results.find((r) => !r.ok);
    if (failed && !failed.ok) {
      showToast(failed.message ?? "تعذّر إعادة ضبط الأوزان", "error");
      await reload({ silent: true, scope: "derived" });
      return false;
    }
    showToast("أُعيد ضبط الأوزان للاقتراح الآلي", "success");
    await reload({ silent: true, scope: "derived" });
    return true;
  }

  async function changeAdjustmentBasis(basis: "price_per_sqm" | "whole_property") {
    const config = apiConfig();
    if (!config || !valuationRequestId || adjustmentsLocked) return;
    setAdjustmentBasis(basis);
    setSaving(true);
    const area = Number(subjectArea.replace(",", "."));
    const res = await saveValuationMarketApproach(config, valuationRequestId, {
      subjectAreaSqm: Number.isFinite(area) ? area : null,
      adjustmentBasis: basis,
      analysisNotes: analysisNotes.trim() || null,
    });
    setSaving(false);
    if (!res.ok) {
      showToast(res.message ?? "تعذّر حفظ أساس التسوية", "error");
      return;
    }
    setSelection(res.data);
  }

  async function saveFactorRationale(
    factorKey: string,
    rawText: string,
    context: string = MARKET_CONTEXT,
  ) {
    const config = apiConfig();
    if (!config || !valuationRequestId || adjustmentsLocked) return;
    const text = rawText.trim();
    // Weight justification is stored on the weight field, not as an adjustment line.
    if (factorKey === "weight") {
      setSaving(true);
      const results = await Promise.all(
        adoptedFor(context)
          .filter((item) => item.market?.weightIsManual)
          .map((item) => {
            const lines = (item.market?.adjustmentLines ?? []).map((l, i) =>
              lineForSave(item, l, i),
            );
            return saveValuationComparableMarket(
              config,
              valuationRequestId,
              item.id,
              marketSaveBody(item, lines, {
                weightOverrideRationale: text || null,
              }),
            );
          }),
      );
      setSaving(false);
      const failed = results.find((r) => !r.ok);
      if (failed && !failed.ok) {
        showToast(failed.message ?? "تعذّر حفظ مبرر الوزن", "error");
      }
      await reload({ silent: true, scope: "derived" });
      return;
    }
    // Rule Q-8-1: one factor-level justification — single request instead of per-comparable fan-out;
    // Line justifications stay as per-comparable overrides edited from the comparable cell.
    if (text.length > 0 && text.length < JUSTIFICATION_MIN_LENGTH) {
      showToast(
        `المبرر أقصر من الحد الأدنى (${JUSTIFICATION_MIN_LENGTH} أحرف) — اكتب مبرراً جوهرياً (ق-8)`,
        "error",
      );
      return;
    }
    setSaving(true);
    const res = await saveAdjustmentFactorRationale(config, valuationRequestId, {
      selectionContext: context,
      factorKey,
      rationaleAr: text || null,
    });
    setSaving(false);
    if (!res.ok) {
      showToast(res.message ?? "تعذّر حفظ مبرر التسوية", "error");
    }
    await reload({ silent: true, scope: "derived" });
  }

  /** Rule Q-8-1: per-comparable justification override — writes that comparable’s adjustment line only. */
  async function saveLineRationaleOverride(
    selectionId: string,
    factorKey: string,
    rawText: string,
    context: string = MARKET_CONTEXT,
  ) {
    const config = apiConfig();
    if (!config || !valuationRequestId || adjustmentsLocked) return;
    const text = rawText.trim();
    if (text.length > 0 && text.length < JUSTIFICATION_MIN_LENGTH) {
      showToast(
        `المبرر أقصر من الحد الأدنى (${JUSTIFICATION_MIN_LENGTH} أحرف) — اكتب مبرراً جوهرياً (ق-8)`,
        "error",
      );
      return;
    }
    const item = adoptedFor(context).find((i) => i.id === selectionId);
    if (!item) return;
    const rawLine = item.market?.adjustmentLines?.find(
      (l) => l.factorKey === factorKey,
    );
    const lines = ensureLinesForSave(
      item,
      factorKey,
      linePercent(item, factorKey),
      factorRowsFor(context),
    ).map((l, i) => ({
      ...lineForSave(item, l, i),
      // Writing an override alone does not turn a “suggested” value into a stored manual percentage.
      percent:
        l.factorKey === factorKey && rawLine?.isSuggestedValue
          ? 0
          : lineForSave(item, l, i).percent,
      rationale: l.factorKey === factorKey ? text : l.rationale,
    }));
    setSaving(true);
    const res = await saveValuationComparableMarket(
      config,
      valuationRequestId,
      item.id,
      marketSaveBody(item, lines),
    );
    setSaving(false);
    if (!res.ok) {
      showToast(res.message ?? "تعذّر حفظ تخصيص المبرر", "error");
    }
    await reload({ silent: true, scope: "derived" });
  }

  async function toggleFactorIncluded(
    _item: ValuationComparableSelectionDto,
    factorKey: string,
  ) {
    const config = apiConfig();
    if (!config || !valuationRequestId || adjustmentsLocked) return;
    const context = contextOfItem(_item);
    const items = adoptedFor(context);
    const currentlyOn =
      items[0]?.market?.adjustmentLines?.find((l) => l.factorKey === factorKey)
        ?.isIncluded !== false;
    const nextIncluded = !currentlyOn;
    // Optimistic ✓ flag flip — save runs in parallel; silent reload reconciles.
    const setter = context === LAND_WITHIN_COST ? setLandSelection : setSelection;
    setter((prev) =>
      prev
        ? {
            ...prev,
            items: prev.items.map((it) =>
              it.isAdopted && it.market
                ? {
                    ...it,
                    market: {
                      ...it.market,
                      adjustmentLines: (it.market.adjustmentLines ?? []).map(
                        (l) =>
                          l.factorKey === factorKey
                            ? { ...l, isIncluded: nextIncluded }
                            : l,
                      ),
                    },
                  }
                : it,
            ),
          }
        : prev,
    );
    const results = await Promise.all(
      items.map((item) => {
        const suggestedByKey = new Map(
          (item.market?.adjustmentLines ?? []).map((l) => [
            l.factorKey,
            l.isSuggestedValue === true,
          ]),
        );
        const lines = ensureLinesForSave(
          item,
          factorKey,
          linePercent(item, factorKey),
          factorRowsFor(context),
        ).map((l, i) => ({
          ...lineForSave(
            item,
            { ...l, isSuggestedValue: suggestedByKey.get(l.factorKey) ?? false },
            i,
          ),
          isIncluded: l.factorKey === factorKey ? nextIncluded : l.isIncluded,
        }));
        return saveValuationComparableMarket(
          config,
          valuationRequestId,
          item.id,
          marketSaveBody(item, lines),
        );
      }),
    );
    const failed = results.find((r) => !r.ok);
    if (failed && !failed.ok) {
      showToast(failed.message ?? "تعذّر تحديث البند", "error");
    }
    await reload({ silent: true, scope: "derived" });
  }

  async function saveAreaFactorPct(raw: string) {
    const config = apiConfig();
    if (!config || !valuationRequestId || adjustmentsLocked) return;
    const pct = Number(String(raw).replace(",", "."));
    if (!Number.isFinite(pct)) return;
    setSaving(true);
    const area = Number(subjectArea.replace(",", "."));
    const res = await saveValuationMarketApproach(config, valuationRequestId, {
      subjectAreaSqm: Number.isFinite(area) ? area : null,
      adjustmentBasis,
      areaFactorPct: pct,
      analysisNotes: analysisNotes.trim() || null,
    });
    setSaving(false);
    if (!res.ok) {
      showToast(res.message ?? "تعذّر حفظ معامل المساحة", "error");
      return;
    }
    setSelection(res.data);
  }

  async function addDifferenceFactor(
    factorKey: string,
    labelAr: string,
    context: string = MARKET_CONTEXT,
  ) {
    const config = apiConfig();
    if (!config || !valuationRequestId || adjustmentsLocked) return;
    if (!adoptedFor(context).length) {
      showToast("اعتمد مقارناً أولاً", "error");
      return;
    }
    setSaving(true);
    const results = await Promise.all(
      adoptedFor(context)
        .filter(
          (item) =>
            !(item.market?.adjustmentLines ?? []).some(
              (l) => l.factorKey === factorKey,
            ),
        )
        .map((item) => {
          const existing = item.market?.adjustmentLines ?? [];
          const lines = [
            ...existing.map((l, i) => lineForSave(item, l, i)),
            {
              id: crypto.randomUUID(),
              factorKey,
              labelAr,
              percent: 0,
              rationale: "",
              descriptionAr: null,
              isIncluded: true,
              sortOrder: existing.length,
            },
          ];
          return saveValuationComparableMarket(
            config,
            valuationRequestId,
            item.id,
            marketSaveBody(item, lines),
          );
        }),
    );
    setSaving(false);
    const failed = results.find((r) => !r.ok);
    if (failed && !failed.ok) {
      showToast(failed.message ?? "تعذّر إضافة العامل", "error");
      await reload({ silent: true, scope: "derived" });
      return;
    }
    showToast("أُضيف عامل الاختلاف", "success");
    await reload({ silent: true, scope: "derived" });
  }

  async function removeDifferenceFactor(
    factorKey: string,
    context: string = MARKET_CONTEXT,
  ) {
    const config = apiConfig();
    if (!config || !valuationRequestId || adjustmentsLocked) return;
    if (AUTO_AREA_KEYS.has(factorKey) || SEQUENTIAL_KEYS.has(factorKey)) return;
    setSaving(true);
    const results = await Promise.all(
      adoptedFor(context).map((item) => {
        const lines = (item.market?.adjustmentLines ?? [])
          .filter((l) => l.factorKey !== factorKey)
          .map((l, i) => lineForSave(item, l, i));
        return saveValuationComparableMarket(
          config,
          valuationRequestId,
          item.id,
          marketSaveBody(item, lines),
        );
      }),
    );
    setSaving(false);
    const failed = results.find((r) => !r.ok);
    if (failed && !failed.ok) {
      showToast(failed.message ?? "تعذّر حذف العامل", "error");
      await reload({ silent: true, scope: "derived" });
      return;
    }
    showToast("حُذف عامل الاختلاف", "success");
    await reload({ silent: true, scope: "derived" });
  }

  /* ─── Adjustments-matrix command dispatcher — one stable ref per context instead of 21 handlers,
     so table memo survives shell re-renders (Command/Strategy).
     Function declarations above are hoisted, so references here are valid. ─── */
  const matrixOps = {
    saveMatrixCell,
    saveWeight,
    saveFactorRationale,
    saveLineRationaleOverride,
    toggleFactorIncluded,
    changeAdjustmentBasis,
    resetWeights,
    saveAreaFactorPct,
    addDifferenceFactor,
    removeDifferenceFactor,
    removeSequentialFactor,
    restoreSequentialFactor,
    saveCellDescription,
    saveSubjectSpec,
  };
  const matrixOpsRef = useRef(matrixOps);
  matrixOpsRef.current = matrixOps;
  const dispatchMarketMatrix = useCallback<MatrixDispatch>(
    (action) => runMatrixAction(matrixOpsRef.current, MARKET_CONTEXT, action),
    [],
  );
  const dispatchLandMatrix = useCallback<MatrixDispatch>(
    (action) => runMatrixAction(matrixOpsRef.current, LAND_WITHIN_COST, action),
    [],
  );


  /* ─── screens ─── */
  function renderMarket() {
    if (!settingsSaved) {
      return (
        <Card>
          <CardPad>
            <p className="text-[13px] text-text-2">
              ابدأ التقييم من شاشة البيانات الأساسية أولاً.
            </p>
          </CardPad>
        </Card>
      );
    }
    if (!marketEnabled) {
      return (
        <Card>
          <CardPad>
            <p className="text-[13px] text-text-2">
              أسلوب السوق غير مفعّل في إعدادات التقييم.
            </p>
          </CardPad>
        </Card>
      );
    }

    return (
      <>
        <ComparablesBankTable
          rows={bankRows}
          subjectSqm={subjectAreaNum}
          adoptedCount={visibleAdoptedMarket.length}
          maxAdopted={MAX_ADOPTED_COMPARABLES}
          distanceKm={bankDistanceKm}
          onAdopt={onAdoptMarket}
          onSearch={onSearchBank}
          onSaveOverride={onSaveBankOverride}
        />

        {selection ? (
          <Suspense fallback={<InlineLoadingSkeleton />}>
            <AdjustmentsMatrix
              selection={selection}
              adopted={visibleAdoptedMarket}
              locked={adjustmentsLocked}
              saving={saving}
              subjectArea={subjectArea}
              idealArea={subjectArea}
              city={property?.city}
              district={property?.district ?? districtHint}
              valuationDate={officialValuationDate ?? undefined}
              factorDefinitions={factorDefinitions}
              catalogFactors={catalogFactorOptions}
              subjectSpecs={subjectSpecs}
              canEditSubjectSpec
              dispatch={dispatchMarketMatrix}
            />
          </Suspense>
        ) : null}

        <Card>
          <CardPad>
            <div className="mb-3 flex items-center justify-between gap-2.5">
              <span className="text-[14.5px] font-extrabold text-heading">
                تحليل التسويات
              </span>
              <div className="flex items-center gap-2.5">
                <span
                  className={cn(
                    "text-[11px] font-semibold",
                    narrativeDirty ? "text-red-text" : "text-gold-d",
                  )}
                >
                  {narrativeDirty
                    ? "نص محرَّر يدوياً — لا يتحدث تلقائياً"
                    : "يتحدث تلقائياً مع المبررات"}
                </span>
                {narrativeDirty ? (
                  <GhostBtn
                    disabled={saving}
                    onClick={() => {
                      setAnalysisNotes("");
                      const config = apiConfig();
                      if (!config || !valuationRequestId) return;
                      const area = Number(subjectArea.replace(",", "."));
                      void saveValuationMarketApproach(config, valuationRequestId, {
                        subjectAreaSqm: Number.isFinite(area) ? area : null,
                        adjustmentBasis,
                        analysisNotes: null,
                      }).then((res) => {
                        if (res.ok) setSelection(res.data);
                      });
                    }}
                  >
                    ↺ استرجاع النص التلقائي
                  </GhostBtn>
                ) : null}
              </div>
            </div>
            <textarea
              rows={9}
              value={narrativeDirty ? analysisNotes : autoNarrative}
              onChange={(e) => setAnalysisNotes(e.target.value)}
              onBlur={() => void saveSubjectArea()}
              className="w-full resize-y rounded-[9px] border border-border bg-surface-2 px-4 py-3.5 text-[13px] font-medium leading-[2] text-text"
            />
          </CardPad>
        </Card>
      </>
    );
  }

  function renderCost() {
    if (!settingsSaved || !costEnabled) {
      return (
        <Card>
          <CardPad>
            <p className="text-[13px] text-text-2">
              {!settingsSaved
                ? "ابدأ التقييم أولاً."
                : "أسلوب التكلفة غير مفعّل أو غير منطبق."}
            </p>
          </CardPad>
        </Card>
      );
    }

    const landComplete = !!cost?.landEstimateComplete;
    const buildingOnly =
      (approachSettings?.costScopeKey ?? "land_and_building") === "building_only";

    return (
      <>
        <div className="sticky top-0 z-[14] bg-[var(--page,#f7f5f0)] py-1 pb-2.5">
          <div className="flex flex-wrap items-center gap-4 rounded-[10px] border border-border-md bg-surface px-[18px] py-[9px] shadow-[0_8px_20px_-18px_rgba(18,40,76,.4)]">
            <span className="text-[13px] font-extrabold text-heading">
              أسلوب التكلفة
            </span>
            <span className="text-[11.5px] text-text-3">
              أرض{" "}
              <b
                dir="ltr"
                className={cn(
                  buildingOnly
                    ? "text-text-3"
                    : landComplete
                      ? "text-heading"
                      : "text-red-text",
                )}
              >
                {buildingOnly
                  ? "غير مشمولة"
                  : landComplete
                    ? fmt(cost?.landValueFromMarket)
                    : "— بانتظار المقارنات"}
              </b>
            </span>
            <span className="text-[11.5px] text-text-3">
              إحلال{" "}
              <b dir="ltr" className="text-heading">
                {fmt(cost?.totalCostWithIndirect)}
              </b>
            </span>
            <span className="text-[11.5px] text-text-3">
              إهلاك{" "}
              <b dir="ltr" className="text-red-text">
                {fmt(cost?.depreciationValue)}
              </b>
            </span>
            <span className="ms-auto flex items-baseline gap-[9px]">
              <span className="text-[11.5px] font-bold text-gold-d">
                {buildingOnly
                  ? "تكلفة الإحلال − الإهلاك ="
                  : "أرض + إحلال − إهلاك ="}
              </span>
              <span
                dir="ltr"
                className={cn(
                  "text-[17px] font-extrabold",
                  buildingOnly || landComplete ? "text-heading" : "text-red-text",
                )}
              >
                {buildingOnly || landComplete
                  ? fmt(cost?.costOpinionWithLand)
                  : "غير مكتمل — يلزم قيمة الأرض"}
              </span>
            </span>
          </div>
        </div>

        <Suspense fallback={<InlineLoadingSkeleton />}>
          <CostBasisUnitCard
            key={`${approachSettings?.costBasisKey ?? "replacement"}:${approachSettings?.costMeasurementUnitKey ?? "comparison_unit"}`}
            savedBasisKey={approachSettings?.costBasisKey || "replacement"}
            savedUnitKey={
              approachSettings?.costMeasurementUnitKey || "comparison_unit"
            }
            saving={saving}
            onSave={onSaveCostBasisUnit}
          />
        </Suspense>

        {!buildingOnly ? (
        <>
        <div className="mb-4 flex items-start gap-[11px] rounded-[10px] border border-border-md bg-gold-soft px-4 py-[13px]">
          <span className="h-[30px] w-[3px] shrink-0 rounded-full bg-gold" />
          <div>
            <div className="text-[13px] font-extrabold text-heading">
              تقدير قيمة الأرض فضاءً
            </div>
            <div className="mt-0.5 text-[11.5px] font-normal text-gold-d">
              مكوّن داخل أسلوب التكلفة — ناتجه قيمة الأرض ولا يدخل التوفيق بين
              الأساليب. مقارناته أراضٍ خام مستقلة عن مقارنات أسلوب السوق.
            </div>
          </div>
        </div>

        <ComparablesBankTable
          rows={landBankRows}
          subjectSqm={cost?.landAreaSqm || subjectAreaNum}
          adoptedCount={visibleAdoptedLand.length}
          maxAdopted={MAX_ADOPTED_COMPARABLES}
          distanceKm={landBankDistanceKm}
          onAdopt={onAdoptLand}
          onSaveOverride={onSaveBankOverride}
        />

        {landSelection ? (
          <Suspense fallback={<InlineLoadingSkeleton />}>
            <AdjustmentsMatrix
              selection={landSelection}
              adopted={visibleAdoptedLand}
              locked={adjustmentsLocked}
              saving={saving}
              subjectArea={String(cost?.landAreaSqm || subjectArea)}
              idealArea={String(cost?.landAreaSqm || subjectArea)}
              city={property?.city}
              district={property?.district ?? districtHint}
              valuationDate={officialValuationDate ?? undefined}
              factorDefinitions={factorDefinitions}
              catalogFactors={catalogFactorOptions}
              dispatch={dispatchLandMatrix}
            />
          </Suspense>
        ) : null}

        </>
        ) : (
          <div className="mb-4 rounded-[10px] border border-border bg-surface-2 px-4 py-3 text-[12.5px] text-text-2">
            النطاق «مبنى فقط» — قسم تقدير الأرض مخفي ومؤشر الأسلوب = تكلفة الإحلال
            ناقصاً الإهلاك. يُغيَّر النطاق من شاشة البيانات الأساسية.
          </div>
        )}

      </>
    );
  }

  function renderReview() {
    const reviewDraft =
      draft ??
      createEvaluatorDraft({
        taskId: "",
        propertyId,
        poNumber: poNumber ?? "",
        assignmentType,
      });
    return (
      <>
        <Suspense fallback={<InlineLoadingSkeleton />}>
          <EvaluatorFinalReviewTab
            draft={reviewDraft}
            disabled={disabled}
            property={intakeProperty}
            assignmentType={assignmentType}
            valuationRequestId={valuationRequestId}
            approachSettings={approachSettings}
            fieldErrors={fieldErrors}
            onDraftPatch={onDraftPatch}
            onReportChoicesPatch={onReportChoicesPatch}
          />
        </Suspense>
        <div className="mt-5 flex flex-wrap items-center justify-end gap-3">
          {showSubmit ? (
            <PrimaryBtn
              disabled={disabled || submitting}
              onClick={() => onSubmit?.()}
            >
              {submitting ? <Spinner /> : null}
              <span>
                {submitting
                  ? "جاري الاعتماد…"
                  : "اعتماد التقييم وإرسال للأخصائي"}
              </span>
            </PrimaryBtn>
          ) : null}
        </div>
      </>
    );
  }

  return (
    <div dir="rtl" className="relative min-h-[480px]">
      {embeddedInTopTabs ? (
        <div className="mb-3.5 flex flex-wrap items-center justify-end gap-3">
          <div className="flex h-[38px] items-center gap-[7px] rounded-[var(--radius)] border border-border-md bg-surface-2 px-[13px] text-[13px] font-medium text-text-2">
            <span>تاريخ التقييم</span>
            <b dir="ltr" className="text-heading">
              {valDate}
            </b>
          </div>
        </div>
      ) : (
        <div className={opsLetterCard}>
          <header className="flex items-center justify-end gap-[18px] border-b border-border px-[22px] py-3.5">
            <div className="flex h-[38px] items-center gap-[7px] rounded-[var(--radius)] border border-border-md bg-surface-2 px-[13px] text-[13px] font-medium text-text-2">
              <span>تاريخ التقييم</span>
              <b dir="ltr" className="text-heading">
                {valDate}
              </b>
            </div>
          </header>

          <nav className="flex flex-wrap gap-1.5 px-[22px] py-3">
            {navItems
              .filter((n) => n.show)
              .map((n) => {
                const active = effectiveScreen === n.id;
                return (
                  <button
                    key={n.id}
                    type="button"
                    onClick={() => setScreen(n.id)}
                    className={cn(
                      "inline-flex cursor-pointer items-center gap-2 rounded-full border px-3.5 py-2 text-[12.5px] font-bold",
                      active
                        ? "border-ink bg-ink text-white"
                        : "border-border-md bg-surface text-text",
                    )}
                  >
                    {n.label}
                    {n.badge != null ? (
                      <span
                        className={cn(
                          "grid h-[17px] min-w-[17px] place-items-center rounded-full px-[5px] text-[9.5px] font-bold",
                          active
                            ? "bg-[rgba(200,181,145,.35)] text-white"
                            : "bg-gold-soft text-gold-d",
                        )}
                      >
                        {n.badge}
                      </span>
                    ) : null}
                  </button>
                );
              })}
          </nav>
        </div>
      )}

      <div
        className={cn(
          "relative pb-2",
          embeddedInTopTabs ? "pt-0" : "py-[18px]",
        )}
      >
        {error ? (
          <p className="mb-3 text-[12.5px] text-red-text">
            {error}
          </p>
        ) : null}
        {loading ? (
          // Placeholder skeleton sized like the real screen — no buttons/chips before data; no layout jump.
          <div aria-busy="true" aria-label="جاري تحميل مساحة عمل التقييم">
            {[0, 1, 2].map((i) => (
              <div
                key={i}
                className={cn(opsLetterCard, "mb-5")}
              >
                <div className="p-[18px_22px]">
                  <div className="h-4 w-44 animate-pulse rounded-md bg-[var(--navy-soft)]" />
                  <div className="mt-4 grid grid-cols-[repeat(auto-fit,minmax(180px,1fr))] gap-3">
                    {[0, 1, 2].map((j) => (
                      <div key={j} className="min-w-0">
                        <div className="h-3 w-24 animate-pulse rounded bg-[var(--navy-soft)]" />
                        <div className="mt-2 h-9 animate-pulse rounded-[var(--radius)] bg-[var(--navy-soft)]" />
                      </div>
                    ))}
                  </div>
                  {i === 2 ? (
                    <div className="mt-4 h-24 animate-pulse rounded-[var(--radius)] bg-[var(--navy-soft)]" />
                  ) : null}
                </div>
              </div>
            ))}
          </div>
        ) : null}
        {visitedScreensRef.current.has("basic") ? (
          <Activity mode={screenMode("basic")}>
            <ApproachSettingsSection
              valuationRequestId={valuationRequestId}
              assignmentType={assignmentType}
              settings={approachSettings}
              hydrateKey={settingsHydrateKey}
              saving={saving}
              onSavingChange={setSaving}
              onSettingsSaved={onSettingsSaved}
            />
          </Activity>
        ) : null}
        {visitedScreensRef.current.has("market") ? (
          <Activity mode={screenMode("market")}>{renderMarket()}</Activity>
        ) : null}
        {visitedScreensRef.current.has("cost") ? (
          <Activity mode={screenMode("cost")}>
            {renderCost()}
            {settingsSaved && costEnabled ? (
              <Suspense fallback={<InlineLoadingSkeleton />}>
                <CostApproachSection
                  valuationRequestId={valuationRequestId}
                  poNumber={poNumber}
                  propertyId={propertyId}
                  cost={cost}
                  hydrateKey={costHydrateKey}
                  buildingOnly={
                    (approachSettings?.costScopeKey ?? "land_and_building") ===
                    "building_only"
                  }
                  isApartmentProperty={(approachSettings?.propertyType ?? "").includes(
                    "شقة",
                  )}
                  costBasisKey={approachSettings?.costBasisKey || "replacement"}
                  saving={saving}
                  onSavingChange={setSaving}
                  onCostSaved={onCostSaved}
                />
              </Suspense>
            ) : null}
          </Activity>
        ) : null}
        {!loading && effectiveScreen === "final" && !settingsSaved ? (
          <Card>
            <CardPad>
              <p className="text-[13px] text-text-2">
                ابدأ التقييم أولاً لفتح رأي القيمة النهائي.
              </p>
            </CardPad>
          </Card>
        ) : null}
        {visitedScreensRef.current.has("final") ? (
          <Activity mode={screenMode("final")}>
            {settingsSaved ? (
              <Suspense fallback={<InlineLoadingSkeleton />}>
                <FinalOpinionSection
                  valuationRequestId={valuationRequestId}
                  recon={recon}
                  gates={gates}
                  cost={cost}
                  hydrateKey={reconHydrateKey}
                  buildingOnly={
                    (approachSettings?.costScopeKey ?? "land_and_building") ===
                    "building_only"
                  }
                  hasAdoptedMarket={visibleAdoptedMarket.length > 0}
                  assignmentType={assignmentType}
                  officialValuationDate={officialValuationDate}
                  saving={saving}
                  onSavingChange={setSaving}
                  onReconSaved={onReconSaved}
                />
              </Suspense>
            ) : null}
          </Activity>
        ) : null}
        {visitedScreensRef.current.has("review") ? (
          <Activity mode={screenMode("review")}>{renderReview()}</Activity>
        ) : null}
      </div>
    </div>
  );
}

export { ValuationWorkShell as EvaluatorComparableSelectionPanel };