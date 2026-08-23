"use client";

import { useCallback, useEffect, useState } from "react";
import { getApiBase, approveRemoteInspection, ensureOpenValuationRequestByProperty, listComparableProperties,
  suggestComparablePropertiesByProximity,
  listValuationComparableSelections,
  removeValuationComparableSelection,
  saveValuationComparableMarket,
  saveValuationCostApproach,
  saveValuationMarketApproach,
  getValuationCostApproach,
  getValuationApproachSettings,
  saveValuationApproachSettings,
  getValuationLists,
  activeValuationListOptions,
  getValuationReconciliation,
  saveValuationReconciliation,
  getValuationIssuanceGates,
  getValuationReportDocument,
  getValuationReportFieldPayload,
  getBuildingInventory,
  getDifferenceFactorCatalog,
  setValuationComparableAdopted,
  type ComparablePropertyDto,
  type ComparableProximitySuggestionDto,
  type ValuationComparableAdjustmentLineDto,
  type ValuationComparableSelectionDto,
  type ValuationComparableSelectionListDto,
  type ValuationApproachSettingsDto,
  type ValuationCostApproachDto,
  type ValuationCostLineDto,
  type ValuationReconciliationDto,
  type ValuationReconciliationMethodDto,
  type ValuationIssuanceGatesDto,
  type ValuationReportFieldPayloadDto,
} from "@platform/api-client";
import { getAuthSession } from "@platform/auth-client";
import { Button, Input, Label, Note, cn, useToast } from "@platform/ui-kit";
import {
  VALUATION_PURPOSE_OPTIONS,
  VALUE_BASIS_OPTIONS,
  basisOfValueKeyForAssignment,
  valuationPurposeKeyForAssignment,
} from "@platform/app-shared/prototype/assignment-valuation-defaults";
import { amountWordsOrZero } from "../../lib/evaluator/value-estimation";
import { openValuationReportPreview } from "../../lib/evaluator/valuation-report-preview";
import {
  EngSection,
  valChipClassName,
  valInputClassName,
  valLabelClassName,
  valPrimaryBtnClassName,
} from "./EvaluatorHtmlPrimitives";

function apiConfig() {
  const session = getAuthSession();
  if (!session?.token) return null;
  return { token: session.token, baseUrl: getApiBase() };
}

function sourceCardLine(comp: ComparablePropertyDto): string {
  const card = comp.sourceCard;
  const bits = [
    card.intakeChannelLabelAr,
    card.freshnessLabelAr,
    card.fromPriorDeal ? "من معاملات سابقة" : null,
    card.sourceWorkOrderNumber ? `أمر ${card.sourceWorkOrderNumber}` : null,
  ].filter(Boolean);
  return bits.join(" · ");
}

type DraftLine = {
  id?: string;
  factorKey: string;
  labelAr: string;
  percent: string;
  rationale: string;
  isIncluded: boolean;
  sortOrder: number;
};

const SEQUENTIAL_KEYS = new Set(["financing", "market", "transaction_type"]);

/** mirrors IndirectCostItemKeys on the backend. */
const INDIRECT_COST_ITEMS: { key: string; label: string }[] = [
  { key: "design_supervision", label: "التصميم والإشراف الهندسي" },
  { key: "licensing_fees", label: "الترخيص والرسوم الحكومية" },
  { key: "project_management", label: "إدارة المشروع" },
  { key: "utilities_connection", label: "توصيل الخدمات" },
  { key: "contingency", label: "مخصص الطوارئ" },
  { key: "developer_profit", label: "أرباح المطور والمخاطرة" },
];

/** mirrors CostLineItemKeys on the backend (defaults per item). */
const COST_ITEM_OPTIONS: { key: string; label: string; unit: string }[] = [
  { key: "basement", label: "القبو", unit: "sqm" },
  { key: "ground_floor", label: "الدور الأرضي", unit: "sqm" },
  { key: "first_floor", label: "الدور الأول", unit: "sqm" },
  { key: "repeated_floors", label: "الأدوار المتكررة", unit: "sqm" },
  { key: "upper_annex", label: "الملحق العلوي", unit: "sqm" },
  { key: "apartment_area", label: "مساحة الشقة", unit: "sqm" },
  { key: "shared_portion", label: "حصة المشترك من المبنى", unit: "sqm" },
  { key: "parking", label: "المواقف", unit: "count" },
  { key: "fence", label: "السور", unit: "lm" },
  { key: "pool", label: "المسبح", unit: "lump" },
  { key: "central_ac", label: "التكييف المركزي", unit: "lump" },
  { key: "elevator", label: "المصعد", unit: "count" },
  { key: "landscaping", label: "تشجير وتنسيق الموقع", unit: "lump" },
  { key: "tanks_pumps", label: "خزانات ومضخات", unit: "lump" },
  { key: "electromechanical", label: "أعمال كهروميكانيكية", unit: "lump" },
  { key: "custom", label: "بند مخصص", unit: "sqm" },
];

const COST_UNIT_OPTIONS = [
  { key: "sqm", label: "م²" },
  { key: "lm", label: "م.ط" },
  { key: "count", label: "عدد" },
  { key: "lump", label: "مقطوع" },
];

function toDraftLines(
  lines: ValuationComparableAdjustmentLineDto[] | undefined,
): DraftLine[] {
  if (!lines?.length) {
    return [
      {
        factorKey: "financing",
        labelAr: "تسوية شروط التمويل",
        percent: "0",
        rationale: "",
        isIncluded: true,
        sortOrder: 0,
      },
      {
        factorKey: "market",
        labelAr: "تسوية ظروف السوق",
        percent: "0",
        rationale: "",
        isIncluded: true,
        sortOrder: 1,
      },
      {
        factorKey: "transaction_type",
        labelAr: "تسوية نوع المقارن",
        percent: "0",
        rationale: "",
        isIncluded: true,
        sortOrder: 2,
      },
    ];
  }
  return lines.map((l) => ({
    id: l.id,
    factorKey: l.factorKey,
    labelAr: l.labelAr,
    percent: String(l.percent),
    rationale: l.rationale ?? "",
    isIncluded: l.isIncluded,
    sortOrder: l.sortOrder,
  }));
}

function LineEditor({
  lines,
  setLines,
  filter,
  disabled,
  saving,
  definitions,
}: {
  lines: DraftLine[];
  setLines: (next: DraftLine[]) => void;
  filter: (line: DraftLine) => boolean;
  disabled?: boolean;
  saving: boolean;
  /** Decision 19.2 — factor definitions shown on hover (تعريف + «ما لا يشمله»). */
  definitions?: Record<string, string>;
}) {
  return (
    <div className="flex flex-col gap-2">
      {lines.map((line, idx) => {
        if (!filter(line)) return null;
        return (
          <div
            key={`${line.factorKey}-${idx}`}
            className="grid gap-2 rounded-md bg-surface-2 px-2 py-2 sm:grid-cols-[1fr_5.5rem_1fr]"
          >
            <div>
              {line.factorKey === "custom" ? (
                <Input
                  className={valInputClassName}
                  placeholder="اسم العامل المضاف (#48)"
                  value={line.labelAr}
                  disabled={disabled || saving}
                  onChange={(e) => {
                    const next = [...lines];
                    next[idx] = { ...line, labelAr: e.target.value };
                    setLines(next);
                  }}
                />
              ) : (
                <Label
                  className={valLabelClassName}
                  title={definitions?.[line.factorKey]}
                >
                  {line.labelAr}
                </Label>
              )}
              <label className="mt-1 flex items-center gap-1.5 text-[11.5px] text-text-2">
                <input
                  type="checkbox"
                  checked={line.isIncluded}
                  disabled={disabled || saving}
                  onChange={(e) => {
                    const next = [...lines];
                    next[idx] = { ...line, isIncluded: e.target.checked };
                    setLines(next);
                  }}
                />
                يُحتسب
              </label>
            </div>
            <div>
              <Label className={valLabelClassName}>٪</Label>
              <Input
                className={valInputClassName}
                inputMode="decimal"
                value={line.percent}
                disabled={disabled || saving}
                onChange={(e) => {
                  const next = [...lines];
                  next[idx] = { ...line, percent: e.target.value };
                  setLines(next);
                }}
              />
            </div>
            <div>
              <Label className={valLabelClassName}>مبرر</Label>
              <Input
                className={valInputClassName}
                value={line.rationale}
                disabled={disabled || saving}
                onChange={(e) => {
                  const next = [...lines];
                  next[idx] = { ...line, rationale: e.target.value };
                  setLines(next);
                }}
              />
            </div>
          </div>
        );
      })}
    </div>
  );
}

function MarketAdjustEditor({
  item,
  valuationRequestId,
  disabled,
  onSaved,
  factorDefinitions,
}: {
  item: ValuationComparableSelectionDto;
  valuationRequestId: string;
  disabled?: boolean;
  onSaved: () => Promise<void>;
  factorDefinitions?: Record<string, string>;
}) {
  const { showToast } = useToast();
  const market = item.market;
  const [lines, setLines] = useState<DraftLine[]>(() =>
    toDraftLines(market?.adjustmentLines),
  );
  const [weightManual, setWeightManual] = useState(market?.weightIsManual ?? false);
  const [weightPct, setWeightPct] = useState(
    String(market?.weightPct ?? market?.suggestedWeightPct ?? ""),
  );
  const [areaMethod, setAreaMethod] = useState(
    market?.areaAdjustmentMethod ?? "multiplier",
  );
  const [weightRationale, setWeightRationale] = useState(
    market?.weightOverrideRationale ?? "",
  );
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    setLines(toDraftLines(market?.adjustmentLines));
    setWeightManual(market?.weightIsManual ?? false);
    setWeightPct(String(market?.weightPct ?? market?.suggestedWeightPct ?? ""));
    setAreaMethod(market?.areaAdjustmentMethod ?? "multiplier");
    setWeightRationale(market?.weightOverrideRationale ?? "");
  }, [market, item.id]);

  async function save() {
    const config = apiConfig();
    if (!config) return;
    setSaving(true);
    const res = await saveValuationComparableMarket(
      config,
      valuationRequestId,
      item.id,
      {
        adjustmentLines: lines.map((l, i) => ({
          id: l.id,
          factorKey: l.factorKey,
          labelAr: l.labelAr,
          percent: Number(l.percent.replace(",", ".")) || 0,
          rationale: l.rationale,
          isIncluded: l.isIncluded,
          sortOrder: i,
        })),
        weightIsManual: weightManual,
        weightPct: weightManual ? Number(weightPct.replace(",", ".")) || 0 : null,
        weightOverrideRationale: weightManual ? weightRationale.trim() || null : null,
        areaAdjustmentMethod: areaMethod,
      },
    );
    setSaving(false);
    if (!res.ok) {
      showToast(res.message ?? "تعذّر حفظ التسويات", "error");
      return;
    }
    showToast("تم حفظ التسويات", "success");
    await onSaved();
  }

  return (
    <div className="mt-2 border-t border-border-md pt-2">
      <div className="mb-2 flex flex-wrap gap-2 text-[11.5px] text-text-muted">
        <span>عمر الصفقة: {market?.dealAgeMonths ?? 0} شهر</span>
        <span>
          بعد التسلسل:{" "}
          {(market?.pricePerSqmAfterSequential ?? 0).toLocaleString("ar-SA")} ر.س/م²
        </span>
        <span>
          بعد عوامل الاختلاف:{" "}
          {(
            market?.pricePerSqmAfterDifference ??
            market?.pricePerSqmAfterSequential ??
            0
          ).toLocaleString("ar-SA")}{" "}
          ر.س/م²
        </span>
        <span>مجموع الكل: {market?.sumIncludedPct ?? 0}٪</span>
        {market?.exceedsLargeAdjustmentThreshold ? (
          <span className="text-danger">تنبيه: |مجموع| &gt; 35٪</span>
        ) : null}
      </div>

      <p className={cn(valLabelClassName, "mb-1")}>التسويات التسلسلية</p>
      <LineEditor
        lines={lines}
        setLines={setLines}
        filter={(l) => SEQUENTIAL_KEYS.has(l.factorKey)}
        disabled={disabled}
        saving={saving}
        definitions={factorDefinitions}
      />

      <div className="mb-1 mt-3 flex flex-wrap items-center gap-2">
        <p className={cn(valLabelClassName, "m-0")}>تسوية المساحة</p>
        <select
          className="rounded-md border border-border-md bg-surface px-2 py-1 text-[12px]"
          value={areaMethod}
          disabled={disabled || saving}
          onChange={(e) => setAreaMethod(e.target.value)}
        >
          <option value="multiplier">المضاعف</option>
          <option value="amthal">الأمثال</option>
        </select>
        <span className="text-[11.5px] text-text-muted">
          الاقتراح المحسوب: {market?.suggestedAreaAdjustmentPct ?? 0}٪ — يُطبَّق عبر سطر «المساحة» أدناه (الأصغر سالب والأكبر موجب)
        </span>
      </div>

      <p className={cn(valLabelClassName, "mb-1 mt-3")}>
        عوامل الاختلاف — تُجمع ثم تُطبَّق مرة واحدة
      </p>
      <LineEditor
        lines={lines}
        setLines={setLines}
        filter={(l) => !SEQUENTIAL_KEYS.has(l.factorKey)}
        disabled={disabled}
        saving={saving}
        definitions={factorDefinitions}
      />
      <div className="mt-1.5">
        <Button
          type="button"
          size="sm"
          variant="outline"
          disabled={disabled || saving}
          onClick={() =>
            setLines([
              ...lines,
              {
                factorKey: "custom",
                labelAr: "",
                percent: "0",
                rationale: "",
                isIncluded: true,
                sortOrder: lines.length,
              },
            ])
          }
        >
          إضافة عامل مضاف من المقيّم
        </Button>
      </div>

      <div className="mt-2 grid max-w-md gap-2 sm:grid-cols-[auto_1fr]">
        <label className="flex items-center gap-1.5 text-[12px] text-text-2">
          <input
            type="checkbox"
            checked={weightManual}
            disabled={disabled || saving}
            onChange={(e) => setWeightManual(e.target.checked)}
          />
          وزن يدوي
        </label>
        <div>
          <Label className={valLabelClassName}>
            الوزن ٪ (مقترح: {market?.suggestedWeightPct ?? 0})
          </Label>
          <Input
            className={valInputClassName}
            inputMode="decimal"
            value={weightPct}
            disabled={disabled || saving || !weightManual}
            onChange={(e) => setWeightPct(e.target.value)}
          />
        </div>
        {weightManual ? (
          <div className="sm:col-span-2">
            <Label className={valLabelClassName}>
              مبرر تجاوز الوزن الآلي (إلزامي)
            </Label>
            <Input
              className={valInputClassName}
              value={weightRationale}
              disabled={disabled || saving}
              onChange={(e) => setWeightRationale(e.target.value)}
              placeholder="لماذا تجاوزت الاقتراح؟"
            />
          </div>
        ) : null}
      </div>

      <div className="mt-2">
        <Button
          type="button"
          size="sm"
          variant="primary"
          disabled={disabled || saving}
          onClick={() => void save()}
        >
          حفظ التسويات
        </Button>
      </div>
    </div>
  );
}

/**
 * select / adopt bank comps + sequential market adjustments + weights.
 * Difference-factor matrix deferred.
 */
export function EvaluatorComparableSelectionPanel({
  propertyId,
  poNumber,
  assignmentType,
  districtHint,
}: {
  propertyId: string;
  poNumber?: string;
  assignmentType?: string;
  districtHint?: string;
}) {
  const { showToast } = useToast();
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [valuationRequestId, setValuationRequestId] = useState<string | null>(null);
  const [displayId, setDisplayId] = useState<string | null>(null);
  const [selection, setSelection] = useState<ValuationComparableSelectionListDto | null>(
    null,
  );
  const [candidates, setCandidates] = useState<ComparablePropertyDto[]>([]);
  const [proximity, setProximity] = useState<ComparableProximitySuggestionDto[]>([]);
  const [proximitySource, setProximitySource] = useState<string>("none");
  const [q, setQ] = useState("");
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [subjectArea, setSubjectArea] = useState("");
  const [adjustmentBasis, setAdjustmentBasis] = useState("price_per_sqm");
  const [analysisNotes, setAnalysisNotes] = useState("");
  const [factorDefinitions, setFactorDefinitions] = useState<Record<string, string>>({});

  useEffect(() => {
    const config = apiConfig();
    if (!config) return;
    // Decision 19.2 — definitions come from the admin catalog, not code constants.
    void getDifferenceFactorCatalog(config).then((res) => {
      if (!res.ok) return;
      const map: Record<string, string> = {};
      for (const f of res.data.factors) {
        if (!f.isActive) continue;
        map[f.key] = f.excludesAr
          ? `${f.definitionAr}\nلا يشمل: ${f.excludesAr}`
          : f.definitionAr;
      }
      setFactorDefinitions(map);
    });
  }, []);
  // شاشة 1 — الأساليب المطبَّقة (ق-2/ق-3) + أساس/وحدة التكلفة + صلاحية التسويات.
  const [approachSettings, setApproachSettings] =
    useState<ValuationApproachSettingsDto | null>(null);
  const [asMarketEnabled, setAsMarketEnabled] = useState(true);
  const [asCostEnabled, setAsCostEnabled] = useState(true);
  const [asCostBasis, setAsCostBasis] = useState("replacement");
  const [asCostUnit, setAsCostUnit] = useState("comparison_unit");
  const [asAdjustUnlocked, setAsAdjustUnlocked] = useState(true);
  // إعدادات تقرير التقييم: الغرض (§4ج-5) + بند الأخصائي الخارجي (IVS 101).
  const [asPurpose, setAsPurpose] = useState(() =>
    valuationPurposeKeyForAssignment(assignmentType),
  );
  const [asPurposeNote, setAsPurposeNote] = useState("");
  const [asSpecialistUsed, setAsSpecialistUsed] = useState(false);
  const [asSpecialistDetails, setAsSpecialistDetails] = useState("");
  // تاريخ التقييم بنوعيه + الافتراضات الخاصة (انتقاء من مكتبة الإعدادات + إضافة حرة).
  const [asDateMode, setAsDateMode] = useState("issue");
  const [asRetroDate, setAsRetroDate] = useState("");
  const [asRetroRationale, setAsRetroRationale] = useState("");
  const [asAssumptions, setAsAssumptions] = useState<string[]>([]);
  const [asFreeAssumption, setAsFreeAssumption] = useState("");
  const [cost, setCost] = useState<ValuationCostApproachDto | null>(null);
  const [costDraft, setCostDraft] = useState<ValuationCostLineDto[]>([]);
  const [useRestrictionPct, setUseRestrictionPct] = useState("0");
  const [indirectDraft, setIndirectDraft] = useState<
    Record<string, { pct: string; rationale: string }>
  >({});
  const [financingRate, setFinancingRate] = useState("0");
  const [financingMonths, setFinancingMonths] = useState("0");
  const [actualAge, setActualAge] = useState("");
  const [economicAge, setEconomicAge] = useState("");
  const [lifeExtension, setLifeExtension] = useState("0");
  const [lifeExtensionBasis, setLifeExtensionBasis] = useState("");
  const [functionalObs, setFunctionalObs] = useState("0");
  const [functionalObsRationale, setFunctionalObsRationale] = useState("");
  const [externalObs, setExternalObs] = useState("0");
  const [externalObsRationale, setExternalObsRationale] = useState("");
  const [useRestrictionRationale, setUseRestrictionRationale] = useState("");
  const [apartmentLandShare, setApartmentLandShare] = useState("");
  const [recon, setRecon] = useState<ValuationReconciliationDto | null>(null);
  const [reconMethods, setReconMethods] = useState<ValuationReconciliationMethodDto[]>(
    [],
  );
  const [methodsRationale, setMethodsRationale] = useState("");
  const [finalRoundDecimals, setFinalRoundDecimals] = useState("0");
  const [basisOfValueKey, setBasisOfValueKey] = useState(() =>
    basisOfValueKeyForAssignment(assignmentType),
  );
  const [valuePremiseKey, setValuePremiseKey] = useState("");
  const [purposeOptions, setPurposeOptions] = useState(VALUATION_PURPOSE_OPTIONS);
  const [basisOptions, setBasisOptions] = useState(VALUE_BASIS_OPTIONS);
  const [premiseOptions, setPremiseOptions] = useState<
    { value: string; label: string }[]
  >([]);
  const [liquidationDiscountPct, setLiquidationDiscountPct] = useState("0");
  const [liquidationDiscountRationale, setLiquidationDiscountRationale] =
    useState("");
  const [alertOverrides, setAlertOverrides] = useState<
    Record<string, { overrideRationale: string; acknowledged: boolean }>
  >({});
  const [gates, setGates] = useState<ValuationIssuanceGatesDto | null>(null);
  const [reportFields, setReportFields] = useState<ValuationReportFieldPayloadDto | null>(null);

  useEffect(() => {
    const config = apiConfig();
    if (!config) return;
    void getValuationLists(config).then((res) => {
      if (!res.ok) return;
      const purposes = activeValuationListOptions(res.data.lists, "purposes");
      const bases = activeValuationListOptions(res.data.lists, "valueBases");
      const premises = activeValuationListOptions(res.data.lists, "premises");
      if (purposes.length) setPurposeOptions(purposes);
      if (bases.length) setBasisOptions(bases);
      if (premises.length) setPremiseOptions(premises);
    });
  }, []);

  const reload = useCallback(async () => {
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

    setLoading(true);
    setError(null);

    const open = await ensureOpenValuationRequestByProperty(config, {
      propId: propertyId.trim(),
      area: districtHint?.trim() || "—",
      type: "—",
      appraiser: "—",
    });
    if (!open.ok) {
      setLoading(false);
      setValuationRequestId(null);
      setDisplayId(null);
      setSelection(null);
      setCost(null);
      setRecon(null);
      setReconMethods([]);
      setGates(null);
      setReportFields(null);
      setProximity([]);
      setProximitySource("none");
      if (open.kind === "auth") {
        setError("يلزم تسجيل الدخول");
      } else if (open.kind === "network") {
        setError("تعذّر الاتصال بخدمة التقييم");
      } else {
        setError("تعذّر فتح طلب التقييم — يُنشأ عند توزيع المعاملة على المقيم.");
      }
      return;
    }

    setValuationRequestId(open.data.id);
    setDisplayId(open.data.displayId);

    const [selRes, bankRes, costRes, reconRes, gatesRes, proxRes, fieldsRes, settingsRes] =
      await Promise.all([
      listValuationComparableSelections(config, open.data.id),
      listComparableProperties(config, {
        q: q || undefined,
        district: districtHint || undefined,
        take: 40,
      }),
      getValuationCostApproach(config, open.data.id),
      getValuationReconciliation(config, open.data.id),
      getValuationIssuanceGates(config, open.data.id),
      suggestComparablePropertiesByProximity(config, {
        propertyId: propertyId.trim(),
        district: districtHint || undefined,
        maxDistanceKm: 5,
        take: 8,
      }),
      getValuationReportFieldPayload(config, open.data.id),
      getValuationApproachSettings(config, open.data.id),
    ]);

    setLoading(false);

    if (settingsRes.ok) {
      setApproachSettings(settingsRes.data);
      setAsMarketEnabled(settingsRes.data.marketApproachEnabled);
      setAsCostEnabled(settingsRes.data.costApproachEnabled);
      setAsCostBasis(settingsRes.data.costBasisKey || "replacement");
      setAsCostUnit(settingsRes.data.costMeasurementUnitKey || "comparison_unit");
      setAsAdjustUnlocked(settingsRes.data.adjustmentsEditUnlocked);
      setAsPurpose(
        settingsRes.data.valuationPurposeKey ||
          valuationPurposeKeyForAssignment(assignmentType),
      );
      setAsPurposeNote(settingsRes.data.valuationPurposeNote ?? "");
      setAsSpecialistUsed(settingsRes.data.externalSpecialistUsed);
      setAsSpecialistDetails(settingsRes.data.externalSpecialistDetails ?? "");
      setAsDateMode(settingsRes.data.valuationDateMode || "issue");
      setAsRetroDate(settingsRes.data.retrospectiveDate ?? "");
      setAsRetroRationale(settingsRes.data.retrospectiveRationale ?? "");
      setAsAssumptions(settingsRes.data.selectedAssumptions ?? []);
    } else {
      setApproachSettings(null);
    }

    if (!selRes.ok) {
      setError("تعذّر تحميل المقارنات المختارة");
      return;
    }
    setSelection(selRes.data);
    setSubjectArea(
      selRes.data.subjectAreaSqm != null ? String(selRes.data.subjectAreaSqm) : "",
    );
    setAdjustmentBasis(selRes.data.adjustmentBasis || "price_per_sqm");
    setAnalysisNotes(selRes.data.analysisNotes ?? "");

    if (bankRes.ok) setCandidates(bankRes.data);
    if (costRes.ok) {
      setCost(costRes.data);
      setCostDraft(costRes.data.lines);
      setUseRestrictionPct(String(costRes.data.useRestrictionDiscountPct ?? 0));
      setUseRestrictionRationale(costRes.data.useRestrictionRationale ?? "");
      setApartmentLandShare(
        costRes.data.apartmentLandShareSqm != null
          ? String(costRes.data.apartmentLandShareSqm)
          : "",
      );
      const indirect: Record<string, { pct: string; rationale: string }> = {};
      for (const item of costRes.data.indirectItems ?? []) {
        indirect[item.itemKey] = {
          pct: String(item.pct),
          rationale: item.rationale ?? "",
        };
      }
      setIndirectDraft(indirect);
      setFinancingRate(String(costRes.data.financingAnnualRatePct ?? 0));
      setFinancingMonths(String(costRes.data.financingMonths ?? 0));
      setActualAge(
        costRes.data.actualAgeYears != null ? String(costRes.data.actualAgeYears) : "",
      );
      setEconomicAge(
        costRes.data.economicAgeYears != null
          ? String(costRes.data.economicAgeYears)
          : "",
      );
      setLifeExtension(String(costRes.data.lifeExtensionYears ?? 0));
      setLifeExtensionBasis(costRes.data.lifeExtensionBasis ?? "");
      setFunctionalObs(String(costRes.data.functionalObsolescencePct ?? 0));
      setFunctionalObsRationale(costRes.data.functionalObsolescenceRationale ?? "");
      setExternalObs(String(costRes.data.externalObsolescencePct ?? 0));
      setExternalObsRationale(costRes.data.externalObsolescenceRationale ?? "");
    } else {
      setCost(null);
      setCostDraft([]);
    }

    if (reconRes.ok) {
      setRecon(reconRes.data);
      setReconMethods(reconRes.data.methods);
      setMethodsRationale(reconRes.data.methodsRationale ?? "");
      setFinalRoundDecimals(String(reconRes.data.finalRoundDecimals ?? 0));
      const nextBasis =
        reconRes.data.basisOfValueKey ||
        basisOfValueKeyForAssignment(assignmentType);
      setBasisOfValueKey(nextBasis);
      let nextPremise = reconRes.data.valuePremiseKey || "";
      if (nextBasis === "liquidation") {
        if (nextPremise !== "orderly" && nextPremise !== "forced") {
          nextPremise = "orderly";
        }
      }
      setValuePremiseKey(nextPremise);
      setLiquidationDiscountPct(String(reconRes.data.liquidationDiscountPct ?? 0));
      setLiquidationDiscountRationale(
        reconRes.data.liquidationDiscountRationale ?? "",
      );
      const ovMap: Record<
        string,
        { overrideRationale: string; acknowledged: boolean }
      > = {};
      for (const o of reconRes.data.methodologyAlertOverrides ?? []) {
        ovMap[o.code] = {
          overrideRationale: o.overrideRationale ?? "",
          acknowledged: o.acknowledged ?? false,
        };
      }
      setAlertOverrides(ovMap);
    } else {
      setRecon(null);
      setReconMethods([]);
      setMethodsRationale("");
      setFinalRoundDecimals("0");
      setBasisOfValueKey(basisOfValueKeyForAssignment(assignmentType));
      setValuePremiseKey(
        basisOfValueKeyForAssignment(assignmentType) === "liquidation"
          ? "orderly"
          : "",
      );
      setLiquidationDiscountPct("0");
      setLiquidationDiscountRationale("");
      setAlertOverrides({});
    }

    if (gatesRes.ok) setGates(gatesRes.data);
    else setGates(null);

    if (fieldsRes.ok) setReportFields(fieldsRes.data);
    else setReportFields(null);

    if (proxRes.ok) {
      const selected = new Set(
        (selRes.ok ? selRes.data.items : []).map((i) => i.comparablePropertyId),
      );
      setProximity(
        proxRes.data.items.filter((x) => !selected.has(x.comparable.id)),
      );
      setProximitySource(proxRes.data.subjectCoordSource);
    } else {
      setProximity([]);
      setProximitySource("none");
    }
  }, [propertyId, districtHint, q, assignmentType]);

  useEffect(() => {
    void reload();
  }, [reload]);

  const selectedIds = new Set(
    selection?.items.map((i) => i.comparablePropertyId) ?? [],
  );

  // شاشة 1 تتحكم بباقي الشاشات: لا تُفتح أقسام العمل حتى تُحفظ إعدادات التقرير.
  const settingsSaved = approachSettings?.isSaved ?? false;
  // ق-2: الأسلوب غير المفعَّل لا يظهر تبويبه ولا يدخل في الترجيح.
  const marketEnabled = settingsSaved && (approachSettings?.marketApproachEnabled ?? true);
  const costEnabled = settingsSaved && (approachSettings?.costApproachEnabled ?? true);
  const adjustmentsLocked = approachSettings
    ? !approachSettings.adjustmentsEditUnlocked
    : false;

  async function adopt(compId: string, isAdopted: boolean) {
    const config = apiConfig();
    if (!config || !valuationRequestId) return;
    setSaving(true);
    const res = await setValuationComparableAdopted(
      config,
      valuationRequestId,
      compId,
      isAdopted,
    );
    setSaving(false);
    if (!res.ok) {
      showToast(res.message ?? "تعذّر تحديث الاعتماد", "error");
      return;
    }
    showToast(isAdopted ? "تم اعتماد المقارن" : "أُلغي الاعتماد", "success");
    await reload();
  }

  async function remove(compId: string) {
    const config = apiConfig();
    if (!config || !valuationRequestId) return;
    setSaving(true);
    const res = await removeValuationComparableSelection(
      config,
      valuationRequestId,
      compId,
    );
    setSaving(false);
    if (!res.ok) {
      showToast("تعذّر إزالة المقارن", "error");
      return;
    }
    await reload();
  }

  // ق-7: اعتماد المقيّم المعتمد لنطاق «مكتبية عن بُعد» — يفكّ الحاجب m21.
  async function approveRemoteScope() {
    const config = apiConfig();
    if (!config || !poNumber) {
      showToast("يلزم رقم أمر العمل لاعتماد نطاق المعاينة", "error");
      return;
    }
    setSaving(true);
    const res = await approveRemoteInspection(config, poNumber, propertyId);
    setSaving(false);
    if (!res.ok) {
      showToast(
        Object.values(res.errors ?? {})[0] ?? "تعذّر اعتماد نطاق المعاينة",
        "error",
      );
      return;
    }
    showToast("اعتُمد نطاق المعاينة المكتبية — سُجّل في التدقيق", "success");
    await reload();
  }

  async function saveApproachSettings() {
    const config = apiConfig();
    if (!config || !valuationRequestId) return;
    setSaving(true);
    const res = await saveValuationApproachSettings(config, valuationRequestId, {
      marketApproachEnabled: asMarketEnabled,
      costApproachEnabled: asCostEnabled,
      incomeApproachEnabled: false,
      costBasisKey: asCostBasis,
      costMeasurementUnitKey: asCostUnit,
      adjustmentsEditUnlocked: asAdjustUnlocked,
      valuationPurposeKey: asPurpose || null,
      valuationPurposeNote: asPurposeNote.trim() || null,
      externalSpecialistUsed: asSpecialistUsed,
      externalSpecialistDetails: asSpecialistDetails.trim() || null,
      valuationDateMode: asDateMode,
      retrospectiveDate: asDateMode === "retrospective" ? asRetroDate || null : null,
      retrospectiveRationale:
        asDateMode === "retrospective" ? asRetroRationale.trim() || null : null,
      selectedAssumptions: asAssumptions,
    });
    setSaving(false);
    if (!res.ok) {
      showToast(res.message ?? "تعذّر حفظ إعدادات التقييم", "error");
      return;
    }
    showToast("تم حفظ إعدادات التقييم", "success");
    await reload();
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

  async function seedCostFromInventory() {
    const config = apiConfig();
    if (!config || !valuationRequestId || !poNumber) {
      showToast("يلزم رقم أمر العمل لسحب حصر المباني", "error");
      return;
    }
    const inv = await getBuildingInventory(config, poNumber, propertyId);
    if (!inv.ok) {
      showToast("تعذّر تحميل حصر المباني", "error");
      return;
    }
    const seeded: ValuationCostLineDto[] = inv.data.lines.map((l, i) => ({
      id: crypto.randomUUID(),
      sourceInventoryLineId: l.id ?? null,
      structureKind: l.structureKind || "other",
      itemKey:
        l.structureKind === "basement"
          ? "basement"
          : l.structureKind === "fence"
            ? "fence"
            : l.structureKind === "annex"
              ? "upper_annex"
              : "custom",
      itemLabelAr: "",
      unit: "sqm",
      unitLabelAr: "م²",
      buildRatioPct: null,
      repeatedFloorCount: null,
      label: l.label,
      areaSqm: Number(String(l.areaSqm ?? "0").replace(",", ".")) || 0,
      unitCostSar: 0,
      lineTotal: 0,
      rationale: "",
      isIncluded: true,
      sortOrder: i,
    }));
    setCostDraft(seeded);
    showToast(`تم سحب ${seeded.length} بندًا من الحصر — أدخل تكلفة المتر`, "info");
  }

  async function saveCost() {
    const config = apiConfig();
    if (!config || !valuationRequestId) return;
    setSaving(true);
    const res = await saveValuationCostApproach(config, valuationRequestId, {
      importLandFromMarket: true,
      useRestrictionDiscountPct: Number(useRestrictionPct.replace(",", ".")) || 0,
      useRestrictionRationale: useRestrictionRationale.trim() || null,
      apartmentLandShareSqm: apartmentLandShare.trim()
        ? Number(apartmentLandShare.replace(",", ".")) || 0
        : null,
      indirectItems: INDIRECT_COST_ITEMS.filter(
        (item) => Number((indirectDraft[item.key]?.pct ?? "0").replace(",", ".")) > 0
          || (indirectDraft[item.key]?.rationale ?? "").trim() !== "",
      ).map((item, i) => ({
        itemKey: item.key,
        pct: Number((indirectDraft[item.key]?.pct ?? "0").replace(",", ".")) || 0,
        rationale: (indirectDraft[item.key]?.rationale ?? "").trim() || null,
        sortOrder: i,
      })),
      financingAnnualRatePct: Number(financingRate.replace(",", ".")) || 0,
      financingMonths: Number.parseInt(financingMonths, 10) || 0,
      actualAgeYears: actualAge.trim()
        ? Number(actualAge.replace(",", ".")) || 0
        : null,
      economicAgeYears: economicAge.trim()
        ? Number(economicAge.replace(",", ".")) || 0
        : null,
      lifeExtensionYears: Number(lifeExtension.replace(",", ".")) || 0,
      lifeExtensionBasis: lifeExtensionBasis.trim() || null,
      functionalObsolescencePct: Number(functionalObs.replace(",", ".")) || 0,
      functionalObsolescenceRationale: functionalObsRationale.trim() || null,
      externalObsolescencePct: Number(externalObs.replace(",", ".")) || 0,
      externalObsolescenceRationale: externalObsRationale.trim() || null,
      lines: costDraft.map((l, i) => ({
        id: l.id,
        sourceInventoryLineId: l.sourceInventoryLineId,
        structureKind: l.structureKind,
        itemKey: l.itemKey || "custom",
        label: l.label,
        areaSqm: l.areaSqm,
        unit: l.unit || null,
        buildRatioPct: l.buildRatioPct ?? null,
        repeatedFloorCount: l.repeatedFloorCount ?? null,
        unitCostSar: l.unitCostSar,
        rationale: l.rationale,
        isIncluded: l.isIncluded,
        sortOrder: i,
      })),
    });
    setSaving(false);
    if (!res.ok) {
      showToast(res.message ?? "تعذّر حفظ التكلفة", "error");
      return;
    }
    setCost(res.data);
    setCostDraft(res.data.lines);
    showToast("تم حفظ أسلوب التكلفة (أرض من السوق)", "success");
    void reload();
  }

  async function saveReconciliation() {
    const config = apiConfig();
    if (!config || !valuationRequestId) return;
    setSaving(true);
    const res = await saveValuationReconciliation(config, valuationRequestId, {
      methodsRationale,
      finalRoundDecimals: Number.parseInt(finalRoundDecimals, 10) || 0,
      basisOfValueKey,
      valuePremiseKey: valuePremiseKey || null,
      liquidationDiscountPct:
        Number(liquidationDiscountPct.replace(",", ".")) || 0,
      liquidationDiscountRationale: liquidationDiscountRationale || null,
      methodologyAlertOverrides: Object.entries(alertOverrides).map(
        ([code, v]) => ({
          code,
          overrideRationale: v.overrideRationale || null,
          acknowledged: v.acknowledged,
        }),
      ),
      methods: reconMethods.map((m, i) => ({
        id: m.id,
        approachKind: m.approachKind,
        weightPct: m.weightPct,
        rationale: m.rationale,
        isIncluded: m.isIncluded,
        sortOrder: i,
      })),
    });
    setSaving(false);
    if (!res.ok) {
      showToast(res.message ?? "تعذّر حفظ الترجيح", "error");
      return;
    }
    setRecon(res.data);
    setReconMethods(res.data.methods);
    setMethodsRationale(res.data.methodsRationale ?? "");
    setFinalRoundDecimals(String(res.data.finalRoundDecimals ?? 0));
    setBasisOfValueKey(res.data.basisOfValueKey || "market");
    setValuePremiseKey(res.data.valuePremiseKey || "");
    setLiquidationDiscountPct(String(res.data.liquidationDiscountPct ?? 0));
    setLiquidationDiscountRationale(
      res.data.liquidationDiscountRationale ?? "",
    );
    const ovMap: Record<
      string,
      { overrideRationale: string; acknowledged: boolean }
    > = {};
    for (const o of res.data.methodologyAlertOverrides ?? []) {
      ovMap[o.code] = {
        overrideRationale: o.overrideRationale ?? "",
        acknowledged: o.acknowledged ?? false,
      };
    }
    setAlertOverrides(ovMap);
    showToast(
      res.data.liquidationDiscountApplied
        ? "تم حفظ رأي القيمة مع خصم التصفية"
        : "تم حفظ رأي القيمة النهائي (تقريب مرة واحدة)",
      "success",
    );
  }

  async function openReportPreview() {
    const config = apiConfig();
    if (!config || !valuationRequestId) return;
    setSaving(true);
    const res = await getValuationReportDocument(config, valuationRequestId);
    setSaving(false);
    if (!res.ok) {
      showToast("تعذّر تحميل استعراض تقرير التقييم", "error");
      return;
    }
    try {
      await openValuationReportPreview(res.data);
    } catch {
      showToast("تعذّر فتح استعراض تقرير التقييم على الكليشة المعتمدة", "error");
    }
  }

  function openValuationReportFieldPreview() {
    if (!reportFields) {
      showToast("لا توجد حمولة حقن بعد", "error");
      return;
    }
    const esc = (s: string) =>
      s
        .replace(/&/g, "&amp;")
        .replace(/</g, "&lt;")
        .replace(/>/g, "&gt;")
        .replace(/"/g, "&quot;");
    const filled = reportFields.fields.filter((f) => f.filled);
    const w = window.open("", "_blank", "noopener,noreferrer,width=960,height=900");
    if (!w) {
      showToast("المتصفح منع فتح النافذة", "error");
      return;
    }
    const rows = filled
      .map(
        (f) =>
          `<tr><td>${esc(f.fieldKey)}</td><td>${esc(f.labelAr)}</td><td>${esc(f.valueTypeLabelAr)}</td><td>${esc(f.value ?? "")}</td><td>${esc(f.sourceKind)}</td></tr>`,
      )
      .join("");
    w.document.open();
    w.document.write(`<!DOCTYPE html><html lang="ar" dir="rtl"><head><meta charset="utf-8"/><title>حقول تقرير التقييم</title>
<style>body{font-family:Tahoma,sans-serif;padding:16px}table{border-collapse:collapse;width:100%;font-size:12px}td,th{border:1px solid #ccc;padding:4px 6px}th{background:#f3f3f3}.meta{margin-bottom:12px;color:#444}</style></head>
<body>
<h1>حمولة حقول التقرير</h1>
<p class="meta">${esc(reportFields.packageNoteAr)}</p>
<p class="meta">طلب ${esc(reportFields.displayId)} · الكتالوج ${reportFields.catalogCount} · مملوء ${reportFields.filledCount} · قابل للحل ${reportFields.resolvableCount} · مؤجّل ${reportFields.deferredCount} · أصول ${reportFields.assetCount}</p>
<table><thead><tr><th>المفتاح</th><th>التسمية</th><th>النوع</th><th>القيمة</th><th>المصدر</th></tr></thead><tbody>${rows}</tbody></table>
<details style="margin-top:16px"><summary>valuesByFieldKey JSON</summary><pre>${esc(JSON.stringify(reportFields.valuesByFieldKey, null, 2))}</pre></details>
</body></html>`);
    w.document.close();
  }

  return (
    <div className="flex flex-col gap-1">
      <EngSection>اختيار المقارنات والتسويات</EngSection>
      <Note>
        سوق: تسلسل ← عوامل اختلاف ← أوزان ← مساحة × متر مرجّح. تكلفة:
        بنود من الحصر + أرض مستوردة من رأي السوق. ثم ترجيح الأساليب
        وتقريب مرة واحدة على الرأي النهائي.
      </Note>

      {displayId ? (
        <p className={cn(valLabelClassName, "mt-2")}>
          طلب التقييم: <span className={valChipClassName}>{displayId}</span>
          {selection ? (
            <>
              {" "}
              · معتمد: {selection.adoptedCount}
              {selection.meetsMinimumAdoptedGate ? " ✓" : " (أقل من الحد الأدنى)"}
              {" · "}
              متر مرجّح: {selection.weightedPricePerSqm.toLocaleString("ar-SA")} ر.س
              {selection.weightsSumTo100 ? "" : " · الأوزان ≠ 100٪"}
            </>
          ) : null}
        </p>
      ) : null}

      {valuationRequestId && approachSettings ? (
        <div className="mt-2 rounded-lg border border-border-md bg-surface-2 px-3 py-2">
          <EngSection>إعدادات تقرير التقييم — شاشة 1</EngSection>
          <p className="mb-2 text-[12px] text-text-muted">
            ق-2: الأسلوب غير المفعَّل لا يظهر ولا يدخل في الترجيح.
            {!approachSettings.costApproachAllowed
              ? " · ق-3: أرض بلا إنشاءات — أسلوب التكلفة لا ينطبق."
              : approachSettings.isLandPropertyType && approachSettings.hasStructuresToValue
                ? " · أرض بإنشاءات — التكلفة تفتح لبنود الإنشاءات فقط (ق-3 المعدَّل)."
                : null}
          </p>
          <div className="mb-2 flex flex-wrap items-center gap-4">
            <label className="flex items-center gap-1.5 text-[12.5px] text-text">
              <input
                type="checkbox"
                checked={asMarketEnabled}
                disabled={saving}
                onChange={(e) => setAsMarketEnabled(e.target.checked)}
              />
              أسلوب السوق (طريقة المقارنة)
            </label>
            <label
              className={cn(
                "flex items-center gap-1.5 text-[12.5px]",
                approachSettings.costApproachAllowed ? "text-text" : "text-text-muted",
              )}
            >
              <input
                type="checkbox"
                checked={asCostEnabled && approachSettings.costApproachAllowed}
                disabled={saving || !approachSettings.costApproachAllowed}
                onChange={(e) => setAsCostEnabled(e.target.checked)}
              />
              أسلوب التكلفة (طريقة المقاول)
              {!approachSettings.costApproachAllowed ? " — لا ينطبق (ق-3)" : ""}
            </label>
            <label className="flex items-center gap-1.5 text-[12.5px] text-text-muted">
              <input type="checkbox" checked={false} disabled />
              أسلوب الدخل — قيد الإنشاء ⏸
            </label>
          </div>
          {asCostEnabled && approachSettings.costApproachAllowed ? (
            <div className="mb-2 grid max-w-xl gap-2 sm:grid-cols-2">
              <div>
                <Label className={valLabelClassName}>أساس التكلفة</Label>
                <select
                  className={valInputClassName}
                  value={asCostBasis}
                  disabled={saving}
                  onChange={(e) => setAsCostBasis(e.target.value)}
                >
                  <option value="replacement">الإحلال</option>
                  <option value="reproduction">إعادة الإنتاج</option>
                </select>
              </div>
              <div>
                <Label className={valLabelClassName}>وحدة قياس التكلفة</Label>
                <select
                  className={valInputClassName}
                  value={asCostUnit}
                  disabled={saving}
                  onChange={(e) => setAsCostUnit(e.target.value)}
                >
                  <option value="comparison_unit">وحدة المقارنة</option>
                  <option value="quantity_survey">المسح الكمي</option>
                  <option value="lump_sum">المبلغ المقطوع</option>
                  <option value="per_item">كل بند على حدة</option>
                </select>
              </div>
            </div>
          ) : null}
          <div className="mb-2 grid max-w-2xl gap-2 sm:grid-cols-2">
            <div>
              <Label className={valLabelClassName}>الغرض من التقييم *</Label>
              <select
                className={valInputClassName}
                value={asPurpose}
                disabled={saving}
                onChange={(e) => setAsPurpose(e.target.value)}
              >
                <option value="">— اختر —</option>
                {purposeOptions.map((option) => (
                  <option key={option.value} value={option.value}>
                    {option.label}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <Label className={valLabelClassName}>
                توضيح الغرض {asPurpose === "other" ? "(إلزامي)" : "(اختياري)"}
              </Label>
              <Input
                className={valInputClassName}
                value={asPurposeNote}
                disabled={saving}
                onChange={(e) => setAsPurposeNote(e.target.value)}
              />
            </div>
          </div>

          <div className="mb-2 rounded-md border border-border-md bg-surface px-2 py-2">
            <label className="flex items-center gap-1.5 text-[12.5px] text-text">
              <input
                type="checkbox"
                checked={asSpecialistUsed}
                disabled={saving}
                onChange={(e) => setAsSpecialistUsed(e.target.checked)}
              />
              استُعين بأخصائي خارجي في مهمة التقييم (بند الأخصائي — IVS 101)
            </label>
            <p className="mt-1 text-[11px] text-text-muted">
              المقصود أخصائي خارجي يستعين به المقيّم لبعض مهام تقييم العقار (خبير
              تكييف/مساحة/إنشائي…) — <strong>لا</strong> أخصائي الإسناد و<strong>لا</strong>{" "}
              أخصائي دراسة الحالة (دوران داخليان في سير المعاملة). عند «لا» يُطبع بند
              النفي القياسي في الافتراضات؛ وعند «نعم» يحل التوضيح محله ويُرفق تقرير الأخصائي.
            </p>
            {asSpecialistUsed ? (
              <div className="mt-1.5">
                <Label className={valLabelClassName}>
                  التوضيح الإلزامي: الأخصائي، دوره، ونتيجته
                </Label>
                <Input
                  className={valInputClassName}
                  value={asSpecialistDetails}
                  disabled={saving}
                  onChange={(e) => setAsSpecialistDetails(e.target.value)}
                  placeholder="مثال: م. فلان — خبير إنشائي — تقدير العمر الاقتصادي للمبنى"
                />
              </div>
            ) : null}
          </div>

          <div className="mb-2 rounded-md border border-border-md bg-surface px-2 py-2">
            <Label className={valLabelClassName}>تاريخ التقييم — نوعان</Label>
            <div className="mt-1 flex flex-wrap gap-4">
              <label className="flex items-center gap-1.5 text-[12.5px] text-text">
                <input
                  type="radio"
                  name="valuation-date-mode"
                  checked={asDateMode !== "retrospective"}
                  disabled={saving}
                  onChange={() => setAsDateMode("issue")}
                />
                تاريخ إصدار القيمة (آلي — غالباً تاريخ إصدار التقرير)
              </label>
              <label className="flex items-center gap-1.5 text-[12.5px] text-text">
                <input
                  type="radio"
                  name="valuation-date-mode"
                  checked={asDateMode === "retrospective"}
                  disabled={saving}
                  onChange={() => setAsDateMode("retrospective")}
                />
                أثر رجعي (يحدده المقيّم يدوياً)
              </label>
            </div>
            {asDateMode === "retrospective" ? (
              <div className="mt-1.5 grid max-w-xl gap-2 sm:grid-cols-[11rem_1fr]">
                <div>
                  <Label className={valLabelClassName}>التاريخ (إلزامي)</Label>
                  <Input
                    className={valInputClassName}
                    type="date"
                    dir="ltr"
                    value={asRetroDate}
                    disabled={saving}
                    onChange={(e) => setAsRetroDate(e.target.value)}
                  />
                </div>
                <div>
                  <Label className={valLabelClassName}>مبرر الأثر الرجعي (إلزامي)</Label>
                  <Input
                    className={valInputClassName}
                    value={asRetroRationale}
                    disabled={saving}
                    onChange={(e) => setAsRetroRationale(e.target.value)}
                  />
                </div>
              </div>
            ) : null}
          </div>

          <div className="mb-2 rounded-md border border-border-md bg-surface px-2 py-2">
            <Label className={valLabelClassName}>
              الافتراضات الخاصة — انتقاء من مكتبة الإعدادات + إضافة حرة
            </Label>
            {approachSettings.assumptionLibrary.length === 0 ? (
              <p className="mt-1 text-[11px] text-text-muted">
                المكتبة فارغة — يضيف الأدمن بنودها من الإعدادات ⟵ تقرير التقييم.
              </p>
            ) : (
              <div className="mt-1 flex flex-col gap-1">
                {approachSettings.assumptionLibrary.map((clause) => (
                  <label
                    key={clause}
                    className="flex items-start gap-1.5 text-[12px] text-text"
                  >
                    <input
                      type="checkbox"
                      className="mt-0.5"
                      checked={asAssumptions.includes(clause)}
                      disabled={saving}
                      onChange={(e) =>
                        setAsAssumptions((prev) =>
                          e.target.checked
                            ? [...prev, clause]
                            : prev.filter((x) => x !== clause),
                        )
                      }
                    />
                    <span>{clause}</span>
                  </label>
                ))}
              </div>
            )}
            {asAssumptions
              .filter((a) => !approachSettings.assumptionLibrary.includes(a))
              .map((a) => (
                <div
                  key={a}
                  className="mt-1 flex items-center justify-between gap-2 rounded bg-surface-2 px-2 py-1 text-[12px] text-text"
                >
                  <span>{a}</span>
                  <button
                    type="button"
                    className="text-[11px] text-danger"
                    disabled={saving}
                    onClick={() =>
                      setAsAssumptions((prev) => prev.filter((x) => x !== a))
                    }
                  >
                    إزالة
                  </button>
                </div>
              ))}
            <div className="mt-1.5 flex gap-2">
              <Input
                className={valInputClassName}
                placeholder="بند افتراض إضافي (حر)"
                value={asFreeAssumption}
                disabled={saving}
                onChange={(e) => setAsFreeAssumption(e.target.value)}
              />
              <Button
                type="button"
                size="sm"
                disabled={saving || !asFreeAssumption.trim()}
                onClick={() => {
                  const t = asFreeAssumption.trim();
                  if (t && !asAssumptions.includes(t))
                    setAsAssumptions((prev) => [...prev, t]);
                  setAsFreeAssumption("");
                }}
              >
                إضافة
              </Button>
            </div>
          </div>

          <div className="mb-2 flex flex-wrap items-center gap-3">
            <label className="flex items-center gap-1.5 text-[12.5px] text-text">
              <input
                type="checkbox"
                checked={asAdjustUnlocked}
                disabled={saving}
                onChange={(e) => setAsAdjustUnlocked(e.target.checked)}
              />
              صلاحية تحرير التسويات (يضبطها مشرف القسم)
            </label>
            {adjustmentsLocked ? (
              <span className="text-[11.5px] text-danger">
                التسويات مقفلة — الحفظ معطَّل حتى تفعيل الصلاحية
              </span>
            ) : null}
          </div>
          <Button
            type="button"
            size="sm"
            variant="primary"
            disabled={saving}
            onClick={() => void saveApproachSettings()}
          >
            حفظ إعدادات التقييم
          </Button>
          {!settingsSaved ? (
            <p className="mt-2 rounded-md bg-amber-light px-2 py-1.5 text-[11.5px] text-amber-text">
              شاشة 1 تتحكم بباقي الشاشات — احفظ إعدادات تقرير التقييم أولاً لفتح
              أقسام العمل (السوق، التكلفة، الترجيح، بوابات الإصدار).
            </p>
          ) : null}
        </div>
      ) : null}

      {valuationRequestId && selection && marketEnabled ? (
        <div className="mt-2 rounded-lg border border-border-md bg-surface-2 px-3 py-2">
          <EngSection>رأي أسلوب السوق</EngSection>
          <div className="grid max-w-2xl gap-2 sm:grid-cols-[1fr_1fr_auto]">
            <div>
              <Label className={valLabelClassName}>مساحة العقار محل التقييم م²</Label>
              <Input
                className={valInputClassName}
                inputMode="decimal"
                value={subjectArea}
                disabled={saving}
                onChange={(e) => setSubjectArea(e.target.value)}
              />
            </div>
            <div>
              <Label className={valLabelClassName}>الأساس المعتمد في التسويات</Label>
              <select
                className="w-full rounded-md border border-border-md bg-surface px-2 py-[7px] text-[12px]"
                value={adjustmentBasis}
                disabled={saving}
                onChange={(e) => setAdjustmentBasis(e.target.value)}
              >
                <option value="price_per_sqm">سعر متر المقارن (× المساحة)</option>
                <option value="whole_property">قيمة العقار المقارن (دون ضرب في المساحة)</option>
              </select>
            </div>
            <div className="flex items-end">
              <Button
                type="button"
                size="sm"
                variant="primary"
                disabled={saving}
                onClick={() => void saveSubjectArea()}
              >
                حفظ
              </Button>
            </div>
          </div>
          <p className="mt-2 text-[13px] text-text">
            رأي القيمة (سوق):{" "}
            <strong>
              {(selection.marketOpinionValue ?? 0).toLocaleString("ar-SA")} ر.س
            </strong>
          </p>
          <div className="mt-2">
            <div className="mb-1 flex items-center gap-2">
              <Label className={valLabelClassName}>
                تحليل التسويات — آلي متحدث أو محرَّر يدويًا
              </Label>
              <Button
                type="button"
                size="sm"
                variant="outline"
                disabled={saving}
                onClick={() => {
                  const adoptedItems = selection.items.filter((i) => i.isAdopted);
                  const parts = adoptedItems.map((i, idx) => {
                    const m = i.market;
                    return `المقارن ${idx + 1} (${i.comparable.comparablePropertyType}): تسويات تسلسلية ${m?.sumSequentialPct ?? 0}٪ وعوامل اختلاف ${m?.sumDifferencePct ?? 0}٪ بوزن ${m?.effectiveWeightPct ?? 0}٪`;
                  });
                  setAnalysisNotes(
                    `اعتُمد ${adoptedItems.length} مقارنات من بنك العقارات. ` +
                      parts.join("؛ ") +
                      `. بلغ سعر المتر المرجّح ${(selection.weightedPricePerSqm ?? 0).toLocaleString("ar-SA")} ر.س/م² وقيمة العقار بأسلوب السوق ${(selection.marketOpinionValue ?? 0).toLocaleString("ar-SA")} ر.س.`,
                  );
                }}
              >
                توليد مسودة آلية
              </Button>
            </div>
            <textarea
              className="min-h-[72px] w-full resize-y rounded-md border border-border-md bg-surface px-2 py-1.5 text-[12px]"
              value={analysisNotes}
              disabled={saving}
              onChange={(e) => setAnalysisNotes(e.target.value)}
              placeholder="يُحفظ مع زر حفظ رأي أسلوب السوق"
            />
          </div>
        </div>
      ) : null}

      {error ? (
        <p className="mt-2 text-[12.5px] text-danger">{error}</p>
      ) : null}

      {loading ? (
        <p className="mt-2 text-[12.5px] text-text-muted">جاري التحميل…</p>
      ) : null}

      {!loading && selection && marketEnabled && selection.items.length > 0 ? (
        <ul className="mt-3 flex flex-col gap-2">
          {selection.items.map((item) => (
            <li
              key={item.id}
              className="rounded-lg border border-border-md bg-surface px-3 py-2"
            >
              <div className="flex flex-wrap items-start justify-between gap-2">
                <div>
                  <div className="text-[13px] font-medium text-text">
                    {item.comparable.referenceCode} —{" "}
                    {item.comparable.comparablePropertyType}
                  </div>
                  <div className="mt-0.5 text-[12px] text-text-muted">
                    {item.comparable.district}
                    {item.comparable.city ? ` · ${item.comparable.city}` : ""}
                    {" · "}
                    {item.comparable.transactionKindLabelAr}
                    {" · "}
                    {item.comparable.pricePerSqm.toLocaleString("ar-SA")} ر.س/م²
                    {item.market ? (
                      <>
                        {" → "}
                        {(
                          item.market.pricePerSqmAfterDifference ??
                          item.market.pricePerSqmAfterSequential
                        ).toLocaleString("ar-SA")}
                        {" · وزن "}
                        {item.market.effectiveWeightPct}٪
                      </>
                    ) : null}
                  </div>
                  <div className="mt-1 text-[11.5px] text-text-muted">
                    بطاقة المصدر: {sourceCardLine(item.comparable)}
                  </div>
                </div>
                <div className="flex flex-wrap gap-1.5">
                  {item.isAdopted ? (
                    <Button
                      type="button"
                      size="sm"
                      variant="outline"
                      disabled={saving}
                      onClick={() =>
                        setExpandedId((cur) => (cur === item.id ? null : item.id))
                      }
                    >
                      {expandedId === item.id ? "إخفاء التسويات" : "التسويات"}
                    </Button>
                  ) : null}
                  <Button
                    type="button"
                    size="sm"
                    variant={item.isAdopted ? "primary" : "default"}
                    disabled={saving}
                    onClick={() => void adopt(item.comparablePropertyId, !item.isAdopted)}
                  >
                    {item.isAdopted ? "معتمد" : "اعتماد"}
                  </Button>
                  <Button
                    type="button"
                    size="sm"
                    variant="ghost"
                    disabled={saving}
                    onClick={() => void remove(item.comparablePropertyId)}
                  >
                    إزالة
                  </Button>
                </div>
              </div>

              {item.isAdopted && expandedId === item.id && valuationRequestId ? (
                <MarketAdjustEditor
                  item={item}
                  valuationRequestId={valuationRequestId}
                  disabled={saving || adjustmentsLocked}
                  onSaved={reload}
                  factorDefinitions={factorDefinitions}
                />
              ) : null}
            </li>
          ))}
        </ul>
      ) : null}

      {valuationRequestId && marketEnabled ? (
        <>
          <EngSection>اقتراح النظام بالقرب الجغرافي</EngSection>
          <p className="mb-2 text-[12px] text-text-muted">
            مرتبة بالمسافة من إحداثيات المعاينة الميدانية (أو إحداثيات ممرَّرة).
            {proximitySource === "none"
              ? " · لا إحداثيات للعقار — ثبّت موقع المعاينة أولًا."
              : proximitySource === "field_inspection"
                ? " · المصدر: معاينة ميدانية"
                : " · المصدر: استعلام"}
          </p>
          {proximity.length > 0 ? (
            <ul className="mb-3 flex flex-col gap-2">
              {proximity.map((item) => (
                <li
                  key={item.comparable.id}
                  className="flex flex-wrap items-start justify-between gap-2 rounded-lg border border-border-md bg-surface-2 px-3 py-2"
                >
                  <div>
                    <div className="text-[13px] text-text">
                      {item.comparable.referenceCode} —{" "}
                      {item.comparable.comparablePropertyType}
                    </div>
                    <div className="mt-0.5 text-[12px] text-text-muted">
                      {item.distanceKm.toLocaleString("ar-SA")} كم
                      {" · "}
                      {item.comparable.district}
                      {" · "}
                      {item.comparable.pricePerSqm.toLocaleString("ar-SA")} ر.س/م²
                    </div>
                  </div>
                  <button
                    type="button"
                    className={valPrimaryBtnClassName}
                    disabled={saving}
                    onClick={() => void adopt(item.comparable.id, true)}
                  >
                    إضافة واعتماد
                  </button>
                </li>
              ))}
            </ul>
          ) : (
            <p className="mb-3 text-[12.5px] text-text-muted">
              لا اقتراحات ضمن 5 كم (أو لا بيانات إحداثيات).
            </p>
          )}

          <EngSection>من بنك المقارنات</EngSection>
          <div className="mb-2 max-w-sm">
            <Label className={valLabelClassName}>بحث</Label>
            <Input
              className={valInputClassName}
              value={q}
              onChange={(e) => setQ(e.target.value)}
              placeholder="حي / نوع / رقم مرجعي"
            />
          </div>
          <ul className="flex flex-col gap-2">
            {candidates
              .filter((c) => !selectedIds.has(c.id))
              .slice(0, 12)
              .map((comp) => (
                <li
                  key={comp.id}
                  className="flex flex-wrap items-start justify-between gap-2 rounded-lg border border-dashed border-border-md px-3 py-2"
                >
                  <div>
                    <div className="text-[13px] text-text">
                      {comp.referenceCode} — {comp.comparablePropertyType}
                      {/* ق-3: الموسوم يُميَّز بصرياً */}
                      {comp.isExcludedFromSuggestions ? (
                        <span className="mr-2 rounded bg-amber-light px-1.5 py-0.5 text-[10px] text-amber-text">
                          موسوم: {comp.reliabilityTag !== "normal" ? comp.reliabilityTagLabelAr : ""}
                          {comp.isDuplicateTagged ? " مكرر" : ""}
                        </span>
                      ) : null}
                    </div>
                    <div className="mt-0.5 text-[12px] text-text-muted">
                      {comp.district}
                      {" · "}
                      {comp.transactionKindLabelAr}
                      {" · "}
                      {comp.pricePerSqm.toLocaleString("ar-SA")} ر.س/م²
                    </div>
                    <div className="mt-1 text-[11.5px] text-text-muted">
                      بطاقة المصدر: {sourceCardLine(comp)}
                    </div>
                  </div>
                  <button
                    type="button"
                    className={valPrimaryBtnClassName}
                    disabled={saving}
                    onClick={() => void adopt(comp.id, true)}
                  >
                    إضافة واعتماد
                  </button>
                </li>
              ))}
          </ul>
          {candidates.filter((c) => !selectedIds.has(c.id)).length === 0 ? (
            <p className="mt-2 text-[12.5px] text-text-muted">
              لا مرشحين إضافيين — أضف إلى البنك من صفحة بنك المقارنات.
            </p>
          ) : null}
        </>
      ) : null}

      {valuationRequestId && costEnabled ? (
        <div className="mt-3 rounded-lg border border-border-md px-3 py-2">
          <EngSection>أسلوب التكلفة (طريقة المقاول)</EngSection>
          <p className="mb-2 text-[12px] text-text-muted">
            سعر متر الأرض يُستورد من رأي السوق عند الحفظ — لا يُدخل يدويًا.
          </p>
          {cost ? (
            <p className="mb-2 text-[12.5px] text-text">
              سعر المتر المستورد: {cost.landUnitRateFromMarket.toLocaleString("ar-SA")} ر.س/م²
              {" · "}
              مساحة الأرض: {cost.landAreaSqm.toLocaleString("ar-SA")} م²
              {" · "}
              بعد الخصم: {cost.landUnitRateAfterDiscount.toLocaleString("ar-SA")} ر.س/م²
              {" · "}
              قيمة الأرض: {cost.landValueFromMarket.toLocaleString("ar-SA")} ر.س
              {" · "}
              تكلفة مباشرة: {cost.directCostTotal.toLocaleString("ar-SA")} ر.س
              {" · "}
              الإجمالي:{" "}
              <strong>{cost.costOpinionWithLand.toLocaleString("ar-SA")} ر.س</strong>
            </p>
          ) : null}
          <div className="mb-2 grid gap-2 sm:grid-cols-[8rem_1fr_10rem]">
            <div>
              <Label className={valLabelClassName}>خصم تقييد الاستخدام ٪</Label>
              <Input
                className={valInputClassName}
                inputMode="decimal"
                value={useRestrictionPct}
                disabled={saving}
                onChange={(e) => setUseRestrictionPct(e.target.value)}
              />
            </div>
            <div>
              <Label className={valLabelClassName}>
                مبرر الخصم {Number(useRestrictionPct.replace(",", ".")) > 0 ? "(إلزامي)" : ""}
              </Label>
              <Input
                className={valInputClassName}
                value={useRestrictionRationale}
                disabled={saving}
                onChange={(e) => setUseRestrictionRationale(e.target.value)}
                placeholder="إلزامي عند نسبة أكبر من صفر"
              />
            </div>
            <div>
              <Label className={valLabelClassName}>حصة الشقة من الأرض م² (#62)</Label>
              <Input
                className={valInputClassName}
                inputMode="decimal"
                value={apartmentLandShare}
                disabled={saving}
                onChange={(e) => setApartmentLandShare(e.target.value)}
                placeholder="للشقق فقط"
              />
            </div>
          </div>

          <p className="mb-1 mt-3 text-[12px] font-semibold text-text">
            التكاليف غير المباشرة — نسبة 0–50٪ + مبرر لكل بند
          </p>
          <div className="mb-2 grid gap-1.5">
            {INDIRECT_COST_ITEMS.map((item) => (
              <div key={item.key} className="grid gap-2 sm:grid-cols-[14rem_6rem_1fr]">
                <Label className={cn(valLabelClassName, "self-center")}>
                  {item.label}
                </Label>
                <Input
                  className={valInputClassName}
                  inputMode="decimal"
                  value={indirectDraft[item.key]?.pct ?? "0"}
                  disabled={saving}
                  onChange={(e) =>
                    setIndirectDraft((prev) => ({
                      ...prev,
                      [item.key]: {
                        pct: e.target.value,
                        rationale: prev[item.key]?.rationale ?? "",
                      },
                    }))
                  }
                />
                <Input
                  className={valInputClassName}
                  value={indirectDraft[item.key]?.rationale ?? ""}
                  disabled={saving}
                  placeholder="مبرر النسبة"
                  onChange={(e) =>
                    setIndirectDraft((prev) => ({
                      ...prev,
                      [item.key]: {
                        pct: prev[item.key]?.pct ?? "0",
                        rationale: e.target.value,
                      },
                    }))
                  }
                />
              </div>
            ))}
          </div>
          <div className="mb-2 grid gap-2 sm:grid-cols-[10rem_10rem_1fr]">
            <div>
              <Label className={valLabelClassName}>المعدل السنوي للتمويل ٪ (#88)</Label>
              <Input
                className={valInputClassName}
                inputMode="decimal"
                value={financingRate}
                disabled={saving}
                onChange={(e) => setFinancingRate(e.target.value)}
              />
            </div>
            <div>
              <Label className={valLabelClassName}>مدة التنفيذ بالأشهر (#89)</Label>
              <Input
                className={valInputClassName}
                inputMode="numeric"
                value={financingMonths}
                disabled={saving}
                onChange={(e) => setFinancingMonths(e.target.value)}
              />
            </div>
            {cost ? (
              <p className="self-end text-[12px] text-text-muted">
                نسبة التمويل: {cost.financingPct.toLocaleString("ar-SA")}٪ · مجموع غير
                المباشرة: {cost.indirectRatesSumPct.toLocaleString("ar-SA")}٪ · التكلفة
                الإجمالية (#92): {cost.totalCostWithIndirect.toLocaleString("ar-SA")} ر.س
              </p>
            ) : null}
          </div>

          <p className="mb-1 mt-3 text-[12px] font-semibold text-text">
            العمر والإهلاك
          </p>
          <div className="mb-2 grid gap-2 sm:grid-cols-4">
            <div>
              <Label className={valLabelClassName}>العمر الفعلي (سنة)</Label>
              <Input
                className={valInputClassName}
                inputMode="decimal"
                value={actualAge}
                disabled={saving}
                onChange={(e) => setActualAge(e.target.value)}
              />
            </div>
            <div>
              <Label className={valLabelClassName}>العمر الاقتصادي (سنة)</Label>
              <Input
                className={valInputClassName}
                inputMode="decimal"
                value={economicAge}
                disabled={saving}
                onChange={(e) => setEconomicAge(e.target.value)}
              />
            </div>
            <div>
              <Label className={valLabelClassName}>تمديد العمر (سنة)</Label>
              <Input
                className={valInputClassName}
                inputMode="decimal"
                value={lifeExtension}
                disabled={saving}
                onChange={(e) => setLifeExtension(e.target.value)}
              />
            </div>
            <div>
              <Label className={valLabelClassName}>
                بيان أساس التمديد{" "}
                {Number(lifeExtension.replace(",", ".")) > 0 ? "(إلزامي)" : ""}
              </Label>
              <Input
                className={valInputClassName}
                value={lifeExtensionBasis}
                disabled={saving}
                onChange={(e) => setLifeExtensionBasis(e.target.value)}
              />
            </div>
            <div>
              <Label className={valLabelClassName}>التقادم الوظيفي ٪</Label>
              <Input
                className={valInputClassName}
                inputMode="decimal"
                value={functionalObs}
                disabled={saving}
                onChange={(e) => setFunctionalObs(e.target.value)}
              />
            </div>
            <div>
              <Label className={valLabelClassName}>
                مبرر الوظيفي{" "}
                {Number(functionalObs.replace(",", ".")) > 0 ? "(إلزامي)" : ""}
              </Label>
              <Input
                className={valInputClassName}
                value={functionalObsRationale}
                disabled={saving}
                onChange={(e) => setFunctionalObsRationale(e.target.value)}
              />
            </div>
            <div>
              <Label className={valLabelClassName}>التقادم الخارجي ٪</Label>
              <Input
                className={valInputClassName}
                inputMode="decimal"
                value={externalObs}
                disabled={saving}
                onChange={(e) => setExternalObs(e.target.value)}
              />
            </div>
            <div>
              <Label className={valLabelClassName}>
                مبرر الخارجي{" "}
                {Number(externalObs.replace(",", ".")) > 0 ? "(إلزامي)" : ""}
              </Label>
              <Input
                className={valInputClassName}
                value={externalObsRationale}
                disabled={saving}
                onChange={(e) => setExternalObsRationale(e.target.value)}
              />
            </div>
          </div>
          {cost ? (
            <p className="mb-2 text-[12px] text-text-muted">
              العمر الممتد: {cost.extendedLifeYears.toLocaleString("ar-SA")} سنة · التقادم
              المادي:{" "}
              {cost.physicalObsolescencePct != null
                ? `${cost.physicalObsolescencePct.toLocaleString("ar-SA")}٪`
                : "—"}{" "}
              · مجموع التقادم: {cost.totalObsolescencePct.toLocaleString("ar-SA")}٪ · قيمة
              الإهلاك: {cost.depreciationValue.toLocaleString("ar-SA")} ر.س · المباني بعد
              الإهلاك (#101):{" "}
              {cost.buildingsValueAfterDepreciation.toLocaleString("ar-SA")} ر.س
            </p>
          ) : null}
          <div className="mb-2 flex flex-wrap gap-1.5">
            <Button
              type="button"
              size="sm"
              variant="outline"
              disabled={saving}
              onClick={() => void seedCostFromInventory()}
            >
              سحب من حصر المباني
            </Button>
            <Button
              type="button"
              size="sm"
              variant="primary"
              disabled={saving || costDraft.length === 0}
              onClick={() => void saveCost()}
            >
              حفظ التكلفة + استيراد الأرض
            </Button>
          </div>
          <ul className="flex flex-col gap-2">
            {costDraft.map((line, idx) => {
              const patchLine = (patch: Partial<ValuationCostLineDto>) => {
                const next = [...costDraft];
                next[idx] = { ...line, ...patch };
                setCostDraft(next);
              };
              const isRepeated = line.itemKey === "repeated_floors";
              return (
                <li
                  key={line.id}
                  className="grid gap-2 rounded-md bg-surface-2 px-2 py-2"
                >
                  <div className="grid gap-2 sm:grid-cols-[11rem_1fr_5.5rem_5rem_6rem_auto]">
                    <div>
                      <Label className={valLabelClassName}>البند</Label>
                      <select
                        className="w-full rounded-md border border-border-md bg-surface px-2 py-[7px] text-[12px]"
                        value={line.itemKey || "custom"}
                        disabled={saving}
                        onChange={(e) => {
                          const item = COST_ITEM_OPTIONS.find(
                            (o) => o.key === e.target.value,
                          );
                          patchLine({
                            itemKey: e.target.value,
                            unit: item?.unit ?? line.unit,
                            label:
                              e.target.value === "custom"
                                ? line.label
                                : item?.label ?? line.label,
                          });
                        }}
                      >
                        {COST_ITEM_OPTIONS.map((o) => (
                          <option key={o.key} value={o.key}>
                            {o.label}
                          </option>
                        ))}
                      </select>
                    </div>
                    <div>
                      <Label className={valLabelClassName}>التسمية</Label>
                      <Input
                        className={valInputClassName}
                        value={line.label}
                        disabled={saving || line.itemKey !== "custom"}
                        onChange={(e) => patchLine({ label: e.target.value })}
                      />
                    </div>
                    <div>
                      <Label className={valLabelClassName}>الوحدة</Label>
                      <select
                        className="w-full rounded-md border border-border-md bg-surface px-2 py-[7px] text-[12px]"
                        value={line.unit || "sqm"}
                        disabled={saving}
                        onChange={(e) => patchLine({ unit: e.target.value })}
                      >
                        {COST_UNIT_OPTIONS.map((u) => (
                          <option key={u.key} value={u.key}>
                            {u.label}
                          </option>
                        ))}
                      </select>
                    </div>
                    <div>
                      <Label className={valLabelClassName}>
                        {isRepeated ? "الكمية (تُشتق)" : "الكمية"}
                      </Label>
                      <Input
                        className={valInputClassName}
                        inputMode="decimal"
                        value={String(line.areaSqm)}
                        disabled={saving || isRepeated}
                        onChange={(e) =>
                          patchLine({
                            areaSqm: Number(e.target.value.replace(",", ".")) || 0,
                          })
                        }
                      />
                    </div>
                    <div>
                      <Label className={valLabelClassName}>تكلفة الوحدة</Label>
                      <Input
                        className={valInputClassName}
                        inputMode="decimal"
                        value={String(line.unitCostSar)}
                        disabled={saving}
                        onChange={(e) =>
                          patchLine({
                            unitCostSar:
                              Number(e.target.value.replace(",", ".")) || 0,
                          })
                        }
                      />
                    </div>
                    <div className="flex items-end">
                      <Button
                        type="button"
                        size="sm"
                        disabled={saving}
                        onClick={() =>
                          setCostDraft(costDraft.filter((_, i) => i !== idx))
                        }
                      >
                        حذف
                      </Button>
                    </div>
                  </div>
                  <div className="grid gap-2 sm:grid-cols-[8rem_1fr]">
                    {isRepeated ? (
                      <div>
                        <Label className={valLabelClassName}>
                          عدد الأدوار
                        </Label>
                        <Input
                          className={valInputClassName}
                          inputMode="numeric"
                          value={String(line.repeatedFloorCount ?? "")}
                          disabled={saving}
                          onChange={(e) =>
                            patchLine({
                              repeatedFloorCount:
                                Number.parseInt(e.target.value, 10) || null,
                            })
                          }
                        />
                      </div>
                    ) : (
                      <div>
                        <Label className={valLabelClassName}>نسبة البناء ٪</Label>
                        <Input
                          className={valInputClassName}
                          inputMode="decimal"
                          value={String(line.buildRatioPct ?? "")}
                          disabled={saving}
                          onChange={(e) =>
                            patchLine({
                              buildRatioPct: e.target.value.trim()
                                ? Number(e.target.value.replace(",", ".")) || 0
                                : null,
                            })
                          }
                        />
                      </div>
                    )}
                    <div>
                      <Label className={valLabelClassName}>
                        أساس التقدير (مبرر) — للبنود الإضافية
                      </Label>
                      <Input
                        className={valInputClassName}
                        value={line.rationale}
                        disabled={saving}
                        onChange={(e) => patchLine({ rationale: e.target.value })}
                      />
                    </div>
                  </div>
                  {isRepeated ? (
                    <p className="m-0 text-[11px] text-text-muted">
                      الكمية = مسطح الدور الأول × العدد — تُشتق عند الحفظ.
                    </p>
                  ) : null}
                </li>
              );
            })}
          </ul>
          <div className="mt-2">
            <Button
              type="button"
              size="sm"
              variant="outline"
              disabled={saving}
              onClick={() =>
                setCostDraft([
                  ...costDraft,
                  {
                    id: crypto.randomUUID(),
                    sourceInventoryLineId: null,
                    structureKind: "other",
                    itemKey: "custom",
                    itemLabelAr: "",
                    label: "",
                    areaSqm: 0,
                    unit: "sqm",
                    unitLabelAr: "م²",
                    buildRatioPct: null,
                    repeatedFloorCount: null,
                    unitCostSar: 0,
                    lineTotal: 0,
                    rationale: "",
                    isIncluded: true,
                    sortOrder: costDraft.length,
                  },
                ])
              }
            >
              إضافة بند
            </Button>
          </div>
          {costDraft.length === 0 ? (
            <p className="text-[12.5px] text-text-muted">
              لا بنود تكلفة — اسحب من حصر المباني أو أضف لاحقًا.
            </p>
          ) : null}
        </div>
      ) : null}

      {valuationRequestId && settingsSaved ? (
        <div className="mt-3 rounded-lg border border-border-md px-3 py-2">
          <EngSection>رأي القيمة النهائي (ترجيح الأساليب)</EngSection>
          <p className="mb-2 text-[12px] text-text-muted">
            نسب المشاركة = 100٪. أساس وفرضية مستقلان. خصم التصفية فقط
            عند أساس = قيمة التصفية مع فرضية منظمة/قسرية.
            {recon && !recon.meetsMultiMethodGate
              ? " · تنبيه: أسلوب واحد فقط بمشاركة (بوابة n≥2 لاحقًا)."
              : null}
          </p>
          <div className="mb-2 grid max-w-xl gap-2 sm:grid-cols-2">
            <div>
              <Label className={valLabelClassName}>أساس القيمة</Label>
              <select
                className={valInputClassName}
                value={basisOfValueKey}
                disabled={saving}
                onChange={(e) => {
                  const next = e.target.value;
                  setBasisOfValueKey(next);
                  if (next === "liquidation") {
                    if (
                      valuePremiseKey !== "orderly" &&
                      valuePremiseKey !== "forced"
                    ) {
                      setValuePremiseKey("orderly");
                    }
                  } else if (
                    valuePremiseKey === "orderly" ||
                    valuePremiseKey === "forced"
                  ) {
                    setValuePremiseKey("current");
                  }
                }}
              >
                {basisOptions.map((option) => (
                  <option key={option.value} value={option.value}>
                    {option.label}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <Label className={valLabelClassName}>فرضية القيمة</Label>
              <select
                className={valInputClassName}
                value={valuePremiseKey}
                disabled={saving}
                onChange={(e) => setValuePremiseKey(e.target.value)}
              >
                <option value="">— اختر —</option>
                {(premiseOptions.length
                  ? premiseOptions.filter((option) =>
                      basisOfValueKey === "liquidation"
                        ? option.value === "orderly" || option.value === "forced"
                        : option.value === "hau" || option.value === "current",
                    )
                  : basisOfValueKey === "liquidation"
                    ? [
                        { value: "orderly", label: "التصفية المنظمة" },
                        { value: "forced", label: "البيع القسري" },
                      ]
                    : [
                        { value: "hau", label: "أعلى وأفضل استخدام" },
                        { value: "current", label: "الاستخدام الحالي" },
                      ]
                ).map((option) => (
                  <option key={option.value} value={option.value}>
                    {option.label}
                  </option>
                ))}
              </select>
            </div>
          </div>
          {basisOfValueKey === "liquidation" ? (
            <div className="mb-2 grid max-w-xl gap-2 sm:grid-cols-[5rem_1fr]">
              <div>
                <Label className={valLabelClassName}>خصم ٪</Label>
                <Input
                  className={valInputClassName}
                  inputMode="decimal"
                  value={liquidationDiscountPct}
                  disabled={saving}
                  onChange={(e) => setLiquidationDiscountPct(e.target.value)}
                />
              </div>
              <div>
                <Label className={valLabelClassName}>مبرر الخصم</Label>
                <Input
                  className={valInputClassName}
                  value={liquidationDiscountRationale}
                  disabled={saving}
                  onChange={(e) =>
                    setLiquidationDiscountRationale(e.target.value)
                  }
                />
              </div>
            </div>
          ) : null}
          <ul className="mb-2 flex flex-col gap-2">
            {reconMethods.map((m, idx) => (
              <li
                key={m.approachKind}
                className="grid gap-2 rounded-md bg-surface-2 px-2 py-2 sm:grid-cols-[1fr_5rem_1fr]"
              >
                <div>
                  <div className="text-[13px] text-text">{m.labelAr}</div>
                  <div className="text-[11.5px] text-text-muted">
                    {m.approachValue.toLocaleString("ar-SA")} ر.س
                    {" · مقترح "}
                    {m.suggestedWeightPct}٪
                  </div>
                </div>
                <div>
                  <Label className={valLabelClassName}>مشاركة ٪</Label>
                  <Input
                    className={valInputClassName}
                    inputMode="decimal"
                    value={String(m.weightPct)}
                    disabled={saving}
                    onChange={(e) => {
                      const next = [...reconMethods];
                      next[idx] = {
                        ...m,
                        weightPct: Number(e.target.value.replace(",", ".")) || 0,
                        isIncluded: true,
                      };
                      setReconMethods(next);
                    }}
                  />
                </div>
                <div>
                  <Label className={valLabelClassName}>مبرر النسبة</Label>
                  <Input
                    className={valInputClassName}
                    value={m.rationale}
                    disabled={saving}
                    onChange={(e) => {
                      const next = [...reconMethods];
                      next[idx] = { ...m, rationale: e.target.value };
                      setReconMethods(next);
                    }}
                  />
                </div>
              </li>
            ))}
          </ul>
          <div className="mb-2 grid max-w-xl gap-2 sm:grid-cols-[1fr_5rem]">
            <div>
              <Label className={valLabelClassName}>مبرر استخدام الطرق</Label>
              <Input
                className={valInputClassName}
                value={methodsRationale}
                disabled={saving}
                onChange={(e) => setMethodsRationale(e.target.value)}
              />
            </div>
            <div>
              <Label className={valLabelClassName}>خانات التقريب</Label>
              <Input
                className={valInputClassName}
                inputMode="numeric"
                value={finalRoundDecimals}
                disabled={saving}
                onChange={(e) => setFinalRoundDecimals(e.target.value)}
              />
            </div>
          </div>
          {recon ? (
            <p className="mb-2 text-[13px] text-text">
              مرجّح: {recon.weightedValue.toLocaleString("ar-SA")} ر.س
              {recon.liquidationDiscountApplied
                ? ` · قبل الخصم: ${(recon.finalOpinionBeforeLiquidation ?? recon.weightedValue).toLocaleString("ar-SA")} · خصم ${recon.liquidationDiscountPct}٪`
                : ""}
              {" · "}
              الرأي النهائي:{" "}
              <strong>
                {recon.finalOpinionValue.toLocaleString("ar-SA")} ر.س
              </strong>
              {" · "}
              كتابةً: {amountWordsOrZero(recon.finalOpinionValue)}
              {!recon.weightsSumTo100 ? " · الأوزان ≠ 100٪" : ""}
            </p>
          ) : null}
          <Button
            type="button"
            size="sm"
            variant="primary"
            disabled={saving || reconMethods.length === 0}
            onClick={() => void saveReconciliation()}
          >
            حفظ الترجيح والرأي النهائي
          </Button>
        </div>
      ) : null}

      {valuationRequestId && settingsSaved && gates ? (
        <div className="mt-3 rounded-lg border border-border-md px-3 py-2">
          <EngSection>بوابات الإصدار</EngSection>
          <p className="mb-2 text-[12px] text-text-muted">
            تمنع إرسال/إصدار التقرير الأصلي عند الفشل.
            بالتوازي.
          </p>
          <p className="mb-2 text-[13px] text-text">
            الحالة:{" "}
            <strong>
              {gates.allowsIssuance ? "جاهز للإصدار ✓" : "محظور ✗"}
            </strong>
          </p>
          <ul className="flex flex-col gap-1.5">
            {gates.gates.map((g) => (
              <li
                key={g.code}
                className="flex flex-wrap items-baseline gap-2 text-[12.5px]"
              >
                <span className={g.passed ? "text-text" : "text-danger"}>
                  {g.passed ? "✓" : "✗"}
                </span>
                <span className="text-text">{g.labelAr}</span>
                {g.detailAr ? (
                  <span className="text-text-muted">— {g.detailAr}</span>
                ) : null}
                {g.isWarning && g.passed ? (
                  <span className="text-text-muted">(تنبيه 60 يومًا)</span>
                ) : null}
              </li>
            ))}
          </ul>

          {gates.methodologyAlerts?.length ? (
            <div className="mt-3 border-t border-border-md pt-2">
              <p className="mb-1 text-[12.5px] font-medium text-text">
                تنبيهات منهجية — مفعّل{" "}
                {gates.methodologyAlertTriggeredCount ?? 0}/21
              </p>
              <p className="mb-2 text-[11.5px] text-text-muted">
                {gates.methodologyAlertsNoteAr}
              </p>
              {(gates.methodologyAlertTriggeredCount ?? 0) === 0 ? (
                <p className="text-[12px] text-text-muted">لا تنبيهات مفعّلة حاليًا.</p>
              ) : (
                <ul className="flex max-h-64 flex-col gap-2 overflow-y-auto">
                  {gates.methodologyAlerts
                    .filter((a) => a.triggered)
                    .map((a) => {
                      const ov = alertOverrides[a.code] ?? {
                        overrideRationale: a.overrideRationale ?? "",
                        acknowledged: a.acknowledged ?? false,
                      };
                      const severity =
                        a.severityKind ??
                        (a.isHard
                          ? "hard"
                          : a.number === 17 ||
                              [6, 8, 9, 10, 12].includes(a.number)
                            ? "require_rationale"
                            : "require_ack");
                      return (
                        <li
                          key={a.code}
                          className="rounded-md border border-border-md px-2 py-1.5 text-[12px]"
                        >
                          <div className="flex flex-wrap items-baseline gap-2">
                            <span
                              className={
                                a.blocksIssuance !== false && a.isHard
                                  ? "text-danger"
                                  : "text-text-muted"
                              }
                            >
                              {a.isHard
                                ? "حاجب"
                                : severity === "require_rationale"
                                  ? "مبرر"
                                  : "إقرار"}
                            </span>
                            <span className="text-text">
                              {a.number}. {a.labelAr}
                            </span>
                            {a.detailAr ? (
                              <span className="text-text-muted">
                                — {a.detailAr}
                              </span>
                            ) : null}
                          </div>
                          {a.code === "m21_remote_inspection_unapproved" ? (
                            <div className="mt-1">
                              <Button
                                type="button"
                                size="sm"
                                variant="primary"
                                disabled={saving}
                                onClick={() => void approveRemoteScope()}
                              >
                                اعتماد النطاق المكتبي (المقيّم المعتمد)
                              </Button>
                            </div>
                          ) : null}
                          {!a.isHard && severity === "require_rationale" ? (
                            <Input
                              className={`${valInputClassName} mt-1`}
                              placeholder="مبرر نصي إلزامي لتمرير التنبيه"
                              disabled={saving}
                              value={ov.overrideRationale}
                              onChange={(e) =>
                                setAlertOverrides((prev) => ({
                                  ...prev,
                                  [a.code]: {
                                    ...ov,
                                    overrideRationale: e.target.value,
                                  },
                                }))
                              }
                            />
                          ) : null}
                          {!a.isHard && severity === "require_ack" ? (
                            <label className="mt-1 flex items-center gap-2 text-[11.5px] text-text-2">
                              <input
                                type="checkbox"
                                checked={ov.acknowledged}
                                disabled={saving}
                                onChange={(e) =>
                                  setAlertOverrides((prev) => ({
                                    ...prev,
                                    [a.code]: {
                                      ...ov,
                                      acknowledged: e.target.checked,
                                    },
                                  }))
                                }
                              />
                              أقرّ بالمرور مع تسجيل في التدقيق
                            </label>
                          ) : null}
                        </li>
                      );
                    })}
                </ul>
              )}
              <p className="mt-1 text-[11px] text-text-muted">
                غير مُقيَّم بعد (حقول غير مُنمذجة):{" "}
                {gates.methodologyAlerts.filter((a) => !a.evaluated).length}
              </p>
            </div>
          ) : null}

          <div className="mt-2 flex flex-wrap gap-2">
            <Button
              type="button"
              size="sm"
              variant="outline"
              disabled={saving}
              onClick={() => void openReportPreview()}
            >
              استعراض تقرير التقييم على الكليشة المعتمدة
            </Button>
            {reportFields ? (
              <Button
                type="button"
                size="sm"
                variant="outline"
                disabled={saving}
                onClick={() => openValuationReportFieldPreview()}
              >
                عرض حقول تقرير التقييم ({reportFields.filledCount}/{reportFields.catalogCount})
              </Button>
            ) : null}
          </div>
          {reportFields ? (
            <p className="mt-2 text-[12px] text-text-muted">
              تعبئة حقول التقرير: مملوء {reportFields.filledCount} · قابل
              للحل الآن {reportFields.resolvableCount} · مؤجّل {reportFields.deferredCount} ·
              أصول/مرفقات {reportFields.assetCount}
            </p>
          ) : null}
        </div>
      ) : null}
    </div>
  );
}
