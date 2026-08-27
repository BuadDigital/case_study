"use client";

import { memo, useMemo, useState, type CSSProperties, type ReactNode } from "react";
import type {
  ValuationComparableAdjustmentLineDto,
  ValuationComparableSelectionDto,
  ValuationComparableSelectionListDto,
} from "@platform/api-client";

/* متغيرات النظام مباشرة — تطابق هوية إجادة والوضع الداكن. */
const C = {
  ink: "var(--heading)",
  inkFill: "var(--ink)",
  navy3: "var(--navy-3)",
  gold: "var(--gold)",
  goldText: "var(--gold-d)",
  goldSoft: "var(--gold-soft)",
  soft: "var(--surface-2)",
  softAlt: "var(--surface-2)",
  border: "var(--border)",
  borderStrong: "var(--border-md)",
  muted: "var(--text-2)",
  faint: "var(--text-3)",
  body: "var(--text-1)",
  danger: "var(--red)",
  dangerText: "var(--red-text)",
  card: "var(--surface)",
} as const;

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

function fmt(n: number | null | undefined, digits = 0): string {
  if (n == null || !Number.isFinite(n)) return "—";
  return n.toLocaleString("en-US", {
    maximumFractionDigits: digits,
    minimumFractionDigits: digits > 0 ? Math.min(digits, 2) : 0,
  });
}

function pct(n: number): string {
  const rounded = Math.round(n * 100) / 100;
  const sign = rounded > 0 ? "+" : "";
  return `${sign}${rounded.toFixed(2)}%`;
}

function pctColor(n: number): string {
  if (n > 0) return "#2f7a4d";
  if (n < 0) return C.dangerText;
  return C.muted;
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

/* ─── أنماط ثابتة على مستوى الوحدة (لا يعاد إنشاؤها مع كل رسم) ─── */
const thBand: CSSProperties = {
  padding: "13px 16px",
  textAlign: "start",
  fontWeight: 700,
  fontSize: 12,
  color: C.ink,
  background: C.soft,
  borderBottom: `2px solid ${C.gold}`,
};
const thComp: CSSProperties = {
  padding: "11px 12px",
  textAlign: "center",
  fontWeight: 700,
  fontSize: 12,
  color: C.ink,
  minWidth: 126,
  background: C.soft,
  borderBottom: `2px solid ${C.gold}`,
  borderInlineStart: `1px solid ${C.border}`,
};
const tdLabel: CSSProperties = {
  padding: "9px 16px",
  textAlign: "start",
  verticalAlign: "top",
  borderBottom: `1px solid ${C.border}`,
};
const tdSubj: CSSProperties = {
  padding: "7px 10px",
  textAlign: "center",
  verticalAlign: "middle",
  background: C.soft,
  borderBottom: `1px solid ${C.border}`,
  borderInline: `1px solid ${C.border}`,
  minWidth: 150,
};
const tdCell: CSSProperties = {
  padding: "7px 10px",
  textAlign: "center",
  verticalAlign: "middle",
  borderBottom: `1px solid ${C.border}`,
  borderInlineStart: `1px solid ${C.border}`,
};
const tdJust: CSSProperties = {
  padding: "7px 12px",
  textAlign: "start",
  verticalAlign: "middle",
  borderBottom: `1px solid ${C.border}`,
  borderInlineStart: `1px solid ${C.border}`,
  minWidth: 230,
};
const noteStyle: CSSProperties = {
  fontWeight: 400,
  fontSize: 10,
  color: C.faint,
  marginTop: 3,
};

function inputStyle(opts: {
  locked?: boolean;
  muted?: boolean;
  border?: string;
  bg?: string;
  color?: string;
}): CSSProperties {
  return {
    width: 96,
    padding: "7px 8px",
    border: `1px solid ${opts.border ?? C.borderStrong}`,
    borderRadius: 7,
    textAlign: "center",
    background: opts.bg ?? (opts.locked || opts.muted ? C.soft : C.card),
    color: opts.color ?? (opts.muted ? C.goldText : C.ink),
    fontWeight: 700,
    fontSize: 13,
  };
}

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
    <td style={tdLabel}>
      <div style={{ display: "flex", alignItems: "flex-start", gap: 8 }}>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div
            title={tip || definition || undefined}
            style={{
              fontWeight: 700,
              fontSize: 12.5,
              color: C.ink,
              cursor: "default",
              lineHeight: 1.35,
            }}
          >
            {label}
          </div>
          {hint ? (
            <div
              style={{
                fontWeight: 400,
                fontSize: 10.5,
                color: C.faint,
                marginTop: 1,
                lineHeight: 1.4,
              }}
            >
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
            style={{
              marginInlineStart: "auto",
              width: 24,
              height: 24,
              flexShrink: 0,
              display: "grid",
              placeItems: "center",
              border: `1px solid ${picked ? C.gold : C.border}`,
              borderRadius: 99,
              background: picked ? C.goldSoft : C.card,
              color: C.goldText,
              fontWeight: 700,
              fontSize: 13,
              cursor: locked ? "not-allowed" : "pointer",
              lineHeight: 1,
            }}
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
            style={{
              width: 24,
              height: 24,
              display: "grid",
              placeItems: "center",
              border: `1px solid ${included === false ? C.border : C.gold}`,
              borderRadius: 7,
              background: included === false ? C.card : C.goldSoft,
              color: C.goldText,
              fontWeight: 700,
              fontSize: 13,
              cursor: locked ? "not-allowed" : "pointer",
              lineHeight: 1,
              flexShrink: 0,
            }}
          >
            {included === false ? "" : "✓"}
          </button>
        ) : null}
        {deleteKey && onDelete && onConfirmDelete ? (
          confirmDelete === deleteKey ? (
            <span
              style={{
                display: "inline-flex",
                alignItems: "center",
                gap: 4,
                flexShrink: 0,
              }}
            >
              <span style={{ fontSize: 10.5, fontWeight: 700, color: C.danger }}>
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
                style={{
                  width: 22,
                  height: 22,
                  display: "grid",
                  placeItems: "center",
                  border: `1px solid ${C.danger}`,
                  borderRadius: 7,
                  background: "var(--red-light)",
                  color: C.dangerText,
                  fontWeight: 700,
                  fontSize: 12,
                  cursor: "pointer",
                  lineHeight: 1,
                }}
              >
                ✓
              </button>
              <button
                type="button"
                title="إلغاء"
                onClick={() => onConfirmDelete(null)}
                style={{
                  width: 22,
                  height: 22,
                  display: "grid",
                  placeItems: "center",
                  border: `1px solid ${C.border}`,
                  borderRadius: 7,
                  background: C.card,
                  color: C.muted,
                  fontWeight: 700,
                  fontSize: 12,
                  cursor: "pointer",
                  lineHeight: 1,
                }}
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
              style={{
                width: 24,
                height: 24,
                display: "grid",
                placeItems: "center",
                border: `1px solid ${C.border}`,
                borderRadius: 7,
                background: C.card,
                color: C.faint,
                fontWeight: 700,
                fontSize: 13,
                cursor: locked ? "not-allowed" : "pointer",
                lineHeight: 1,
                flexShrink: 0,
              }}
            >
              ×
            </button>
          )
        ) : null}
      </div>
      {offNote ? (
        <div
          style={{
            fontWeight: 600,
            fontSize: 10.5,
            color: C.danger,
            marginTop: 3,
          }}
        >
          {offNote}
        </div>
      ) : null}
      {areaFactor != null && onAreaFactorChange ? (
        <label
          style={{
            display: "flex",
            alignItems: "center",
            gap: 7,
            marginTop: 6,
          }}
        >
          <span style={{ fontWeight: 500, fontSize: 10.5, color: C.goldText }}>
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
            style={{
              width: 64,
              padding: "5px 7px",
              border: `1px solid ${C.borderStrong}`,
              borderRadius: 7,
              textAlign: "center",
              background: C.card,
              color: C.ink,
              fontWeight: 700,
              fontSize: 12,
            }}
          />
        </label>
      ) : null}
    </td>
  );
}

function SubjCell({ value, note }: { value: string; note?: string }) {
  return (
    <td style={tdSubj}>
      <span style={{ fontWeight: 700, fontSize: 12.5, color: C.goldText }}>
        {value}
      </span>
      {note ? <div style={noteStyle}>{note}</div> : null}
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
    return <td style={tdJust} />;
  }
  return (
    <td style={tdJust}>
      <input
        type="text"
        value={value ?? ""}
        disabled={locked}
        placeholder="مبرّر التسوية؟"
        onChange={(e) => onDraft(factorKey, e.target.value)}
        onBlur={() => onSave(factorKey)}
        style={{
          width: "100%",
          padding: "7px 10px",
          border: `1px solid ${C.border}`,
          borderRadius: 7,
          background: C.card,
          color: C.body,
          fontWeight: 500,
          fontSize: 12,
        }}
      />
    </td>
  );
}

function CompReadonly({
  value,
  note,
  color,
  font,
}: {
  value: string;
  note?: string;
  color?: string;
  font?: string;
}) {
  return (
    <td style={tdCell}>
      <span
        dir="ltr"
        style={{
          font: font ?? "800 14px Tajawal, sans-serif",
          color: color ?? C.ink,
        }}
      >
        {value}
      </span>
      {note ? <div style={noteStyle}>{note}</div> : null}
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
    <td style={tdCell}>
      <input
        dir="ltr"
        type="text"
        disabled={disabled}
        value={value}
        onChange={(e) => onDraft(cellKey, e.target.value)}
        onBlur={() => onSave?.()}
        style={inputStyle({
          locked: disabled,
          muted: muted || disabled,
          border: muted || auto ? C.border : C.borderStrong,
          bg: muted || disabled ? C.soft : C.card,
          color: muted || auto ? C.goldText : C.ink,
        })}
      />
      {note ? <div style={noteStyle}>{note}</div> : null}
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
    <tr style={{ background: C.softAlt }}>
      <td colSpan={colSpan} style={{ padding: "10px 16px" }}>
        <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
          <span style={{ fontSize: 12, fontWeight: 600, color: C.muted }}>
            إضافة عامل اختلاف
          </span>
          <select
            disabled={locked}
            value={current.factorKey}
            onChange={(e) => setSelected(e.target.value)}
            style={{
              padding: "7px 10px",
              border: `1px solid ${C.borderStrong}`,
              borderRadius: "var(--radius-sm)",
              fontSize: 12.5,
              color: C.ink,
              background: C.card,
              minWidth: 180,
            }}
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
            style={{
              padding: "7px 14px",
              border: "none",
              borderRadius: "var(--radius-sm)",
              background: C.inkFill,
              color: "#fff",
              fontWeight: 700,
              fontSize: 12.5,
              cursor: locked ? "not-allowed" : "pointer",
              opacity: locked ? 0.55 : 1,
            }}
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
  matrixDraft: Record<string, string>;
  weightDraft: Record<string, string>;
  rationaleDraft: Record<string, string>;
  factorDefinitions: Record<string, string>;
  onMatrixDraft: (key: string, value: string) => void;
  onWeightDraft: (id: string, value: string) => void;
  onRationaleDraft: (factorKey: string, value: string) => void;
  onSaveCell: (item: ValuationComparableSelectionDto, factorKey: string) => void;
  onSaveWeight: (item: ValuationComparableSelectionDto) => void;
  onSaveRationale: (factorKey: string) => void;
  onToggleIncluded: (
    item: ValuationComparableSelectionDto,
    factorKey: string,
  ) => void;
  onChangeBasis: (basis: "price_per_sqm" | "whole_property") => void;
  onResetWeights: () => void;
  onAreaFactorChange?: (value: string) => void;
  onAddFactor?: (factorKey: string, labelAr: string) => void;
  onRemoveFactor?: (factorKey: string) => void;
  catalogFactors?: { factorKey: string; labelAr: string }[];
  /** حذف تسوية تسلسلية (تمويل/نوع) — تُستعاد عبر شريحة «↺ استعادة». */
  onRemoveSequential?: (factorKey: string) => void;
  onRestoreSequential?: (factorKey: string) => void;
  /** compSpec: وصف المقارن لكل خلية عامل اختلاف. */
  descriptionDraft?: Record<string, string>;
  onDescriptionDraft?: (key: string, value: string) => void;
  onSaveDescription?: (
    item: ValuationComparableSelectionDto,
    factorKey: string,
    text: string,
  ) => void;
  /** subjSpec: وصف العقار محل التقييم لكل عامل اختلاف. */
  subjectSpecs?: Record<string, string>;
  subjectSpecDraft?: Record<string, string>;
  onSubjectSpecDraft?: (factorKey: string, value: string) => void;
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
  matrixDraft,
  weightDraft,
  rationaleDraft,
  factorDefinitions,
  onMatrixDraft,
  onWeightDraft,
  onRationaleDraft,
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
  descriptionDraft,
  onDescriptionDraft,
  onSaveDescription,
  subjectSpecs,
  subjectSpecDraft,
  onSubjectSpecDraft,
  onSaveSubjectSpec,
}: AdjustmentsMatrixProps) {
  /** حذف بخطوتين — «حذف؟ ✓ ×» (خانة تأكيد واحدة في كل لحظة كما في النموذج). */
  const [confirmDelete, setConfirmDelete] = useState<string | null>(null);
  const basis = selection.adjustmentBasis || "price_per_sqm";
  const isUnit = basis !== "whole_property";
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
      <div
        style={{
          background: C.card,
          border: `1px solid ${C.border}`,
          borderRadius: 12,
          padding: "18px 22px",
          marginBottom: 24,
          color: C.faint,
          fontSize: 13,
        }}
      >
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
      <div
        style={{
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          gap: 16,
          marginBottom: 12,
        }}
      >
        <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
          <h2 style={{ fontWeight: 800, fontSize: 17, margin: 0, color: C.ink }}>
            جدول التسويات
          </h2>
          <span style={{ fontWeight: 400, fontSize: 12, color: C.faint }}>
            مرّر على اسم البند لقراءة تعريفه وحدوده
          </span>
        </div>
        <div style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
          {removedSequential.map((k) => (
            <button
              key={k}
              type="button"
              disabled={saving || locked}
              onClick={() => onRestoreSequential?.(k)}
              title="استعادة البند المحذوف بقيمه الافتراضية"
              style={{
                display: "inline-flex",
                alignItems: "center",
                gap: 5,
                padding: "8px 12px",
                border: `1px dashed ${C.gold}`,
                borderRadius: "var(--radius)",
                background: C.goldSoft,
                color: C.goldText,
                fontWeight: 700,
                fontSize: 12,
                cursor: locked || saving ? "not-allowed" : "pointer",
              }}
            >
              ↺ استعادة {metaFor(k).label}
            </button>
          ))}
          <button
            type="button"
            disabled={saving || locked}
            onClick={onResetWeights}
            style={{
              display: "flex",
              alignItems: "center",
              gap: 7,
              padding: "10px 16px",
              border: "none",
              borderRadius: 9,
              background: C.inkFill,
              color: "#fff",
              fontWeight: 700,
              fontSize: 13,
              cursor: locked || saving ? "not-allowed" : "pointer",
              boxShadow: "var(--shadow)",
              opacity: locked || saving ? 0.55 : 1,
            }}
          >
            إعادة ضبط الأوزان
          </button>
        </div>
      </div>

      <div
        style={{
          background: C.card,
          border: `1px solid ${C.border}`,
          borderRadius: 12,
          boxShadow:
            "0 1px 2px rgba(18,40,76,.03),0 6px 16px -18px rgba(18,40,76,.10)",
          overflow: "hidden",
          marginBottom: 24,
        }}
      >
        <div style={{ overflowX: "auto" }}>
          <table
            style={{ width: "100%", borderCollapse: "collapse", minWidth: 1100 }}
          >
            <thead>
              <tr>
                <th style={{ ...thBand, width: 230 }}>البند</th>
                <th
                  style={{
                    ...thComp,
                    background: C.goldSoft,
                    borderInline: `1px solid ${C.borderStrong}`,
                  }}
                >
                  <div>العقار محل التقييم</div>
                  <div
                    style={{
                      fontWeight: 400,
                      fontSize: 10.5,
                      color: C.goldText,
                      marginTop: 3,
                    }}
                  >
                    أساس المقارنة
                  </div>
                </th>
                {adopted.map((item) => (
                  <th key={item.id} style={thComp}>
                    <div dir="ltr">{item.comparable.referenceCode}</div>
                    <div
                      style={{
                        fontWeight: 400,
                        fontSize: 10.5,
                        color: C.faint,
                        marginTop: 3,
                      }}
                    >
                      {item.comparable.transactionKindLabelAr}
                    </div>
                  </th>
                ))}
                <th
                  style={{
                    ...thBand,
                    minWidth: 230,
                    borderInlineStart: `1px solid ${C.border}`,
                  }}
                >
                  مبرر التسوية
                </th>
              </tr>
            </thead>
            <tbody>
              {/* أساس: قيمة العقار */}
              <tr style={{ background: isUnit ? C.softAlt : C.card }}>
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
                    color={!isUnit ? C.ink : C.faint}
                  />
                ))}
                <JustCell />
              </tr>

              {/* أساس: سعر المتر */}
              <tr style={{ background: isUnit ? C.card : C.softAlt }}>
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
                    color={isUnit ? C.ink : C.faint}
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
                    style={{ background: included ? C.card : C.softAlt }}
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
                          onDraft={onMatrixDraft}
                          onSave={
                            included2
                              ? () => onSaveCell(item, factorKey)
                              : undefined
                          }
                        />
                      );
                    })}
                    <JustCell
                      factorKey={factorKey}
                      value={justValue(factorKey)}
                      locked={locked}
                      onDraft={onRationaleDraft}
                      onSave={onSaveRationale}
                    />
                  </tr>
                );
              })}

              {/* بعد التسلسل */}
              <tr style={{ background: C.soft }}>
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
                      color={pctColor(adj)}
                      note={`${fmt(effArea(item))} م²`}
                    />
                  );
                })}
                <JustCell
                  factorKey="area"
                  value={justValue("area")}
                  locked={locked}
                  onDraft={onRationaleDraft}
                  onSave={onSaveRationale}
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
                    style={{ background: included ? C.card : C.softAlt }}
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
                      <td style={tdSubj}>
                        <input
                          type="text"
                          disabled={locked}
                          placeholder="وصف العقار…"
                          value={
                            subjectSpecDraft?.[factorKey] ??
                            subjectSpecs?.[factorKey] ??
                            ""
                          }
                          onChange={(e) =>
                            onSubjectSpecDraft?.(factorKey, e.target.value)
                          }
                          onBlur={(e) =>
                            onSaveSubjectSpec?.(factorKey, e.target.value)
                          }
                          style={{
                            width: "100%",
                            padding: "6px 8px",
                            border: `1px dashed ${C.borderStrong}`,
                            borderRadius: 7,
                            textAlign: "center",
                            background: C.card,
                            color: C.goldText,
                            fontWeight: 700,
                            fontSize: 12,
                          }}
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
                          onDraft={onMatrixDraft}
                          onSave={
                            included
                              ? () => onSaveCell(item, factorKey)
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
                                  descriptionDraft?.[descKey] ??
                                  line?.descriptionAr ??
                                  ""
                                }
                                onChange={(e) =>
                                  onDescriptionDraft?.(descKey, e.target.value)
                                }
                                onBlur={(e) =>
                                  onSaveDescription(item, factorKey, e.target.value)
                                }
                                style={{
                                  width: 110,
                                  marginTop: 4,
                                  padding: "4px 6px",
                                  border: `1px dashed ${C.border}`,
                                  borderRadius: 6,
                                  textAlign: "center",
                                  background: C.card,
                                  color: C.muted,
                                  fontWeight: 500,
                                  fontSize: 10.5,
                                }}
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
                      onDraft={onRationaleDraft}
                      onSave={onSaveRationale}
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
              <tr style={{ background: C.soft }}>
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
                      color={over ? C.dangerText : pctColor(sum)}
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
                    <td key={item.id} style={tdCell}>
                      <input
                        dir="ltr"
                        type="text"
                        disabled={locked}
                        value={display}
                        onChange={(e) => onWeightDraft(item.id, e.target.value)}
                        onBlur={() => onSaveWeight(item)}
                        style={inputStyle({
                          muted: !manual,
                          border: manual ? C.borderStrong : C.border,
                          bg: manual ? C.card : C.soft,
                          color: manual ? C.ink : C.goldText,
                        })}
                      />
                      <div style={noteStyle}>
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
                  onDraft={onRationaleDraft}
                  onSave={onSaveRationale}
                />
              </tr>

              {/* بعد الوزن */}
              <tr style={{ background: C.soft }}>
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
      <div
        style={{
          display: "flex",
          alignItems: "stretch",
          background: C.card,
          border: `1px solid ${C.border}`,
          borderRadius: 12,
          boxShadow:
            "0 1px 2px rgba(18,40,76,.03),0 6px 16px -18px rgba(18,40,76,.10)",
          overflow: "hidden",
          marginBottom: 24,
        }}
      >
        <div
          style={{
            flex: 1,
            padding: "18px 22px",
            borderInlineEnd: `1px solid ${C.border}`,
          }}
        >
          <div
            style={{ fontWeight: 500, fontSize: 12, color: C.muted, marginBottom: 9 }}
          >
            {isUnit ? "قيمة المتر بعد التسوية" : "قيمة العقار بعد التسوية"}
          </div>
          <div
            dir="ltr"
            style={{
              fontWeight: 800,
              fontSize: 24,
              lineHeight: 1,
              color: C.ink,
              textAlign: "start",
            }}
          >
            {fmt(selection.weightedPricePerSqm)}
          </div>
          <div style={{ fontWeight: 400, fontSize: 11.5, color: C.faint, marginTop: 7 }}>
            {isUnit ? "ريال / م²" : "ريال — قبل الضرب في المساحة"}
          </div>
          <div
            style={{ fontWeight: 700, fontSize: 11.5, color: C.goldText, marginTop: 5 }}
          >
            قيمة المتر المربع:{" "}
            <span dir="ltr">{fmt(selection.weightedPricePerSqm)}</span> ر.س/م²
          </div>
        </div>
        <div
          style={{
            flex: 1,
            padding: "18px 22px",
            borderInlineEnd: `1px solid ${C.border}`,
          }}
        >
          <div
            style={{ fontWeight: 500, fontSize: 12, color: C.muted, marginBottom: 9 }}
          >
            قيمة الأرض قبل التقريب
          </div>
          <div
            dir="ltr"
            style={{
              fontWeight: 800,
              fontSize: 24,
              lineHeight: 1,
              color: C.ink,
              textAlign: "start",
            }}
          >
            {fmt(selection.marketOpinionValueRaw ?? selection.marketOpinionValue)}
          </div>
          <div style={{ fontWeight: 400, fontSize: 11.5, color: C.faint, marginTop: 7 }}>
            سعر المتر × مساحة العقار
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
            مؤشر أسلوب السوق (خام)
          </div>
          <div
            dir="ltr"
            style={{
              fontWeight: 800,
              fontSize: 24,
              lineHeight: 1,
              color: C.ink,
              textAlign: "start",
            }}
          >
            {fmt(selection.marketOpinionValue)}
          </div>
          <div style={{ fontWeight: 400, fontSize: 11.5, color: C.faint, marginTop: 7 }}>
            بلا تقريب هنا — التقريب مرة واحدة بعد التوفيق النهائي (منطق-التكلفة)
          </div>
        </div>
      </div>

      {/* لوحة التنبيهات — مواصفة النموذج التفاعلي */}
      <div
        style={{
          background: C.card,
          border: `1px solid ${C.border}`,
          borderRadius: 12,
          boxShadow:
            "0 1px 2px rgba(18,40,76,.03),0 6px 16px -18px rgba(18,40,76,.10)",
          overflow: "hidden",
          marginBottom: 24,
        }}
      >
        <div
          style={{
            padding: "12px 22px",
            borderBottom: `1px solid ${C.border}`,
            fontWeight: 800,
            fontSize: 13.5,
            color: C.ink,
          }}
        >
          تنبيهات جدول التسويات
        </div>
        {alerts.map((a, i) => (
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
                background: a.kind === "error" ? C.danger : "#3f8f5f",
              }}
            />
            <div>
              <div
                style={{
                  fontWeight: 700,
                  fontSize: 12.5,
                  color: a.kind === "error" ? C.dangerText : "#3f8f5f",
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
      </div>

      {/* شريط عائم مطابق للتصميم */}
      <div
        style={{
          position: "fixed",
          bottom: 22,
          left: 41,
          zIndex: 40,
          display: "flex",
          alignItems: "center",
          gap: 14,
          padding: "10px 16px",
          borderRadius: "var(--radius-lg)",
          background: C.card,
          border: `1px solid ${C.borderStrong}`,
          borderInlineStart: `3px solid ${C.gold}`,
          boxShadow: "var(--shadow-lg)",
        }}
      >
        <div>
          <div style={{ fontWeight: 600, fontSize: 10.5, color: C.faint }}>
            القيمة النهائية للعقار
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
            {fmt(selection.marketOpinionValue)}
          </div>
        </div>
        <div style={{ width: 1, height: 30, background: C.border }} />
        <div>
          <div style={{ fontWeight: 600, fontSize: 10.5, color: C.faint }}>
            قيمة المتر المربع
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
            {fmt(selection.weightedPricePerSqm)}
          </div>
        </div>
      </div>
    </>
  );
});
