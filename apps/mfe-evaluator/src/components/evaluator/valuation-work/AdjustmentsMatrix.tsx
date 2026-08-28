"use client";

import { memo, useMemo, useState, type ReactNode } from "react";
import { cn } from "@platform/ui-kit";
import type {
  ValuationComparableAdjustmentLineDto,
  ValuationComparableSelectionDto,
  ValuationComparableSelectionListDto,
} from "@platform/api-client";
import { fmt, JUSTIFICATION_MIN_LENGTH } from "./lib/shell-utils";
import {
  AUTO_AREA_KEY,
  SEQUENTIAL_KEYS,
  SEQUENTIAL_SET,
  factorDescriptor,
  factorHasSpecCell,
  factorMeta,
} from "./lib/factor-registry";
import type { MatrixDispatch } from "./lib/matrix-actions";

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

/** ق-8-1: مبرر على مستوى العامل + لوحة «تخصيص لمقارن بعينه» عند الاختلاف. */
function JustCell({
  factorKey,
  value,
  locked,
  onDraft,
  onSave,
  overrides,
  onSaveOverride,
}: {
  factorKey?: string;
  value?: string;
  locked?: boolean;
  onDraft?: (factorKey: string, value: string) => void;
  onSave?: (factorKey: string) => void;
  overrides?: { id: string; label: string; value: string }[];
  onSaveOverride?: (selectionId: string, factorKey: string, text: string) => void;
}) {
  const [showOverrides, setShowOverrides] = useState(false);
  const [overrideDraft, setOverrideDraft] = useState<Record<string, string>>({});
  if (!factorKey || !onDraft || !onSave) {
    return <td className={tdJustClass} />;
  }
  const text = value ?? "";
  // ق-8-2: المبرر الصوري (أقصر من الحد) لا يُحفظ.
  const tooShort =
    text.trim().length > 0 && text.trim().length < JUSTIFICATION_MIN_LENGTH;
  const overrideCount = (overrides ?? []).filter(
    (o) => (overrideDraft[o.id] ?? o.value).trim().length > 0,
  ).length;
  return (
    <td className={tdJustClass}>
      <input
        type="text"
        value={text}
        disabled={locked}
        placeholder="مبرّر التسوية (يغطي كل المقارنات)؟"
        onChange={(e) => onDraft(factorKey, e.target.value)}
        onBlur={() => {
          if (!tooShort) onSave(factorKey);
        }}
        className={cn(
          "w-full rounded-[7px] border bg-surface px-2.5 py-[7px] text-[12px] font-medium text-text",
          tooShort ? "border-danger" : "border-border",
        )}
      />
      {tooShort ? (
        <div className="mt-1 text-[10.5px] font-semibold text-danger">
          الحد الأدنى {JUSTIFICATION_MIN_LENGTH} أحرف (ق-8)
        </div>
      ) : null}
      {overrides && overrides.length > 0 && onSaveOverride ? (
        <>
          <button
            type="button"
            disabled={locked}
            onClick={() => setShowOverrides((v) => !v)}
            className="mt-1 text-[10.5px] font-semibold text-text-3 hover:text-text"
          >
            تخصيص لمقارن بعينه{overrideCount > 0 ? ` (${overrideCount})` : ""}{" "}
            {showOverrides ? "▴" : "▾"}
          </button>
          {showOverrides ? (
            <div className="mt-1.5 space-y-1.5">
              {overrides.map((o) => {
                const draft = overrideDraft[o.id] ?? o.value;
                const overrideTooShort =
                  draft.trim().length > 0 &&
                  draft.trim().length < JUSTIFICATION_MIN_LENGTH;
                return (
                  <div key={o.id}>
                    <input
                      type="text"
                      value={draft}
                      disabled={locked}
                      placeholder={`${o.label} — يرث مبرر العامل`}
                      onChange={(e) =>
                        setOverrideDraft((prev) => ({
                          ...prev,
                          [o.id]: e.target.value,
                        }))
                      }
                      onBlur={() => {
                        if (overrideTooShort) return;
                        if (draft !== o.value)
                          onSaveOverride(o.id, factorKey, draft);
                      }}
                      className={cn(
                        "w-full rounded-[6px] border bg-surface-2 px-2 py-1 text-[11px] text-text",
                        overrideTooShort ? "border-danger" : "border-border",
                      )}
                    />
                    {overrideTooShort ? (
                      <div className="mt-0.5 text-[10px] font-semibold text-danger">
                        الحد الأدنى {JUSTIFICATION_MIN_LENGTH} أحرف
                      </div>
                    ) : null}
                  </div>
                );
              })}
            </div>
          ) : null}
        </>
      ) : null}
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
  catalogFactors?: { factorKey: string; labelAr: string }[];
  /** subjSpec: وصف العقار محل التقييم لكل عامل اختلاف. */
  subjectSpecs?: Record<string, string>;
  /** سياق السوق يحرّر وصف العقار؛ سياق الأرض ضمن التكلفة لا. */
  canEditSubjectSpec?: boolean;
  /**
   * الأمر الواحد بدل ١٥ مقبضاً — يعيد نجاح التنفيذ حيث تُمسح المسودة عنده.
   * مرجع مستقر واحد فيصمد memo الجدول أمام إعادة رسم الصدفة.
   */
  dispatch: MatrixDispatch;
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
  catalogFactors,
  subjectSpecs,
  canEditSubjectSpec,
  dispatch,
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
    void dispatch({ type: "save-rationale", factorKey, text });
  };
  const saveLineRationale = (
    selectionId: string,
    factorKey: string,
    text: string,
  ) => void dispatch({ type: "save-line-rationale", selectionId, factorKey, text });
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
    if (factorKey === AUTO_AREA_KEY)
      return item.market?.suggestedAreaAdjustmentPct ?? 0;
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

  // الصفوف التسلسلية من السجل — بند محذوف يختفي وتظهر شريحة استعادته.
  const sequentialKeys = SEQUENTIAL_KEYS.filter(
    (k) =>
      factorDescriptor(k)?.alwaysPresent || factorKeysFromData.includes(k),
  );
  const removedSequential = SEQUENTIAL_KEYS.filter(
    (k) =>
      !factorDescriptor(k)?.alwaysPresent && !factorKeysFromData.includes(k),
  );
  const differenceKeys = factorKeysFromData.filter(
    (k) => !SEQUENTIAL_SET.has(k) && k !== AUTO_AREA_KEY,
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

  // ق-8-1: مبرر العامل من جدوله المستقل؛ مبرر السطر القديم يظهر كتوافق خلفي فقط.
  const factorRationaleByKey = new Map(
    (selection.factorRationales ?? []).map((r) => [r.factorKey, r.rationaleAr]),
  );
  const justValue = (factorKey: string) =>
    rationaleDraft[factorKey] ??
    factorRationaleByKey.get(factorKey) ??
    lineOf(adopted[0]!, factorKey)?.rationale ??
    "";

  /** ق-8-1: أسطر التخصيص لكل مقارن — تُعرض تحت مبرر العامل عند الطلب. */
  const overridesFor = (factorKey: string) =>
    adopted.map((item, i) => ({
      id: item.id,
      label: `مقارن ${i + 1}`,
      value: lineOf(item, factorKey)?.rationale ?? "",
    }));

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
      !SEQUENTIAL_SET.has(f.factorKey) &&
      f.factorKey !== AUTO_AREA_KEY,
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
              onClick={() =>
                void dispatch({ type: "restore-sequential", factorKey: k })
              }
              title="استعادة البند المحذوف بقيمه الافتراضية"
              className="inline-flex cursor-pointer items-center gap-[5px] rounded-[var(--radius)] border border-dashed border-gold bg-gold-soft px-3 py-2 text-[12px] font-bold text-gold-d disabled:cursor-not-allowed"
            >
              ↺ استعادة {factorMeta(k).label}
            </button>
          ))}
          <button
            type="button"
            disabled={saving || locked}
            onClick={() =>
              void dispatch({ type: "reset-weights" }).then(
                (ok) => ok && setWeightDraft({}),
              )
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
                  onPick={() =>
                    void dispatch({ type: "change-basis", basis: "whole_property" })
                  }
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
                  onPick={() =>
                    void dispatch({ type: "change-basis", basis: "price_per_sqm" })
                  }
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
                const desc = factorDescriptor(factorKey);
                const meta = factorMeta(
                  factorKey,
                  lineOf(adopted[0]!, factorKey)?.labelAr,
                );
                const included =
                  lineOf(adopted[0]!, factorKey)?.isIncluded !== false;
                const deletable = desc?.deletable === true;
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
                        if (first)
                          void dispatch({
                            type: "toggle-included",
                            item: first,
                            factorKey,
                          });
                      }}
                      offNote={
                        included ? undefined : "غير محتسب في السعر التسلسلي"
                      }
                      deleteKey={deletable ? factorKey : undefined}
                      confirmDelete={confirmDelete}
                      onConfirmDelete={setConfirmDelete}
                      onDelete={
                        deletable
                          ? () =>
                              void dispatch({
                                type: "remove-sequential",
                                factorKey,
                              })
                          : undefined
                      }
                    />
                    <SubjCell
                      value={
                        desc?.subjectCell === "valuation-date"
                          ? "تاريخ التقييم"
                          : "—"
                      }
                      note={
                        desc?.subjectCell === "valuation-date"
                          ? valuationDate || undefined
                          : undefined
                      }
                    />
                    {adopted.map((item) => {
                      // «مقترح» من الخادم — المسودة المهيّأة ليست إدخالاً يدوياً.
                      const line = lineOf(item, factorKey);
                      const suggested =
                        desc?.compNote === "kind-suggested" &&
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
                            desc?.compNote === "deal-age"
                              ? `عمر الصفقة ${item.market?.dealAgeMonths ?? "—"} شهراً`
                              : desc?.compNote === "kind-suggested"
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
                                  void dispatch({
                                    type: "save-cell",
                                    item,
                                    factorKey,
                                    raw,
                                  }).then(
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
                      overrides={overridesFor(factorKey)}
                      onSaveOverride={saveLineRationale}
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
                  label={factorMeta(AUTO_AREA_KEY).label}
                  hint={areaMethod}
                  tip={factorMeta(AUTO_AREA_KEY).tip}
                  locked={locked}
                  areaFactor={areaFactor}
                  onAreaFactorChange={(value) =>
                    void dispatch({ type: "area-factor-change", value })
                  }
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
                  factorKey={AUTO_AREA_KEY}
                  value={justValue(AUTO_AREA_KEY)}
                  locked={locked}
                  onDraft={(key, value) =>
                    setRationaleDraft((prev) => ({ ...prev, [key]: value }))
                  }
                  onSave={saveRationale}
                  overrides={overridesFor(AUTO_AREA_KEY)}
                  onSaveOverride={saveLineRationale}
                />
              </tr>

              {/* عوامل الاختلاف */}
              {differenceKeys.map((factorKey) => {
                const desc = factorDescriptor(factorKey);
                const meta = factorMeta(
                  factorKey,
                  lineOf(adopted[0]!, factorKey)?.labelAr,
                );
                const included =
                  lineOf(adopted[0]!, factorKey)?.isIncluded !== false;
                const specEnabled = factorHasSpecCell(factorKey);
                let subjVal = "—";
                let subjNote: string | undefined;
                if (desc?.subjectCell === "ideal-area") {
                  subjVal = `${fmt(Number(idealArea.replace(",", ".")) || Number(subjectArea.replace(",", ".")) || null)} م²`;
                  subjNote = "السائدة في الحي";
                } else if (desc?.subjectCell === "location") {
                  subjVal = district || "—";
                  subjNote = city;
                }
                const subjEditable =
                  specEnabled && !desc?.subjectCell && !!canEditSubjectSpec;
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
                        if (first)
                          void dispatch({
                            type: "toggle-included",
                            item: first,
                            factorKey,
                          });
                      }}
                      offNote={included ? undefined : "غير محتسب في المجموع"}
                      deleteKey={factorKey}
                      confirmDelete={confirmDelete}
                      onConfirmDelete={setConfirmDelete}
                      onDelete={() =>
                        void dispatch({ type: "remove-factor", factorKey })
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
                            void dispatch({
                              type: "save-subject-spec",
                              factorKey,
                              text: e.target.value,
                            })
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
                                  void dispatch({
                                    type: "save-cell",
                                    item,
                                    factorKey,
                                    raw,
                                  }).then(
                                    (ok) =>
                                      ok &&
                                      clearDraft(setMatrixDraft, cellKey),
                                  );
                                }
                              : undefined
                          }
                          note={
                            desc?.subjectCell === "location"
                              ? `${item.comparable.district || "—"} · ${city || ""}`
                              : undefined
                          }
                          extra={
                            specEnabled ? (
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
                                  void dispatch({
                                    type: "save-description",
                                    item,
                                    factorKey,
                                    text: e.target.value,
                                  })
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
                      overrides={overridesFor(factorKey)}
                      onSaveOverride={saveLineRationale}
                    />
                  </tr>
                );
              })}

              {addableFactors.length > 0 ? (
                <AddFactorRow
                  options={addableFactors}
                  locked={locked}
                  colSpan={3 + adopted.length}
                  onAdd={(factorKey, labelAr) =>
                    void dispatch({ type: "add-factor", factorKey, labelAr })
                  }
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
                          void dispatch({
                            type: "save-weight",
                            item,
                            rawPct: raw,
                            weightRationale: rationaleDraft["weight"] ?? "",
                          }).then(
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
