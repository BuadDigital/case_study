"use client";

import { memo, useMemo, useState, type ReactNode } from "react";
import { cn } from "@platform/ui-kit";
import type {
  ValuationComparableAdjustmentLineDto,
  ValuationComparableSelectionDto,
  ValuationComparableSelectionListDto,
} from "@platform/api-client";
import { fmt } from "./lib/shell-utils";

const SEQUENTIAL = new Set(["financing", "market", "transaction_type"]);
const AUTO_AREA = "area";

const FACTOR_META: Record<
  string,
  { label: string; hint: string; tip: string }
> = {
  financing: {
    label: "تسوية شروط التمويل",
    hint: "نسبة ٪ — تسلسلية",
    tip: "أثر شروط البيع والتمويل غير النقدية على السعر المرصود.",
  },
  market: {
    label: "تسوية ظروف السوق",
    hint: "تُدخل يدوياً — يظهر عمر الصفقة للاستدلال",
    tip: "فرق الزمن بين تاريخ المقارن وتاريخ التقييم — يقدّرها المقيّم يدوياً.",
  },
  transaction_type: {
    label: "تسوية نوع المقارن",
    hint: "صفقة / عرض / حد / سوم",
    tip: "الفرق بين سعر المقارن وسعر السوق بحسب نوعه.",
  },
  area: {
    label: "المساحة",
    hint: "آلية",
    tip: "فرق مساحة القطعة عن مساحة المقارن، مقيساً بطريقة المضاعف أو الأمثال. المقارن الأصغر يأخذ تسوية سالبة والأكبر موجبة.",
  },
  ideal_area: {
    label: "المساحة المثالية",
    hint: "قرب المساحة من السائد في الحي",
    tip: "قرب مساحة القطعة من المساحة السائدة للاستخدام في الحي. لا يشمل الفرق العددي في المساحة.",
  },
  location: {
    label: "الموقع",
    hint: "أفضلية الحي أو المنطقة",
    tip: "أفضلية الحي أو المنطقة مقارنةً بغيرها. لا يشمل القرب من معلم محدد.",
  },
  attraction: {
    label: "عامل الجذب للموقع",
    hint: "القرب من معلم أو مرفق يرفع الطلب",
    tip: "القرب من معلم أو مرفق محدد يرفع الطلب.",
  },
  access: {
    label: "سهولة الوصول",
    hint: "موضع القطعة داخل نسيج الحي",
    tip: "موضع القطعة داخل نسيج الحي وسهولة بلوغها.",
  },
  street_count: {
    label: "عدد الشوارع",
    hint: "عدد الواجهات المطلة",
    tip: "عدد الشوارع المطلة عليها القطعة. لا يشمل عرضها.",
  },
  street_lengths: {
    label: "أطوال الشوارع",
    hint: "عرض الشوارع وأطوال الواجهات",
    tip: "عرض الشوارع المطلة على القطعة وأطوال واجهاتها عليها.",
  },
};

/** عوامل الاختلاف التي لا تحمل خلية وصف/عمود عقار قابل للتحرير (الموقع من المدينة/الحي، والمثالية رقمية). */
const NO_SPEC_KEYS = new Set(["location"]);

function pct(n: number): string {
  const rounded = Math.round(n * 100) / 100;
  const sign = rounded > 0 ? "+" : "";
  return `${sign}${rounded.toFixed(2)}%`;
}

function pctClass(n: number): string {
  if (n > 0) return "text-[#2f7a4d]";
  if (n < 0) return "text-danger-text";
  return "text-text-2";
}

function metaFor(factorKey: string, labelAr?: string) {
  const m = FACTOR_META[factorKey];
  return {
    label: labelAr || m?.label || factorKey,
    hint: m?.hint ?? "",
    tip: m?.tip ?? "",
  };
}

/** compEdit: القيم الفعلية للمقارن بعد تجاوزات هذا التقييم. */
function effPrice(item: ValuationComparableSelectionDto): number {
  return item.effectivePriceSar ?? item.comparable.price;
}
function effUnit(item: ValuationComparableSelectionDto): number {
  return item.effectivePricePerSqm ?? item.comparable.pricePerSqm;
}
function effArea(item: ValuationComparableSelectionDto): number {
  return item.effectiveAreaSqm ?? item.comparable.areaSqm;
}

/* ─── أصناف ثابتة على مستوى الوحدة — رموز النظام (هوية إجادة والوضع الداكن) عبر Tailwind ─── */
const thBandClass =
  "border-b-2 border-b-gold bg-surface-2 px-4 py-[13px] text-start text-[12px] font-bold text-heading";
const thCompBaseClass =
  "min-w-[126px] border-b-2 border-b-gold px-3 py-[11px] text-center text-[12px] font-bold text-heading";
const thCompClass = cn(
  thCompBaseClass,
  "border-s border-s-border bg-surface-2",
);
const tdLabelClass =
  "border-b border-border px-4 py-[9px] text-start align-top";
const tdSubjClass =
  "min-w-[150px] border-x border-b border-border bg-surface-2 px-2.5 py-[7px] text-center align-middle";
const tdCellClass =
  "border-b border-s border-border px-2.5 py-[7px] text-center align-middle";
const tdJustClass =
  "min-w-[230px] border-b border-s border-border px-3 py-[7px] text-start align-middle";
const noteClass = "mt-[3px] text-[10px] font-normal text-text-3";
const cellInputBaseClass =
  "w-24 rounded-[7px] border px-2 py-[7px] text-center text-[13px] font-bold";
const panelCardClass =
  "mb-6 overflow-hidden rounded-xl border border-border bg-surface shadow-card";

/* ─── مكوّنات خلايا على مستوى الوحدة —
   تعريفها داخل المكوّن الأب يجعل React يعيد تركيبها بالكامل مع كل رسم
   (فقدان تركيز الحقول وبطء ملموس) — rerender-no-inline-components. ─── */

function LabelCell({
  label,
  hint,
  tip,
  definition,
  locked,
  pickable,
  picked,
  onPick,
  removable,
  included,
  onToggle,
  offNote,
  areaFactor,
  onAreaFactorChange,
  deleteKey,
  confirmDelete,
  onConfirmDelete,
  onDelete,
}: {
  label: string;
  hint?: string;
  tip?: string;
  definition?: string;
  locked: boolean;
  pickable?: boolean;
  picked?: boolean;
  onPick?: () => void;
  removable?: boolean;
  included?: boolean;
  onToggle?: () => void;
  offNote?: string;
  /** حاضرة فقط في صف المساحة — «نسبة التسوية لكل مثل أو مضاعف». */
  areaFactor?: number;
  onAreaFactorChange?: (value: string) => void;
  /** حذف بخطوتين: × → «حذف؟ ✓ ×». */
  deleteKey?: string;
  confirmDelete?: string | null;
  onConfirmDelete?: (key: string | null) => void;
  onDelete?: () => void;
}) {
  return (
    <td className={tdLabelClass}>
      <div className="flex items-start gap-2">
        <div className="min-w-0 flex-1">
          <div
            title={tip || definition || undefined}
            className="cursor-default text-[12.5px] font-bold leading-[1.35] text-heading"
          >
            {label}
          </div>
          {hint ? (
            <div className="mt-px text-[10.5px] font-normal leading-[1.4] text-text-3">
              {hint}
            </div>
          ) : null}
        </div>
        {pickable ? (
          <button
            type="button"
            title={
              picked
                ? "الأساس المعتمد في التسويات"
                : "اعتماد هذا الأساس في التسويات"
            }
            disabled={locked}
            onClick={onPick}
            className={cn(
              "ms-auto grid size-6 shrink-0 cursor-pointer place-items-center rounded-full border text-[13px] font-bold leading-none text-gold-d disabled:cursor-not-allowed",
              picked ? "border-gold bg-gold-soft" : "border-border bg-surface",
            )}
          >
            {picked ? "●" : ""}
          </button>
        ) : null}
        {removable ? (
          <button
            type="button"
            title={
              included === false
                ? "تفعيل احتساب البند"
                : "استبعاد البند من الاحتساب"
            }
            disabled={locked}
            onClick={onToggle}
            className={cn(
              "grid size-6 shrink-0 cursor-pointer place-items-center rounded-[7px] border text-[13px] font-bold leading-none text-gold-d disabled:cursor-not-allowed",
              included === false
                ? "border-border bg-surface"
                : "border-gold bg-gold-soft",
            )}
          >
            {included === false ? "" : "✓"}
          </button>
        ) : null}
        {deleteKey && onDelete && onConfirmDelete ? (
          confirmDelete === deleteKey ? (
            <span className="inline-flex shrink-0 items-center gap-1">
              <span className="text-[10.5px] font-bold text-danger">
                حذف؟
              </span>
              <button
                type="button"
                title="تأكيد الحذف"
                disabled={locked}
                onClick={() => {
                  onConfirmDelete(null);
                  onDelete();
                }}
                className="grid size-[22px] cursor-pointer place-items-center rounded-[7px] border border-danger bg-danger-bg text-[12px] font-bold leading-none text-danger-text disabled:cursor-not-allowed"
              >
                ✓
              </button>
              <button
                type="button"
                title="إلغاء"
                onClick={() => onConfirmDelete(null)}
                className="grid size-[22px] cursor-pointer place-items-center rounded-[7px] border border-border bg-surface text-[12px] font-bold leading-none text-text-2"
              >
                ×
              </button>
            </span>
          ) : (
            <button
              type="button"
              title="حذف البند من الجدول"
              disabled={locked}
              onClick={() => onConfirmDelete(deleteKey)}
              className="grid size-6 shrink-0 cursor-pointer place-items-center rounded-[7px] border border-border bg-surface text-[13px] font-bold leading-none text-text-3 disabled:cursor-not-allowed"
            >
              ×
            </button>
          )
        ) : null}
      </div>
      {offNote ? (
        <div className="mt-[3px] text-[10.5px] font-semibold text-danger">
          {offNote}
        </div>
      ) : null}
      {areaFactor != null && onAreaFactorChange ? (
        <label className="mt-1.5 flex items-center gap-[7px]">
          <span className="text-[10.5px] font-medium text-gold-d">
            نسبة التسوية لكل مثل أو مضاعف (٪)
          </span>
          <input
            dir="ltr"
            type="number"
            min={0}
            max={50}
            step={0.5}
            disabled={locked}
            defaultValue={String(areaFactor)}
            onBlur={(e) => onAreaFactorChange(e.target.value)}
            className="w-16 rounded-[7px] border border-border-md bg-surface px-[7px] py-[5px] text-center text-[12px] font-bold text-heading"
          />
        </label>
      ) : null}
    </td>
  );
}

function SubjCell({ value, note }: { value: string; note?: string }) {
  return (
    <td className={tdSubjClass}>
      <span className="text-[12.5px] font-bold text-gold-d">{value}</span>
      {note ? <div className={noteClass}>{note}</div> : null}
    </td>
  );
}

function JustCell({
  factorKey,
  value,
  locked,
  onDraft,
  onSave,
}: {
  factorKey?: string;
  value?: string;
  locked?: boolean;
  onDraft?: (factorKey: string, value: string) => void;
  onSave?: (factorKey: string) => void;
}) {
  if (!factorKey || !onDraft || !onSave) {
    return <td className={tdJustClass} />;
  }
  return (
    <td className={tdJustClass}>
      <input
        type="text"
        value={value ?? ""}
        disabled={locked}
        placeholder="مبرّر التسوية؟"
        onChange={(e) => onDraft(factorKey, e.target.value)}
        onBlur={() => onSave(factorKey)}
        className="w-full rounded-[7px] border border-border bg-surface px-2.5 py-[7px] text-[12px] font-medium text-text"
      />
    </td>
  );
}

function CompReadonly({
  value,
  note,
  valueClassName = "text-heading",
}: {
  value: string;
  note?: string;
  valueClassName?: string;
}) {
  return (
    <td className={tdCellClass}>
      <span
        dir="ltr"
        className={cn(
          "font-[Tajawal,sans-serif] text-[14px] font-extrabold",
          valueClassName,
        )}
      >
        {value}
      </span>
      {note ? <div className={noteClass}>{note}</div> : null}
    </td>
  );
}

function CompInput({
  cellKey,
  value,
  disabled,
  muted,
  auto,
  note,
  extra,
  onDraft,
  onSave,
}: {
  cellKey: string;
  value: string;
  disabled: boolean;
  muted: boolean;
  auto?: boolean;
  note?: string;
  extra?: ReactNode;
  onDraft: (key: string, value: string) => void;
  onSave?: () => void;
}) {
  return (
    <td className={tdCellClass}>
      <input
        dir="ltr"
        type="text"
        disabled={disabled}
        value={value}
        onChange={(e) => onDraft(cellKey, e.target.value)}
        onBlur={() => onSave?.()}
        className={cn(
          cellInputBaseClass,
          muted || auto
            ? "border-border text-gold-d"
            : "border-border-md text-heading",
          muted || disabled ? "bg-surface-2" : "bg-surface",
        )}
      />
      {note ? <div className={noteClass}>{note}</div> : null}
      {extra}
    </td>
  );
}

function AddFactorRow({
  options,
  locked,
  colSpan,
  onAdd,
}: {
  options: { factorKey: string; labelAr: string }[];
  locked: boolean;
  colSpan: number;
  onAdd: (factorKey: string, labelAr: string) => void;
}) {
  const [selected, setSelected] = useState(options[0]?.factorKey ?? "");
  if (!options.length) return null;
  const current = options.find((o) => o.factorKey === selected) ?? options[0];
  return (
    <tr className="bg-surface-2">
      <td colSpan={colSpan} className="px-4 py-2.5">
        <div className="flex items-center gap-2.5">
          <span className="text-[12px] font-semibold text-text-2">
            إضافة عامل اختلاف
          </span>
          <select
            disabled={locked}
            value={current.factorKey}
            onChange={(e) => setSelected(e.target.value)}
            className="min-w-[180px] rounded-[var(--radius-sm)] border border-border-md bg-surface px-2.5 py-[7px] text-[12.5px] text-heading"
          >
            {options.map((o) => (
              <option key={o.factorKey} value={o.factorKey}>
                {o.labelAr}
              </option>
            ))}
          </select>
          <button
            type="button"
            disabled={locked}
            onClick={() => onAdd(current.factorKey, current.labelAr)}
            className="cursor-pointer rounded-[var(--radius-sm)] border-none bg-ink px-3.5 py-[7px] text-[12.5px] font-bold text-white disabled:cursor-not-allowed disabled:opacity-55"
          >
            إضافة
          </button>
        </div>
      </td>
    </tr>
  );
}

export type AdjustmentsMatrixProps = {
  selection: ValuationComparableSelectionListDto;
  adopted: ValuationComparableSelectionDto[];
  locked: boolean;
  saving: boolean;
  subjectArea: string;
  idealArea: string;
  city?: string;
  district?: string;
  valuationDate?: string;
  factorDefinitions: Record<string, string>;
  /** حفظ خلية تسوية — يعيد true عند النجاح فتُمسح مسودة الخلية. */
  onSaveCell: (
    item: ValuationComparableSelectionDto,
    factorKey: string,
    raw: string,
  ) => Promise<boolean>;
  /** حفظ الوزن اليدوي — يعيد true عند النجاح فتُمسح مسودة الوزن. */
  onSaveWeight: (
    item: ValuationComparableSelectionDto,
    rawPct: string,
    weightRationale: string,
  ) => Promise<boolean>;
  onSaveRationale: (factorKey: string, text: string) => void;
  onToggleIncluded: (
    item: ValuationComparableSelectionDto,
    factorKey: string,
  ) => void;
  onChangeBasis: (basis: "price_per_sqm" | "whole_property") => void;
  /** يعيد true عند النجاح فتُمسح مسودات الأوزان لتظهر الاقتراحات الجديدة. */
  onResetWeights: () => Promise<boolean>;
  onAreaFactorChange?: (value: string) => void;
  onAddFactor?: (factorKey: string, labelAr: string) => void;
  onRemoveFactor?: (factorKey: string) => void;
  catalogFactors?: { factorKey: string; labelAr: string }[];
  /** حذف تسوية تسلسلية (تمويل/نوع) — تُستعاد عبر شريحة «↺ استعادة». */
  onRemoveSequential?: (factorKey: string) => void;
  onRestoreSequential?: (factorKey: string) => void;
  /** compSpec: وصف المقارن لكل خلية عامل اختلاف. */
  onSaveDescription?: (
    item: ValuationComparableSelectionDto,
    factorKey: string,
    text: string,
  ) => void;
  /** subjSpec: وصف العقار محل التقييم لكل عامل اختلاف. */
  subjectSpecs?: Record<string, string>;
  onSaveSubjectSpec?: (factorKey: string, text: string) => void;
};

export const AdjustmentsMatrix = memo(function AdjustmentsMatrix({
  selection,
  adopted,
  locked,
  saving,
  subjectArea,
  idealArea,
  city,
  district,
  valuationDate,
  factorDefinitions,
  onSaveCell,
  onSaveWeight,
  onSaveRationale,
  onToggleIncluded,
  onChangeBasis,
  onResetWeights,
  onAreaFactorChange,
  onAddFactor,
  onRemoveFactor,
  catalogFactors,
  onRemoveSequential,
  onRestoreSequential,
  onSaveDescription,
  subjectSpecs,
  onSaveSubjectSpec,
}: AdjustmentsMatrixProps) {
  /** حذف بخطوتين — «حذف؟ ✓ ×» (خانة تأكيد واحدة في كل لحظة كما في النموذج). */
  const [confirmDelete, setConfirmDelete] = useState<string | null>(null);
  /* المسودات محلية — الكتابة هنا لا تعيد رسم صدفة التقييم؛ الحفظ عند blur كما كان،
     ولا حفظ عند مغادرة حقل لم يُلمس (كانت تُحفَظ أصفار/فراغات فوق قيم الخادم). */
  const [matrixDraft, setMatrixDraft] = useState<Record<string, string>>({});
  const [weightDraft, setWeightDraft] = useState<Record<string, string>>({});
  const [rationaleDraft, setRationaleDraft] = useState<Record<string, string>>({});
  const [descriptionDraft, setDescriptionDraft] = useState<Record<string, string>>({});
  const [subjectSpecDraft, setSubjectSpecDraft] = useState<Record<string, string>>({});
  const clearDraft = (
    set: (
      updater: (prev: Record<string, string>) => Record<string, string>,
    ) => void,
    key: string,
  ) =>
    set((prev) => {
      const next = { ...prev };
      delete next[key];
      return next;
    });
  const saveRationale = (factorKey: string) => {
    const text = rationaleDraft[factorKey];
    if (text == null) return;
    onSaveRationale(factorKey, text);
  };
  const basis = selection.adjustmentBasis || "price_per_sqm";
  const isUnit = basis !== "whole_property";
  /** عند أساس قيمة العقار: weightedPricePerSqm يحمل الإجمالي — المتر = الإجمالي ÷ المساحة. */
  const pricePerSqmDisplay = (() => {
    if (isUnit) return selection.weightedPricePerSqm;
    // مساحة المعاملة (من الـ UI) أولى من قيمة الخادم القديمة إن اختلفت.
    const fromUi = Number(String(subjectArea ?? "").replace(",", "."));
    const area =
      (Number.isFinite(fromUi) && fromUi > 0 ? fromUi : null) ??
      (selection.subjectAreaSqm != null && selection.subjectAreaSqm > 0
        ? selection.subjectAreaSqm
        : null) ??
      0;
    const opinion =
      selection.marketOpinionValue ?? selection.weightedPricePerSqm ?? 0;
    if (!(area > 0) || !(opinion > 0)) return null;
    return opinion / area;
  })();
  const opinionRaw =
    selection.marketOpinionValueRaw ?? selection.marketOpinionValue;
  const opinionFinal = selection.marketOpinionValue;
  const areaMethod =
    adopted[0]?.market?.areaAdjustmentMethod === "multiplier"
      ? "طريقة المضاعف — آلية"
      : "طريقة الأمثال — آلية";
  const areaFactor = selection.areaFactorPct ?? 5;

  // js-index-maps: فهرس سطر لكل (مقارن، عامل) بدل find() في كل خلية مع كل رسم.
  const linesByItem = useMemo(() => {
    const map = new Map<string, Map<string, ValuationComparableAdjustmentLineDto>>();
    for (const item of adopted) {
      const inner = new Map<string, ValuationComparableAdjustmentLineDto>();
      for (const line of item.market?.adjustmentLines ?? []) {
        if (!inner.has(line.factorKey)) inner.set(line.factorKey, line);
      }
      map.set(item.id, inner);
    }
    return map;
  }, [adopted]);
  const lineOf = (item: ValuationComparableSelectionDto, factorKey: string) =>
    linesByItem.get(item.id)?.get(factorKey);
  const linePct = (item: ValuationComparableSelectionDto, factorKey: string) => {
    const line = lineOf(item, factorKey);
    if (line) return line.percent;
    if (factorKey === AUTO_AREA) return item.market?.suggestedAreaAdjustmentPct ?? 0;
    return 0;
  };

  const factorKeysFromData = useMemo(() => {
    const keys: string[] = [];
    const seen = new Set<string>();
    for (const item of adopted) {
      for (const line of item.market?.adjustmentLines ?? []) {
        if (seen.has(line.factorKey)) continue;
        seen.add(line.factorKey);
        keys.push(line.factorKey);
      }
    }
    return keys;
  }, [adopted]);

  // الصفوف التسلسلية من البيانات — بند محذوف يختفي وتظهر شريحة استعادته.
  const sequentialKeys = ["financing", "market", "transaction_type"].filter(
    (k) => k === "market" || factorKeysFromData.includes(k),
  );
  const removedSequential = ["financing", "transaction_type"].filter(
    (k) => !factorKeysFromData.includes(k),
  );
  const differenceKeys = factorKeysFromData.filter(
    (k) => !SEQUENTIAL.has(k) && k !== AUTO_AREA,
  );

  function afterWeight(item: ValuationComparableSelectionDto): number {
    const m = item.market;
    if (!m) return 0;
    return (m.pricePerSqmAfterDifference * m.effectiveWeightPct) / 100;
  }

  if (adopted.length === 0) {
    return (
      <div className="mb-6 rounded-xl border border-border bg-surface px-[22px] py-[18px] text-[13px] text-text-3">
        اعتمد مقارناً واحداً على الأقل لفتح جدول التسويات.
      </div>
    );
  }

  const justValue = (factorKey: string) =>
    rationaleDraft[factorKey] ??
    lineOf(adopted[0]!, factorKey)?.rationale ??
    "";

  const largeComps = adopted.filter(
    (i) => i.market?.exceedsLargeAdjustmentThreshold,
  );
  const weightsSum = adopted.reduce(
    (s, i) => s + (i.market?.effectiveWeightPct ?? 0),
    0,
  );
  const weightsOk = Math.round(weightsSum) === 100;

  // لوحة التنبيهات — مواصفة النموذج التفاعلي (alerts).
  const alerts: { kind: "error" | "ok"; title: string; body: string }[] = [];
  if (!weightsOk) {
    alerts.push({
      kind: "error",
      title: `مجموع الأوزان ${Math.round(weightsSum * 100) / 100}٪ ≠ ١٠٠٪`,
      body: "عدّل الأوزان اليدوية أو أعد الضبط للاقتراح الآلي.",
    });
  }
  for (const c of largeComps) {
    alerts.push({
      kind: "error",
      title: `المقارن ${c.comparable.referenceCode} — مجموع التسويات ${pct(c.market?.sumDifferencePct ?? 0)}`,
      body: "تجاوز ±٣٥٪ — التبرير إلزامي، مع مراجعة صلاحية المقارن أصلاً.",
    });
  }
  if (alerts.length === 0) {
    alerts.push({
      kind: "ok",
      title: "لا تنبيهات",
      body: "الأوزان مضبوطة على ١٠٠٪ ولا مقارن تجاوز حدود التسوية.",
    });
  }
  const addableFactors = (catalogFactors ?? []).filter(
    (f) =>
      !differenceKeys.includes(f.factorKey) &&
      !SEQUENTIAL.has(f.factorKey) &&
      f.factorKey !== AUTO_AREA,
  );

  return (
    <>
      <div className="mb-3 flex items-center justify-between gap-4">
        <div className="flex items-center gap-2.5">
          <h2 className="m-0 text-[17px] font-extrabold text-heading">
            جدول التسويات
          </h2>
          <span className="text-[12px] font-normal text-text-3">
            مرّر على اسم البند لقراءة تعريفه وحدوده
          </span>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          {removedSequential.map((k) => (
            <button
              key={k}
              type="button"
              disabled={saving || locked}
              onClick={() => onRestoreSequential?.(k)}
              title="استعادة البند المحذوف بقيمه الافتراضية"
              className="inline-flex cursor-pointer items-center gap-[5px] rounded-[var(--radius)] border border-dashed border-gold bg-gold-soft px-3 py-2 text-[12px] font-bold text-gold-d disabled:cursor-not-allowed"
            >
              ↺ استعادة {metaFor(k).label}
            </button>
          ))}
          <button
            type="button"
            disabled={saving || locked}
            onClick={() =>
              void onResetWeights().then((ok) => ok && setWeightDraft({}))
            }
            className="flex cursor-pointer items-center gap-[7px] rounded-[9px] border-none bg-ink px-4 py-2.5 text-[13px] font-bold text-white shadow-card disabled:cursor-not-allowed disabled:opacity-55"
          >
            إعادة ضبط الأوزان
          </button>
        </div>
      </div>

      <div className={panelCardClass}>
        <div className="overflow-x-auto">
          <table className="w-full min-w-[1100px] border-collapse">
            <thead>
              <tr>
                <th className={cn(thBandClass, "w-[230px]")}>البند</th>
                <th
                  className={cn(
                    thCompBaseClass,
                    "border-x border-x-border-md bg-gold-soft",
                  )}
                >
                  <div>العقار محل التقييم</div>
                  <div className="mt-[3px] text-[10.5px] font-normal text-gold-d">
                    أساس المقارنة
                  </div>
                </th>
                {adopted.map((item) => (
                  <th key={item.id} className={thCompClass}>
                    <div dir="ltr">{item.comparable.referenceCode}</div>
                    <div className="mt-[3px] text-[10.5px] font-normal text-text-3">
                      {item.comparable.transactionKindLabelAr}
                    </div>
                  </th>
                ))}
                <th
                  className={cn(
                    thBandClass,
                    "min-w-[230px] border-s border-s-border",
                  )}
                >
                  مبرر التسوية
                </th>
              </tr>
            </thead>
            <tbody>
              {/* أساس: قيمة العقار */}
              <tr className={isUnit ? "bg-surface-2" : "bg-surface"}>
                <LabelCell
                  label="قيمة العقار المقارن"
                  hint="إجمالي الصفقة (ريال) — التسويات على قيمة العقار كاملة"
                  tip="إجمالي سعر العقار المقارن. عند اعتماده تُجرى كل التسويات على قيمة العقار كاملة."
                  locked={locked}
                  pickable
                  picked={!isUnit}
                  onPick={() => onChangeBasis("whole_property")}
                />
                <SubjCell value="المطلوب تقديره" note="مخرج التقييم" />
                {adopted.map((item) => (
                  <CompReadonly
                    key={item.id}
                    value={fmt(effPrice(item))}
                    note={item.comparable.transactionDate}
                    valueClassName={!isUnit ? "text-heading" : "text-text-3"}
                  />
                ))}
                <JustCell />
              </tr>

              {/* أساس: سعر المتر */}
              <tr className={isUnit ? "bg-surface" : "bg-surface-2"}>
                <LabelCell
                  label="سعر متر المقارن"
                  hint="ريال / م² — سعر المتر يُضرب في مساحة العقار آخر المطاف"
                  tip="سعر المتر المرصود للمقارن قبل أي تسوية."
                  locked={locked}
                  pickable
                  picked={isUnit}
                  onPick={() => onChangeBasis("price_per_sqm")}
                />
                <SubjCell value="المطلوب تقديره" note="مخرج التقييم" />
                {adopted.map((item) => (
                  <CompReadonly
                    key={item.id}
                    value={fmt(effUnit(item))}
                    note={item.comparable.transactionDate}
                    valueClassName={isUnit ? "text-heading" : "text-text-3"}
                  />
                ))}
                <JustCell />
              </tr>

              {/* تسلسلية */}
              {sequentialKeys.map((factorKey) => {
                const meta = metaFor(
                  factorKey,
                  lineOf(adopted[0]!, factorKey)?.labelAr,
                );
                const included =
                  lineOf(adopted[0]!, factorKey)?.isIncluded !== false;
                const deletable = factorKey !== "market";
                return (
                  <tr
                    key={factorKey}
                    className={included ? "bg-surface" : "bg-surface-2"}
                  >
                    <LabelCell
                      label={meta.label}
                      hint={meta.hint}
                      tip={meta.tip}
                      definition={factorDefinitions[meta.label]}
                      locked={locked}
                      removable={deletable}
                      included={included}
                      onToggle={() => {
                        const first = adopted[0];
                        if (first) onToggleIncluded(first, factorKey);
                      }}
                      offNote={
                        included ? undefined : "غير محتسب في السعر التسلسلي"
                      }
                      deleteKey={
                        deletable && onRemoveSequential ? factorKey : undefined
                      }
                      confirmDelete={confirmDelete}
                      onConfirmDelete={setConfirmDelete}
                      onDelete={
                        deletable && onRemoveSequential
                          ? () => onRemoveSequential(factorKey)
                          : undefined
                      }
                    />
                    <SubjCell
                      value={factorKey === "market" ? "تاريخ التقييم" : "—"}
                      note={
                        factorKey === "market"
                          ? valuationDate || undefined
                          : undefined
                      }
                    />
                    {adopted.map((item) => {
                      // «مقترح» من الخادم — المسودة المهيّأة ليست إدخالاً يدوياً.
                      const line = lineOf(item, factorKey);
                      const suggested =
                        factorKey === "transaction_type" &&
                        line?.isSuggestedValue === true;
                      const included2 = line?.isIncluded !== false;
                      const cellKey = `${item.id}:${factorKey}`;
                      return (
                        <CompInput
                          key={item.id}
                          cellKey={cellKey}
                          value={
                            matrixDraft[cellKey] ??
                            String(linePct(item, factorKey))
                          }
                          disabled={locked || !included2}
                          muted={suggested || !included2}
                          note={
                            factorKey === "market"
                              ? `عمر الصفقة ${item.market?.dealAgeMonths ?? "—"} شهراً`
                              : factorKey === "transaction_type"
                                ? [
                                    item.comparable.transactionKindLabelAr,
                                    suggested ? "مقترح" : "تجاوز يدوي",
                                  ].join(" · ")
                                : undefined
                          }
                          onDraft={(key, value) =>
                            setMatrixDraft((prev) => ({ ...prev, [key]: value }))
                          }
                          onSave={
                            included2
                              ? () => {
                                  const raw = matrixDraft[cellKey];
                                  if (raw == null) return;
                                  void onSaveCell(item, factorKey, raw).then(
                                    (ok) =>
                                      ok &&
                                      clearDraft(setMatrixDraft, cellKey),
                                  );
                                }
                              : undefined
                          }
                        />
                      );
                    })}
                    <JustCell
                      factorKey={factorKey}
                      value={justValue(factorKey)}
                      locked={locked}
                      onDraft={(key, value) =>
                        setRationaleDraft((prev) => ({ ...prev, [key]: value }))
                      }
                      onSave={saveRationale}
                    />
                  </tr>
                );
              })}

              {/* بعد التسلسل */}
              <tr className="bg-surface-2">
                <LabelCell
                  label="السعر بعد التسويات التسلسلية"
                  hint="ضربية بالترتيب"
                  tip="السعر × (1+تمويل) × (1+سوق) × (1+نوع)."
                  locked={locked}
                />
                <SubjCell value="—" />
                {adopted.map((item) => (
                  <CompReadonly
                    key={item.id}
                    value={fmt(item.market?.pricePerSqmAfterSequential)}
                  />
                ))}
                <JustCell />
              </tr>

              {/* المساحة */}
              <tr>
                <LabelCell
                  label="المساحة"
                  hint={areaMethod}
                  tip={FACTOR_META.area.tip}
                  locked={locked}
                  areaFactor={onAreaFactorChange ? areaFactor : undefined}
                  onAreaFactorChange={onAreaFactorChange}
                />
                <SubjCell
                  value={`${fmt(Number(subjectArea.replace(",", ".")) || null)} م²`}
                  note="مساحة الأرض"
                />
                {adopted.map((item) => {
                  const adj = item.market?.suggestedAreaAdjustmentPct ?? 0;
                  return (
                    <CompReadonly
                      key={item.id}
                      value={pct(adj)}
                      valueClassName={pctClass(adj)}
                      note={`${fmt(effArea(item))} م²`}
                    />
                  );
                })}
                <JustCell
                  factorKey="area"
                  value={justValue("area")}
                  locked={locked}
                  onDraft={(key, value) =>
                    setRationaleDraft((prev) => ({ ...prev, [key]: value }))
                  }
                  onSave={saveRationale}
                />
              </tr>

              {/* عوامل الاختلاف */}
              {differenceKeys.map((factorKey) => {
                const meta = metaFor(
                  factorKey,
                  lineOf(adopted[0]!, factorKey)?.labelAr,
                );
                const included =
                  lineOf(adopted[0]!, factorKey)?.isIncluded !== false;
                const specEnabled = !NO_SPEC_KEYS.has(factorKey);
                let subjVal = "—";
                let subjNote: string | undefined;
                if (factorKey === "ideal_area") {
                  subjVal = `${fmt(Number(idealArea.replace(",", ".")) || Number(subjectArea.replace(",", ".")) || null)} م²`;
                  subjNote = "السائدة في الحي";
                } else if (factorKey === "location") {
                  subjVal = district || "—";
                  subjNote = city;
                }
                const subjEditable =
                  specEnabled && factorKey !== "ideal_area" && !!onSaveSubjectSpec;
                return (
                  <tr
                    key={factorKey}
                    className={included ? "bg-surface" : "bg-surface-2"}
                  >
                    <LabelCell
                      label={meta.label}
                      hint={meta.hint}
                      tip={meta.tip}
                      definition={factorDefinitions[meta.label]}
                      locked={locked}
                      removable
                      included={included}
                      onToggle={() => {
                        const first = adopted[0];
                        if (first) onToggleIncluded(first, factorKey);
                      }}
                      offNote={included ? undefined : "غير محتسب في المجموع"}
                      deleteKey={onRemoveFactor ? factorKey : undefined}
                      confirmDelete={confirmDelete}
                      onConfirmDelete={setConfirmDelete}
                      onDelete={
                        onRemoveFactor ? () => onRemoveFactor(factorKey) : undefined
                      }
                    />
                    {subjEditable ? (
                      <td className={tdSubjClass}>
                        <input
                          type="text"
                          disabled={locked}
                          placeholder="وصف العقار…"
                          value={
                            subjectSpecDraft[factorKey] ??
                            subjectSpecs?.[factorKey] ??
                            ""
                          }
                          onChange={(e) =>
                            setSubjectSpecDraft((prev) => ({
                              ...prev,
                              [factorKey]: e.target.value,
                            }))
                          }
                          onBlur={(e) =>
                            onSaveSubjectSpec?.(factorKey, e.target.value)
                          }
                          className="w-full rounded-[7px] border border-dashed border-border-md bg-surface px-2 py-1.5 text-center text-[12px] font-bold text-gold-d"
                        />
                      </td>
                    ) : (
                      <SubjCell value={subjVal} note={subjNote} />
                    )}
                    {adopted.map((item) => {
                      const line = lineOf(item, factorKey);
                      const cellKey = `${item.id}:${factorKey}`;
                      const descKey = `${cellKey}:desc`;
                      return (
                        <CompInput
                          key={item.id}
                          cellKey={cellKey}
                          value={
                            matrixDraft[cellKey] ??
                            String(linePct(item, factorKey))
                          }
                          disabled={locked || !included}
                          muted={!included}
                          onDraft={(key, value) =>
                            setMatrixDraft((prev) => ({ ...prev, [key]: value }))
                          }
                          onSave={
                            included
                              ? () => {
                                  const raw = matrixDraft[cellKey];
                                  if (raw == null) return;
                                  void onSaveCell(item, factorKey, raw).then(
                                    (ok) =>
                                      ok &&
                                      clearDraft(setMatrixDraft, cellKey),
                                  );
                                }
                              : undefined
                          }
                          note={
                            factorKey === "location"
                              ? `${item.comparable.district || "—"} · ${city || ""}`
                              : undefined
                          }
                          extra={
                            factorKey !== "location" &&
                            specEnabled &&
                            onSaveDescription ? (
                              <input
                                type="text"
                                disabled={locked}
                                placeholder="وصف المقارن…"
                                value={
                                  descriptionDraft[descKey] ??
                                  line?.descriptionAr ??
                                  ""
                                }
                                onChange={(e) =>
                                  setDescriptionDraft((prev) => ({
                                    ...prev,
                                    [descKey]: e.target.value,
                                  }))
                                }
                                onBlur={(e) =>
                                  onSaveDescription(item, factorKey, e.target.value)
                                }
                                className="mt-1 w-[110px] rounded-md border border-dashed border-border bg-surface px-1.5 py-1 text-center text-[10.5px] font-medium text-text-2"
                              />
                            ) : null
                          }
                        />
                      );
                    })}
                    <JustCell
                      factorKey={factorKey}
                      value={justValue(factorKey)}
                      locked={locked}
                      onDraft={(key, value) =>
                        setRationaleDraft((prev) => ({ ...prev, [key]: value }))
                      }
                      onSave={saveRationale}
                    />
                  </tr>
                );
              })}

              {onAddFactor && addableFactors.length > 0 ? (
                <AddFactorRow
                  options={addableFactors}
                  locked={locked}
                  colSpan={3 + adopted.length}
                  onAdd={onAddFactor}
                />
              ) : null}

              {/* مجموع */}
              <tr className="bg-surface-2">
                <LabelCell
                  label="مجموع نسب التسويات"
                  hint="الصافي بإشاراته"
                  tip="مجموع تسوية المساحة وعوامل الاختلاف. تجاوز ±٣٥٪ يستلزم مبرراً موثقاً ومراجعة صلاحية المقارن."
                  locked={locked}
                />
                <SubjCell value="أساس المقارنة" note="صفر بالتعريف" />
                {adopted.map((item) => {
                  const sum = item.market?.sumDifferencePct ?? 0;
                  const over = Math.abs(sum) > 35;
                  return (
                    <CompReadonly
                      key={item.id}
                      value={pct(sum)}
                      valueClassName={over ? "text-danger-text" : pctClass(sum)}
                      note={over ? "التبرير إلزامي" : undefined}
                    />
                  );
                })}
                <JustCell />
              </tr>

              {/* بعد عوامل الاختلاف */}
              <tr>
                <LabelCell
                  label="القيمة بعد ضبط عوامل الاختلاف"
                  hint={isUnit ? "ريال / م²" : "ريال — قيمة العقار"}
                  tip="السعر التسلسلي × (1 + مجموع نسب التسويات)."
                  locked={locked}
                />
                <SubjCell value="—" />
                {adopted.map((item) => (
                  <CompReadonly
                    key={item.id}
                    value={fmt(item.market?.pricePerSqmAfterDifference)}
                  />
                ))}
                <JustCell />
              </tr>

              {/* الوزن */}
              <tr>
                <LabelCell
                  label="الوزن النسبي"
                  hint="مقترح آلياً · قابل للتعديل"
                  tip="المقارن الذي مجموع نسب تسوياته أقرب إلى الصفر يأخذ الوزن الأكبر."
                  locked={locked}
                />
                <SubjCell value="—" />
                {adopted.map((item) => {
                  const manual = item.market?.weightIsManual;
                  const display =
                    weightDraft[item.id] ??
                    String(
                      manual
                        ? (item.market?.weightPct ??
                            item.market?.effectiveWeightPct ??
                            "")
                        : (item.market?.suggestedWeightPct ??
                            item.market?.effectiveWeightPct ??
                            ""),
                    );
                  return (
                    <td key={item.id} className={tdCellClass}>
                      <input
                        dir="ltr"
                        type="text"
                        disabled={locked}
                        value={display}
                        onChange={(e) =>
                          setWeightDraft((prev) => ({
                            ...prev,
                            [item.id]: e.target.value,
                          }))
                        }
                        onBlur={() => {
                          const raw = weightDraft[item.id];
                          if (raw == null) return;
                          void onSaveWeight(
                            item,
                            raw,
                            rationaleDraft["weight"] ?? "",
                          ).then(
                            (ok) =>
                              ok && clearDraft(setWeightDraft, item.id),
                          );
                        }}
                        className={cn(
                          cellInputBaseClass,
                          manual
                            ? "border-border-md bg-surface text-heading"
                            : "border-border bg-surface-2 text-gold-d",
                        )}
                      />
                      <div className={noteClass}>
                        {manual
                          ? "تجاوز يدوي"
                          : `مقترح ${item.market?.suggestedWeightPct ?? "—"}%`}
                      </div>
                    </td>
                  );
                })}
                <JustCell
                  factorKey="weight"
                  value={justValue("weight")}
                  locked={locked}
                  onDraft={(key, value) =>
                    setRationaleDraft((prev) => ({ ...prev, [key]: value }))
                  }
                  onSave={saveRationale}
                />
              </tr>

              {/* بعد الوزن */}
              <tr className="bg-surface-2">
                <LabelCell
                  label="القيمة بعد الوزن النسبي"
                  hint={isUnit ? "ريال / م²" : "ريال — قيمة العقار"}
                  tip="القيمة بعد التسويات × الوزن."
                  locked={locked}
                />
                <SubjCell value="—" />
                {adopted.map((item) => (
                  <CompReadonly key={item.id} value={fmt(afterWeight(item))} />
                ))}
                <JustCell />
              </tr>
            </tbody>
          </table>
        </div>
      </div>

      {/* مخرجات تحت الجدول */}
      <div className={cn(panelCardClass, "flex items-stretch")}>
        <div className="flex-1 border-e border-border px-[22px] py-[18px]">
          <div className="mb-[9px] text-[12px] font-medium text-text-2">
            {isUnit ? "قيمة المتر بعد التسوية" : "قيمة العقار بعد التسوية"}
          </div>
          <div
            dir="ltr"
            className="text-start text-[24px] font-extrabold leading-none text-heading"
          >
            {fmt(selection.weightedPricePerSqm)}
          </div>
          <div className="mt-[7px] text-[11.5px] font-normal text-text-3">
            {isUnit ? "ريال / م²" : "ريال — متوسط مرجّح لقيم المقارنات"}
          </div>
          <div className="mt-[5px] text-[11.5px] font-bold text-gold-d">
            قيمة المتر المربع:{" "}
            <span dir="ltr">
              {pricePerSqmDisplay != null ? fmt(pricePerSqmDisplay) : "—"}
            </span>{" "}
            ر.س/م²
          </div>
        </div>
        <div className="flex-1 border-e border-border px-[22px] py-[18px]">
          <div className="mb-[9px] text-[12px] font-medium text-text-2">
            {isUnit ? "قيمة الأرض قبل التقريب" : "قيمة العقار قبل التقريب"}
          </div>
          <div
            dir="ltr"
            className="text-start text-[24px] font-extrabold leading-none text-heading"
          >
            {fmt(opinionRaw)}
          </div>
          <div className="mt-[7px] text-[11.5px] font-normal text-text-3">
            {isUnit
              ? "سعر المتر بعد التسوية × مساحة العقار"
              : "أساس الكل — بلا ضرب في المساحة (يساوي المتوسط المرجّح)"}
          </div>
        </div>
        <div className="relative flex-[1.4] bg-surface-2 px-[22px] py-[18px]">
          <span className="absolute start-0 top-0 h-full w-[3px] bg-gold" />
          <div className="mb-[9px] text-[12px] font-bold text-heading">
            مؤشر أسلوب السوق (خام)
          </div>
          <div
            dir="ltr"
            className="text-start text-[24px] font-extrabold leading-none text-heading"
          >
            {fmt(opinionFinal)}
          </div>
          <div className="mt-[7px] text-[11.5px] font-normal text-text-3">
            بلا تقريب هنا — التقريب مرة واحدة بعد التوفيق النهائي
          </div>
        </div>
      </div>

      {/* لوحة التنبيهات — مواصفة النموذج التفاعلي */}
      <div className={panelCardClass}>
        <div className="border-b border-border px-[22px] py-3 text-[13.5px] font-extrabold text-heading">
          تنبيهات جدول التسويات
        </div>
        {alerts.map((a, i) => (
          <div
            key={i}
            role={a.kind === "error" ? "alert" : "status"}
            className="flex items-start gap-2.5 border-b border-border px-[22px] py-[11px]"
          >
            <span
              className={cn(
                "mt-[5px] size-[9px] shrink-0 rounded-full",
                a.kind === "error" ? "bg-danger" : "bg-[#3f8f5f]",
              )}
            />
            <div>
              <div
                className={cn(
                  "text-[12.5px] font-bold",
                  a.kind === "error" ? "text-danger-text" : "text-[#3f8f5f]",
                )}
              >
                {a.title}
              </div>
              <div className="mt-0.5 text-[11.5px] text-text-2">{a.body}</div>
            </div>
          </div>
        ))}
      </div>

      {/* شريط عائم مطابق للتصميم */}
      <div className="fixed bottom-[22px] left-[41px] z-40 flex items-center gap-3.5 rounded-[var(--radius-lg)] border-y border-e border-s-[3px] border-y-border-md border-e-border-md border-s-gold bg-surface px-4 py-2.5 shadow-lg">
        <div>
          <div className="text-[10.5px] font-semibold text-text-3">
            القيمة النهائية للعقار
          </div>
          <div
            dir="ltr"
            className="text-start text-[19px] font-extrabold leading-[1.25] text-heading"
          >
            {fmt(selection.marketOpinionValue)}
          </div>
        </div>
        <div className="h-[30px] w-px bg-border" />
        <div>
          <div className="text-[10.5px] font-semibold text-text-3">
            قيمة المتر المربع
          </div>
          <div
            dir="ltr"
            className="text-start text-[14px] font-bold leading-[1.25] text-gold-d"
          >
            {pricePerSqmDisplay != null ? fmt(pricePerSqmDisplay) : "—"}
          </div>
        </div>
      </div>
    </>
  );
});
