"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  getApiBase,
  ensureOpenValuationRequestByProperty,
  listValuationComparableSelections,
  saveValuationComparableMarket,
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
import { cn, Spinner, useToast } from "@platform/ui-kit";
import { amountWordsOrZero } from "../../../lib/evaluator/value-estimation";
import type { PoPropertyIntake } from "@case-study/mfe/lib/prototype/po-intake-data";
import type {
  EvaluatorReportChoices,
  EvaluatorSubmission,
} from "../../../lib/evaluator/evaluator-window-data";
import { createEvaluatorDraft } from "../../../lib/evaluator/evaluator-window-data";
import { EvaluatorFinalReviewTab } from "../EvaluatorFinalReviewTab";
import { AdjustmentsMatrix } from "./AdjustmentsMatrix";

import {
  Card,
  CardPad,
  GhostBtn,
  PrimaryBtn,
} from "./atoms";
import { ApproachSettingsSection } from "./ApproachSettingsSection";
import { ComparablesBankTable } from "./ComparablesBankTable";
import { CostApproachSection, CostBasisUnitCard } from "./CostApproachSection";
import { FinalOpinionSection } from "./FinalOpinionSection";
import {
  BANK_DISPLAY_LIMIT,
  fetchBankCandidates,
  isVacantLandComparable,
  parseSubjectAreaSqm,
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
import { apiConfig, fmt } from "./lib/shell-utils";

const LAND_WITHIN_COST = "land_within_cost";
const MARKET_CONTEXT = "market";
/** مواصفة النموذج التفاعلي: «N من ٥ معتمدة». */
const MAX_ADOPTED_COMPARABLES = 5;

type ScreenId = "basic" | "market" | "cost" | "final" | "review";

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
};

/**
 * Appraiser valuation work shell — matches docs/_تقييم بطريقة المبيعات المشابهة design.
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
}: ValuationWorkShellProps) {
  const { showToast } = useToast();
  const onFinalOpinionChangeRef = useRef(onFinalOpinionChange);
  onFinalOpinionChangeRef.current = onFinalOpinionChange;
  const [screen, setScreen] = useState<ScreenId>("basic");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [valuationRequestId, setValuationRequestId] = useState<string | null>(null);
  // مرجع متزامن لمعرّف الطلب حتى لا يعيد reload نداء ensure-open في كل تحديث صامت.
  const valuationRequestIdRef = useRef<string | null>(null);
  const [displayId, setDisplayId] = useState<string | null>(null);
  const [selection, setSelection] =
    useState<ValuationComparableSelectionListDto | null>(null);
  const [landSelection, setLandSelection] =
    useState<ValuationComparableSelectionListDto | null>(null);
  const [candidates, setCandidates] = useState<ComparablePropertyDto[]>([]);
  const [candidateDistanceKm, setCandidateDistanceKm] = useState<
    Record<string, number>
  >({});
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
  /** ترطيب مسودات التكلفة يتم داخل CostApproachSection — المفتاح يزداد مع كل تحميل كامل فقط. */
  const [costHydrateKey, setCostHydrateKey] = useState(0);
  /** ترطيب مسودات التوفيق يتم داخل FinalOpinionSection — نفس آلية المفتاح. */
  const [reconHydrateKey, setReconHydrateKey] = useState(0);
  /** ترطيب مسودات الإعدادات داخل ApproachSettingsSection — يزداد مع كل تحميل كامل وكل حفظ إعدادات. */
  const [settingsHydrateKey, setSettingsHydrateKey] = useState(0);

  const [recon, setRecon] = useState<ValuationReconciliationDto | null>(null);
  const [gates, setGates] = useState<ValuationIssuanceGatesDto | null>(null);

  // تاريخ التقييم الرسمي من الإعدادات المحفوظة — لا من مسودات لم تُحفظ بعد.
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
    // التحديث الصامت يجدّد بيانات الخادم فقط ولا يلمس مسودات المستخدم —
    // إعادة كتابة الحقول أثناء الكتابة كانت مصدر «التقطيع» وفقدان النص.
    const hydrateEdits = !opts?.silent;
    // نطاق «derived»: بعد حفظ لا يغيّر الإعدادات ولا مرشحي البنك — لا إعادة جلب لهما.
    const derivedOnly = opts?.scope === "derived";
    setError(null);

    // الطلب المفتوح معروف بعد أول تحميل — لا داعي لجولة ensure-open في كل تحديث.
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
        // قسما التكلفة والرأي النهائي يعيدان بذر مسوداتهما عبر مفتاحي الترطيب.
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

    // كل استجابة تُطبَّق فور وصولها — علامة الاعتماد لا تنتظر أبطأ نداء (بوابات الإصدار).
    const selP = listValuationComparableSelections(config, requestId, MARKET_CONTEXT);
    const landP = listValuationComparableSelections(config, requestId, LAND_WITHIN_COST);
    // بنك العرض: مرشحون ضمن ٥ كم، ثم ترتيب حسب أقرب مساحة لعقار التقييم — ٦ للعرض.
    // البحث النصي صار نداءً مستقلاً داخل جدول البنك (searchBank) — لا يمر من هنا.
    const bankP = derivedOnly
      ? null
      : fetchBankCandidates(config, {
          propertyId: propertyId.trim() || undefined,
          district: districtHint || property?.district || undefined,
          propertyType: property?.propertyType?.trim() || undefined,
          subjectSqm: parseSubjectAreaSqm(subjectArea, property?.area),
        });
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
        setCandidateDistanceKm(bankRes.distances);
      });
    }
    void gatesP.then((gatesRes) => setGates(gatesRes.ok ? gatesRes.data : null));

    const [selRes, costRes, reconRes] = await Promise.all([selP, costP, reconP]);
    const settingsRes = settingsP ? await settingsP : null;

    setLoading(false);

    if (settingsRes) {
      if (settingsRes.ok) {
        setApproachSettings(settingsRes.data);
        // ترطيب مسودات الإعدادات داخل ApproachSettingsSection — مفتاح جديد مع كل تحميل كامل.
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
      // مسودات الجداول محلية داخل مكوّناتها — لا شيء يُمسح هنا.

      // مساحة المعاملة من العقار أولى من مساحة أسلوب السوق القديمة على الخادم.
      const txNum = Number(transactionArea.replace(",", "."));
      const serverArea = selRes.data.subjectAreaSqm;
      const syncKey = `${requestId}:${txNum}`;
      if (
        transactionArea &&
        Number.isFinite(txNum) &&
        txNum > 0 &&
        (serverArea == null || Math.abs(Number(serverArea) - txNum) > 0.001) &&
        subjectAreaSyncedRef.current !== syncKey
      ) {
        subjectAreaSyncedRef.current = syncKey;
        const syncRes = await saveValuationMarketApproach(config, requestId, {
          subjectAreaSqm: txNum,
          adjustmentBasis: selRes.data.adjustmentBasis || "price_per_sqm",
          analysisNotes: selRes.data.analysisNotes ?? null,
        });
        if (syncRes.ok) setSelection(syncRes.data);
      }
    }

    if (costRes.ok) {
      setCost(costRes.data);
      // ترطيب مسودات التكلفة داخل CostApproachSection — مفتاح جديد مع كل تحميل كامل.
      if (hydrateEdits) setCostHydrateKey((k) => k + 1);
    } else {
      setCost(null);
      setCostHydrateKey((k) => k + 1);
    }

    if (reconRes.ok) {
      setRecon(reconRes.data);
      // ترطيب مسودات التوفيق داخل FinalOpinionSection — مفتاح جديد مع كل تحميل كامل.
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
    ],
  );

  const reloadRef = useRef(reload);
  reloadRef.current = reload;

  /** بعد حفظ التكلفة: حدّث الدفعة وجدّد صامتاً — بلا وميض هيكل تحميل. */
  const onCostSaved = useCallback((dto: ValuationCostApproachDto) => {
    setCost(dto);
    void reloadRef.current({ silent: true, scope: "derived" });
  }, []);
  /** بعد حفظ التوفيق: حدّث الدفعة وبلّغ رأي القيمة وجدّد صامتاً. */
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
  /** بعد حفظ الإعدادات: حدّث الدفعة وأعد بذر مسودات الإعدادات وجدّد المشتقات صامتاً. */
  const onSettingsSaved = useCallback((dto: ValuationApproachSettingsDto) => {
    setApproachSettings(dto);
    setSettingsHydrateKey((k) => k + 1);
    void reloadRef.current({ silent: true, scope: "derived" });
  }, []);
  /** حفظ أساس/وحدة التكلفة من شاشة التكلفة — فوق آخر إعدادات محفوظة. */
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
        showToast(res.message ?? "تعذّر حفظ إعدادات التقييم", "error");
        return;
      }
      showToast("تم حفظ أساس ووحدة التكلفة", "success");
      setApproachSettings(res.data);
      setSettingsHydrateKey((k) => k + 1);
      void reloadRef.current({ silent: true, scope: "derived" });
    },
    [showToast],
  );
  /** قسما التكلفة والرأي النهائي لا يُركَّبان إلا بعد أول زيارة — ثم يبقيان مخفيين حفاظاً على المسودات. */
  const costScreenVisitedRef = useRef(false);
  if (screen === "cost") costScreenVisitedRef.current = true;
  const finalScreenVisitedRef = useRef(false);
  if (screen === "final") finalScreenVisitedRef.current = true;

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
  const factorRows = useMemo(
    () => buildFactorRows(adoptedMarket),
    [adoptedMarket],
  );
  /** جدول أرض التكلفة (land_within_cost) — بياناته وتسوياته مستقلة عن أسلوب السوق. */
  const adoptedLand = useMemo(
    () => landSelection?.items.filter((i) => i.isAdopted) ?? [],
    [landSelection],
  );
  const landFactorRows = useMemo(
    () => buildFactorRows(adoptedLand),
    [adoptedLand],
  );
  const subjectSpecs = useMemo(
    () => selection?.subjectSpecs ?? {},
    [selection],
  );

  /** السياق الذي ينتمي إليه اختيار المقارن — لاختيار قائمة العوامل الصحيحة. */
  function contextOfItem(item: ValuationComparableSelectionDto): string {
    return adoptedLand.some((i) => i.id === item.id)
      ? LAND_WITHIN_COST
      : MARKET_CONTEXT;
  }
  function adoptedFor(context: string) {
    return context === LAND_WITHIN_COST ? adoptedLand : adoptedMarket;
  }
  function factorRowsFor(context: string) {
    return context === LAND_WITHIN_COST ? landFactorRows : factorRows;
  }

  /**
   * مواصفة النموذج التفاعلي (buildNarrative): نص تحليل التسويات يتولّد آلياً من مبررات
   * البنود («لم يتم تبريره» عند الفراغ) ما دام المقيّم لم يحرره يدوياً.
   */
  const autoNarrative = useMemo(() => {
    if (!adoptedMarket.length) {
      return "لم تُعتمد أي مقارنة بعد؛ يلزم اعتماد مقارن واحد على الأقل لتكوين رأي القيمة.";
    }
    const first = adoptedMarket[0]?.market?.adjustmentLines ?? [];
    const bullets: string[] = [];
    for (const f of factorRows) {
      const line = first.find((l) => l.factorKey === f.factorKey);
      const just = (line?.rationale ?? "").trim();
      bullets.push(`• ${f.labelAr || f.factorKey} — ${just || "لم يتم تبريره"}`);
    }
    const weightJust = (
      adoptedMarket[0]?.market?.weightOverrideRationale ?? ""
    ).trim();
    bullets.push(`• الوزن النسبي — ${weightJust || "لم يتم تبريره"}`);
    return `مبررات التسويات:\n${bullets.join("\n")}`;
  }, [adoptedMarket, factorRows]);
  const narrativeDirty = analysisNotes.trim().length > 0;

  const selectedIds = useMemo(
    () => new Set(selection?.items.map((i) => i.comparablePropertyId) ?? []),
    [selection],
  );
  const landSelectedIds = useMemo(
    () => new Set(landSelection?.items.map((i) => i.comparablePropertyId) ?? []),
    [landSelection],
  );

  const bankRows = useMemo(() => {
    const rows: {
      key: string;
      selected: boolean;
      adopted: boolean;
      comp: ComparablePropertyDto;
      item?: ValuationComparableSelectionDto;
    }[] = [];
    for (const item of selection?.items ?? []) {
      rows.push({
        key: item.id,
        selected: true,
        adopted: item.isAdopted,
        comp: item.comparable,
        item,
      });
    }
    for (const c of candidates) {
      if (selectedIds.has(c.id)) continue;
      rows.push({
        key: c.id,
        selected: false,
        adopted: false,
        comp: c,
      });
    }
    return rows.slice(0, BANK_DISPLAY_LIMIT);
  }, [selection, candidates, selectedIds]);

  const landBankRows = useMemo(() => {
    const rows: {
      key: string;
      selected: boolean;
      adopted: boolean;
      comp: ComparablePropertyDto;
      item?: ValuationComparableSelectionDto;
    }[] = [];
    for (const item of landSelection?.items ?? []) {
      rows.push({
        key: item.id,
        selected: true,
        adopted: item.isAdopted,
        comp: item.comparable,
        item,
      });
    }
    for (const c of candidates) {
      if (!isVacantLandComparable(c.comparablePropertyType)) continue;
      if (landSelectedIds.has(c.id)) continue;
      rows.push({
        key: `land-${c.id}`,
        selected: false,
        adopted: false,
        comp: c,
      });
    }
    return rows.slice(0, BANK_DISPLAY_LIMIT);
  }, [landSelection, candidates, landSelectedIds]);

  const subjectAreaNum = Number(subjectArea.replace(",", ".")) || null;

  /* ─── مقابض مستقرة لبنك المقارنات — حتى يعمل memo على الجدول رغم إعادة رسم الصدفة.
     الدوال المعلنة أدناه ترفع (hoisting) فتصلح مراجعها هنا. ─── */
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
  /** بحث البنك — يجلب مرشحي البنك فقط بدل إعادة تحميل الشاشة كاملة (٧ نداءات). */
  const onSearchBank = useCallback(
    (search: string) => {
      void (async () => {
        const config = apiConfig();
        if (!config) return;
        const res = await fetchBankCandidates(config, {
          q: search,
          propertyId: propertyId.trim() || undefined,
          district: districtHint || property?.district || undefined,
          propertyType: property?.propertyType?.trim() || undefined,
          subjectSqm: parseSubjectAreaSqm(subjectAreaRef.current, property?.area),
        });
        if (!res.ok) return;
        setCandidates(res.data);
        setCandidateDistanceKm(res.distances);
      })();
    },
    [
      propertyId,
      districtHint,
      property?.district,
      property?.propertyType,
      property?.area,
    ],
  );

  const navItems: { id: ScreenId; label: string; badge?: number; show: boolean }[] =
    [
      { id: "basic", label: "البيانات الأساسية", show: true },
      {
        id: "market",
        label: "طريقة المقارنة",
        badge: selection?.adoptedCount,
        show: approachSettings?.marketApproachEnabled ?? true,
      },
      {
        id: "cost",
        label: "طريقة المقاول",
        show:
          (approachSettings?.costApproachEnabled ?? true) &&
          (approachSettings?.costApproachAllowed ?? true),
      },
      { id: "final", label: "رأي القيمة النهائي", show: true },
      { id: "review", label: "المراجعة النهائية", show: true },
    ];

  useEffect(() => {
    const visible = navItems.filter((n) => n.show).map((n) => n.id);
    if (!visible.includes(screen)) {
      setScreen(visible[0] ?? "basic");
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps -- re-gate when toggles flip
  }, [
    approachSettings?.marketApproachEnabled,
    approachSettings?.costApproachEnabled,
    approachSettings?.costApproachAllowed,
  ]);

  const pageMeta = useMemo(() => {
    switch (screen) {
      case "basic":
        return {
          crumbMid: "إعداد التقييم",
          crumbLast: "البيانات الأساسية",
          title: "البيانات الأساسية",
          barMainLabel: "طلب التقييم",
          barMainValue: displayId ?? "—",
          barSubLabel: "الحالة",
          barSubValue: settingsSaved ? "إعدادات محفوظة" : "يلزم حفظ الإعدادات",
        };
      case "market": {
        const fromUi = Number(String(subjectArea ?? "").replace(",", "."));
        const area =
          (Number.isFinite(fromUi) && fromUi > 0 ? fromUi : null) ??
          (selection?.subjectAreaSqm != null && selection.subjectAreaSqm > 0
            ? selection.subjectAreaSqm
            : null) ??
          0;
        const opinion = selection?.marketOpinionValue ?? 0;
        const isUnitBasis =
          (selection?.adjustmentBasis || "price_per_sqm") !== "whole_property";
        const perSqm =
          isUnitBasis
            ? selection?.weightedPricePerSqm
            : area > 0 && opinion > 0
              ? opinion / area
              : null;
        return {
          crumbMid: "أسلوب السوق",
          crumbLast: "طريقة المقارنة",
          title: "التقييم بطريقة المقارنة",
          barMainLabel: "القيمة النهائية للعقار",
          barMainValue: `${fmt(selection?.marketOpinionValue)} ر.س`,
          barSubLabel: "قيمة المتر المربع",
          barSubValue:
            perSqm != null ? `${fmt(perSqm)} ر.س/م²` : "—",
        };
      }
      case "cost":
        return {
          crumbMid: "أسلوب التكلفة",
          crumbLast: "طريقة المقاول",
          title: "التقييم بطريقة المقاول",
          barMainLabel: "مؤشر أسلوب التكلفة",
          barMainValue: cost?.landEstimateComplete
            ? `${fmt(cost.costOpinionWithLand)} ر.س`
            : "غير مكتمل",
          barSubLabel: "أرض + إحلال − إهلاك",
          barSubValue: cost
            ? `${fmt(cost.landValueFromMarket)} + ${fmt(cost.totalCostWithIndirect)} − ${fmt(cost.depreciationValue)}`
            : "—",
        };
      case "final":
        return {
          crumbMid: "التوفيق",
          crumbLast: "رأي القيمة النهائي",
          title: "رأي القيمة النهائي",
          barMainLabel: "الرأي النهائي",
          barMainValue: `${fmt(recon?.finalOpinionValue)} ر.س`,
          barSubLabel: "بعد التقريب",
          barSubValue: amountWordsOrZero(recon?.finalOpinionValue ?? 0),
        };
      case "review":
        return {
          crumbMid: "التوفيق",
          crumbLast: "المراجعة النهائية",
          title: "المراجعة النهائية",
          barMainLabel: "الرأي النهائي",
          barMainValue: `${fmt(recon?.finalOpinionValue)} ر.س`,
          barSubLabel: "قبل الاعتماد",
          barSubValue: "رأي القيمة · الافتراضات · ESG",
        };
      default:
        return {
          crumbMid: "إعداد التقييم",
          crumbLast: "البيانات الأساسية",
          title: "البيانات الأساسية",
          barMainLabel: "طلب التقييم",
          barMainValue: displayId ?? "—",
          barSubLabel: "الحالة",
          barSubValue: settingsSaved ? "إعدادات محفوظة" : "يلزم حفظ الإعدادات",
        };
    }
  }, [screen, displayId, settingsSaved, selection, cost, recon, subjectArea]);

  async function adopt(
    compId: string,
    isAdopted: boolean,
    context: string = MARKET_CONTEXT,
  ) {
    const config = apiConfig();
    if (!config || !valuationRequestId) return;
    // مواصفة النموذج التفاعلي: الحد الأقصى ٥ مقارنات معتمدة لكل جدول.
    if (isAdopted) {
      const adoptedNow =
        context === MARKET_CONTEXT
          ? selection?.adoptedCount ?? 0
          : landSelection?.adoptedCount ?? 0;
      if (adoptedNow >= MAX_ADOPTED_COMPARABLES) {
        showToast("الحد الأقصى ٥ مقارنات معتمدة — ألغِ اعتماد مقارن أولاً", "error");
        return;
      }
    }
    // انقلاب تفاؤلي فوري للعلامة — الخادم يصادق في الخلفية والتحديث الصامت يوفّق.
    const setter = context === MARKET_CONTEXT ? setSelection : setLandSelection;
    setter((prev) => {
      if (!prev) return prev;
      const found = prev.items.some((i) => i.comparablePropertyId === compId);
      if (!found) return prev;
      return {
        ...prev,
        adoptedCount: Math.max(0, prev.adoptedCount + (isAdopted ? 1 : -1)),
        items: prev.items.map((i) =>
          i.comparablePropertyId === compId ? { ...i, isAdopted } : i,
        ),
      };
    });
    const res = await setValuationComparableAdopted(
      config,
      valuationRequestId,
      compId,
      isAdopted,
      context,
    );
    if (!res.ok) {
      showToast(res.message ?? "تعذّر تحديث الاعتماد", "error");
      await reload({ silent: true, scope: "derived" }); // تراجع للحالة الحقيقية
      return;
    }
    await reload({ silent: true, scope: "derived" }); // توفيق الأوزان والاقتراحات
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

  /** compEdit: حفظ تجاوز سعر/مساحة المقارن لهذا التقييم فقط — لا يمس البنك المشترك.
   * يعيد true عند النجاح — جدول البنك يمسح مسودته المحلية عندها. */
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

  /** compSpec: وصف المقارن لعامل اختلاف محدد — خلية لكل مقارن. */
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

  /** subjSpec: وصف العقار محل التقييم لعامل اختلاف — عمود «العقار محل التقييم». */
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

  /** حذف تسوية تسلسلية (تمويل/نوع) من الجدول — قابلة للاستعادة عبر شريحة «↺ استعادة». */
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

  /** استعادة تسوية تسلسلية محذوفة بقيمها الافتراضية. */
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
    // مبرر الوزن يُخزَّن على حقل الوزن لا كسطر تسوية.
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
    setSaving(true);
    const results = await Promise.all(
      adoptedFor(context).map((item) => {
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
          // كتابة المبرر وحدها لا تحوّل «المقترح» إلى إدخال يدوي بنسبة مخزّنة.
          percent:
            l.factorKey === factorKey && rawLine?.isSuggestedValue
              ? 0
              : lineForSave(item, l, i).percent,
          rationale: l.factorKey === factorKey ? text : l.rationale,
        }));
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
      showToast(failed.message ?? "تعذّر حفظ مبرر التسوية", "error");
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
    // انقلاب تفاؤلي فوري لعلامة ✓ — الحفظ يجري بالتوازي والتحديث الصامت يوفّق.
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

  /* ─── مقابض مستقرة لجدول التسويات — حتى يعمل memo على الجدول رغم إعادة رسم الصدفة.
     الدوال المعلنة أعلاه دوال مرفوعة (hoisted) فمراجعها هنا صحيحة. ─── */
  const matrixOps = {
    saveMatrixCell,
    saveWeight,
    saveFactorRationale,
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
  const onSaveCellStable = useCallback(
    (item: ValuationComparableSelectionDto, factorKey: string, raw: string) =>
      matrixOpsRef.current.saveMatrixCell(item, factorKey, raw),
    [],
  );
  const onSaveWeightStable = useCallback(
    (
      item: ValuationComparableSelectionDto,
      rawPct: string,
      weightRationale: string,
    ) => matrixOpsRef.current.saveWeight(item, rawPct, weightRationale),
    [],
  );
  const onSaveRationaleMarket = useCallback(
    (factorKey: string, text: string) => {
      void matrixOpsRef.current.saveFactorRationale(
        factorKey,
        text,
        MARKET_CONTEXT,
      );
    },
    [],
  );
  const onSaveRationaleLand = useCallback((factorKey: string, text: string) => {
    void matrixOpsRef.current.saveFactorRationale(
      factorKey,
      text,
      LAND_WITHIN_COST,
    );
  }, []);
  const onToggleIncludedStable = useCallback(
    (item: ValuationComparableSelectionDto, factorKey: string) => {
      void matrixOpsRef.current.toggleFactorIncluded(item, factorKey);
    },
    [],
  );
  const onChangeBasisStable = useCallback(
    (basis: "price_per_sqm" | "whole_property") => {
      void matrixOpsRef.current.changeAdjustmentBasis(basis);
    },
    [],
  );
  const onResetWeightsMarket = useCallback(
    () => matrixOpsRef.current.resetWeights(MARKET_CONTEXT),
    [],
  );
  const onResetWeightsLand = useCallback(
    () => matrixOpsRef.current.resetWeights(LAND_WITHIN_COST),
    [],
  );
  const onAreaFactorStable = useCallback((value: string) => {
    void matrixOpsRef.current.saveAreaFactorPct(value);
  }, []);
  const onAddFactorMarket = useCallback((factorKey: string, labelAr: string) => {
    void matrixOpsRef.current.addDifferenceFactor(factorKey, labelAr);
  }, []);
  const onAddFactorLand = useCallback((factorKey: string, labelAr: string) => {
    void matrixOpsRef.current.addDifferenceFactor(
      factorKey,
      labelAr,
      LAND_WITHIN_COST,
    );
  }, []);
  const onRemoveFactorMarket = useCallback((factorKey: string) => {
    void matrixOpsRef.current.removeDifferenceFactor(factorKey);
  }, []);
  const onRemoveFactorLand = useCallback((factorKey: string) => {
    void matrixOpsRef.current.removeDifferenceFactor(
      factorKey,
      LAND_WITHIN_COST,
    );
  }, []);
  const onRemoveSequentialMarket = useCallback((factorKey: string) => {
    void matrixOpsRef.current.removeSequentialFactor(factorKey);
  }, []);
  const onRemoveSequentialLand = useCallback((factorKey: string) => {
    void matrixOpsRef.current.removeSequentialFactor(
      factorKey,
      LAND_WITHIN_COST,
    );
  }, []);
  const onRestoreSequentialMarket = useCallback((factorKey: string) => {
    void matrixOpsRef.current.restoreSequentialFactor(factorKey);
  }, []);
  const onRestoreSequentialLand = useCallback((factorKey: string) => {
    void matrixOpsRef.current.restoreSequentialFactor(
      factorKey,
      LAND_WITHIN_COST,
    );
  }, []);
  const onSaveDescriptionStable = useCallback(
    (
      item: ValuationComparableSelectionDto,
      factorKey: string,
      text: string,
    ) => {
      void matrixOpsRef.current.saveCellDescription(item, factorKey, text);
    },
    [],
  );
  const onSaveSubjectSpecStable = useCallback(
    (factorKey: string, text: string) => {
      void matrixOpsRef.current.saveSubjectSpec(factorKey, text);
    },
    [],
  );


  /* ─── screens ─── */
  function renderMarket() {
    if (!settingsSaved) {
      return (
        <Card>
          <CardPad>
            <p className="text-[13px] text-text-2">
              احفظ إعدادات التقييم من شاشة البيانات الأساسية أولاً.
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
          adoptedCount={selection?.adoptedCount ?? 0}
          maxAdopted={MAX_ADOPTED_COMPARABLES}
          distanceKm={candidateDistanceKm}
          onAdopt={onAdoptMarket}
          onSearch={onSearchBank}
          onSaveOverride={onSaveBankOverride}
        />

        {selection ? (
          <AdjustmentsMatrix
            selection={selection}
            adopted={adoptedMarket}
            locked={adjustmentsLocked}
            saving={saving}
            subjectArea={subjectArea}
            idealArea={subjectArea}
            city={property?.city}
            district={property?.district ?? districtHint}
            valuationDate={officialValuationDate ?? undefined}
            factorDefinitions={factorDefinitions}
            onSaveCell={onSaveCellStable}
            onSaveWeight={onSaveWeightStable}
            onSaveRationale={onSaveRationaleMarket}
            onToggleIncluded={onToggleIncludedStable}
            onChangeBasis={onChangeBasisStable}
            onResetWeights={onResetWeightsMarket}
            onAreaFactorChange={onAreaFactorStable}
            onAddFactor={onAddFactorMarket}
            onRemoveFactor={onRemoveFactorMarket}
            catalogFactors={catalogFactorOptions}
            onRemoveSequential={onRemoveSequentialMarket}
            onRestoreSequential={onRestoreSequentialMarket}
            onSaveDescription={onSaveDescriptionStable}
            subjectSpecs={subjectSpecs}
            onSaveSubjectSpec={onSaveSubjectSpecStable}
          />
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
                ? "احفظ إعدادات التقييم أولاً."
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

        <CostBasisUnitCard
          key={`${approachSettings?.costBasisKey ?? "replacement"}:${approachSettings?.costMeasurementUnitKey ?? "comparison_unit"}`}
          savedBasisKey={approachSettings?.costBasisKey || "replacement"}
          savedUnitKey={
            approachSettings?.costMeasurementUnitKey || "comparison_unit"
          }
          saving={saving}
          onSave={onSaveCostBasisUnit}
        />

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
          adoptedCount={landSelection?.adoptedCount ?? 0}
          maxAdopted={MAX_ADOPTED_COMPARABLES}
          distanceKm={candidateDistanceKm}
          onAdopt={onAdoptLand}
          onSaveOverride={onSaveBankOverride}
        />

        {landSelection ? (
          <AdjustmentsMatrix
            selection={landSelection}
            adopted={adoptedLand}
            locked={adjustmentsLocked}
            saving={saving}
            subjectArea={String(cost?.landAreaSqm || subjectArea)}
            idealArea={String(cost?.landAreaSqm || subjectArea)}
            city={property?.city}
            district={property?.district ?? districtHint}
            valuationDate={officialValuationDate ?? undefined}
            factorDefinitions={factorDefinitions}
            onSaveCell={onSaveCellStable}
            onSaveWeight={onSaveWeightStable}
            onSaveRationale={onSaveRationaleLand}
            onToggleIncluded={onToggleIncludedStable}
            onChangeBasis={onChangeBasisStable}
            onResetWeights={onResetWeightsLand}
            onAreaFactorChange={onAreaFactorStable}
            onAddFactor={onAddFactorLand}
            onRemoveFactor={onRemoveFactorLand}
            catalogFactors={catalogFactorOptions}
            onRemoveSequential={onRemoveSequentialLand}
            onRestoreSequential={onRestoreSequentialLand}
            onSaveDescription={onSaveDescriptionStable}
          />
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
        <EvaluatorFinalReviewTab
          draft={reviewDraft}
          disabled={disabled}
          property={intakeProperty}
          assignmentType={assignmentType}
          fieldErrors={fieldErrors}
          onDraftPatch={onDraftPatch}
          onReportChoicesPatch={onReportChoicesPatch}
        />
        {showSubmit ? (
          <div className="mt-5">
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
          </div>
        ) : null}
      </>
    );
  }

  return (
    <div dir="rtl" className="relative min-h-[480px]">
      {/* رأس مساحة العمل وأشرطة الشاشات — بطاقة واحدة عائمة بلغة بطاقات النظام. */}
      <div className="overflow-hidden rounded-[var(--radius-lg)] border border-border bg-surface shadow-card">
      <header className="flex items-center justify-between gap-[18px] border-b border-border px-[22px] py-3.5">
        <h1 className="m-0 text-[17px] font-extrabold tracking-[-0.01em] text-heading">
          {pageMeta.title}
        </h1>
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
            const active = screen === n.id;
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

      <div className="relative py-[18px] pb-2">
        {error ? (
          <p className="mb-3 text-[12.5px] text-red-text">
            {error}
          </p>
        ) : null}
        {loading ? (
          // هيكل انتظار بحجم الشاشة الفعلية — لا تظهر أزرار أو شرائح قبل البيانات ولا يقفز التخطيط.
          <div aria-busy="true" aria-label="جاري تحميل مساحة عمل التقييم">
            {[0, 1, 2].map((i) => (
              <div
                key={i}
                className="mb-5 overflow-hidden rounded-[var(--radius-lg)] border border-border bg-surface shadow-card"
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
        <div hidden={loading || screen !== "basic"}>
          <ApproachSettingsSection
            valuationRequestId={valuationRequestId}
            assignmentType={assignmentType}
            settings={approachSettings}
            hydrateKey={settingsHydrateKey}
            saving={saving}
            onSavingChange={setSaving}
            onSettingsSaved={onSettingsSaved}
          />
        </div>
        {!loading && screen === "market" ? renderMarket() : null}
        {!loading && screen === "cost" ? renderCost() : null}
        {/* قسم التكلفة يبقى مركّباً (مخفياً) بعد أول زيارة — مسودات الجدول لا تضيع عند التنقل بين الشاشات. */}
        <div hidden={loading || screen !== "cost"}>
          {costScreenVisitedRef.current && settingsSaved && costEnabled ? (
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
          ) : null}
        </div>
        {!loading && screen === "final" && !settingsSaved ? (
          <Card>
            <CardPad>
              <p className="text-[13px] text-text-2">
                احفظ إعدادات التقييم أولاً لفتح رأي القيمة النهائي.
              </p>
            </CardPad>
          </Card>
        ) : null}
        <div hidden={loading || screen !== "final"}>
          {finalScreenVisitedRef.current && settingsSaved ? (
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
              hasAdoptedMarket={adoptedMarket.length > 0}
              assignmentType={assignmentType}
              officialValuationDate={officialValuationDate}
              saving={saving}
              onSavingChange={setSaving}
              onReconSaved={onReconSaved}
            />
          ) : null}
        </div>
        {!loading && screen === "review" ? renderReview() : null}
      </div>

      {/* شريحة القيم الملخّصة — لا تظهر أثناء التحميل ولا على شاشة الإعدادات (لا قيم بعد). */}
      {loading || screen === "basic" ? null : (
      <div className="sticky bottom-4 z-40 mb-2 ms-4 inline-flex max-w-[calc(100%-32px)] items-center gap-3.5 rounded-[var(--radius-lg)] border border-border-md border-s-[3px] border-s-gold bg-surface px-4 py-2.5 shadow-lg">
        <div>
          <div className="text-[10.5px] font-semibold text-text-3">
            {pageMeta.barMainLabel}
          </div>
          <div
            dir="ltr"
            className="text-start text-[19px] font-extrabold leading-tight text-heading"
          >
            {pageMeta.barMainValue}
          </div>
        </div>
        <div className="h-[30px] w-px bg-border" />
        <div>
          <div className="text-[10.5px] font-semibold text-text-3">
            {pageMeta.barSubLabel}
          </div>
          <div
            dir="ltr"
            className="text-start text-sm font-bold leading-tight text-gold-d"
          >
            {pageMeta.barSubValue}
          </div>
        </div>
      </div>
      )}
    </div>
  );
}

/** Alias matching the previous public export name. */
export { ValuationWorkShell as EvaluatorComparableSelectionPanel };
