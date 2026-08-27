"use client";

import { Fragment, useCallback, useEffect, useMemo, useRef, useState, type CSSProperties, type ReactNode } from "react";
import {
  getApiBase,
  ensureOpenValuationRequestByProperty,
  listComparableProperties,
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
  getBuildingInventory,
  getDifferenceFactorCatalog,
  setValuationComparableAdopted,
  isNoExternalSpecialistAssumption,
  type ComparablePropertyDto,
  type DifferenceFactorDefinitionDto,
  type SaveValuationComparableMarketRequest,
  type ValuationComparableAdjustmentLineDto,
  type ValuationComparableSelectionDto,
  type ValuationComparableSelectionListDto,
  type ValuationApproachSettingsDto,
  type ValuationCostApproachDto,
  type ValuationCostLineDto,
  type ValuationReconciliationDto,
  type ValuationReconciliationMethodDto,
  type ValuationIssuanceGatesDto,
} from "@platform/api-client";
import { getAuthSession } from "@platform/auth-client";
import { cn, useToast } from "@platform/ui-kit";
import {
  VALUE_BASIS_OPTIONS,
  basisOfValueKeyForAssignment,
  valuationPurposeKeyForAssignment,
} from "@platform/app-shared/prototype/assignment-valuation-defaults";
import { amountWordsOrZero } from "../../../lib/evaluator/value-estimation";
import { openValuationReportPreview } from "../../../lib/evaluator/valuation-report-preview";
import { AdjustmentsMatrix } from "./AdjustmentsMatrix";

/* ─── design tokens — نقرأ متغيرات النظام مباشرة كي تطابق الشاشات هوية إجادة (والوضع الداكن). */
const C = {
  page: "var(--bg)",
  card: "var(--surface)",
  border: "var(--border)",
  borderStrong: "var(--border-md)",
  gold: "var(--gold)",
  goldSoft: "var(--gold-soft)",
  goldText: "var(--gold-d)",
  /* نص العناوين — يتبدّل للفاتح في الوضع الداكن؛ التعبئات الكحلية تستخدم var(--ink) مباشرة. */
  ink: "var(--heading)",
  inkFill: "var(--ink)",
  muted: "var(--text-2)",
  faint: "var(--text-3)",
  soft: "var(--surface-2)",
  softAlt: "var(--surface-2)",
  body: "var(--text-1)",
  danger: "var(--red)",
  dangerText: "var(--red-text)",
} as const;

const LAND_WITHIN_COST = "land_within_cost";
const MARKET_CONTEXT = "market";
/** مواصفة النموذج التفاعلي: «N من ٥ معتمدة». */
const MAX_ADOPTED_COMPARABLES = 5;

const SEQUENTIAL_KEYS = new Set(["financing", "market", "transaction_type"]);
const AUTO_AREA_KEYS = new Set(["area"]);
const DEFAULT_DIFFERENCE_KEYS = new Set([
  "ideal_area",
  "location",
  "attraction",
  "access",
  "street_count",
  "street_lengths",
]);

const STANDARD_FACTORS: { factorKey: string; labelAr: string }[] = [
  { factorKey: "financing", labelAr: "تسوية شروط التمويل" },
  { factorKey: "market", labelAr: "تسوية ظروف السوق" },
  { factorKey: "transaction_type", labelAr: "تسوية نوع المقارن" },
  { factorKey: "area", labelAr: "المساحة" },
  { factorKey: "ideal_area", labelAr: "المساحة المثالية" },
  { factorKey: "location", labelAr: "الموقع" },
  { factorKey: "attraction", labelAr: "عامل الجذب للموقع" },
  { factorKey: "access", labelAr: "سهولة الوصول" },
  { factorKey: "street_count", labelAr: "عدد الشوارع" },
  { factorKey: "street_lengths", labelAr: "أطوال الشوارع" },
];

const INDIRECT_COST_ITEMS: { key: string; label: string }[] = [
  { key: "design_supervision", label: "التصميم والإشراف الهندسي" },
  { key: "licensing_fees", label: "الترخيص والرسوم الحكومية" },
  { key: "project_management", label: "إدارة المشروع" },
  { key: "utilities_connection", label: "توصيل الخدمات" },
  { key: "contingency", label: "مخصص الطوارئ" },
  { key: "developer_profit", label: "أرباح المطور والمخاطرة" },
];

const COST_ITEM_OPTIONS: { key: string; label: string; unit: string }[] = [
  { key: "basement", label: "القبو", unit: "sqm" },
  { key: "ground_floor", label: "الدور الأرضي", unit: "sqm" },
  { key: "first_floor", label: "الدور الأول", unit: "sqm" },
  { key: "repeated_floors", label: "الأدوار المتكررة", unit: "sqm" },
  { key: "upper_annex", label: "الملحق العلوي", unit: "sqm" },
  { key: "lower_annex", label: "الملحق الأرضي", unit: "sqm" },
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

/** مجموعة ١ — مسطحات المبنى والأدوار (تقبل نسبة البناء وتدخل في مسطحات البناء). */
const COST_GROUP1_KEYS = new Set([
  "basement",
  "ground_floor",
  "first_floor",
  "repeated_floors",
  "upper_annex",
  "lower_annex",
  "apartment_area",
  "shared_portion",
]);

function costGroupOf(line: ValuationCostLineDto): "area" | "extra" {
  // بند مخصص يرث مجموعته من structureKind (floor = مسطحات) — كما في النموذج التفاعلي.
  if (line.itemKey === "custom") {
    return line.structureKind === "floor" ? "area" : "extra";
  }
  return COST_GROUP1_KEYS.has(line.itemKey) ? "area" : "extra";
}

/**
 * حساب البند محلياً بقواعد النموذج التفاعلي: الأدوار المتكررة تُشتق من مسطح الدور
 * الأول × العدد وترث سعر متره عند تركه فارغاً؛ نسبة البناء تُطبَّق على بنود م².
 */
function costLineComputed(
  line: ValuationCostLineDto,
  all: ValuationCostLineDto[],
) {
  const firstFloor = all.find((l) => l.itemKey === "first_floor");
  const isRepeated = line.itemKey === "repeated_floors";
  const isLump = (line.unit || "sqm") === "lump";
  const base = isRepeated
    ? (firstFloor?.areaSqm ?? 0) * Math.max(0, line.repeatedFloorCount ?? 0)
    : line.areaSqm;
  const inArea = costGroupOf(line) === "area";
  const bp = line.buildRatioPct;
  const usesPct = inArea && (line.unit || "sqm") === "sqm";
  const qty =
    usesPct && bp != null && Number.isFinite(bp)
      ? (base * Math.min(Math.max(bp, 0), 100)) / 100
      : base;
  const inherited =
    isRepeated && (!line.unitCostSar || line.unitCostSar <= 0) &&
    (firstFloor?.unitCostSar ?? 0) > 0;
  const uc = inherited ? firstFloor!.unitCostSar : Math.max(0, line.unitCostSar);
  return {
    qty,
    uc,
    total: line.isIncluded !== false ? qty * uc : 0,
    rawTotal: qty * uc,
    inherited,
    isRepeated,
    isLump,
    inArea,
    usesPct,
  };
}

type ScreenId = "basic" | "market" | "cost" | "final";

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
  onExternalSpecialistUsedChange?: (used: boolean) => void;
  property?: ValuationWorkPropertyHint;
};

function apiConfig() {
  const session = getAuthSession();
  if (!session?.token) return null;
  return { token: session.token, baseUrl: getApiBase() };
}

function fmt(n: number | null | undefined, digits = 0): string {
  if (n == null || !Number.isFinite(n)) return "—";
  // أرقام لاتينية موحّدة مع بقية النظام (بطاقة العقار، جدول التسويات، التقارير).
  return n.toLocaleString("en-US", {
    maximumFractionDigits: digits,
    minimumFractionDigits: digits > 0 ? Math.min(digits, 2) : 0,
  });
}

function sourceCardLine(comp: ComparablePropertyDto): string {
  const card = comp.sourceCard;
  return [
    card.intakeChannelLabelAr,
    card.freshnessLabelAr,
    card.fromPriorDeal ? "من معاملات سابقة" : null,
    card.sourceWorkOrderNumber ? `أمر ${card.sourceWorkOrderNumber}` : null,
  ]
    .filter(Boolean)
    .join(" · ");
}

function isVacantLandComparable(type: string | null | undefined): boolean {
  const t = (type ?? "").trim();
  if (!t) return false;
  if (/فيلا|شقة|مبنى|دور|villa|apartment|building/i.test(t)) return false;
  return /أرض|ارض|فضاء|land/i.test(t);
}

/** مواصفة النموذج التفاعلي: النسبة = الأكبر ÷ الأصغر (≥ ١)؛ ≥ ٢ تعني طريقة المضاعف وتُلوَّن حمراء. */
function areaRatioValue(
  subjectArea: number | null | undefined,
  compArea: number,
): number | null {
  if (!subjectArea || !compArea || subjectArea <= 0 || compArea <= 0) return null;
  return Math.max(subjectArea, compArea) / Math.min(subjectArea, compArea);
}

function areaRatio(
  subjectArea: number | null | undefined,
  compArea: number,
): string {
  const r = areaRatioValue(subjectArea, compArea);
  return r == null ? "—" : r.toFixed(2);
}

/* ─── shared UI atoms ─── */
function Card({
  children,
  className,
  style,
}: {
  children: ReactNode;
  className?: string;
  style?: CSSProperties;
}) {
  return (
    <div
      className={cn("mb-5 overflow-hidden", className)}
      style={{
        background: C.card,
        border: `1px solid ${C.border}`,
        borderRadius: "var(--radius-lg)",
        boxShadow: "var(--shadow)",
        ...style,
      }}
    >
      {children}
    </div>
  );
}

function CardPad({ children }: { children: ReactNode }) {
  return <div style={{ padding: "18px 22px 22px" }}>{children}</div>;
}

function CardTitle({ children }: { children: ReactNode }) {
  return (
    <div
      style={{
        fontWeight: 800,
        fontSize: 14.5,
        color: C.ink,
        marginBottom: 16,
      }}
    >
      {children}
    </div>
  );
}

function FieldLabel({ children }: { children: ReactNode }) {
  return (
    <span style={{ fontWeight: 500, fontSize: 11.5, color: C.muted }}>
      {children}
    </span>
  );
}

const inputStyle: CSSProperties = {
  padding: "10px 12px",
  border: `1px solid ${C.borderStrong}`,
  borderRadius: "var(--radius)",
  background: C.soft,
  color: C.body,
  fontWeight: 600,
  fontSize: 13,
  width: "100%",
};

const thStyle: CSSProperties = {
  padding: "13px 16px",
  textAlign: "center",
  fontWeight: 700,
  fontSize: 12,
  color: C.ink,
  background: C.soft,
  borderBottom: `2px solid ${C.gold}`,
  whiteSpace: "nowrap",
};

const tdStyle: CSSProperties = {
  padding: "12px 16px",
  textAlign: "center",
  borderBottom: `1px solid ${C.border}`,
  fontSize: 12.5,
  color: C.body,
};

/** HTML `.grid` cols — finance-ui.css comparable bank table. */
const BANK_COLS =
  "70px minmax(132px,1.1fr) minmax(100px,.9fr) minmax(122px,1fr) 112px minmax(96px,.85fr) minmax(108px,.95fr) 92px 88px minmax(84px,.75fr) minmax(128px,1.15fr)";

/** صف دفتر القيمة (invoiceRows) — تسمية وملاحظة يميناً وقيمة يساراً. */
function LedgerRow({
  label,
  note,
  value,
  valueColor,
  strong,
}: {
  label: string;
  note?: string;
  value: string;
  valueColor?: string;
  strong?: boolean;
}) {
  return (
    <div
      style={{
        display: "flex",
        alignItems: "center",
        justifyContent: "space-between",
        gap: 10,
        padding: "11px 16px",
        borderBottom: `1px solid ${C.border}`,
        background: strong ? C.soft : C.card,
      }}
    >
      <div>
        <div
          style={{
            fontWeight: strong ? 800 : 700,
            fontSize: 12.5,
            color: C.ink,
          }}
        >
          {label}
        </div>
        {note ? (
          <div style={{ fontSize: 10.5, color: C.faint, marginTop: 2 }}>
            {note}
          </div>
        ) : null}
      </div>
      <span
        dir="ltr"
        style={{
          fontWeight: 800,
          fontSize: strong ? 15 : 13.5,
          color: valueColor ?? C.ink,
        }}
      >
        {value}
      </span>
    </div>
  );
}

function BankTh({
  children,
  start,
  highlight,
}: {
  children: ReactNode;
  start?: boolean;
  highlight?: boolean;
}) {
  return (
    <div
      className={cn(
        "flex min-w-0 items-center overflow-hidden text-ellipsis whitespace-nowrap px-4 py-3.5 text-[12px] font-bold text-heading",
        start ? "justify-start text-start" : "justify-center text-center",
        highlight && "bg-gold-soft",
      )}
    >
      {children}
    </div>
  );
}

function BankTd({
  children,
  start,
  highlight,
  className,
}: {
  children?: ReactNode;
  start?: boolean;
  highlight?: boolean;
  className?: string;
}) {
  return (
    <div
      className={cn(
        "flex min-w-0 items-center overflow-hidden px-4 py-3.5",
        start ? "justify-start text-start" : "justify-center text-center",
        highlight && "bg-gold-soft",
        className,
      )}
    >
      {children}
    </div>
  );
}

function ToggleChip({
  active,
  onClick,
  children,
  disabled,
}: {
  active: boolean;
  onClick: () => void;
  children: ReactNode;
  disabled?: boolean;
}) {
  return (
    <button
      type="button"
      disabled={disabled}
      onClick={onClick}
      style={{
        padding: "9px 15px",
        border: `1px solid ${active ? C.gold : C.borderStrong}`,
        borderRadius: "var(--radius)",
        background: active ? C.goldSoft : C.card,
        color: active ? C.goldText : C.muted,
        fontWeight: 700,
        fontSize: 12,
        cursor: disabled ? "not-allowed" : "pointer",
        opacity: disabled ? 0.55 : 1,
        transition: "background .15s, color .15s, border-color .15s",
      }}
    >
      {children}
    </button>
  );
}

function PrimaryBtn({
  children,
  onClick,
  disabled,
}: {
  children: ReactNode;
  onClick: () => void;
  disabled?: boolean;
}) {
  return (
    <button
      type="button"
      disabled={disabled}
      onClick={onClick}
      style={{
        display: "inline-flex",
        alignItems: "center",
        gap: 7,
        padding: "10px 16px",
        border: "none",
        borderRadius: "var(--radius)",
        background: C.inkFill,
        color: "#fff",
        fontWeight: 700,
        fontSize: 13,
        cursor: disabled ? "not-allowed" : "pointer",
        opacity: disabled ? 0.55 : 1,
        boxShadow: "var(--shadow)",
        transition: "background .15s",
      }}
    >
      {children}
    </button>
  );
}

function GhostBtn({
  children,
  onClick,
  disabled,
}: {
  children: ReactNode;
  onClick: () => void;
  disabled?: boolean;
}) {
  return (
    <button
      type="button"
      disabled={disabled}
      onClick={onClick}
      style={{
        display: "inline-flex",
        alignItems: "center",
        gap: 7,
        height: 36,
        padding: "0 13px",
        border: `1px solid ${C.borderStrong}`,
        borderRadius: "var(--radius)",
        background: C.card,
        color: C.muted,
        fontWeight: 500,
        fontSize: 12.5,
        cursor: disabled ? "not-allowed" : "pointer",
        opacity: disabled ? 0.55 : 1,
      }}
    >
      {children}
    </button>
  );
}

function buildFactorRows(
  adopted: ValuationComparableSelectionDto[],
): { factorKey: string; labelAr: string }[] {
  // الصفوف من البيانات الفعلية — بند تسلسلي محذوف (تمويل/نوع) يبقى محذوفاً
  // حتى تستعيده شريحة «↺ استعادة»، ولا يُعاد فرضه هنا.
  const map = new Map<string, string>();
  const first = adopted[0]?.market?.adjustmentLines;
  if (first?.length) {
    for (const line of first) {
      map.set(
        line.factorKey,
        line.labelAr ||
          STANDARD_FACTORS.find((f) => f.factorKey === line.factorKey)?.labelAr ||
          line.factorKey,
      );
    }
  } else {
    for (const f of STANDARD_FACTORS) map.set(f.factorKey, f.labelAr);
  }
  for (const item of adopted) {
    for (const line of item.market?.adjustmentLines ?? []) {
      if (!map.has(line.factorKey)) map.set(line.factorKey, line.labelAr);
    }
  }
  return Array.from(map.entries()).map(([factorKey, labelAr]) => ({
    factorKey,
    labelAr,
  }));
}

function linePercent(
  item: ValuationComparableSelectionDto,
  factorKey: string,
): number {
  const line = item.market?.adjustmentLines?.find((l) => l.factorKey === factorKey);
  if (line) return line.percent;
  if (factorKey === "area") return item.market?.suggestedAreaAdjustmentPct ?? 0;
  return 0;
}

function ensureLinesForSave(
  item: ValuationComparableSelectionDto,
  factorKey: string,
  percent: number,
  factors: { factorKey: string; labelAr: string }[],
): ValuationComparableAdjustmentLineDto[] {
  const existing = item.market?.adjustmentLines ?? [];
  const byKey = new Map(existing.map((l) => [l.factorKey, { ...l }]));
  for (const f of factors) {
    if (!byKey.has(f.factorKey)) {
      byKey.set(f.factorKey, {
        id: crypto.randomUUID(),
        factorKey: f.factorKey,
        labelAr: f.labelAr,
        percent: f.factorKey === "area" ? (item.market?.suggestedAreaAdjustmentPct ?? 0) : 0,
        rationale: "",
        isIncluded: true,
        sortOrder: byKey.size,
      });
    }
  }
  const target = byKey.get(factorKey);
  if (target) {
    target.percent =
      factorKey === "area"
        ? (item.market?.suggestedAreaAdjustmentPct ?? percent)
        : percent;
    target.isIncluded = true;
    // الإدخال الصريح يلغي حالة «مقترح» لهذا البند.
    target.isSuggestedValue = false;
  }
  return Array.from(byKey.values()).map((l, i) => ({ ...l, sortOrder: i }));
}

/**
 * تجهيز سطر تسوية للحفظ: المساحة تُثبَّت على المقترح الآلي، والقيم «المقترحة»
 * (نوع المقارن غير المُدخل) تُعاد صفراً حتى لا يتحول المقترح إلى إدخال يدوي دائم.
 */
function lineForSave(
  item: ValuationComparableSelectionDto,
  l: ValuationComparableAdjustmentLineDto,
  i: number,
) {
  return {
    id: l.id,
    factorKey: l.factorKey,
    labelAr: l.labelAr,
    percent:
      l.factorKey === "area"
        ? (item.market?.suggestedAreaAdjustmentPct ?? l.percent)
        : l.isSuggestedValue
          ? 0
          : l.percent,
    rationale: l.rationale,
    descriptionAr: l.descriptionAr ?? null,
    isIncluded: l.isIncluded,
    sortOrder: i,
  };
}

/** جسم حفظ التسويات مع الحفاظ على الوزن وتجاوزات compEdit الحالية. */
function marketSaveBody(
  item: ValuationComparableSelectionDto,
  lines: ReturnType<typeof lineForSave>[],
  extra?: Partial<SaveValuationComparableMarketRequest>,
) {
  return {
    adjustmentLines: lines,
    weightIsManual: item.market?.weightIsManual ?? false,
    weightPct: item.market?.weightIsManual ? item.market.weightPct ?? null : null,
    weightOverrideRationale: item.market?.weightOverrideRationale ?? null,
    areaAdjustmentMethod: item.market?.areaAdjustmentMethod ?? null,
    priceOverrideSar: item.priceOverrideSar ?? null,
    areaOverrideSqm: item.areaOverrideSqm ?? null,
    ...extra,
  };
}

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
  onExternalSpecialistUsedChange,
  property,
}: ValuationWorkShellProps) {
  const { showToast } = useToast();
  const onFinalOpinionChangeRef = useRef(onFinalOpinionChange);
  onFinalOpinionChangeRef.current = onFinalOpinionChange;
  const onExternalSpecialistUsedChangeRef = useRef(onExternalSpecialistUsedChange);
  onExternalSpecialistUsedChangeRef.current = onExternalSpecialistUsedChange;
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
  const [q, setQ] = useState("");
  const [subjectArea, setSubjectArea] = useState("");
  const [adjustmentBasis, setAdjustmentBasis] = useState("price_per_sqm");
  const [analysisNotes, setAnalysisNotes] = useState("");
  const [factorDefinitions, setFactorDefinitions] = useState<Record<string, string>>({});
  const [catalogFactorOptions, setCatalogFactorOptions] = useState<
    { factorKey: string; labelAr: string }[]
  >([]);
  const [matrixDraft, setMatrixDraft] = useState<Record<string, string>>({});
  const [weightDraft, setWeightDraft] = useState<Record<string, string>>({});
  const [rationaleDraft, setRationaleDraft] = useState<Record<string, string>>({});
  /** compEdit: مسودات تعديل سعر/مساحة المقارن في بنك المقارنات. */
  const [bankEditDraft, setBankEditDraft] = useState<Record<string, string>>({});
  /** compSpec: مسودات وصف المقارن لكل خلية عامل. */
  const [descriptionDraft, setDescriptionDraft] = useState<Record<string, string>>({});
  /** subjSpec: مسودات وصف العقار محل التقييم لكل عامل. */
  const [subjectSpecDraft, setSubjectSpecDraft] = useState<Record<string, string>>({});
  /** مبررات جدول أرض التكلفة — مستقلة عن مبررات أسلوب السوق (جدولان مستقلان). */
  const [landRationaleDraft, setLandRationaleDraft] = useState<Record<string, string>>({});
  /** سحب بند تكلفة لإعادة ترتيبه داخل مجموعته (drag-to-reorder من النموذج التفاعلي). */
  const [dragCostId, setDragCostId] = useState<string | null>(null);

  const [approachSettings, setApproachSettings] =
    useState<ValuationApproachSettingsDto | null>(null);
  const [asMarketEnabled, setAsMarketEnabled] = useState(true);
  const [asCostEnabled, setAsCostEnabled] = useState(true);
  const [asCostBasis, setAsCostBasis] = useState("replacement");
  /** نطاق التقييم بالتكلفة: land_and_building | building_only (مواصفة النموذج التفاعلي). */
  const [asCostScope, setAsCostScope] = useState("land_and_building");
  const [asCostUnit, setAsCostUnit] = useState("comparison_unit");
  const [asPurpose, setAsPurpose] = useState(() =>
    valuationPurposeKeyForAssignment(assignmentType),
  );
  const [asPurposeNote, setAsPurposeNote] = useState("");
  const [asSpecialistUsed, setAsSpecialistUsed] = useState(false);
  const [asSpecialistDetails, setAsSpecialistDetails] = useState("");
  const [asDateMode, setAsDateMode] = useState("issue");
  const [asRetroDate, setAsRetroDate] = useState("");
  const [asRetroRationale, setAsRetroRationale] = useState("");
  const [asAssumptions, setAsAssumptions] = useState<string[]>([]);
  const [asFreeAssumption, setAsFreeAssumption] = useState("");

  const [cost, setCost] = useState<ValuationCostApproachDto | null>(null);
  const [costDraft, setCostDraft] = useState<ValuationCostLineDto[]>([]);
  const [useRestrictionPct, setUseRestrictionPct] = useState("0");
  const [useRestrictionRationale, setUseRestrictionRationale] = useState("");
  const [apartmentLandShare, setApartmentLandShare] = useState("");
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
  /** تحليل التكلفة — فارغ = يتولّد آلياً من المبررات (نموذج «مقترح حتى يُحرَّر»). */
  const [costAnalysisNotes, setCostAnalysisNotes] = useState("");

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

  const officialValuationDate =
    asDateMode === "retrospective" && asRetroDate.trim()
      ? asRetroDate
      : null;
  const valDate = officialValuationDate ?? "عند الاعتماد";

  useEffect(() => {
    onExternalSpecialistUsedChangeRef.current?.(asSpecialistUsed);
  }, [asSpecialistUsed]);

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

  useEffect(() => {
    const config = apiConfig();
    if (!config) return;
    void getValuationLists(config).then((res) => {
      if (!res.ok) return;
      const bases = activeValuationListOptions(res.data.lists, "valueBases");
      const premises = activeValuationListOptions(res.data.lists, "premises");
      if (bases.length) setBasisOptions(bases);
      if (premises.length) setPremiseOptions(premises);
    });
  }, []);

  const reload = useCallback(async (opts?: { silent?: boolean }) => {
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
        setReconMethods([]);
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
    const bankP = listComparableProperties(config, {
      q: q || undefined,
      district: districtHint || property?.district || undefined,
      take: 40,
      forPropertyId: propertyId.trim() || undefined,
    });
    const costP = getValuationCostApproach(config, requestId);
    const reconP = getValuationReconciliation(config, requestId);
    const gatesP = getValuationIssuanceGates(config, requestId);
    const settingsP = getValuationApproachSettings(config, requestId);

    void landP.then((landSelRes) =>
      setLandSelection(landSelRes.ok ? landSelRes.data : null),
    );
    void bankP.then((bankRes) => {
      if (bankRes.ok) setCandidates(bankRes.data);
    });
    void gatesP.then((gatesRes) => setGates(gatesRes.ok ? gatesRes.data : null));

    const [selRes, costRes, reconRes, settingsRes] = await Promise.all([
      selP,
      costP,
      reconP,
      settingsP,
    ]);

    setLoading(false);

    if (settingsRes.ok) {
      setApproachSettings(settingsRes.data);
      if (hydrateEdits) {
      setAsMarketEnabled(settingsRes.data.marketApproachEnabled);
      setAsCostEnabled(settingsRes.data.costApproachEnabled);
      setAsCostBasis(settingsRes.data.costBasisKey || "replacement");
      setAsCostScope(settingsRes.data.costScopeKey || "land_and_building");
      setAsCostUnit(settingsRes.data.costMeasurementUnitKey || "comparison_unit");
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
      const loadedAssumptions = settingsRes.data.selectedAssumptions ?? [];
      setAsAssumptions(
        settingsRes.data.externalSpecialistUsed
          ? loadedAssumptions.filter((x) => !isNoExternalSpecialistAssumption(x))
          : loadedAssumptions,
      );
      }
    } else {
      setApproachSettings(null);
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
      // المسودات متفرقة: تحمل ما كتبه المستخدم فقط والعرض يعود لقيم الخادم عند غيابها —
      // لا بذر شامل يعيد كتابة الحقول ويحجب القيم المقترحة المتجددة.
      setMatrixDraft({});
      setWeightDraft({});
      setRationaleDraft({});
      setBankEditDraft({});
      setDescriptionDraft({});
      setSubjectSpecDraft({});
      setLandRationaleDraft({});
    }

    if (costRes.ok) {
      setCost(costRes.data);
      if (hydrateEdits) {
      setCostDraft(costRes.data.lines);
      setCostAnalysisNotes(costRes.data.analysisNotes ?? "");
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
      }
    } else {
      setCost(null);
      setCostDraft([]);
    }

    if (reconRes.ok) {
      setRecon(reconRes.data);
      if (!hydrateEdits) {
        // صامت: حدّث قيم الأساليب المحسوبة وأبقِ أوزان/مبررات المستخدم كما هي.
        const serverMethods = reconRes.data.methods;
        setReconMethods((prev) =>
          serverMethods.map((m) => {
            const mine = prev.find((p) => p.approachKind === m.approachKind);
            return mine
              ? {
                  ...m,
                  weightPct: mine.weightPct,
                  rationale: mine.rationale,
                  isIncluded: mine.isIncluded,
                }
              : m;
          }),
        );
      } else {
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
      }
      if (
        typeof reconRes.data.finalOpinionValue === "number" &&
        reconRes.data.finalOpinionValue > 0
      ) {
        onFinalOpinionChangeRef.current?.(reconRes.data.finalOpinionValue);
      }
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
  }, [
    propertyId,
    districtHint,
    q,
    assignmentType,
    property?.area,
    property?.district,
    property?.propertyType,
  ]);

  const reloadRef = useRef(reload);
  reloadRef.current = reload;

  // Initial + property identity — avoid re-running when parent passes a new callback each render.
  useEffect(() => {
    valuationRequestIdRef.current = null;
    void reloadRef.current();
  }, [propertyId]);

  // Soft refresh when bank search query changes (no full-screen blank).
  useEffect(() => {
    if (!valuationRequestId) return;
    const t = window.setTimeout(() => {
      void reloadRef.current({ silent: true });
    }, 280);
    return () => window.clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps -- only react to search text
  }, [q]);

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
      const just = (rationaleDraft[f.factorKey] ?? line?.rationale ?? "").trim();
      bullets.push(`• ${f.labelAr || f.factorKey} — ${just || "لم يتم تبريره"}`);
    }
    const weightJust = (
      rationaleDraft["weight"] ??
      adoptedMarket[0]?.market?.weightOverrideRationale ??
      ""
    ).trim();
    bullets.push(`• الوزن النسبي — ${weightJust || "لم يتم تبريره"}`);
    return `مبررات التسويات:\n${bullets.join("\n")}`;
  }, [adoptedMarket, factorRows, rationaleDraft]);
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
    return rows;
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
    return rows;
  }, [landSelection, candidates, landSelectedIds]);

  const subjectAreaNum = Number(subjectArea.replace(",", ".")) || null;

  const navItems: { id: ScreenId; label: string; badge?: number; show: boolean }[] =
    [
      { id: "basic", label: "البيانات الأساسية", show: true },
      {
        id: "market",
        label: "طريقة المقارنة",
        badge: selection?.adoptedCount,
        show: asMarketEnabled,
      },
      {
        id: "cost",
        label: "طريقة المقاول",
        show:
          asCostEnabled && (approachSettings?.costApproachAllowed ?? true),
      },
      { id: "final", label: "رأي القيمة النهائي", show: true },
    ];

  useEffect(() => {
    const visible = navItems.filter((n) => n.show).map((n) => n.id);
    if (!visible.includes(screen)) {
      setScreen(visible[0] ?? "basic");
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps -- re-gate when toggles flip
  }, [asMarketEnabled, asCostEnabled, approachSettings?.costApproachAllowed]);

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
      case "market":
        return {
          crumbMid: "أسلوب السوق",
          crumbLast: "طريقة المقارنة",
          title: "التقييم بطريقة المقارنة",
          barMainLabel: "القيمة النهائية للعقار",
          barMainValue: `${fmt(selection?.marketOpinionValue)} ر.س`,
          barSubLabel: "قيمة المتر المرجحة",
          barSubValue: `${fmt(selection?.weightedPricePerSqm)} ر.س/م²`,
        };
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
      default:
        return {
          crumbMid: "التوفيق",
          crumbLast: "رأي القيمة النهائي",
          title: "رأي القيمة النهائي",
          barMainLabel: "الرأي النهائي",
          barMainValue: `${fmt(recon?.finalOpinionValue)} ر.س`,
          barSubLabel: "بعد التقريب",
          barSubValue: amountWordsOrZero(recon?.finalOpinionValue ?? 0),
        };
    }
  }, [screen, displayId, settingsSaved, selection, cost, recon]);

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
      await reload({ silent: true }); // تراجع للحالة الحقيقية
      return;
    }
    await reload({ silent: true }); // توفيق الأوزان والاقتراحات
  }

  async function remove(compId: string, context: string = MARKET_CONTEXT) {
    const config = apiConfig();
    if (!config || !valuationRequestId) return;
    setSaving(true);
    const res = await removeValuationComparableSelection(
      config,
      valuationRequestId,
      compId,
      context,
    );
    setSaving(false);
    if (!res.ok) {
      showToast("تعذّر إزالة المقارن", "error");
      return;
    }
    await reload({ silent: true });
  }

  async function saveApproachSettings() {
    const config = apiConfig();
    if (!config || !valuationRequestId) return;
    setSaving(true);
    const res = await saveValuationApproachSettings(config, valuationRequestId, {
      marketApproachEnabled: asMarketEnabled,
      costApproachEnabled: asCostEnabled && (approachSettings?.costApproachAllowed ?? true),
      incomeApproachEnabled: false,
      costBasisKey: asCostBasis,
      costScopeKey: asCostScope,
      costMeasurementUnitKey: asCostUnit,
      adjustmentsEditUnlocked: true,
      valuationPurposeKey:
        valuationPurposeKeyForAssignment(assignmentType) || asPurpose || null,
      valuationPurposeNote: asPurposeNote.trim() || null,
      externalSpecialistUsed: asSpecialistUsed,
      externalSpecialistDetails: asSpecialistDetails.trim() || null,
      valuationDateMode: asDateMode,
      retrospectiveDate: asDateMode === "retrospective" ? asRetroDate || null : null,
      retrospectiveRationale:
        asDateMode === "retrospective" ? asRetroRationale.trim() || null : null,
      selectedAssumptions: asSpecialistUsed
        ? asAssumptions.filter((x) => !isNoExternalSpecialistAssumption(x))
        : asAssumptions,
    });
    setSaving(false);
    if (!res.ok) {
      showToast(res.message ?? "تعذّر حفظ إعدادات التقييم", "error");
      return;
    }
    showToast("تم حفظ إعدادات التقييم", "success");
    await reload({ silent: true });
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
  ) {
    const config = apiConfig();
    if (!config || !valuationRequestId || adjustmentsLocked) return;
    const key = `${item.id}:${factorKey}`;
    const raw = matrixDraft[key];
    const percent = Number(String(raw ?? "0").replace(",", ".")) || 0;
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
      return;
    }
    // المسودة أدّت غرضها — قيمة الخادم القانونية تعرض بعد التحديث الصامت.
    setMatrixDraft((prev) => {
      const next = { ...prev };
      delete next[key];
      return next;
    });
    await reload({ silent: true });
  }

  /** compEdit: حفظ تجاوز سعر/مساحة المقارن لهذا التقييم فقط — لا يمس البنك المشترك. */
  async function saveBankOverride(
    item: ValuationComparableSelectionDto,
    field: "price" | "area",
    raw: string,
  ) {
    const config = apiConfig();
    if (!config || !valuationRequestId) return;
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
      return;
    }
    setBankEditDraft((prev) => {
      const next = { ...prev };
      delete next[`${item.id}:${field}`];
      return next;
    });
    await reload({ silent: true });
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
    await reload({ silent: true });
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
      await reload({ silent: true });
      return;
    }
    await reload({ silent: true });
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
      await reload({ silent: true });
      return;
    }
    await reload({ silent: true });
  }

  async function saveAllMatrix() {
    for (const item of adoptedMarket) {
      for (const f of factorRows) {
        if (AUTO_AREA_KEYS.has(f.factorKey)) continue;
        await saveMatrixCell(item, f.factorKey);
      }
    }
    showToast("تم حفظ جدول التسويات", "success");
  }

  async function saveWeight(item: ValuationComparableSelectionDto) {
    const config = apiConfig();
    if (!config || !valuationRequestId || adjustmentsLocked) return;
    const pct = Number((weightDraft[item.id] ?? "0").replace(",", ".")) || 0;
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
          ((contextOfItem(item) === LAND_WITHIN_COST
            ? landRationaleDraft
            : rationaleDraft)["weight"] ?? "")
            .trim() ||
          item.market?.weightOverrideRationale ||
          null,
      }),
    );
    setSaving(false);
    if (!res.ok) {
      showToast(res.message ?? "تعذّر حفظ الوزن", "error");
      return;
    }
    setWeightDraft((prev) => {
      const next = { ...prev };
      delete next[item.id];
      return next;
    });
    await reload({ silent: true });
  }

  async function resetWeights(context: string = MARKET_CONTEXT) {
    const config = apiConfig();
    if (!config || !valuationRequestId || adjustmentsLocked) return;
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
      await reload({ silent: true });
      return;
    }
    // امسح مسودات الأوزان حتى تظهر الاقتراحات الآلية الجديدة.
    setWeightDraft({});
    showToast("أُعيد ضبط الأوزان للاقتراح الآلي", "success");
    await reload({ silent: true });
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
    context: string = MARKET_CONTEXT,
  ) {
    const config = apiConfig();
    if (!config || !valuationRequestId || adjustmentsLocked) return;
    const drafts =
      context === LAND_WITHIN_COST ? landRationaleDraft : rationaleDraft;
    const text = (drafts[factorKey] ?? "").trim();
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
      await reload({ silent: true });
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
    await reload({ silent: true });
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
    await reload({ silent: true });
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
      await reload({ silent: true });
      return;
    }
    showToast("أُضيف عامل الاختلاف", "success");
    await reload({ silent: true });
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
      await reload({ silent: true });
      return;
    }
    showToast("حُذف عامل الاختلاف", "success");
    await reload({ silent: true });
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
              ? /علوي|upper/i.test(l.label ?? "")
                ? "upper_annex"
                : "lower_annex"
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
      refreshLandFromLandComps: true,
      analysisNotes: costAnalysisNotes.trim() || null,
      useRestrictionDiscountPct: Number(useRestrictionPct.replace(",", ".")) || 0,
      useRestrictionRationale: useRestrictionRationale.trim() || null,
      apartmentLandShareSqm: apartmentLandShare.trim()
        ? Number(apartmentLandShare.replace(",", ".")) || 0
        : null,
      indirectItems: INDIRECT_COST_ITEMS.filter(
        (item) =>
          Number((indirectDraft[item.key]?.pct ?? "0").replace(",", ".")) > 0 ||
          (indirectDraft[item.key]?.rationale ?? "").trim() !== "",
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
    showToast("تم حفظ أسلوب التكلفة", "success");
    void reload();
  }

  async function saveReconciliation() {
    const config = apiConfig();
    if (!config || !valuationRequestId) return;
    setSaving(true);
    const res = await saveValuationReconciliation(config, valuationRequestId, {
      // النص الآلي يُثبَّت عند الحفظ ما لم يحرره المقيّم (نموذج «آلي حتى يُحرَّر»).
      methodsRationale: methodsRationale.trim() || finalComputed.opinionAuto,
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
    setLiquidationDiscountRationale(res.data.liquidationDiscountRationale ?? "");
    if (
      typeof res.data.finalOpinionValue === "number" &&
      res.data.finalOpinionValue > 0
    ) {
      onFinalOpinionChangeRef.current?.(res.data.finalOpinionValue);
    }
    showToast(
      res.data.liquidationDiscountApplied
        ? "تم حفظ رأي القيمة مع خصم التصفية"
        : "تم حفظ رأي القيمة النهائي",
      "success",
    );
    // تحديث بوابات الإصدار والتنبيهات بعد الحفظ (المعالجات تدخل في التقييم فوراً).
    void reload({ silent: true });
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
      showToast("تعذّر فتح استعراض تقرير التقييم", "error");
    }
  }

  /* ─── حساب رأي القيمة الحي (مواصفة النموذج التفاعلي) ─── */
  const finalComputed = useMemo(() => {
    const buildingOnlyScope =
      (approachSettings?.costScopeKey ?? "land_and_building") === "building_only";
    const weightSumLocal = reconMethods.reduce((s, m) => s + (m.weightPct || 0), 0);
    const reconWeightsBad =
      reconMethods.length >= 2 && Math.round(weightSumLocal) !== 100;
    // مواصفة النموذج التفاعلي: القيم كما هي (قد تكون جزئية أو سالبة) — الاعتماد هو الحاجز.
    const weightedLocal =
      reconMethods.length === 0
        ? 0
        : reconMethods.length === 1
          ? reconMethods[0].approachValue
          : reconMethods.reduce(
              (s, m) => s + m.approachValue * ((m.weightPct || 0) / 100),
              0,
            );

    // اكتمال المؤشرات كما في النموذج: السوق = مقارن معتمد؛ التكلفة = بنود + عمر ممتد (+ أرض ما لم يكن «مبنى فقط»).
    const costBuildReady =
      (cost?.lines?.length ?? 0) > 0 &&
      (cost?.directCostTotal ?? 0) > 0 &&
      (cost?.extendedLifeYears ?? 0) > 0;
    const costComplete = buildingOnlyScope
      ? costBuildReady
      : costBuildReady && !!cost?.landEstimateComplete;
    const marketComplete = adoptedMarket.length > 0;
    const methodComplete = (kind: string) =>
      kind === "cost" ? costComplete : marketComplete;
    const isLiquidation = basisOfValueKey === "liquidation";
    const discountPctNum = isLiquidation
      ? Number(liquidationDiscountPct.replace(",", ".")) || 0
      : 0;
    const forcedCut = (weightedLocal * discountPctNum) / 100;
    const decNum = Math.min(
      Math.max(Number.parseInt(finalRoundDecimals, 10) || 0, 0),
      6,
    );
    const roundPow = 10 ** decNum;
    const finalLocal =
      Math.round((weightedLocal - forcedCut) / roundPow) * roundPow;
    const roundNote =
      decNum === 0
        ? "بلا تقريب — أقرب ريال"
        : `مقرَّبة لأقرب ${fmt(roundPow)} ريال`;
    const soleCost =
      reconMethods.length === 1 && reconMethods[0]?.approachKind === "cost";

    // buildOpinion — النص الآلي للرأي النهائي.
    const basisLabel =
      basisOptions.find((o) => o.value === basisOfValueKey)?.label ??
      basisOfValueKey;
    const linesOut: string[] = [];
    if (!reconMethods.length) {
      linesOut.push("لم يُختَر أي أسلوب تقييم بعد.");
    } else if (reconMethods.length === 1) {
      if (soleCost && !buildingOnlyScope) {
        linesOut.push(
          "اعتُمد أسلوب التكلفة. قُدّرت قيمة الأرض بطريقة المقارنات باعتبارها فضاء، وقُدّرت قيمة التحسينات بطريقة المقاول على أساس تكلفة الإحلال ناقصاً الإهلاك، والقيمة النهائية هي حاصل جمعهما. ولم يجرِ توفيق بين مؤشرات القيمة لاعتماد أسلوب واحد.",
        );
      } else if (soleCost) {
        linesOut.push(
          "اعتُمد أسلوب التكلفة بنطاق «مبنى فقط»؛ القيمة = تكلفة الإحلال ناقصاً الإهلاك. ولم يجرِ توفيق بين مؤشرات القيمة لاعتماد أسلوب واحد.",
        );
      } else {
        linesOut.push(
          "اعتُمد أسلوب السوق وحده، وقُدّرت القيمة بطريقة المقارنات. ولم يجرِ توفيق بين مؤشرات القيمة لاعتماد أسلوب واحد.",
        );
      }
      linesOut.push(
        `مؤشر ${reconMethods[0].labelAr}: ${fmt(reconMethods[0].approachValue)} ر.س بوزن ١٠٠٪.`,
      );
    } else {
      for (const m of reconMethods) {
        linesOut.push(
          `مؤشر ${m.labelAr}: ${fmt(m.approachValue)} ر.س بوزن ${m.weightPct}٪.`,
        );
        if ((m.rationale ?? "").trim())
          linesOut.push(`مبرر وزن ${m.labelAr}: ${m.rationale.trim()}.`);
      }
    }
    if (discountPctNum > 0)
      linesOut.push(`طُبِّق خصم بيع قسري ${discountPctNum}٪.`);
    linesOut.push(`أساس القيمة المستخدم: ${basisLabel}.`);
    linesOut.push(`الرأي النهائي في قيمة العقار: ${fmt(finalLocal)} ر.س.`);

    return {
      buildingOnlyScope,
      weightSumLocal,
      reconWeightsBad,
      weightedLocal,
      isLiquidation,
      discountPctNum,
      forcedCut,
      finalLocal,
      roundNote,
      soleCost,
      methodComplete,
      opinionAuto: linesOut.join("\n"),
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps -- cost/adoptedMarket feed completeness flags
  }, [
    approachSettings?.costScopeKey,
    reconMethods,
    basisOfValueKey,
    liquidationDiscountPct,
    finalRoundDecimals,
    basisOptions,
    cost,
    adoptedMarket,
  ]);

  /* ─── screens ─── */
  function renderBasic() {
    const isLandKind = approachSettings?.isLandPropertyType ?? false;
    return (
      <>
        {/* بيانات العقار محل التقييم — مواصفة النموذج التفاعلي */}
        <Card>
          <CardPad>
            <CardTitle>بيانات العقار محل التقييم</CardTitle>
            <div
              style={{
                display: "grid",
                gridTemplateColumns: "repeat(3, 1fr)",
                gap: 14,
              }}
            >
              <label style={{ display: "flex", flexDirection: "column", gap: 6 }}>
                <FieldLabel>مساحة الأرض (م²)</FieldLabel>
                <input
                  dir="ltr"
                  value={subjectArea}
                  onChange={(e) =>
                    setSubjectArea(e.target.value.replace(/[^\d.]/g, ""))
                  }
                  onBlur={() => void saveSubjectArea()}
                  style={{ ...inputStyle, textAlign: "center" }}
                />
                <span style={{ fontSize: 10.5, color: C.faint }}>
                  أساس المقارنة وتسوية المساحة في أسلوب السوق
                </span>
              </label>
              <div>
                <FieldLabel>نوع العقار</FieldLabel>
                <div
                  style={{
                    marginTop: 6,
                    fontWeight: 700,
                    fontSize: 13.5,
                    color: C.ink,
                  }}
                >
                  {approachSettings?.propertyType || "—"}
                </div>
                <span style={{ fontSize: 10.5, color: C.faint }}>
                  من أمر العمل — «أرض» تعطّل أسلوب التكلفة (ق-3)
                </span>
              </div>
              <div>
                <FieldLabel>المدينة / الحي</FieldLabel>
                <div
                  style={{
                    marginTop: 6,
                    fontWeight: 700,
                    fontSize: 13.5,
                    color: C.ink,
                  }}
                >
                  {[property?.city, property?.district ?? districtHint]
                    .filter(Boolean)
                    .join(" · ") || "—"}
                </div>
                <span style={{ fontSize: 10.5, color: C.faint }}>
                  تاريخ التقييم: {officialValuationDate ?? "عند الاعتماد"}
                </span>
              </div>
            </div>
          </CardPad>
        </Card>

        {/* أساس القيمة المستخدم */}
        <Card>
          <CardPad>
            <CardTitle>أساس القيمة المستخدم</CardTitle>
            <p style={{ fontSize: 11.5, color: C.goldText, marginBottom: 10 }}>
              خصم البيع القسري لا يُفعَّل إلا مع «قيمة التصفية».
            </p>
            <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
              {basisOptions.map((o) => (
                <ToggleChip
                  key={o.value}
                  active={basisOfValueKey === o.value}
                  disabled={saving}
                  onClick={() => {
                    setBasisOfValueKey(o.value);
                    if (o.value === "liquidation") {
                      if (
                        valuePremiseKey !== "orderly" &&
                        valuePremiseKey !== "forced"
                      )
                        setValuePremiseKey("forced");
                    } else {
                      // اختيار أساس غير التصفية يصفّر خصم البيع القسري.
                      setLiquidationDiscountPct("0");
                      if (
                        valuePremiseKey === "orderly" ||
                        valuePremiseKey === "forced"
                      )
                        setValuePremiseKey("current");
                    }
                  }}
                >
                  {o.label}
                </ToggleChip>
              ))}
            </div>
            <p style={{ fontSize: 10.5, color: C.faint, marginTop: 10 }}>
              يُثبَّت الأساس مع حفظ رأي القيمة النهائي.
            </p>
          </CardPad>
        </Card>

        <Card>
          <CardPad>
            <CardTitle>أساليب وطرق التقييم المستخدمة</CardTitle>
            {!approachSettings?.costApproachAllowed ? (
              <p style={{ fontSize: 11.5, color: C.goldText, marginBottom: 12 }}>
                ق-3: أرض بلا إنشاءات — أسلوب التكلفة لا ينطبق.
              </p>
            ) : null}
            <div
              style={{
                display: "grid",
                gridTemplateColumns: "repeat(3, 1fr)",
                gap: 12,
                marginBottom: 16,
              }}
            >
              <label
                style={{
                  display: "flex",
                  alignItems: "flex-start",
                  gap: 10,
                  padding: "13px 14px",
                  border: `1px solid ${asMarketEnabled ? C.gold : C.borderStrong}`,
                  borderRadius: 10,
                  background: asMarketEnabled ? C.goldSoft : C.card,
                  cursor: "pointer",
                }}
              >
                <input
                  type="checkbox"
                  checked={asMarketEnabled}
                  onChange={(e) => setAsMarketEnabled(e.target.checked)}
                  style={{ width: 17, height: 17, accentColor: C.ink, marginTop: 2 }}
                />
                <div>
                  <div style={{ fontWeight: 700, fontSize: 12.5, color: C.ink }}>
                    أسلوب السوق
                  </div>
                  <div style={{ fontWeight: 400, fontSize: 11, color: C.faint, marginTop: 3 }}>
                    طريقة المقارنة — يقارن العقار كوحدة غير مجزّأة بصفقات مشابهة
                  </div>
                </div>
              </label>
              <label
                style={{
                  display: "flex",
                  alignItems: "flex-start",
                  gap: 10,
                  padding: "13px 14px",
                  border: `1px solid ${
                    asCostEnabled && approachSettings?.costApproachAllowed
                      ? C.gold
                      : C.borderStrong
                  }`,
                  borderRadius: 10,
                  background:
                    asCostEnabled && approachSettings?.costApproachAllowed
                      ? C.goldSoft
                      : C.card,
                  cursor: approachSettings?.costApproachAllowed
                    ? "pointer"
                    : "not-allowed",
                  opacity: approachSettings?.costApproachAllowed ? 1 : 0.55,
                }}
              >
                <input
                  type="checkbox"
                  checked={asCostEnabled && !!approachSettings?.costApproachAllowed}
                  disabled={saving || !approachSettings?.costApproachAllowed}
                  onChange={(e) => setAsCostEnabled(e.target.checked)}
                  style={{ width: 17, height: 17, accentColor: C.ink, marginTop: 2 }}
                />
                <div>
                  <div style={{ fontWeight: 700, fontSize: 12.5, color: C.ink }}>
                    أسلوب التكلفة
                  </div>
                  <div style={{ fontWeight: 400, fontSize: 11, color: C.faint, marginTop: 3 }}>
                    {isLandKind && !approachSettings?.costApproachAllowed
                      ? "لا ينطبق: الأرض لا تُقيَّم بالتكلفة"
                      : "أسلوب مركّب إلزامياً: قيمة الأرض بالمقارنات + تكلفة الإحلال ناقصاً الإهلاك — لا يُلغى أحد المكوّنين منفرداً"}
                  </div>
                </div>
              </label>
              <label
                title="قيد الإنشاء — غير متاح بعد"
                style={{
                  display: "flex",
                  alignItems: "flex-start",
                  gap: 10,
                  padding: "13px 14px",
                  border: `1px solid ${C.borderStrong}`,
                  borderRadius: 10,
                  background: C.card,
                  cursor: "not-allowed",
                  opacity: 0.55,
                }}
              >
                <input
                  type="checkbox"
                  checked={false}
                  disabled
                  style={{ width: 17, height: 17, marginTop: 2 }}
                />
                <div>
                  <div style={{ fontWeight: 700, fontSize: 12.5, color: C.ink }}>
                    أسلوب الدخل
                  </div>
                  <div style={{ fontWeight: 400, fontSize: 11, color: C.faint, marginTop: 3 }}>
                    قيد الإنشاء — غير متاح بعد
                  </div>
                </div>
              </label>
            </div>

            {asCostEnabled && approachSettings?.costApproachAllowed ? (
              <p style={{ fontSize: 11.5, color: C.goldText, marginBottom: 12 }}>
                طريقة المقاول تستلزم تقييم أرض المبنى بطريقة المقارنة.
              </p>
            ) : null}

            {asCostEnabled && approachSettings?.costApproachAllowed ? (
              <div
                style={{
                  borderTop: `1px solid ${C.border}`,
                  paddingTop: 16,
                  marginBottom: 16,
                }}
              >
                <FieldLabel>نطاق التقييم بالتكلفة</FieldLabel>
                <div style={{ display: "flex", gap: 8, flexWrap: "wrap", margin: "8px 0 6px" }}>
                  <ToggleChip
                    active={asCostScope !== "building_only"}
                    disabled={saving}
                    onClick={() => setAsCostScope("land_and_building")}
                  >
                    أرض ومبنى
                  </ToggleChip>
                  <ToggleChip
                    active={asCostScope === "building_only"}
                    disabled={saving}
                    onClick={() => setAsCostScope("building_only")}
                  >
                    مبنى فقط
                  </ToggleChip>
                </div>
                <p style={{ fontSize: 10.5, color: C.faint, margin: "0 0 14px" }}>
                  {asCostScope === "building_only"
                    ? "«مبنى فقط» يخفي قسم تقدير الأرض ويجعل مؤشر الأسلوب = تكلفة الإحلال ناقصاً الإهلاك."
                    : "«أرض ومبنى» يستلزم تقدير الأرض بالمقارنات داخل أسلوب التكلفة."}
                </p>
                <FieldLabel>طريقة تقدير التكلفة</FieldLabel>
                <div style={{ display: "flex", gap: 8, flexWrap: "wrap", margin: "8px 0 6px" }}>
                  <ToggleChip
                    active={asCostBasis === "replacement"}
                    disabled={saving}
                    onClick={() => setAsCostBasis("replacement")}
                  >
                    الإحلال
                  </ToggleChip>
                  <ToggleChip
                    active={asCostBasis === "reproduction"}
                    disabled={saving}
                    onClick={() => setAsCostBasis("reproduction")}
                  >
                    إعادة الإنتاج
                  </ToggleChip>
                </div>
                <p style={{ fontSize: 10.5, color: C.faint, margin: "0 0 14px" }}>
                  {asCostBasis === "reproduction"
                    ? "تكلفة إنتاج نسخة طبق الأصل بالمواد والتصميم نفسيهما — تُستخدم للمباني التراثية والخاصة."
                    : "تكلفة إنشاء بديل بمنفعة مكافئة بمواد وطرق اليوم."}
                </p>
                <FieldLabel>وحدة قياس التكلفة</FieldLabel>
                <div style={{ display: "flex", gap: 8, flexWrap: "wrap", marginTop: 8 }}>
                  {(
                    [
                      ["comparison_unit", "وحدة المقارنة"],
                      ["quantity_survey", "المسح الكمي"],
                      ["lump_sum", "المبلغ المقطوع"],
                      ["per_item", "كل بند على حدة"],
                    ] as const
                  ).map(([k, label]) => (
                    <ToggleChip
                      key={k}
                      active={asCostUnit === k}
                      disabled={saving}
                      onClick={() => setAsCostUnit(k)}
                    >
                      {label}
                    </ToggleChip>
                  ))}
                </div>
              </div>
            ) : null}

            <div style={{ marginBottom: 14 }}>
              <FieldLabel>تاريخ التقييم — نوعان</FieldLabel>
              <div style={{ display: "flex", gap: 16, marginTop: 8, flexWrap: "wrap" }}>
                <label style={{ display: "flex", alignItems: "center", gap: 6, fontSize: 12.5 }}>
                  <input
                    type="radio"
                    checked={asDateMode !== "retrospective"}
                    onChange={() => setAsDateMode("issue")}
                  />
                  تاريخ إصدار القيمة
                </label>
                <label style={{ display: "flex", alignItems: "center", gap: 6, fontSize: 12.5 }}>
                  <input
                    type="radio"
                    checked={asDateMode === "retrospective"}
                    onChange={() => setAsDateMode("retrospective")}
                  />
                  أثر رجعي
                </label>
              </div>
              {asDateMode === "retrospective" ? (
                <div
                  style={{
                    display: "grid",
                    gridTemplateColumns: "11rem 1fr",
                    gap: 10,
                    marginTop: 10,
                  }}
                >
                  <input
                    type="date"
                    dir="ltr"
                    value={asRetroDate}
                    onChange={(e) => setAsRetroDate(e.target.value)}
                    style={inputStyle}
                  />
                  <input
                    placeholder="مبرر الأثر الرجعي"
                    value={asRetroRationale}
                    onChange={(e) => setAsRetroRationale(e.target.value)}
                    style={{ ...inputStyle, fontWeight: 500 }}
                  />
                </div>
              ) : null}
            </div>

            <label
              style={{
                display: "flex",
                alignItems: "center",
                gap: 8,
                fontSize: 12.5,
                marginBottom: 8,
              }}
            >
              <input
                type="checkbox"
                className="size-4 shrink-0 cursor-pointer accent-[var(--ink)]"
                checked={asSpecialistUsed}
                onChange={(e) => {
                  const used = e.target.checked;
                  setAsSpecialistUsed(used);
                  if (used) {
                    setAsAssumptions((prev) =>
                      prev.filter((x) => !isNoExternalSpecialistAssumption(x)),
                    );
                    return;
                  }
                  const clause = approachSettings?.assumptionLibrary?.find(
                    isNoExternalSpecialistAssumption,
                  );
                  if (clause) {
                    setAsAssumptions((prev) =>
                      prev.includes(clause) ? prev : [...prev, clause],
                    );
                  }
                }}
                style={{ accentColor: C.ink }}
              />
              استُعين بأخصائي خارجي (IVS 101)
            </label>
            {asSpecialistUsed ? (
              <input
                placeholder="الأخصائي، دوره، ونتيجته"
                value={asSpecialistDetails}
                onChange={(e) => setAsSpecialistDetails(e.target.value)}
                style={{ ...inputStyle, fontWeight: 500, marginBottom: 14 }}
              />
            ) : null}

            {(approachSettings?.assumptionLibrary?.length ?? 0) > 0 ? (
              <div style={{ marginBottom: 14 }}>
                <FieldLabel>الافتراضات الخاصة</FieldLabel>
                <div className="mt-2 overflow-hidden rounded-[var(--radius)] border border-border">
                  {approachSettings!.assumptionLibrary
                    .filter(
                      (clause) =>
                        !asSpecialistUsed || !isNoExternalSpecialistAssumption(clause),
                    )
                    .map((clause) => (
                    <label
                      key={clause}
                      className="flex cursor-pointer items-start gap-2.5 border-b border-border bg-surface px-3 py-2.5 text-[12.5px] leading-relaxed text-text transition-colors last:border-b-0 hover:bg-row-hover"
                    >
                      <input
                        type="checkbox"
                        className="mt-0.5 size-4 shrink-0 cursor-pointer accent-[var(--ink)]"
                        checked={asAssumptions.includes(clause)}
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
                <div style={{ display: "flex", gap: 8, marginTop: 8 }}>
                  <input
                    placeholder="بند افتراض إضافي"
                    value={asFreeAssumption}
                    onChange={(e) => setAsFreeAssumption(e.target.value)}
                    style={{ ...inputStyle, fontWeight: 500, flex: 1 }}
                  />
                  <GhostBtn
                    disabled={saving || !asFreeAssumption.trim()}
                    onClick={() => {
                      const t = asFreeAssumption.trim();
                      if (
                        t &&
                        !asAssumptions.includes(t) &&
                        !(asSpecialistUsed && isNoExternalSpecialistAssumption(t))
                      )
                        setAsAssumptions((prev) => [...prev, t]);
                      setAsFreeAssumption("");
                    }}
                  >
                    إضافة
                  </GhostBtn>
                </div>
              </div>
            ) : null}

            <PrimaryBtn disabled={saving} onClick={() => void saveApproachSettings()}>
              حفظ إعدادات التقييم
            </PrimaryBtn>
            {!settingsSaved ? (
              <p
                style={{
                  marginTop: 12,
                  padding: "8px 10px",
                  borderRadius: "var(--radius)",
                  background: "var(--amber-light)",
                  color: "var(--amber-text)",
                  fontSize: 11.5,
                }}
              >
                احفظ إعدادات التقييم أولاً لفتح شاشات العمل (السوق، التكلفة، الترجيح).
              </p>
            ) : null}
          </CardPad>
        </Card>
      </>
    );
  }

  function renderBankTable(
    rows: typeof bankRows,
    context: string,
    subjectSqm: number | null,
  ) {
    const adoptedCount =
      context === MARKET_CONTEXT
        ? selection?.adoptedCount ?? 0
        : landSelection?.adoptedCount ?? 0;
    return (
      <>
        <div className="mb-3 flex flex-wrap items-center justify-between gap-2.5">
          <div className="flex items-center gap-2.5">
            <h2 className="m-0 text-[17px] font-extrabold text-heading">
              بنك المقارنات
            </h2>
            <span className="inline-flex items-center rounded-md bg-gold-soft px-2.5 py-[3px] text-[12px] font-bold text-gold-d">
              {adoptedCount} من {MAX_ADOPTED_COMPARABLES} معتمدة
            </span>
            <span className="hidden text-[11.5px] text-text-3 md:inline">
              لا حدّ زمني على المقارنات المخزّنة — تسوية ظروف السوق تعالج فارق الزمن
            </span>
          </div>
          {context === MARKET_CONTEXT ? (
            <input
              placeholder="بحث حي / نوع / رقم مرجعي"
              value={q}
              onChange={(e) => setQ(e.target.value)}
              className="w-[248px] rounded-lg border border-border-md bg-surface px-3.5 py-2 text-[13px] font-medium text-text outline-none transition-[border-color,box-shadow] placeholder:text-text-3 focus:border-gold focus:shadow-[0_0_0_3px_color-mix(in_srgb,var(--gold)_22%,transparent)]"
            />
          ) : (
            <span className="text-[12px] text-text-3">
              أراضٍ فضاء فقط — لا استيراد من أسلوب السوق
            </span>
          )}
        </div>
        <Card style={{ marginBottom: 24 }}>
          <div className="overflow-x-auto rounded-xl">
            <div className="min-w-[1180px]">
              <div
                className="grid border-b-2 border-gold bg-surface-2"
                style={{ gridTemplateColumns: BANK_COLS }}
              >
                <BankTh start>اعتماد</BankTh>
                <BankTh>الرقم المرجعي</BankTh>
                <BankTh>نوع العقار</BankTh>
                <BankTh>نوع المقارن</BankTh>
                <BankTh>تاريخ المقارن</BankTh>
                <BankTh highlight>سعر المتر</BankTh>
                <BankTh>سعر العقار</BankTh>
                <BankTh>المساحة (م²)</BankTh>
                <BankTh>نسبة المساحة</BankTh>
                <BankTh>الحي</BankTh>
                <BankTh>المصدر</BankTh>
              </div>
              {rows.map((row) => (
                <div
                  key={row.key}
                  className={cn(
                    "grid min-h-[58px] items-center border-b border-border transition-colors duration-100 last:border-b-0 hover:bg-row-hover",
                    row.adopted && "bg-gold-soft",
                  )}
                  style={{ gridTemplateColumns: BANK_COLS }}
                >
                  <BankTd start>
                    <input
                      type="checkbox"
                      checked={row.adopted}
                      onChange={(e) =>
                        void adopt(row.comp.id, e.target.checked, context)
                      }
                      className="size-[17px] cursor-pointer accent-[var(--ink)]"
                    />
                    {row.selected && !row.adopted ? (
                      <button
                        type="button"
                        title="إزالة من الاختيار"
                        disabled={saving}
                        onClick={() => void remove(row.comp.id, context)}
                        className="ms-2 cursor-pointer border-0 bg-transparent text-[14px] text-text-3"
                      >
                        ×
                      </button>
                    ) : null}
                  </BankTd>
                  <BankTd>
                    <span
                      dir="ltr"
                      className="text-[13.5px] font-bold text-gold-d"
                    >
                      {row.comp.referenceCode}
                    </span>
                  </BankTd>
                  <BankTd>
                    <span className="text-[13px] text-text">
                      {row.comp.comparablePropertyType}
                    </span>
                  </BankTd>
                  <BankTd>
                    <span className="inline-flex items-center rounded-md border border-border-md bg-surface-2 px-[11px] py-[3px] text-[12px] font-medium text-text-2">
                      {row.comp.transactionKindLabelAr}
                    </span>
                  </BankTd>
                  <BankTd>
                    <span dir="ltr" className="text-[13px] text-text-2">
                      {row.comp.transactionDate?.slice(0, 10) || "—"}
                    </span>
                  </BankTd>
                  <BankTd highlight>
                    <span
                      dir="ltr"
                      className="text-[14px] font-extrabold text-heading"
                    >
                      {fmt(row.item?.effectivePricePerSqm ?? row.comp.pricePerSqm)}
                    </span>
                  </BankTd>
                  <BankTd>
                    {row.item ? (
                      <input
                        dir="ltr"
                        type="text"
                        title="سعر العقار الإجمالي — تجاوز لهذا التقييم فقط، لا يمس بنك المقارنات"
                        value={
                          bankEditDraft[`${row.item.id}:price`] ??
                          String(row.item.effectivePriceSar ?? row.comp.price)
                        }
                        onChange={(e) =>
                          setBankEditDraft((prev) => ({
                            ...prev,
                            [`${row.item!.id}:price`]: e.target.value.replace(
                              /[^\d.]/g,
                              "",
                            ),
                          }))
                        }
                        onBlur={(e) =>
                          void saveBankOverride(row.item!, "price", e.target.value)
                        }
                        className={cn(
                          "w-[104px] rounded-md border px-2 py-1.5 text-center text-[13.5px] font-extrabold outline-none",
                          row.item.priceOverrideSar != null
                            ? "border-border-md bg-surface text-heading"
                            : "border-border bg-surface-2 text-text-2",
                        )}
                      />
                    ) : (
                      <span
                        dir="ltr"
                        className="text-[14px] font-extrabold text-heading"
                      >
                        {fmt(row.comp.price)}
                      </span>
                    )}
                  </BankTd>
                  <BankTd>
                    {row.item ? (
                      <input
                        dir="ltr"
                        type="text"
                        title="مساحة المقارن — تجاوز لهذا التقييم فقط"
                        value={
                          bankEditDraft[`${row.item.id}:area`] ??
                          String(row.item.effectiveAreaSqm ?? row.comp.areaSqm)
                        }
                        onChange={(e) =>
                          setBankEditDraft((prev) => ({
                            ...prev,
                            [`${row.item!.id}:area`]: e.target.value.replace(
                              /[^\d.]/g,
                              "",
                            ),
                          }))
                        }
                        onBlur={(e) =>
                          void saveBankOverride(row.item!, "area", e.target.value)
                        }
                        className={cn(
                          "w-[84px] rounded-md border px-2 py-1.5 text-center text-[13px] font-bold outline-none",
                          row.item.areaOverrideSqm != null
                            ? "border-border-md bg-surface text-heading"
                            : "border-border bg-surface-2 text-text-2",
                        )}
                      />
                    ) : (
                      <span dir="ltr" className="text-[13.5px] font-bold text-text-2">
                        {fmt(row.comp.areaSqm)}
                      </span>
                    )}
                  </BankTd>
                  <BankTd>
                    {(() => {
                      const effArea =
                        row.item?.effectiveAreaSqm ?? row.comp.areaSqm;
                      const ratio = areaRatioValue(subjectSqm, effArea);
                      return (
                        <span
                          dir="ltr"
                          className="text-[13.5px] font-bold"
                          style={{
                            color:
                              ratio != null && ratio >= 2
                                ? C.dangerText
                                : C.ink,
                          }}
                          title={
                            ratio != null && ratio >= 2
                              ? "نسبة ≥ ٢ — تُفعِّل طريقة المضاعف على الجدول كاملاً"
                              : undefined
                          }
                        >
                          {areaRatio(subjectSqm, effArea)}
                        </span>
                      );
                    })()}
                  </BankTd>
                  <BankTd>
                    <span className="truncate text-[13px] text-text-2">
                      {row.comp.district}
                    </span>
                  </BankTd>
                  <BankTd>
                    <span className="truncate text-[11.5px] text-text-3">
                      {sourceCardLine(row.comp)}
                    </span>
                  </BankTd>
                </div>
              ))}
              {rows.length === 0 ? (
                <div className="px-4 py-10 text-center text-[13px] text-text-3">
                  لا مرشحين — أضف إلى البنك من صفحة بنك المقارنات.
                </div>
              ) : null}
            </div>
          </div>
        </Card>
      </>
    );
  }

  function renderMarket() {
    if (!settingsSaved) {
      return (
        <Card>
          <CardPad>
            <p style={{ color: C.muted, fontSize: 13 }}>
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
            <p style={{ color: C.muted, fontSize: 13 }}>
              أسلوب السوق غير مفعّل في إعدادات التقييم.
            </p>
          </CardPad>
        </Card>
      );
    }

    return (
      <>
        {renderBankTable(bankRows, MARKET_CONTEXT, subjectAreaNum)}

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
            matrixDraft={matrixDraft}
            weightDraft={weightDraft}
            rationaleDraft={rationaleDraft}
            factorDefinitions={factorDefinitions}
            onMatrixDraft={(key, value) =>
              setMatrixDraft((prev) => ({ ...prev, [key]: value }))
            }
            onWeightDraft={(id, value) =>
              setWeightDraft((prev) => ({ ...prev, [id]: value }))
            }
            onRationaleDraft={(factorKey, value) =>
              setRationaleDraft((prev) => ({ ...prev, [factorKey]: value }))
            }
            onSaveCell={(item, factorKey) => void saveMatrixCell(item, factorKey)}
            onSaveWeight={(item) => void saveWeight(item)}
            onSaveRationale={(factorKey) => void saveFactorRationale(factorKey)}
            onToggleIncluded={(item, factorKey) =>
              void toggleFactorIncluded(item, factorKey)
            }
            onChangeBasis={(basis) => void changeAdjustmentBasis(basis)}
            onResetWeights={() => void resetWeights()}
            onAreaFactorChange={(value) => void saveAreaFactorPct(value)}
            onAddFactor={(factorKey, labelAr) =>
              void addDifferenceFactor(factorKey, labelAr)
            }
            onRemoveFactor={(factorKey) => void removeDifferenceFactor(factorKey)}
            catalogFactors={catalogFactorOptions}
            onRemoveSequential={(factorKey) =>
              void removeSequentialFactor(factorKey)
            }
            onRestoreSequential={(factorKey) =>
              void restoreSequentialFactor(factorKey)
            }
            descriptionDraft={descriptionDraft}
            onDescriptionDraft={(key, value) =>
              setDescriptionDraft((prev) => ({ ...prev, [key]: value }))
            }
            onSaveDescription={(item, factorKey, text) =>
              void saveCellDescription(item, factorKey, text)
            }
            subjectSpecs={subjectSpecs}
            subjectSpecDraft={subjectSpecDraft}
            onSubjectSpecDraft={(factorKey, value) =>
              setSubjectSpecDraft((prev) => ({ ...prev, [factorKey]: value }))
            }
            onSaveSubjectSpec={(factorKey, text) =>
              void saveSubjectSpec(factorKey, text)
            }
          />
        ) : null}

        <Card>
          <CardPad>
            <div
              style={{
                display: "flex",
                alignItems: "center",
                justifyContent: "space-between",
                gap: 10,
                marginBottom: 12,
              }}
            >
              <span style={{ fontWeight: 800, fontSize: 14.5, color: C.ink }}>
                تحليل التسويات
              </span>
              <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                <span
                  style={{
                    fontSize: 11,
                    fontWeight: 600,
                    color: narrativeDirty ? C.dangerText : C.goldText,
                  }}
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
              style={{
                width: "100%",
                padding: "14px 16px",
                border: `1px solid ${C.border}`,
                borderRadius: 9,
                background: C.soft,
                color: C.body,
                fontWeight: 500,
                fontSize: 13,
                lineHeight: 2,
                resize: "vertical",
              }}
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
            <p style={{ color: C.muted, fontSize: 13 }}>
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

    // حسابات محلية حية بقواعد النموذج التفاعلي (الخادم يعيد الحساب عند الحفظ).
    const computedLines = costDraft.map((l) => costLineComputed(l, costDraft));
    const directTotal = computedLines.reduce((s, c) => s + c.total, 0);
    const areaSubtotal = computedLines.reduce(
      (s, c) => (c.inArea ? s + c.total : s),
      0,
    );
    const extraSubtotal = directTotal - areaSubtotal;
    const buildAreaLocal = computedLines.reduce(
      (s, c, i) =>
        c.inArea && (costDraft[i].unit || "sqm") === "sqm" &&
        costDraft[i].isIncluded !== false
          ? s + c.qty
          : s,
      0,
    );
    const financingPctLocal =
      ((Number(financingRate.replace(",", ".")) || 0) *
        ((Number.parseInt(financingMonths, 10) || 0) / 12)) *
      0.5;
    const indirectSumLocal =
      INDIRECT_COST_ITEMS.reduce(
        (s, item) =>
          s + Math.max(0, Number((indirectDraft[item.key]?.pct ?? "0").replace(",", ".")) || 0),
        0,
      ) + financingPctLocal;
    const totalCostLocal = directTotal * (1 + indirectSumLocal / 100);
    const usedItemKeys = new Set(costDraft.map((l) => l.itemKey));
    const ghostOptionsFor = (group: "area" | "extra") =>
      COST_ITEM_OPTIONS.filter(
        (o) =>
          o.key !== "custom" &&
          !usedItemKeys.has(o.key) &&
          (group === "area"
            ? COST_GROUP1_KEYS.has(o.key)
            : !COST_GROUP1_KEYS.has(o.key)),
      );
    // العمر والإهلاك محلياً (حي — يطابق حساب الخادم عند الحفظ).
    const economicLocal = Number(economicAge.replace(",", ".")) || 0;
    const extLifeLocal = economicLocal + (Number(lifeExtension.replace(",", ".")) || 0);
    const actualLocal = Number(actualAge.replace(",", ".")) || 0;
    const physicalLocal =
      extLifeLocal > 0 && actualAge.trim() ? (actualLocal / extLifeLocal) * 100 : 0;
    const functionalLocal = Number(functionalObs.replace(",", ".")) || 0;
    const externalLocal = Number(externalObs.replace(",", ".")) || 0;
    const totalDepLocal = physicalLocal + functionalLocal + externalLocal;
    // مواصفة النموذج: بلا سقف ١٠٠٪ — تجاوز التقادم يُنتج قيمة سالبة ويحجبه تنبيه m4.
    const depValueLocal = (totalCostLocal * Math.max(totalDepLocal, 0)) / 100;
    const netValueLocal = totalCostLocal - depValueLocal;
    const landValueNow = cost?.landValueFromMarket ?? 0;
    // costValue = landPart + netValue دائماً (landPart = 0 عند عدم اكتمال الأرض).
    const costValueLocal =
      netValueLocal + (!buildingOnly && landComplete ? landValueNow : 0);
    const developerProfitPct =
      Number((indirectDraft["developer_profit"]?.pct ?? "0").replace(",", ".")) || 0;

    // تنبيهات أسلوب التكلفة — جدول محفزات النموذج التفاعلي.
    const costAlerts: { kind: "error" | "warn" | "ok"; title: string; body: string }[] = [];
    if (costDraft.length === 0)
      costAlerts.push({
        kind: "error",
        title: "لا يوجد بند تكلفة",
        body: "يلزم بند واحد على الأقل في جدول التكلفة.",
      });
    if (extLifeLocal <= 0)
      costAlerts.push({
        kind: "error",
        title: "العمر الممتد صفر",
        body: "العمر الاقتصادي + التمديد يجب أن يكون أكبر من صفر.",
      });
    else if (actualLocal > extLifeLocal)
      costAlerts.push({
        kind: "error",
        title: "العمر الفعلي يتجاوز العمر الممتد",
        body: "الإهلاك المادي يتجاوز ١٠٠٪.",
      });
    if (totalDepLocal > 100)
      costAlerts.push({
        kind: "error",
        title: "مجموع التقادم يتجاوز ١٠٠٪",
        body: "راجع نسب التقادم الوظيفي والخارجي.",
      });
    if (
      costDraft.some((l) => l.itemKey === "repeated_floors") &&
      !costDraft.some((l) => l.itemKey === "first_floor" && l.areaSqm > 0)
    )
      costAlerts.push({
        kind: "error",
        title: "بند الأدوار المتكررة بلا «الدور الأول»",
        body: "كمية المتكررة تُشتقّ من مسطح الدور الأول — أعد إدراجه أو احذف بند المتكررة.",
      });
    if (Number(lifeExtension.replace(",", ".")) > 0 && !lifeExtensionBasis.trim())
      costAlerts.push({
        kind: "warn",
        title: "تمديد العمر مستخدم",
        body: "يلزم بيان أساس التمديد كتابةً.",
      });
    for (const [i, l] of costDraft.entries()) {
      if (
        costGroupOf(l) === "extra" &&
        (l.label.trim() || l.itemKey !== "custom") &&
        !l.rationale.trim()
      ) {
        costAlerts.push({
          kind: "warn",
          title: `بند إضافي بلا مبرر: ${l.label || COST_ITEM_OPTIONS.find((o) => o.key === l.itemKey)?.label || ""}`,
          body: "يلزم توثيق أساس التقدير — احتمال ازدواج مع ما هو مضمَّن في تكلفة المتر.",
        });
      }
      if (
        l.itemKey === "repeated_floors" &&
        l.unitCostSar > 0 &&
        l.unitCostSar !==
          (costDraft.find((f) => f.itemKey === "first_floor")?.unitCostSar ?? 0) &&
        !l.rationale.trim()
      ) {
        costAlerts.push({
          kind: "warn",
          title: "تكلفة متر المتكررة تخالف الدور الأول",
          body: "التجاوز مسموح بمبرر مكتوب — دوّن سببه.",
        });
      }
      void i;
    }
    if ((Number(useRestrictionPct.replace(",", ".")) || 0) > 0 && !useRestrictionRationale.trim())
      costAlerts.push({
        kind: "warn",
        title: "خصم تقييد الاستخدام بلا مبرر",
        body: "افتراضه صفر ولا يُملأ إلا بمبرر موثّق.",
      });
    if (!buildingOnly && !landComplete)
      costAlerts.push({
        kind: "error",
        title: "قيمة الأرض غير مقدَّرة",
        body: "اعتمد مقارنات أراضٍ فضاء — مؤشر الأسلوب يبقى غير مكتمل بدونها.",
      });
    if ((functionalLocal > 0 && !functionalObsRationale.trim()) ||
        (externalLocal > 0 && !externalObsRationale.trim()))
      costAlerts.push({
        kind: "warn",
        title: "تقادم وظيفي أو خارجي بلا مبرر",
        body: "يلزم مبرر مكتوب لكل نسبة تقادم غير مادية.",
      });
    if (developerProfitPct < 10 || developerProfitPct > 20)
      costAlerts.push({
        kind: "warn",
        title: "أرباح المطور خارج النطاق",
        body: `النطاق المعتاد ١٠٪–٢٠٪، والحالي ${developerProfitPct}٪.`,
      });
    if (indirectSumLocal > 45)
      costAlerts.push({
        kind: "warn",
        title: "النسب غير المباشرة مرتفعة",
        body: `المجموع ${(Math.round(indirectSumLocal * 100) / 100).toFixed(2)}٪ يتجاوز ٤٥٪.`,
      });
    if (costAlerts.length === 0)
      costAlerts.push({
        kind: "ok",
        title: "لا تنبيهات",
        body: "المدخلات ضمن الحدود المنهجية.",
      });

    // تحليل التكلفة الآلي — buildCostNarrative من النموذج التفاعلي.
    const noJust = "لم يتم تبريره";
    const costNarrativeAuto = [
      `طريقة التكلفة: ${asCostBasis === "reproduction" ? "إعادة الإنتاج" : "الإحلال"}.`,
      (Number(useRestrictionPct.replace(",", ".")) || 0) > 0
        ? `خصم تقييد الاستخدام: ${useRestrictionPct}٪ — ${useRestrictionRationale.trim() || noJust}.`
        : null,
      "مبررات بنود التكلفة:\n" +
        (costDraft.length
          ? costDraft
              .filter((l) => l.label.trim() || l.itemKey !== "custom")
              .map(
                (l) =>
                  `• ${l.label || COST_ITEM_OPTIONS.find((o) => o.key === l.itemKey)?.label || ""} — ${l.rationale.trim() || noJust}`,
              )
              .join("\n")
          : "• لا توجد بنود"),
      "مبررات النسب غير المباشرة:\n" +
        INDIRECT_COST_ITEMS.map(
          (item) =>
            `• ${item.label} (${indirectDraft[item.key]?.pct ?? "0"}٪) — ${(indirectDraft[item.key]?.rationale ?? "").trim() || noJust}`,
        ).join("\n") +
        `\n• التمويل — معدل ${financingRate}٪ سنوياً على ${financingMonths} شهراً بمتوسط سحب ٥٠٪`,
      "مبررات العمر والتقادم:\n" +
        [
          `• العمر الفعلي (${actualAge || "—"}) — ${noJust}`,
          `• العمر الاقتصادي (${economicAge || "—"}) — ${noJust}`,
          `• تمديد العمر (${lifeExtension || "0"}) — ${lifeExtensionBasis.trim() || noJust}`,
          `• التقادم الوظيفي (${functionalObs || "0"}٪) — ${functionalObsRationale.trim() || noJust}`,
          `• التقادم الخارجي (${externalObs || "0"}٪) — ${externalObsRationale.trim() || noJust}`,
        ].join("\n"),
    ]
      .filter(Boolean)
      .join("\n\n");
    const costNarrativeDirty = costAnalysisNotes.trim().length > 0;

    const blankCostLine = (
      partial: Partial<ValuationCostLineDto>,
    ): ValuationCostLineDto => ({
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
      ...partial,
    });
    const addCostLine = (partial: Partial<ValuationCostLineDto>) =>
      setCostDraft([...costDraft, blankCostLine(partial)]);
    /** إدراج بند مخصص بعد صف محدد — يرث مجموعة الصف (hover-insert من النموذج). */
    const insertCostLineAfter = (idx: number) => {
      const anchor = costDraft[idx];
      if (!anchor) return;
      const next = [...costDraft];
      next.splice(
        idx + 1,
        0,
        blankCostLine({
          structureKind: costGroupOf(anchor) === "area" ? "floor" : "other",
        }),
      );
      setCostDraft(next);
    };
    /** نقل بند مسحوب إلى موضع صف الهدف — يُرفض عبور المجموعات (كما في النموذج). */
    const moveCostLine = (sourceId: string, targetIdx: number) => {
      const sourceIdx = costDraft.findIndex((l) => l.id === sourceId);
      const target = costDraft[targetIdx];
      if (sourceIdx < 0 || !target || sourceIdx === targetIdx) return;
      if (costGroupOf(costDraft[sourceIdx]!) !== costGroupOf(target)) return;
      const next = [...costDraft];
      const [moved] = next.splice(sourceIdx, 1);
      next.splice(targetIdx, 0, moved!);
      setCostDraft(next);
    };

    return (
      <>
        <div
          style={{
            position: "sticky",
            top: 0,
            zIndex: 14,
            background: C.page,
            padding: "4px 0 10px",
          }}
        >
          <div
            style={{
              display: "flex",
              alignItems: "center",
              gap: 16,
              flexWrap: "wrap",
              background: C.card,
              border: `1px solid ${C.borderStrong}`,
              borderRadius: 10,
              padding: "9px 18px",
              boxShadow: "0 8px 20px -18px rgba(18,40,76,.4)",
            }}
          >
            <span style={{ fontWeight: 800, fontSize: 13, color: C.ink }}>
              أسلوب التكلفة
            </span>
            <span style={{ fontSize: 11.5, color: C.faint }}>
              أرض{" "}
              <b
                dir="ltr"
                style={{
                  color: buildingOnly
                    ? C.faint
                    : landComplete
                      ? C.ink
                      : C.dangerText,
                }}
              >
                {buildingOnly
                  ? "غير مشمولة"
                  : landComplete
                    ? fmt(cost?.landValueFromMarket)
                    : "— بانتظار المقارنات"}
              </b>
            </span>
            <span style={{ fontSize: 11.5, color: C.faint }}>
              إحلال{" "}
              <b dir="ltr" style={{ color: C.ink }}>
                {fmt(cost?.totalCostWithIndirect)}
              </b>
            </span>
            <span style={{ fontSize: 11.5, color: C.faint }}>
              إهلاك{" "}
              <b dir="ltr" style={{ color: C.dangerText }}>
                {fmt(cost?.depreciationValue)}
              </b>
            </span>
            <span
              style={{
                marginInlineStart: "auto",
                display: "flex",
                alignItems: "baseline",
                gap: 9,
              }}
            >
              <span style={{ fontWeight: 700, fontSize: 11.5, color: C.goldText }}>
                {buildingOnly
                  ? "تكلفة الإحلال − الإهلاك ="
                  : "أرض + إحلال − إهلاك ="}
              </span>
              <span
                dir="ltr"
                style={{
                  fontWeight: 800,
                  fontSize: 17,
                  color:
                    buildingOnly || landComplete ? C.ink : C.dangerText,
                }}
              >
                {buildingOnly || landComplete
                  ? fmt(cost?.costOpinionWithLand)
                  : "غير مكتمل — يلزم قيمة الأرض"}
              </span>
            </span>
          </div>
        </div>

        <Card>
          <CardPad>
            <CardTitle>طريقة التكلفة وأسلوب التقدير</CardTitle>
            <FieldLabel>أساس التكلفة</FieldLabel>
            <div style={{ display: "flex", gap: 8, flexWrap: "wrap", margin: "8px 0 14px" }}>
              <ToggleChip
                active={asCostBasis === "replacement"}
                disabled={saving}
                onClick={() => setAsCostBasis("replacement")}
              >
                الإحلال / الاستبدال
              </ToggleChip>
              <ToggleChip
                active={asCostBasis === "reproduction"}
                disabled={saving}
                onClick={() => setAsCostBasis("reproduction")}
              >
                إعادة الإنتاج
              </ToggleChip>
            </div>
            <FieldLabel>وحدة التقدير</FieldLabel>
            <div style={{ display: "flex", gap: 8, flexWrap: "wrap", marginTop: 8 }}>
              {(
                [
                  ["comparison_unit", "وحدة المقارنة"],
                  ["quantity_survey", "المسح الكمي"],
                  ["lump_sum", "المبلغ المقطوع"],
                  ["per_item", "كل بند على حدة"],
                ] as const
              ).map(([k, label]) => (
                <ToggleChip
                  key={k}
                  active={asCostUnit === k}
                  disabled={saving}
                  onClick={() => setAsCostUnit(k)}
                >
                  {label}
                </ToggleChip>
              ))}
            </div>
            <div style={{ marginTop: 14 }}>
              <GhostBtn
                disabled={saving}
                onClick={() => void saveApproachSettings()}
              >
                حفظ أساس/وحدة التكلفة
              </GhostBtn>
            </div>
          </CardPad>
        </Card>

        {!buildingOnly ? (
        <>
        <div
          style={{
            display: "flex",
            alignItems: "flex-start",
            gap: 11,
            padding: "13px 16px",
            borderRadius: 10,
            background: C.goldSoft,
            border: `1px solid ${C.borderStrong}`,
            marginBottom: 16,
          }}
        >
          <span
            style={{
              width: 3,
              height: 30,
              borderRadius: 99,
              background: C.gold,
              flexShrink: 0,
            }}
          />
          <div>
            <div style={{ fontWeight: 800, fontSize: 13, color: C.ink }}>
              تقدير قيمة الأرض فضاءً
            </div>
            <div style={{ fontWeight: 400, fontSize: 11.5, color: C.goldText, marginTop: 2 }}>
              مكوّن داخل أسلوب التكلفة — ناتجه قيمة الأرض ولا يدخل التوفيق بين
              الأساليب. مقارناته أراضٍ خام مستقلة عن مقارنات أسلوب السوق.
            </div>
          </div>
        </div>

        {renderBankTable(
          landBankRows,
          LAND_WITHIN_COST,
          cost?.landAreaSqm || subjectAreaNum,
        )}

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
            matrixDraft={matrixDraft}
            weightDraft={weightDraft}
            rationaleDraft={landRationaleDraft}
            factorDefinitions={factorDefinitions}
            onMatrixDraft={(key, value) =>
              setMatrixDraft((prev) => ({ ...prev, [key]: value }))
            }
            onWeightDraft={(id, value) =>
              setWeightDraft((prev) => ({ ...prev, [id]: value }))
            }
            onRationaleDraft={(factorKey, value) =>
              setLandRationaleDraft((prev) => ({ ...prev, [factorKey]: value }))
            }
            onSaveCell={(item, factorKey) => void saveMatrixCell(item, factorKey)}
            onSaveWeight={(item) => void saveWeight(item)}
            onSaveRationale={(factorKey) =>
              void saveFactorRationale(factorKey, LAND_WITHIN_COST)
            }
            onToggleIncluded={(item, factorKey) =>
              void toggleFactorIncluded(item, factorKey)
            }
            onChangeBasis={(basis) => void changeAdjustmentBasis(basis)}
            onResetWeights={() => void resetWeights(LAND_WITHIN_COST)}
            onAreaFactorChange={(value) => void saveAreaFactorPct(value)}
            onAddFactor={(factorKey, labelAr) =>
              void addDifferenceFactor(factorKey, labelAr, LAND_WITHIN_COST)
            }
            onRemoveFactor={(factorKey) =>
              void removeDifferenceFactor(factorKey, LAND_WITHIN_COST)
            }
            catalogFactors={catalogFactorOptions}
            onRemoveSequential={(factorKey) =>
              void removeSequentialFactor(factorKey, LAND_WITHIN_COST)
            }
            onRestoreSequential={(factorKey) =>
              void restoreSequentialFactor(factorKey, LAND_WITHIN_COST)
            }
            descriptionDraft={descriptionDraft}
            onDescriptionDraft={(key, value) =>
              setDescriptionDraft((prev) => ({ ...prev, [key]: value }))
            }
            onSaveDescription={(item, factorKey, text) =>
              void saveCellDescription(item, factorKey, text)
            }
          />
        ) : null}

        <Card>
          <CardPad>
            <CardTitle>قيمة الأرض</CardTitle>
            <div
              style={{
                display: "grid",
                gridTemplateColumns: "repeat(4, 1fr)",
                gap: 14,
              }}
            >
              <div>
                <FieldLabel>سعر المتر من مقارنات الأرض</FieldLabel>
                <div dir="ltr" style={{ fontWeight: 800, fontSize: 16, color: C.ink, marginTop: 6 }}>
                  {landComplete ? fmt(cost?.landUnitRateFromMarket) : "—"}
                </div>
              </div>
              <label style={{ display: "flex", flexDirection: "column", gap: 6 }}>
                <FieldLabel>خصم تقييد الاستخدام ٪</FieldLabel>
                <input
                  dir="ltr"
                  value={useRestrictionPct}
                  onChange={(e) =>
                    setUseRestrictionPct(e.target.value.replace(/[^\d.]/g, ""))
                  }
                  style={{ ...inputStyle, textAlign: "center" }}
                />
              </label>
              {(approachSettings?.propertyType ?? "").includes("شقة") ? (
                <label style={{ display: "flex", flexDirection: "column", gap: 6 }}>
                  <FieldLabel>حصة الشقة من الأرض (م²)</FieldLabel>
                  <input
                    dir="ltr"
                    value={apartmentLandShare}
                    placeholder="120"
                    title="تحل محل مساحة الأرض في معادلة قيمة الأرض"
                    onChange={(e) =>
                      setApartmentLandShare(e.target.value.replace(/[^\d.]/g, ""))
                    }
                    style={{ ...inputStyle, textAlign: "center" }}
                  />
                </label>
              ) : null}
              <div>
                <FieldLabel>سعر المتر بعد الخصم</FieldLabel>
                <div
                  dir="ltr"
                  style={{ fontWeight: 800, fontSize: 16, color: C.goldText, marginTop: 6 }}
                >
                  {landComplete ? fmt(cost?.landUnitRateAfterDiscount) : "—"}
                </div>
              </div>
              <div>
                <FieldLabel>قيمة الأرض</FieldLabel>
                <div
                  dir="ltr"
                  style={{
                    fontWeight: 800,
                    fontSize: 18,
                    color: landComplete ? C.ink : C.dangerText,
                    marginTop: 6,
                  }}
                >
                  {landComplete ? fmt(cost?.landValueFromMarket) : "غير مكتمل"}
                </div>
              </div>
            </div>
            <input
              placeholder="مبرر تقييد الاستخدام…"
              value={useRestrictionRationale}
              onChange={(e) => setUseRestrictionRationale(e.target.value)}
              style={{
                ...inputStyle,
                fontWeight: 500,
                marginTop: 12,
                borderStyle: "dashed",
                background: C.soft,
                color: C.muted,
              }}
            />
          </CardPad>
        </Card>
        </>
        ) : (
          <div
            style={{
              padding: "12px 16px",
              borderRadius: 10,
              background: C.soft,
              border: `1px solid ${C.border}`,
              marginBottom: 16,
              fontSize: 12.5,
              color: C.muted,
            }}
          >
            النطاق «مبنى فقط» — قسم تقدير الأرض مخفي ومؤشر الأسلوب = تكلفة الإحلال
            ناقصاً الإهلاك. يُغيَّر النطاق من شاشة البيانات الأساسية.
          </div>
        )}

        <div
          style={{
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            gap: 10,
            flexWrap: "wrap",
            marginBottom: 12,
          }}
        >
          <div style={{ display: "flex", alignItems: "baseline", gap: 10 }}>
            <h2 style={{ fontWeight: 800, fontSize: 17, margin: 0, color: C.ink }}>
              بنود التكلفة المباشرة
            </h2>
            <span style={{ fontSize: 11.5, color: C.faint }}>
              البنود موجبة فقط — النقص عن السائد يُعالَج تقادماً وظيفياً · أضف البند
              من صف «اختر البند» في نهاية كل مجموعة
            </span>
          </div>
          <GhostBtn disabled={saving} onClick={() => void seedCostFromInventory()}>
            سحب من حصر المباني
          </GhostBtn>
        </div>

        <Card style={{ marginBottom: 24 }}>
          <div style={{ overflowX: "auto" }}>
            <table
              style={{
                width: "100%",
                borderCollapse: "collapse",
                minWidth: 900,
              }}
            >
              <thead>
                <tr>
                  <th style={{ ...thStyle, textAlign: "start" }}>البند</th>
                  <th style={thStyle}>
                    المساحة / العدد
                    <div style={{ fontWeight: 400, fontSize: 10, color: C.faint }}>
                      · نسبة البناء
                    </div>
                  </th>
                  <th style={thStyle}>الوحدة</th>
                  <th style={thStyle}>سعر المتر / تكلفة الوحدة</th>
                  <th style={thStyle}>
                    الإجمالي
                    <div style={{ fontWeight: 400, fontSize: 10, color: C.faint }}>
                      سعر المتر بعد غير المباشرة
                    </div>
                  </th>
                  <th style={{ ...thStyle, textAlign: "start" }}>مبرر التقدير</th>
                  <th style={thStyle} />
                </tr>
              </thead>
              <tbody>
                {(
                  [
                    ["area", "مسطحات المبنى والأدوار", areaSubtotal],
                    ["extra", "تكاليف وتجهيزات إضافية", extraSubtotal],
                  ] as const
                ).map(([group, groupTitle, subtotal]) => (
                  <Fragment key={group}>
                    <tr>
                      <td
                        colSpan={5}
                        style={{
                          padding: "9px 16px",
                          background: C.goldSoft,
                          borderBottom: `1px solid ${C.borderStrong}`,
                          fontWeight: 800,
                          fontSize: 12.5,
                          color: C.ink,
                          textAlign: "start",
                        }}
                      >
                        {groupTitle}
                      </td>
                      <td
                        colSpan={2}
                        style={{
                          padding: "9px 16px",
                          background: C.goldSoft,
                          borderBottom: `1px solid ${C.borderStrong}`,
                          fontWeight: 800,
                          fontSize: 13,
                          color: C.goldText,
                          textAlign: "end",
                        }}
                      >
                        <span dir="ltr">{fmt(subtotal)}</span>
                      </td>
                    </tr>
                    {costDraft.map((line, idx) => {
                      if (costGroupOf(line) !== group) return null;
                      const comp = computedLines[idx];
                      const patchLine = (
                        partial: Partial<ValuationCostLineDto>,
                      ) => {
                        const next = [...costDraft];
                        next[idx] = { ...line, ...partial };
                        setCostDraft(next);
                      };
                      return (
                        <Fragment key={line.id}>
                        <tr
                          onDragOver={(e) => {
                            if (dragCostId) e.preventDefault();
                          }}
                          onDrop={(e) => {
                            e.preventDefault();
                            if (dragCostId) moveCostLine(dragCostId, idx);
                            setDragCostId(null);
                          }}
                          style={
                            dragCostId === line.id
                              ? { opacity: 0.45 }
                              : undefined
                          }
                        >
                          <td style={{ ...tdStyle, textAlign: "start" }}>
                            <div
                              style={{
                                display: "flex",
                                alignItems: "flex-start",
                                gap: 6,
                              }}
                            >
                              <span
                                draggable
                                title="اسحب لإعادة الترتيب داخل المجموعة"
                                onDragStart={(e) => {
                                  setDragCostId(line.id);
                                  e.dataTransfer.effectAllowed = "move";
                                }}
                                onDragEnd={() => setDragCostId(null)}
                                style={{
                                  cursor: "grab",
                                  color: C.faint,
                                  fontSize: 13,
                                  lineHeight: 1,
                                  paddingTop: 11,
                                  userSelect: "none",
                                  flexShrink: 0,
                                }}
                              >
                                ⋮⋮
                              </span>
                              <div style={{ flex: 1, minWidth: 0 }}>
                            <select
                              value={line.itemKey || "custom"}
                              onChange={(e) => {
                                const opt = COST_ITEM_OPTIONS.find(
                                  (o) => o.key === e.target.value,
                                );
                                patchLine({
                                  itemKey: e.target.value,
                                  unit: opt?.unit ?? line.unit,
                                  areaSqm:
                                    (opt?.unit ?? line.unit) === "lump"
                                      ? 1
                                      : line.areaSqm,
                                  repeatedFloorCount:
                                    e.target.value === "repeated_floors"
                                      ? line.repeatedFloorCount ?? 2
                                      : null,
                                  label:
                                    e.target.value === "custom"
                                      ? line.label
                                      : opt?.label ?? line.label,
                                });
                              }}
                              style={{
                                ...inputStyle,
                                fontWeight: 700,
                                fontSize: 12.5,
                                padding: "8px 10px",
                              }}
                            >
                              {COST_ITEM_OPTIONS.filter(
                                (o) =>
                                  o.key === line.itemKey ||
                                  o.key === "custom" ||
                                  (!usedItemKeys.has(o.key) &&
                                    (group === "area"
                                      ? COST_GROUP1_KEYS.has(o.key)
                                      : !COST_GROUP1_KEYS.has(o.key))),
                              ).map((o) => (
                                <option key={o.key} value={o.key}>
                                  {o.key === "custom"
                                    ? "✎ كتابة اسم آخر…"
                                    : o.label}
                                </option>
                              ))}
                            </select>
                            {line.itemKey === "custom" ? (
                              <input
                                value={line.label}
                                placeholder="اكتب اسم البند…"
                                onChange={(e) =>
                                  patchLine({ label: e.target.value })
                                }
                                style={{
                                  ...inputStyle,
                                  marginTop: 4,
                                  fontWeight: 500,
                                  fontSize: 12,
                                  padding: "6px 9px",
                                }}
                              />
                            ) : null}
                              </div>
                            </div>
                          </td>
                          <td style={tdStyle}>
                            {comp.isLump ? (
                              <span
                                style={{
                                  fontSize: 12,
                                  fontWeight: 700,
                                  color: C.goldText,
                                }}
                              >
                                مبلغ مقطوع
                              </span>
                            ) : comp.isRepeated ? (
                              <label
                                title="عدد الأدوار المتكررة — الكمية تُشتق من مسطح الدور الأول × العدد"
                                style={{
                                  display: "inline-flex",
                                  alignItems: "center",
                                  gap: 6,
                                }}
                              >
                                <span style={{ fontSize: 10.5, color: C.faint }}>
                                  عدد
                                </span>
                                <input
                                  dir="ltr"
                                  value={String(line.repeatedFloorCount ?? 2)}
                                  onChange={(e) =>
                                    patchLine({
                                      repeatedFloorCount:
                                        Number.parseInt(
                                          e.target.value.replace(/[^\d]/g, ""),
                                          10,
                                        ) || 0,
                                    })
                                  }
                                  style={{
                                    width: 46,
                                    padding: "8px 4px",
                                    border: `1px solid ${C.borderStrong}`,
                                    borderRadius: 7,
                                    textAlign: "center",
                                    fontWeight: 700,
                                    fontSize: 12.5,
                                  }}
                                />
                              </label>
                            ) : (
                              <input
                                dir="ltr"
                                value={String(line.areaSqm)}
                                onChange={(e) =>
                                  patchLine({
                                    areaSqm:
                                      Number(
                                        e.target.value.replace(",", "."),
                                      ) || 0,
                                  })
                                }
                                style={{
                                  width: 66,
                                  padding: "8px 4px",
                                  border: `1px solid ${C.borderStrong}`,
                                  borderRadius: 7,
                                  textAlign: "center",
                                  fontWeight: 700,
                                  fontSize: 12.5,
                                }}
                              />
                            )}
                            {comp.usesPct ? (
                              <label
                                title="نسبة البناء (٪) — فارغة = ١٠٠٪"
                                style={{
                                  display: "flex",
                                  alignItems: "center",
                                  justifyContent: "center",
                                  gap: 4,
                                  marginTop: 4,
                                }}
                              >
                                <input
                                  dir="ltr"
                                  value={
                                    line.buildRatioPct == null
                                      ? ""
                                      : String(line.buildRatioPct)
                                  }
                                  placeholder="100"
                                  onChange={(e) => {
                                    const raw = e.target.value.replace(
                                      /[^\d.]/g,
                                      "",
                                    );
                                    patchLine({
                                      buildRatioPct: raw
                                        ? Number(raw)
                                        : null,
                                    });
                                  }}
                                  style={{
                                    width: 46,
                                    padding: "4px 3px",
                                    border: `1px dashed ${C.border}`,
                                    borderRadius: 6,
                                    textAlign: "center",
                                    fontWeight: 700,
                                    fontSize: 11,
                                    color: C.goldText,
                                    background: C.soft,
                                  }}
                                />
                                <span style={{ fontSize: 10, color: C.faint }}>
                                  ٪
                                </span>
                              </label>
                            ) : null}
                            {comp.usesPct &&
                            line.buildRatioPct != null &&
                            line.buildRatioPct !== 100 ? (
                              <div
                                style={{
                                  fontSize: 10,
                                  color: C.goldText,
                                  marginTop: 2,
                                }}
                              >
                                المسطح <span dir="ltr">{fmt(comp.qty, 1)}</span> م²
                              </div>
                            ) : comp.isRepeated ? (
                              <div
                                style={{
                                  fontSize: 10,
                                  color: C.faint,
                                  marginTop: 2,
                                }}
                              >
                                الكمية <span dir="ltr">{fmt(comp.qty, 1)}</span> م²
                              </div>
                            ) : null}
                          </td>
                          <td style={tdStyle}>
                            <select
                              value={line.unit || "sqm"}
                              onChange={(e) =>
                                patchLine({
                                  unit: e.target.value,
                                  areaSqm:
                                    e.target.value === "lump" ? 1 : line.areaSqm,
                                })
                              }
                              style={{
                                padding: "8px 10px",
                                border: `1px solid ${C.borderStrong}`,
                                borderRadius: 7,
                                fontSize: 12.5,
                              }}
                            >
                              {COST_UNIT_OPTIONS.map((o) => (
                                <option key={o.key} value={o.key}>
                                  {o.label}
                                </option>
                              ))}
                            </select>
                          </td>
                          <td style={tdStyle}>
                            <input
                              dir="ltr"
                              value={
                                comp.inherited ? "" : String(line.unitCostSar)
                              }
                              placeholder={
                                comp.inherited ? String(comp.uc) : undefined
                              }
                              onChange={(e) =>
                                patchLine({
                                  unitCostSar:
                                    Number(e.target.value.replace(",", ".")) || 0,
                                })
                              }
                              style={{
                                width: 110,
                                padding: 8,
                                border: `1px solid ${comp.inherited ? C.border : C.borderStrong}`,
                                borderRadius: 7,
                                textAlign: "center",
                                fontWeight: 700,
                                fontSize: 13,
                                background: comp.inherited ? C.soft : C.card,
                                color: comp.inherited ? C.goldText : C.ink,
                              }}
                            />
                            {comp.inherited ? (
                              <div
                                style={{
                                  fontSize: 10,
                                  color: C.goldText,
                                  marginTop: 2,
                                }}
                              >
                                موروثة من الدور الأول
                              </div>
                            ) : null}
                          </td>
                          <td style={{ ...tdStyle, fontWeight: 800, color: C.ink }}>
                            <span dir="ltr">{fmt(comp.rawTotal)}</span>
                            {comp.rawTotal > 0 && comp.qty > 0 ? (
                              <div
                                style={{
                                  fontSize: 10,
                                  color: C.faint,
                                  marginTop: 2,
                                }}
                              >
                                <span dir="ltr">
                                  {fmt(
                                    (comp.rawTotal *
                                      (1 + indirectSumLocal / 100)) /
                                      comp.qty,
                                  )}
                                </span>{" "}
                                بعد غير المباشرة
                              </div>
                            ) : null}
                          </td>
                          <td style={{ ...tdStyle, textAlign: "start" }}>
                            <input
                              value={line.rationale}
                              onChange={(e) =>
                                patchLine({ rationale: e.target.value })
                              }
                              placeholder="أساس التقدير…"
                              style={{
                                width: "100%",
                                padding: "8px 10px",
                                border: `1px solid ${C.border}`,
                                borderRadius: 7,
                                fontSize: 12,
                              }}
                            />
                          </td>
                          <td style={tdStyle}>
                            <button
                              type="button"
                              disabled={saving}
                              onClick={() =>
                                setCostDraft(
                                  costDraft.filter((_, i) => i !== idx),
                                )
                              }
                              style={{
                                width: 24,
                                height: 24,
                                border: `1px solid ${C.border}`,
                                borderRadius: 6,
                                background: C.card,
                                color: C.faint,
                                cursor: "pointer",
                              }}
                            >
                              ×
                            </button>
                          </td>
                        </tr>
                        {/* شريط إدراج بين الصفوف (hover-insert) — بند مخصص يرث المجموعة */}
                        <tr>
                          <td colSpan={7} style={{ padding: 0, border: 0 }}>
                            <div
                              style={{
                                height: 10,
                                display: "flex",
                                justifyContent: "center",
                                alignItems: "center",
                              }}
                            >
                              <button
                                type="button"
                                disabled={saving}
                                title="إدراج بند مخصص هنا"
                                onClick={() => insertCostLineAfter(idx)}
                                onMouseEnter={(e) => {
                                  e.currentTarget.style.opacity = "1";
                                }}
                                onMouseLeave={(e) => {
                                  e.currentTarget.style.opacity = "0.12";
                                }}
                                style={{
                                  opacity: 0.12,
                                  width: 18,
                                  height: 18,
                                  display: "grid",
                                  placeItems: "center",
                                  border: `1px solid ${C.gold}`,
                                  borderRadius: 99,
                                  background: C.goldSoft,
                                  color: C.goldText,
                                  fontWeight: 700,
                                  fontSize: 12,
                                  lineHeight: 1,
                                  cursor: "pointer",
                                  transition: "opacity .12s",
                                }}
                              >
                                +
                              </button>
                            </div>
                          </td>
                        </tr>
                        </Fragment>
                      );
                    })}
                    <tr style={{ background: C.softAlt }}>
                      <td colSpan={7} style={{ padding: "8px 16px" }}>
                        <div
                          style={{
                            display: "flex",
                            alignItems: "center",
                            gap: 10,
                          }}
                        >
                          <select
                            value=""
                            onChange={(e) => {
                              if (!e.target.value) return;
                              if (e.target.value === "__custom") {
                                addCostLine({
                                  structureKind:
                                    group === "area" ? "floor" : "other",
                                });
                                return;
                              }
                              const opt = COST_ITEM_OPTIONS.find(
                                (o) => o.key === e.target.value,
                              );
                              if (!opt) return;
                              addCostLine({
                                itemKey: opt.key,
                                label: opt.label,
                                unit: opt.unit,
                                areaSqm: opt.unit === "lump" ? 1 : 0,
                                repeatedFloorCount:
                                  opt.key === "repeated_floors" ? 2 : null,
                              });
                            }}
                            style={{
                              padding: "7px 10px",
                              border: `1px dashed ${C.borderStrong}`,
                              borderRadius: 7,
                              fontSize: 12,
                              color: C.goldText,
                              background: C.card,
                              minWidth: 170,
                            }}
                          >
                            <option value="">اختر البند</option>
                            <option value="__custom">+ بند مخصص…</option>
                            {ghostOptionsFor(group).map((o) => (
                              <option key={o.key} value={o.key}>
                                {o.label}
                              </option>
                            ))}
                          </select>
                          <span style={{ fontSize: 11, color: C.faint }}>
                            تُفتح بقية الحقول بعد اختيار البند
                          </span>
                        </div>
                      </td>
                    </tr>
                  </Fragment>
                ))}
              </tbody>
            </table>
          </div>
          <div
            style={{
              display: "flex",
              justifyContent: "space-between",
              padding: "12px 16px",
              background: C.soft,
              borderTop: `1px solid ${C.border}`,
            }}
          >
            <span style={{ fontSize: 12, color: C.muted }}>مجموع البنود = التكلفة المباشرة</span>
            <span dir="ltr" style={{ fontWeight: 800, fontSize: 16, color: C.ink }}>
              {fmt(directTotal)}
            </span>
          </div>
        </Card>

        <div
          style={{
            display: "grid",
            gridTemplateColumns: "1.2fr 1fr",
            gap: 18,
            marginBottom: 24,
          }}
        >
          <Card style={{ marginBottom: 0 }}>
            <CardPad>
              <CardTitle>التكاليف غير المباشرة</CardTitle>
              <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
                {INDIRECT_COST_ITEMS.map((item) => {
                  const pctNum =
                    Number(
                      (indirectDraft[item.key]?.pct ?? "0").replace(",", "."),
                    ) || 0;
                  return (
                    <div
                      key={item.key}
                      style={{ display: "flex", alignItems: "center", gap: 10 }}
                    >
                      <span
                        style={{
                          fontSize: 12.5,
                          color: C.muted,
                          width: 170,
                          flexShrink: 0,
                        }}
                      >
                        {item.label}
                      </span>
                      <input
                        value={indirectDraft[item.key]?.rationale ?? ""}
                        placeholder="مبرر النسبة…"
                        onChange={(e) =>
                          setIndirectDraft((prev) => ({
                            ...prev,
                            [item.key]: {
                              pct: prev[item.key]?.pct ?? "0",
                              rationale: e.target.value,
                            },
                          }))
                        }
                        style={{
                          flex: 1,
                          padding: "6px 9px",
                          border: `1px dashed ${C.border}`,
                          borderRadius: 7,
                          background: C.soft,
                          fontSize: 11.5,
                        }}
                      />
                      <span
                        dir="ltr"
                        title="المبلغ = التكلفة المباشرة × النسبة"
                        style={{
                          width: 92,
                          textAlign: "end",
                          fontSize: 11.5,
                          fontWeight: 700,
                          color: C.goldText,
                          flexShrink: 0,
                        }}
                      >
                        {fmt((directTotal * pctNum) / 100)}
                      </span>
                      <input
                        dir="ltr"
                        type="number"
                        min={0}
                        max={50}
                        step={1}
                        value={indirectDraft[item.key]?.pct ?? "0"}
                        onChange={(e) =>
                          setIndirectDraft((prev) => ({
                            ...prev,
                            [item.key]: {
                              pct: e.target.value,
                              rationale: prev[item.key]?.rationale ?? "",
                            },
                          }))
                        }
                        style={{
                          width: 70,
                          padding: 7,
                          border: `1px solid ${C.borderStrong}`,
                          borderRadius: 7,
                          textAlign: "center",
                          fontWeight: 700,
                          fontSize: 13,
                        }}
                      />
                    </div>
                  );
                })}
                <div
                  style={{
                    display: "flex",
                    gap: 8,
                    alignItems: "flex-end",
                    paddingTop: 10,
                    borderTop: `1px solid ${C.border}`,
                  }}
                >
                  <label style={{ display: "flex", flexDirection: "column", gap: 4, flex: 1 }}>
                    <FieldLabel>معدل التمويل السنوي ٪</FieldLabel>
                    <input
                      dir="ltr"
                      value={financingRate}
                      onChange={(e) => setFinancingRate(e.target.value)}
                      style={{ ...inputStyle, textAlign: "center" }}
                    />
                  </label>
                  <label style={{ display: "flex", flexDirection: "column", gap: 4, flex: 1 }}>
                    <FieldLabel>مدة التنفيذ (أشهر)</FieldLabel>
                    <input
                      dir="ltr"
                      value={financingMonths}
                      onChange={(e) => setFinancingMonths(e.target.value)}
                      style={{ ...inputStyle, textAlign: "center" }}
                    />
                  </label>
                </div>
                <div style={{ fontSize: 11, color: C.faint }}>
                  التمويل: معدل سنوي × (المدة ÷ ١٢) × ٥٠٪ ={" "}
                  <b dir="ltr" style={{ color: C.goldText }}>
                    {(Math.round(financingPctLocal * 100) / 100).toFixed(2)}٪
                  </b>{" "}
                  · مبلغه{" "}
                  <b dir="ltr" style={{ color: C.goldText }}>
                    {fmt((directTotal * financingPctLocal) / 100)}
                  </b>
                </div>
                <div
                  style={{
                    display: "flex",
                    justifyContent: "space-between",
                    alignItems: "center",
                    padding: "10px 13px",
                    background: C.soft,
                    border: `1px solid ${C.border}`,
                    borderRadius: 9,
                  }}
                >
                  <span style={{ fontWeight: 700, fontSize: 12.5, color: C.ink }}>
                    مجموع النسب غير المباشرة
                  </span>
                  <span
                    dir="ltr"
                    style={{
                      fontWeight: 800,
                      fontSize: 15,
                      color: indirectSumLocal > 45 ? C.dangerText : C.ink,
                    }}
                  >
                    {(Math.round(indirectSumLocal * 100) / 100).toFixed(2)}٪
                  </span>
                </div>
                {indirectSumLocal > 45 ? (
                  <div style={{ fontSize: 11.5, fontWeight: 700, color: C.dangerText }}>
                    مجموع النسب غير المباشرة يتجاوز ٤٥٪ — يستلزم مراجعة
                  </div>
                ) : null}
                <div
                  style={{
                    display: "flex",
                    justifyContent: "space-between",
                    alignItems: "center",
                    padding: "10px 13px",
                    background: C.goldSoft,
                    border: `1px solid ${C.borderStrong}`,
                    borderRadius: 9,
                  }}
                >
                  <span style={{ fontWeight: 800, fontSize: 12.5, color: C.ink }}>
                    التكلفة الإجمالية
                  </span>
                  <span dir="ltr" style={{ fontWeight: 800, fontSize: 16, color: C.ink }}>
                    {fmt(totalCostLocal)}
                  </span>
                </div>
              </div>
            </CardPad>
          </Card>

          <Card style={{ marginBottom: 0 }}>
            <CardPad>
              <CardTitle>العمر والإهلاك</CardTitle>
              <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
                {(
                  [
                    ["العمر الفعلي (سنة)", actualAge, setActualAge, null, null],
                    ["العمر الاقتصادي (سنة)", economicAge, setEconomicAge, null, null],
                    [
                      "تمديد العمر (سنة)",
                      lifeExtension,
                      setLifeExtension,
                      lifeExtensionBasis,
                      setLifeExtensionBasis,
                    ],
                    [
                      "التقادم الوظيفي (٪)",
                      functionalObs,
                      setFunctionalObs,
                      functionalObsRationale,
                      setFunctionalObsRationale,
                    ],
                    [
                      "التقادم الخارجي (٪)",
                      externalObs,
                      setExternalObs,
                      externalObsRationale,
                      setExternalObsRationale,
                    ],
                  ] as const
                ).map(([label, val, setVal, just, setJust]) => (
                  <div
                    key={label}
                    style={{ display: "flex", alignItems: "center", gap: 8 }}
                  >
                    <span
                      style={{
                        fontSize: 12.5,
                        color: C.muted,
                        width: 128,
                        flexShrink: 0,
                      }}
                    >
                      {label}
                    </span>
                    {setJust ? (
                      <input
                        placeholder={
                          label.startsWith("تمديد")
                            ? "أساس تمديد العمر…"
                            : "مبرر التقدير…"
                        }
                        value={just ?? ""}
                        onChange={(e) => setJust(e.target.value)}
                        style={{
                          flex: 1,
                          padding: "6px 9px",
                          border: `1px dashed ${C.border}`,
                          borderRadius: 7,
                          background: C.soft,
                          fontSize: 11.5,
                        }}
                      />
                    ) : (
                      <span style={{ flex: 1 }} />
                    )}
                    <input
                      dir="ltr"
                      value={val}
                      onChange={(e) => setVal(e.target.value)}
                      style={{
                        width: 78,
                        padding: 7,
                        border: `1px solid ${C.borderStrong}`,
                        borderRadius: 7,
                        textAlign: "center",
                        fontWeight: 700,
                        flexShrink: 0,
                      }}
                    />
                  </div>
                ))}
                <div
                  style={{
                    display: "grid",
                    gridTemplateColumns: "1fr 1fr",
                    gap: 8,
                  }}
                >
                  <div
                    style={{
                      padding: "9px 12px",
                      background: C.soft,
                      border: `1px solid ${C.border}`,
                      borderRadius: 9,
                      fontSize: 11.5,
                      color: C.muted,
                    }}
                  >
                    التقادم المادي{" "}
                    <b dir="ltr" style={{ color: C.ink }}>
                      {cost?.physicalObsolescencePct != null
                        ? `${cost.physicalObsolescencePct}٪`
                        : "—"}
                    </b>
                  </div>
                  <div
                    style={{
                      padding: "9px 12px",
                      background: C.soft,
                      border: `1px solid ${C.border}`,
                      borderRadius: 9,
                      fontSize: 11.5,
                      color: C.muted,
                    }}
                  >
                    مجموع التقادم{" "}
                    <b
                      dir="ltr"
                      style={{
                        color:
                          (cost?.totalObsolescencePct ?? 0) > 100
                            ? C.dangerText
                            : C.ink,
                      }}
                    >
                      {cost ? `${cost.totalObsolescencePct}٪` : "—"}
                    </b>
                  </div>
                  <div
                    style={{
                      padding: "9px 12px",
                      background: C.soft,
                      border: `1px solid ${C.border}`,
                      borderRadius: 9,
                      fontSize: 11.5,
                      color: C.muted,
                    }}
                  >
                    قيمة الإهلاك{" "}
                    <b dir="ltr" style={{ color: C.dangerText }}>
                      {fmt(cost?.depreciationValue)}
                    </b>
                  </div>
                  <div
                    style={{
                      padding: "9px 12px",
                      background: C.goldSoft,
                      border: `1px solid ${C.borderStrong}`,
                      borderRadius: 9,
                      fontSize: 11.5,
                      color: C.muted,
                    }}
                  >
                    المباني بعد الإهلاك{" "}
                    <b dir="ltr" style={{ color: C.ink }}>
                      {fmt(cost?.buildingsValueAfterDepreciation)}
                    </b>
                  </div>
                </div>
              </div>
            </CardPad>
          </Card>
        </div>

        {/* النتائج والتوصيات — مواصفة النموذج التفاعلي */}
        <h2 style={{ fontWeight: 800, fontSize: 17, margin: "0 0 12px", color: C.ink }}>
          النتائج والتوصيات
        </h2>
        <Card style={{ marginBottom: 24 }}>
          <div style={{ display: "flex", alignItems: "stretch" }}>
            <div
              style={{
                flex: 1,
                padding: "18px 22px",
                borderInlineEnd: `1px solid ${C.border}`,
              }}
            >
              <div style={{ fontWeight: 500, fontSize: 12, color: C.muted, marginBottom: 9 }}>
                سعر متر المباني للعقار
              </div>
              <div dir="ltr" style={{ fontWeight: 800, fontSize: 24, lineHeight: 1, color: C.ink }}>
                {buildAreaLocal > 0 ? fmt(totalCostLocal / buildAreaLocal) : "—"}
              </div>
              <div style={{ fontSize: 11.5, color: C.faint, marginTop: 7 }}>
                قبل الإهلاك · التكلفة الإجمالية ÷{" "}
                <span dir="ltr">{fmt(buildAreaLocal, 1)}</span> م² مسطحات
              </div>
              <div style={{ fontWeight: 700, fontSize: 11.5, color: C.goldText, marginTop: 5 }}>
                بعد الإهلاك:{" "}
                <span dir="ltr">
                  {buildAreaLocal > 0 ? fmt(netValueLocal / buildAreaLocal) : "—"}
                </span>{" "}
                ر.س / م²
              </div>
            </div>
            <div
              style={{
                flex: 1.4,
                padding: "18px 22px",
                background: C.soft,
                position: "relative",
              }}
            >
              <span
                style={{
                  position: "absolute",
                  top: 0,
                  insetInlineStart: 0,
                  width: 3,
                  height: "100%",
                  background: C.gold,
                }}
              />
              <div style={{ fontWeight: 700, fontSize: 12, color: C.ink, marginBottom: 9 }}>
                ناتج أسلوب التكلفة — المباني دون الأرض
              </div>
              <div dir="ltr" style={{ fontWeight: 800, fontSize: 24, lineHeight: 1, color: C.ink }}>
                {fmt(netValueLocal)}
              </div>
              <div style={{ fontSize: 11.5, color: C.faint, marginTop: 7 }}>
                التكلفة الإجمالية − الإهلاك · بلا تقريب
              </div>
              <div style={{ fontWeight: 700, fontSize: 11.5, color: C.goldText, marginTop: 5 }}>
                {buildingOnly
                  ? "النطاق «مبنى فقط» — هذا هو مؤشر الأسلوب"
                  : landComplete
                    ? `مع قيمة الأرض: ${fmt(costValueLocal)} ر.س — للاسترشاد`
                    : "مؤشر الأسلوب غير مكتمل — يلزم قيمة الأرض"}
              </div>
            </div>
          </div>
        </Card>

        <Card>
          <CardPad>
            <div
              style={{
                display: "flex",
                alignItems: "center",
                justifyContent: "space-between",
                gap: 10,
                marginBottom: 12,
              }}
            >
              <span style={{ fontWeight: 800, fontSize: 14.5, color: C.ink }}>
                تحليل التكلفة
              </span>
              <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                <span
                  style={{
                    fontSize: 11,
                    fontWeight: 600,
                    color: costNarrativeDirty ? C.dangerText : C.goldText,
                  }}
                >
                  {costNarrativeDirty
                    ? "نص محرَّر يدوياً — لا يتحدث تلقائياً"
                    : "يتحدث تلقائياً مع المبررات"}
                </span>
                {costNarrativeDirty ? (
                  <GhostBtn
                    disabled={saving}
                    onClick={() => setCostAnalysisNotes("")}
                  >
                    ↺ استرجاع النص التلقائي
                  </GhostBtn>
                ) : null}
              </div>
            </div>
            <textarea
              rows={10}
              value={costNarrativeDirty ? costAnalysisNotes : costNarrativeAuto}
              onChange={(e) => setCostAnalysisNotes(e.target.value)}
              style={{
                width: "100%",
                padding: "14px 16px",
                border: `1px solid ${C.border}`,
                borderRadius: 9,
                background: C.soft,
                color: C.body,
                fontWeight: 500,
                fontSize: 13,
                lineHeight: 2,
                resize: "vertical",
              }}
            />
          </CardPad>
        </Card>

        <Card style={{ marginBottom: 24 }}>
          <div
            style={{
              padding: "12px 22px",
              borderBottom: `1px solid ${C.border}`,
              fontWeight: 800,
              fontSize: 13.5,
              color: C.ink,
            }}
          >
            تنبيهات أسلوب التكلفة
          </div>
          {costAlerts.map((a, i) => (
            <div
              key={i}
              role={a.kind === "error" ? "alert" : "status"}
              style={{
                display: "flex",
                alignItems: "flex-start",
                gap: 10,
                padding: "11px 22px",
                borderBottom: `1px solid ${C.border}`,
              }}
            >
              <span
                style={{
                  width: 9,
                  height: 9,
                  borderRadius: 99,
                  marginTop: 5,
                  flexShrink: 0,
                  background:
                    a.kind === "error"
                      ? C.danger
                      : a.kind === "warn"
                        ? "#d9a441"
                        : "#3f8f5f",
                }}
              />
              <div>
                <div
                  style={{
                    fontWeight: 700,
                    fontSize: 12.5,
                    color:
                      a.kind === "error"
                        ? C.dangerText
                        : a.kind === "warn"
                          ? "#a07a24"
                          : "#3f8f5f",
                  }}
                >
                  {a.title}
                </div>
                <div style={{ fontSize: 11.5, color: C.muted, marginTop: 2 }}>
                  {a.body}
                </div>
              </div>
            </div>
          ))}
        </Card>

        <PrimaryBtn disabled={saving} onClick={() => void saveCost()}>
          حفظ أسلوب التكلفة
        </PrimaryBtn>
      </>
    );
  }

  function renderFinal() {
    if (!settingsSaved) {
      return (
        <Card>
          <CardPad>
            <p style={{ color: C.muted, fontSize: 13 }}>
              احفظ إعدادات التقييم أولاً لفتح رأي القيمة النهائي.
            </p>
          </CardPad>
        </Card>
      );
    }

    const sole = recon && !recon.meetsMultiMethodGate;
    const {
      buildingOnlyScope,
      weightSumLocal,
      reconWeightsBad,
      weightedLocal,
      isLiquidation,
      forcedCut,
      finalLocal,
      roundNote,
      soleCost,
      methodComplete,
      opinionAuto,
    } = finalComputed;
    // محرَّر يدوياً فقط عندما يختلف عن النص الآلي (الحفظ يثبّت الآلي دون اعتباره تحريراً).
    const opinionDirty =
      methodsRationale.trim().length > 0 &&
      methodsRationale.trim() !== opinionAuto.trim();

    return (
      <>
        {!sole ? (
          <>
            <div
              style={{
                display: "flex",
                justifyContent: "space-between",
                marginBottom: 12,
              }}
            >
              <h2 style={{ fontWeight: 800, fontSize: 17, margin: 0, color: C.ink }}>
                التوفيق بين مؤشرات الأساليب
              </h2>
              <span style={{ fontSize: 12, color: C.faint }}>
                مجموع نسب المشاركة يجب أن يساوي ١٠٠٪
              </span>
            </div>
            <Card style={{ marginBottom: 24 }}>
              <div style={{ overflowX: "auto" }}>
                <table
                  style={{
                    width: "100%",
                    borderCollapse: "collapse",
                    minWidth: 900,
                  }}
                >
                  <thead>
                    <tr>
                      <th style={{ ...thStyle, textAlign: "start" }}>الأسلوب</th>
                      <th style={thStyle}>القيمة الناتجة</th>
                      <th style={thStyle}>نسبة المشاركة (٪)</th>
                      <th style={thStyle}>القيمة بعد المشاركة</th>
                      <th style={{ ...thStyle, textAlign: "start" }}>مبرر</th>
                    </tr>
                  </thead>
                  <tbody>
                    {reconMethods.map((m, idx) => {
                      const incomplete = !methodComplete(m.approachKind);
                      return (
                      <tr key={m.approachKind}>
                        <td style={{ ...tdStyle, textAlign: "start" }}>
                          <div style={{ fontWeight: 700, color: C.ink }}>{m.labelAr}</div>
                          <div style={{ fontSize: 10.5, color: C.faint, marginTop: 2 }}>
                            {m.approachKind === "cost"
                              ? buildingOnlyScope
                                ? "مبنى فقط — تكلفة الإحلال ناقصاً الإهلاك"
                                : "قيمة الأرض + تكلفة الإحلال − الإهلاك"
                              : "مؤشر قيمة من طريقة المقارنة"}
                          </div>
                        </td>
                        <td style={{ ...tdStyle, fontWeight: 800 }}>
                          {incomplete ? (
                            <span style={{ color: C.dangerText, fontSize: 12.5 }}>
                              غير مكتمل
                            </span>
                          ) : (
                            <span dir="ltr">{fmt(m.approachValue)}</span>
                          )}
                        </td>
                        <td style={tdStyle}>
                          <input
                            dir="ltr"
                            type="number"
                            min={0}
                            max={100}
                            step={5}
                            value={m.weightPct}
                            onChange={(e) => {
                              const next = [...reconMethods];
                              next[idx] = {
                                ...m,
                                weightPct:
                                  Number(e.target.value.replace(",", ".")) || 0,
                                isIncluded: true,
                              };
                              setReconMethods(next);
                            }}
                            style={{
                              width: 82,
                              padding: 8,
                              border: `1px solid ${reconWeightsBad ? C.danger : C.borderStrong}`,
                              borderRadius: 7,
                              textAlign: "center",
                              fontWeight: 700,
                              background: reconWeightsBad
                                ? "rgba(192,85,61,.07)"
                                : C.card,
                              color: reconWeightsBad ? C.dangerText : C.ink,
                            }}
                          />
                        </td>
                        <td style={{ ...tdStyle, fontWeight: 800 }}>
                          {incomplete ? (
                            <span style={{ color: C.faint }}>—</span>
                          ) : (
                            <span dir="ltr">
                              {fmt((m.approachValue * m.weightPct) / 100)}
                            </span>
                          )}
                        </td>
                        <td style={{ ...tdStyle, textAlign: "start" }}>
                          <input
                            value={m.rationale ?? ""}
                            onChange={(e) => {
                              const next = [...reconMethods];
                              next[idx] = { ...m, rationale: e.target.value };
                              setReconMethods(next);
                            }}
                            placeholder="مبرر نسبة المشاركة…"
                            style={{
                              width: "100%",
                              padding: "8px 10px",
                              border: `1px solid ${C.border}`,
                              borderRadius: 7,
                              fontSize: 12,
                            }}
                          />
                        </td>
                      </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
              <div
                style={{
                  display: "flex",
                  justifyContent: "space-between",
                  padding: "12px 16px",
                  background: C.soft,
                  borderTop: `1px solid ${C.border}`,
                }}
              >
                <span
                  style={{
                    fontWeight: 700,
                    fontSize: 12.5,
                    color: reconWeightsBad ? C.dangerText : "#3f8f5f",
                  }}
                >
                  مجموع نسب المشاركة: {weightSumLocal}٪
                  {reconWeightsBad ? " — يجب أن يساوي ١٠٠٪" : ""}
                </span>
                <span
                  style={{
                    fontWeight: 700,
                    fontSize: 13,
                    color: reconWeightsBad ? C.dangerText : C.ink,
                  }}
                >
                  القيمة المرجّحة:{" "}
                  <span dir="ltr">{fmt(weightedLocal)}</span> ريال
                </span>
              </div>
            </Card>
          </>
        ) : (
          <Card>
            <CardPad>
              <p style={{ fontSize: 12.5, color: C.muted, marginBottom: 12 }}>
                أسلوب واحد مفعّل — لا توفيق بين مؤشرات (n = 1). القيمة النهائية = مؤشر
                الأسلوب الوحيد بوزن ١٠٠٪.
              </p>
              {reconMethods.map((m) => (
                <div
                  key={m.approachKind}
                  style={{
                    padding: "12px 14px",
                    borderRadius: 10,
                    background: C.goldSoft,
                    border: `1px solid ${C.borderStrong}`,
                    marginBottom: 8,
                  }}
                >
                  <div style={{ fontWeight: 700, color: C.ink }}>{m.labelAr}</div>
                  <div style={{ fontSize: 12, color: C.muted, marginTop: 4 }}>
                    <span dir="ltr">{fmt(m.approachValue)}</span> ر.س · وزن ١٠٠٪
                  </div>
                </div>
              ))}
            </CardPad>
          </Card>
        )}

        <Card>
          <CardPad>
            <div style={{ position: "relative", paddingInlineStart: 12 }}>
              <span
                style={{
                  position: "absolute",
                  top: 0,
                  insetInlineStart: 0,
                  width: 3,
                  height: "100%",
                  background: C.gold,
                  borderRadius: 99,
                }}
              />
              <div
                style={{
                  display: "flex",
                  justifyContent: "space-between",
                  marginBottom: 14,
                  flexWrap: "wrap",
                  gap: 8,
                }}
              >
                <div style={{ fontWeight: 800, fontSize: 14, color: C.ink }}>
                  الرأي النهائي للقيمة
                </div>
                <div style={{ fontSize: 11.5, color: C.faint }}>
                  {officialValuationDate
                    ? `قيمة العقار محل التقييم في تاريخ ${officialValuationDate}`
                    : "قيمة العقار محل التقييم — يُثبَّت التاريخ عند اعتماد التقييم"}
                </div>
              </div>

              <div
                style={{
                  display: "grid",
                  gridTemplateColumns: "1fr 1fr",
                  gap: 12,
                  marginBottom: 16,
                }}
              >
                <label style={{ display: "flex", flexDirection: "column", gap: 6 }}>
                  <FieldLabel>أساس القيمة</FieldLabel>
                  <select
                    value={basisOfValueKey}
                    onChange={(e) => {
                      const next = e.target.value;
                      setBasisOfValueKey(next);
                      // مواصفة النموذج: خصم البيع القسري لا يُفعَّل إلا مع «قيمة التصفية»
                      // — تغيير الأساس يصفّر الخصم.
                      if (next === "liquidation") {
                        if (
                          valuePremiseKey !== "orderly" &&
                          valuePremiseKey !== "forced"
                        ) {
                          setValuePremiseKey("forced");
                        }
                      } else {
                        setLiquidationDiscountPct("0");
                        if (
                          valuePremiseKey === "orderly" ||
                          valuePremiseKey === "forced"
                        ) {
                          setValuePremiseKey("current");
                        }
                      }
                    }}
                    style={{ ...inputStyle, fontWeight: 500, cursor: "pointer" }}
                  >
                    {basisOptions.map((o) => (
                      <option key={o.value} value={o.value}>
                        {o.label}
                      </option>
                    ))}
                  </select>
                </label>
                <label style={{ display: "flex", flexDirection: "column", gap: 6 }}>
                  <FieldLabel>فرضية القيمة</FieldLabel>
                  <select
                    value={valuePremiseKey}
                    onChange={(e) => setValuePremiseKey(e.target.value)}
                    style={{ ...inputStyle, fontWeight: 500, cursor: "pointer" }}
                  >
                    <option value="">— اختر —</option>
                    {(premiseOptions.length
                      ? premiseOptions.filter((o) =>
                          basisOfValueKey === "liquidation"
                            ? o.value === "orderly" || o.value === "forced"
                            : o.value === "hau" || o.value === "current",
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
                    ).map((o) => (
                      <option key={o.value} value={o.value}>
                        {o.label}
                      </option>
                    ))}
                  </select>
                </label>
              </div>

              {/* دفتر القيمة — مواصفة النموذج التفاعلي (invoiceRows) */}
              <div
                style={{
                  border: `1px solid ${C.border}`,
                  borderRadius: 10,
                  overflow: "hidden",
                  marginBottom: 16,
                }}
              >
                {soleCost && !buildingOnlyScope ? (
                  <>
                    <LedgerRow
                      label="قيمة الأرض"
                      note={
                        cost?.landEstimateComplete
                          ? `${fmt(cost?.landUnitRateAfterDiscount)} ر.س/م² × ${fmt(
                              cost?.apartmentLandShareSqm || cost?.landAreaSqm,
                            )} م²`
                          : "بانتظار المقارنات"
                      }
                      value={
                        cost?.landEstimateComplete
                          ? fmt(cost?.landValueFromMarket)
                          : "—"
                      }
                    />
                    <LedgerRow
                      label="+ قيمة المباني بعد الإهلاك"
                      note="تكلفة الإحلال − الإهلاك"
                      value={fmt(cost?.buildingsValueAfterDepreciation)}
                    />
                  </>
                ) : null}
                {reconMethods.map((m) => {
                  const done = methodComplete(m.approachKind);
                  return (
                    <LedgerRow
                      key={m.approachKind}
                      label={`${soleCost && !buildingOnlyScope ? "= " : ""}مؤشر ${m.labelAr}`}
                      note={
                        reconMethods.length === 1
                          ? "وزنه ١٠٠٪"
                          : `وزنه ${m.weightPct}٪`
                      }
                      value={done ? fmt(m.approachValue) : "غير مكتمل"}
                      valueColor={done ? undefined : C.dangerText}
                    />
                  );
                })}
                {reconMethods.length >= 2 ? (
                  <LedgerRow
                    label="القيمة المرجّحة"
                    note="مجموع المؤشرات بأوزانها"
                    value={fmt(weightedLocal)}
                    strong
                  />
                ) : null}
                {isLiquidation ? (
                  <div
                    style={{
                      display: "flex",
                      alignItems: "center",
                      gap: 10,
                      padding: "11px 16px",
                      borderBottom: `1px solid ${C.border}`,
                      background: "var(--red-light)",
                    }}
                  >
                    <div style={{ flex: 1 }}>
                      <div style={{ fontWeight: 700, fontSize: 12.5, color: C.dangerText }}>
                        − خصم البيع القسري
                      </div>
                      <div style={{ fontSize: 10.5, color: C.faint, marginTop: 2 }}>
                        ٪ من القيمة قبل الخصم
                      </div>
                    </div>
                    <input
                      value={liquidationDiscountRationale}
                      placeholder="مبرر معامل التصفية…"
                      onChange={(e) =>
                        setLiquidationDiscountRationale(e.target.value)
                      }
                      style={{
                        flex: 1.2,
                        padding: "6px 9px",
                        border: `1px dashed ${C.border}`,
                        borderRadius: 7,
                        background: C.card,
                        fontSize: 11.5,
                      }}
                    />
                    <input
                      dir="ltr"
                      type="number"
                      min={0}
                      max={90}
                      step={5}
                      value={liquidationDiscountPct}
                      onChange={(e) => setLiquidationDiscountPct(e.target.value)}
                      style={{
                        width: 66,
                        padding: 7,
                        border: `1px solid ${C.borderStrong}`,
                        borderRadius: 7,
                        textAlign: "center",
                        fontWeight: 700,
                      }}
                    />
                    <span
                      dir="ltr"
                      style={{
                        width: 110,
                        textAlign: "end",
                        fontWeight: 800,
                        fontSize: 13.5,
                        color: C.dangerText,
                      }}
                    >
                      −{fmt(forcedCut)}
                    </span>
                  </div>
                ) : null}
                <div
                  style={{
                    display: "flex",
                    alignItems: "center",
                    gap: 10,
                    padding: "11px 16px",
                    borderBottom: `1px solid ${C.border}`,
                  }}
                >
                  <div style={{ flex: 1 }}>
                    <div style={{ fontWeight: 700, fontSize: 12.5, color: C.ink }}>
                      تقريب القيمة
                    </div>
                    <div style={{ fontSize: 10.5, color: C.faint, marginTop: 2 }}>
                      {roundNote}
                    </div>
                  </div>
                  <input
                    dir="ltr"
                    type="number"
                    min={0}
                    max={6}
                    step={1}
                    value={finalRoundDecimals}
                    onChange={(e) => setFinalRoundDecimals(e.target.value)}
                    style={{
                      width: 66,
                      padding: 7,
                      border: `1px solid ${C.borderStrong}`,
                      borderRadius: 7,
                      textAlign: "center",
                      fontWeight: 700,
                    }}
                  />
                </div>
                <div
                  style={{
                    display: "flex",
                    alignItems: "baseline",
                    justifyContent: "space-between",
                    gap: 10,
                    padding: "14px 16px",
                    background: C.goldSoft,
                  }}
                >
                  <div style={{ fontWeight: 800, fontSize: 14, color: C.ink }}>
                    = القيمة النهائية
                  </div>
                  <div style={{ textAlign: "end" }}>
                    <div
                      dir="ltr"
                      style={{
                        fontWeight: 800,
                        fontSize: 32,
                        color: C.ink,
                        letterSpacing: "-0.02em",
                      }}
                    >
                      {fmt(finalLocal)}
                    </div>
                    <div style={{ fontSize: 11.5, color: C.faint, marginTop: 3 }}>
                      ريال سعودي · كتابةً: {amountWordsOrZero(finalLocal)}
                    </div>
                  </div>
                </div>
              </div>

              {/* نص الرأي النهائي — آلي حتى يُحرَّر */}
              <div
                style={{
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "space-between",
                  gap: 10,
                  marginBottom: 8,
                }}
              >
                <span style={{ fontWeight: 700, fontSize: 12.5, color: C.ink }}>
                  نص الرأي النهائي (مبرر استخدام الطرق)
                </span>
                <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                  <span
                    style={{
                      fontSize: 11,
                      fontWeight: 600,
                      color: opinionDirty ? C.dangerText : C.goldText,
                    }}
                  >
                    {opinionDirty
                      ? "نص محرَّر يدوياً — لا يتحدث تلقائياً"
                      : "يتحدث تلقائياً مع المدخلات"}
                  </span>
                  {opinionDirty ? (
                    <GhostBtn disabled={saving} onClick={() => setMethodsRationale("")}>
                      ↺ استرجاع النص التلقائي
                    </GhostBtn>
                  ) : null}
                </div>
              </div>
              <textarea
                rows={6}
                value={opinionDirty ? methodsRationale : opinionAuto}
                onChange={(e) => setMethodsRationale(e.target.value)}
                style={{
                  width: "100%",
                  padding: "12px 14px",
                  border: `1px solid ${C.border}`,
                  borderRadius: 9,
                  background: C.soft,
                  color: C.body,
                  fontWeight: 500,
                  fontSize: 12.5,
                  lineHeight: 1.9,
                  resize: "vertical",
                }}
              />
            </div>

            <div style={{ marginTop: 18, display: "flex", gap: 10, flexWrap: "wrap" }}>
              <PrimaryBtn
                disabled={saving || reconMethods.length === 0}
                onClick={() => void saveReconciliation()}
              >
                {sole ? "حفظ الرأي النهائي" : "حفظ التوفيق والرأي النهائي"}
              </PrimaryBtn>
              <GhostBtn disabled={saving} onClick={() => void openReportPreview()}>
                معاينة التقرير
              </GhostBtn>
            </div>
          </CardPad>
        </Card>

        {gates ? (
          <Card>
            <CardPad>
              <CardTitle>اعتماد التقييم — شروط الإصدار</CardTitle>
              <p style={{ fontSize: 11.5, color: C.faint, marginBottom: 10 }}>
                المنع يقع عند الاعتماد فقط — الإدخال الجزئي محفوظ كمسوّدة.
              </p>
              <p style={{ fontSize: 13, color: C.body, marginBottom: 10 }}>
                الحالة:{" "}
                <strong style={{ color: gates.allowsIssuance ? "#2f7a4d" : C.dangerText }}>
                  {gates.allowsIssuance
                    ? "كل شروط الاعتماد مستوفاة ✓"
                    : "الاعتماد ممنوع ✗"}
                </strong>
              </p>
              <ul style={{ listStyle: "none", margin: 0, padding: 0 }}>
                {gates.gates.map((g) => (
                  <li
                    key={g.code}
                    style={{
                      display: "flex",
                      gap: 8,
                      fontSize: 12.5,
                      marginBottom: 6,
                      color: g.passed ? C.body : C.dangerText,
                    }}
                  >
                    <span>{g.passed ? "✓" : "✗"}</span>
                    <span>{g.labelAr}</span>
                    {g.detailAr ? (
                      <span style={{ color: C.faint }}>— {g.detailAr}</span>
                    ) : null}
                  </li>
                ))}
              </ul>

              {/* التنبيهات المنهجية (21) — المعالجة بمبرر نصي أو إقرار حسب فئة التنبيه */}
              <div
                style={{
                  marginTop: 16,
                  paddingTop: 14,
                  borderTop: `1px solid ${C.border}`,
                }}
              >
                <div
                  style={{
                    display: "flex",
                    alignItems: "baseline",
                    justifyContent: "space-between",
                    gap: 10,
                    marginBottom: 10,
                    flexWrap: "wrap",
                  }}
                >
                  <span style={{ fontWeight: 800, fontSize: 13.5, color: C.ink }}>
                    التنبيهات المنهجية
                  </span>
                  <span style={{ fontSize: 11, color: C.faint }}>
                    {gates.methodologyAlertsNoteAr} · تُحفَظ المعالجات مع «حفظ
                    التوفيق والرأي النهائي»
                  </span>
                </div>
                {gates.methodologyAlerts.filter((a) => a.triggered).length === 0 ? (
                  <div style={{ fontSize: 12.5, color: "#2f7a4d", fontWeight: 700 }}>
                    ✓ لا تنبيهات منهجية مفعّلة
                  </div>
                ) : (
                  gates.methodologyAlerts
                    .filter((a) => a.triggered)
                    .map((a) => {
                      const ov = alertOverrides[a.code] ?? {
                        overrideRationale: "",
                        acknowledged: false,
                      };
                      const needsRationale = a.severityKind === "require_rationale";
                      const needsAck = a.severityKind === "require_ack";
                      return (
                        <div
                          key={a.code}
                          style={{
                            display: "flex",
                            flexDirection: "column",
                            gap: 6,
                            padding: "10px 12px",
                            marginBottom: 8,
                            borderRadius: 9,
                            border: `1px solid ${a.blocksIssuance ? C.danger : C.border}`,
                            background: a.blocksIssuance ? "var(--red-light)" : C.soft,
                          }}
                        >
                          <div
                            style={{
                              display: "flex",
                              alignItems: "center",
                              gap: 8,
                              flexWrap: "wrap",
                            }}
                          >
                            <span
                              style={{
                                width: 9,
                                height: 9,
                                borderRadius: 99,
                                flexShrink: 0,
                                background: a.isHard
                                  ? C.danger
                                  : a.blocksIssuance
                                    ? "#d9a441"
                                    : "#3f8f5f",
                              }}
                            />
                            <span
                              style={{ fontWeight: 700, fontSize: 12.5, color: C.ink }}
                            >
                              {a.number}. {a.labelAr}
                            </span>
                            <span
                              style={{
                                fontSize: 10.5,
                                fontWeight: 700,
                                padding: "2px 8px",
                                borderRadius: 99,
                                background: C.card,
                                border: `1px solid ${C.border}`,
                                color: a.isHard ? C.dangerText : C.goldText,
                              }}
                            >
                              {a.isHard
                                ? "حاجب"
                                : needsRationale
                                  ? "يتطلب مبرراً نصياً"
                                  : "يتطلب إقراراً"}
                            </span>
                            {a.detailAr ? (
                              <span style={{ fontSize: 11.5, color: C.muted }}>
                                {a.detailAr}
                              </span>
                            ) : null}
                          </div>
                          {needsRationale ? (
                            <input
                              value={ov.overrideRationale}
                              placeholder="المبرر النصي لتجاوز التنبيه…"
                              onChange={(e) =>
                                setAlertOverrides((prev) => ({
                                  ...prev,
                                  [a.code]: {
                                    overrideRationale: e.target.value,
                                    acknowledged: prev[a.code]?.acknowledged ?? false,
                                  },
                                }))
                              }
                              style={{
                                padding: "7px 10px",
                                border: `1px dashed ${C.borderStrong}`,
                                borderRadius: 7,
                                background: C.card,
                                fontSize: 12,
                              }}
                            />
                          ) : null}
                          {needsAck ? (
                            <label
                              style={{
                                display: "inline-flex",
                                alignItems: "center",
                                gap: 8,
                                fontSize: 12,
                                color: C.body,
                                cursor: "pointer",
                              }}
                            >
                              <input
                                type="checkbox"
                                checked={ov.acknowledged}
                                onChange={(e) =>
                                  setAlertOverrides((prev) => ({
                                    ...prev,
                                    [a.code]: {
                                      overrideRationale:
                                        prev[a.code]?.overrideRationale ?? "",
                                      acknowledged: e.target.checked,
                                    },
                                  }))
                                }
                                style={{ width: 15, height: 15 }}
                              />
                              أقرّ بالاطلاع على هذا التنبيه والوعي بأثره
                            </label>
                          ) : null}
                          {a.isHard ? (
                            <span style={{ fontSize: 11, color: C.dangerText }}>
                              تنبيه حاجب — يُعالَج بتصحيح المدخلات نفسها لا
                              بالتجاوز.
                            </span>
                          ) : null}
                        </div>
                      );
                    })
                )}
              </div>
            </CardPad>
          </Card>
        ) : null}
      </>
    );
  }

  return (
    <div
      dir="rtl"
      style={{
        position: "relative",
        minHeight: 480,
      }}
    >
      {/* رأس مساحة العمل وأشرطة الشاشات — بطاقة واحدة عائمة بلغة بطاقات النظام. */}
      <div
        style={{
          background: C.card,
          border: `1px solid ${C.border}`,
          borderRadius: "var(--radius-lg)",
          boxShadow: "var(--shadow)",
          overflow: "hidden",
        }}
      >
      <header
        style={{
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          gap: 18,
          padding: "14px 22px",
          borderBottom: `1px solid ${C.border}`,
        }}
      >
        <h1
          style={{
            fontWeight: 800,
            fontSize: 17,
            margin: 0,
            color: C.ink,
            letterSpacing: "-0.01em",
          }}
        >
          {pageMeta.title}
        </h1>
        <div
          style={{
            display: "flex",
            alignItems: "center",
            gap: 7,
            height: 38,
            padding: "0 13px",
            border: `1px solid ${C.borderStrong}`,
            borderRadius: "var(--radius)",
            background: C.soft,
            color: C.muted,
            fontSize: 13,
            fontWeight: 500,
          }}
        >
          <span>تاريخ التقييم</span>
          <b dir="ltr" style={{ color: C.ink }}>
            {valDate}
          </b>
        </div>
      </header>

      <nav
        style={{
          display: "flex",
          gap: 6,
          padding: "12px 22px",
          flexWrap: "wrap",
        }}
      >
        {navItems
          .filter((n) => n.show)
          .map((n) => {
            const active = screen === n.id;
            return (
              <button
                key={n.id}
                type="button"
                onClick={() => setScreen(n.id)}
                style={{
                  display: "inline-flex",
                  alignItems: "center",
                  gap: 8,
                  padding: "8px 14px",
                  borderRadius: 99,
                  border: `1px solid ${active ? C.inkFill : C.borderStrong}`,
                  background: active ? C.inkFill : C.card,
                  color: active ? "#fff" : C.body,
                  fontWeight: 700,
                  fontSize: 12.5,
                  cursor: "pointer",
                }}
              >
                {n.label}
                {n.badge != null ? (
                  <span
                    style={{
                      minWidth: 17,
                      height: 17,
                      borderRadius: 99,
                      display: "grid",
                      placeItems: "center",
                      padding: "0 5px",
                      background: active
                        ? "rgba(200,181,145,.35)"
                        : C.goldSoft,
                      color: active ? "#fff" : C.goldText,
                      fontWeight: 700,
                      fontSize: 9.5,
                    }}
                  >
                    {n.badge}
                  </span>
                ) : null}
              </button>
            );
          })}
      </nav>
      </div>

      <div style={{ padding: "18px 0 8px", position: "relative" }}>
        {error ? (
          <p style={{ color: C.dangerText, fontSize: 12.5, marginBottom: 12 }}>
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
                  <div
                    className="mt-4 grid gap-3"
                    style={{
                      gridTemplateColumns:
                        "repeat(auto-fit, minmax(180px, 1fr))",
                    }}
                  >
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
        {!loading && screen === "basic" ? renderBasic() : null}
        {!loading && screen === "market" ? renderMarket() : null}
        {!loading && screen === "cost" ? renderCost() : null}
        {!loading && screen === "final" ? renderFinal() : null}
      </div>

      {/* شريحة القيم الملخّصة — لا تظهر أثناء التحميل ولا على شاشة الإعدادات (لا قيم بعد). */}
      {loading || screen === "basic" ? null : (
      <div
        style={{
          position: "sticky",
          bottom: 16,
          marginInlineStart: 16,
          marginBottom: 8,
          zIndex: 40,
          display: "inline-flex",
          alignItems: "center",
          gap: 14,
          padding: "10px 16px",
          borderRadius: "var(--radius-lg)",
          background: C.card,
          border: `1px solid ${C.borderStrong}`,
          borderInlineStart: `3px solid ${C.gold}`,
          boxShadow: "var(--shadow-lg)",
          maxWidth: "calc(100% - 32px)",
        }}
      >
        <div>
          <div style={{ fontWeight: 600, fontSize: 10.5, color: C.faint }}>
            {pageMeta.barMainLabel}
          </div>
          <div
            dir="ltr"
            style={{
              fontWeight: 800,
              fontSize: 19,
              lineHeight: 1.25,
              textAlign: "start",
              color: C.ink,
            }}
          >
            {pageMeta.barMainValue}
          </div>
        </div>
        <div
          style={{
            width: 1,
            height: 30,
            background: C.border,
          }}
        />
        <div>
          <div style={{ fontWeight: 600, fontSize: 10.5, color: C.faint }}>
            {pageMeta.barSubLabel}
          </div>
          <div
            dir="ltr"
            style={{
              fontWeight: 700,
              fontSize: 14,
              lineHeight: 1.25,
              textAlign: "start",
              color: C.goldText,
            }}
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
