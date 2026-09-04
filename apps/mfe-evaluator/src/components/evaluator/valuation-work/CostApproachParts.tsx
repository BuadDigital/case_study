"use client";

import { memo, useState } from "react";
import type { ValuationCostApproachDto } from "@platform/api-client";
import { cn, opsFldControl } from "@platform/ui-kit";

import {
  Card,
  CardPad,
  CardTitle,
  FieldLabel,
  GhostBtn,
  ToggleChip,
} from "./atoms";
import { INDIRECT_COST_ITEMS } from "./lib/cost-line-math";
import { costNum } from "./lib/cost-approach-state";
import type {
  CostApproachAlert,
  CostApproachDerived,
  CostApproachFields,
} from "./lib/cost-approach-state";
import { fmt } from "./lib/shell-utils";

type FieldSetter = <K extends keyof CostApproachFields>(
  key: K,
  value: CostApproachFields[K],
) => void;

/** The plain-text/number draft fields — everything except the indirect map. */
type CostTextFieldKey = {
  [K in keyof CostApproachFields]: CostApproachFields[K] extends string ? K : never;
}[keyof CostApproachFields];

/** Land value card — read-only server figures plus the use-restriction discount. */
export function CostLandValueCard({
  cost,
  fields,
  setField,
  landComplete,
  isApartmentProperty,
}: {
  cost: ValuationCostApproachDto | null;
  fields: CostApproachFields;
  setField: FieldSetter;
  landComplete: boolean;
  isApartmentProperty: boolean;
}) {
  return (
    <Card>
      <CardPad>
        <CardTitle>قيمة الأرض</CardTitle>
        <div className="grid grid-cols-4 gap-3.5">
          <div>
            <FieldLabel>سعر المتر من مقارنات الأرض</FieldLabel>
            <div dir="ltr" className="mt-1.5 text-base font-extrabold text-heading">
              {landComplete ? fmt(cost?.landUnitRateFromMarket) : "—"}
            </div>
          </div>
          <label className="flex flex-col gap-1.5">
            <FieldLabel>خصم تقييد الاستخدام ٪</FieldLabel>
            <input
              dir="ltr"
              value={fields.useRestrictionPct}
              onChange={(e) =>
                setField("useRestrictionPct", e.target.value.replace(/[^\d.]/g, ""))
              }
              className={cn(opsFldControl, "font-semibold text-center")}
            />
          </label>
          {isApartmentProperty ? (
            <label className="flex flex-col gap-1.5">
              <FieldLabel>حصة الشقة من الأرض (م²)</FieldLabel>
              <input
                dir="ltr"
                value={fields.apartmentLandShare}
                placeholder="120"
                title="تحل محل مساحة الأرض في معادلة قيمة الأرض"
                onChange={(e) =>
                  setField(
                    "apartmentLandShare",
                    e.target.value.replace(/[^\d.]/g, ""),
                  )
                }
                className={cn(opsFldControl, "font-semibold text-center")}
              />
            </label>
          ) : null}
          <div>
            <FieldLabel>سعر المتر بعد الخصم</FieldLabel>
            <div dir="ltr" className="mt-1.5 text-base font-extrabold text-gold-d">
              {landComplete ? fmt(cost?.landUnitRateAfterDiscount) : "—"}
            </div>
          </div>
          <div>
            <FieldLabel>قيمة الأرض</FieldLabel>
            <div
              dir="ltr"
              className={cn(
                "mt-1.5 text-lg font-extrabold",
                landComplete ? "text-heading" : "text-red-text",
              )}
            >
              {landComplete ? fmt(cost?.landValueFromMarket) : "غير مكتمل"}
            </div>
          </div>
        </div>
        <input
          placeholder="مبرر تقييد الاستخدام…"
          value={fields.useRestrictionRationale}
          onChange={(e) => setField("useRestrictionRationale", e.target.value)}
          className={cn(
            opsFldControl,
            "mt-3 border-dashed bg-surface-2 font-medium text-text-2",
          )}
        />
      </CardPad>
    </Card>
  );
}

/** Indirect cost percentages, the financing derivation and the grand total. */
export function CostIndirectCard({
  fields,
  setField,
  setIndirect,
  directTotal,
  derived,
}: {
  fields: CostApproachFields;
  setField: FieldSetter;
  setIndirect: (itemKey: string, patch: { pct?: string; rationale?: string }) => void;
  directTotal: number;
  derived: CostApproachDerived;
}) {
  const { financingPctLocal, indirectSumLocal, totalCostLocal } = derived;
  return (
    <Card className="mb-0">
      <CardPad>
        <CardTitle>التكاليف غير المباشرة</CardTitle>
        <div className="flex flex-col gap-2.5">
          {INDIRECT_COST_ITEMS.map((item) => {
            const pctNum = costNum(fields.indirectDraft[item.key]?.pct ?? "0");
            return (
              <div key={item.key} className="flex items-center gap-2.5">
                <span className="w-[170px] shrink-0 text-[12.5px] text-text-2">
                  {item.label}
                </span>
                <input
                  value={fields.indirectDraft[item.key]?.rationale ?? ""}
                  placeholder="مبرر النسبة…"
                  onChange={(e) =>
                    setIndirect(item.key, { rationale: e.target.value })
                  }
                  className="flex-1 rounded-[7px] border border-dashed border-border bg-surface-2 px-[9px] py-1.5 text-[11.5px]"
                />
                <span
                  dir="ltr"
                  title="المبلغ = التكلفة المباشرة × النسبة"
                  className="w-[92px] shrink-0 text-end text-[11.5px] font-bold text-gold-d"
                >
                  {fmt((directTotal * pctNum) / 100)}
                </span>
                <input
                  dir="ltr"
                  type="number"
                  min={0}
                  max={50}
                  step={1}
                  value={fields.indirectDraft[item.key]?.pct ?? "0"}
                  onChange={(e) => setIndirect(item.key, { pct: e.target.value })}
                  className="w-[70px] rounded-[7px] border border-border-md p-[7px] text-center text-[13px] font-bold"
                />
              </div>
            );
          })}
          <div className="flex items-end gap-2 border-t border-border pt-2.5">
            <label className="flex flex-1 flex-col gap-1">
              <FieldLabel>معدل التمويل السنوي ٪</FieldLabel>
              <input
                dir="ltr"
                value={fields.financingRate}
                onChange={(e) => setField("financingRate", e.target.value)}
                className={cn(opsFldControl, "font-semibold text-center")}
              />
            </label>
            <label className="flex flex-1 flex-col gap-1">
              <FieldLabel>مدة التنفيذ (أشهر)</FieldLabel>
              <input
                dir="ltr"
                value={fields.financingMonths}
                onChange={(e) => setField("financingMonths", e.target.value)}
                className={cn(opsFldControl, "font-semibold text-center")}
              />
            </label>
          </div>
          <div className="text-[11px] text-text-3">
            التمويل: معدل سنوي × (المدة ÷ ١٢) × ٥٠٪ ={" "}
            <b dir="ltr" className="text-gold-d">
              {(Math.round(financingPctLocal * 100) / 100).toFixed(2)}٪
            </b>{" "}
            · مبلغه{" "}
            <b dir="ltr" className="text-gold-d">
              {fmt((directTotal * financingPctLocal) / 100)}
            </b>
          </div>
          <div className="flex items-center justify-between rounded-[9px] border border-border bg-surface-2 px-[13px] py-2.5">
            <span className="text-[12.5px] font-bold text-heading">
              مجموع النسب غير المباشرة
            </span>
            <span
              dir="ltr"
              className={cn(
                "text-[15px] font-extrabold",
                indirectSumLocal > 45 ? "text-red-text" : "text-heading",
              )}
            >
              {(Math.round(indirectSumLocal * 100) / 100).toFixed(2)}٪
            </span>
          </div>
          {indirectSumLocal > 45 ? (
            <div className="text-[11.5px] font-bold text-red-text">
              مجموع النسب غير المباشرة يتجاوز ٤٥٪ — يستلزم مراجعة
            </div>
          ) : null}
          <div className="flex items-center justify-between rounded-[9px] border border-border-md bg-gold-soft px-[13px] py-2.5">
            <span className="text-[12.5px] font-extrabold text-heading">
              التكلفة الإجمالية
            </span>
            <span dir="ltr" className="text-base font-extrabold text-heading">
              {fmt(totalCostLocal)}
            </span>
          </div>
        </div>
      </CardPad>
    </Card>
  );
}

/** Age rows: value field plus an optional justification field, in form order. */
const AGE_ROWS: {
  label: string;
  value: CostTextFieldKey;
  justification: CostTextFieldKey | null;
}[] = [
  { label: "العمر الفعلي (سنة)", value: "actualAge", justification: null },
  { label: "العمر الاقتصادي (سنة)", value: "economicAge", justification: null },
  {
    label: "تمديد العمر (سنة)",
    value: "lifeExtension",
    justification: "lifeExtensionBasis",
  },
  {
    label: "التقادم الوظيفي (٪)",
    value: "functionalObs",
    justification: "functionalObsRationale",
  },
  {
    label: "التقادم الخارجي (٪)",
    value: "externalObs",
    justification: "externalObsRationale",
  },
];

/** Age and depreciation inputs, with the server-side results underneath. */
export function CostAgeCard({
  cost,
  fields,
  setField,
}: {
  cost: ValuationCostApproachDto | null;
  fields: CostApproachFields;
  setField: FieldSetter;
}) {
  return (
    <Card className="mb-0">
      <CardPad>
        <CardTitle>العمر والإهلاك</CardTitle>
        <div className="flex flex-col gap-2.5">
          {AGE_ROWS.map(({ label, value, justification }) => (
            <div key={label} className="flex items-center gap-2">
              <span className="w-32 shrink-0 text-[12.5px] text-text-2">
                {label}
              </span>
              {justification ? (
                <input
                  placeholder={
                    label.startsWith("تمديد") ? "أساس تمديد العمر…" : "مبرر التقدير…"
                  }
                  value={fields[justification]}
                  onChange={(e) => setField(justification, e.target.value)}
                  className="flex-1 rounded-[7px] border border-dashed border-border bg-surface-2 px-[9px] py-1.5 text-[11.5px]"
                />
              ) : (
                <span className="flex-1" />
              )}
              <input
                dir="ltr"
                value={fields[value]}
                onChange={(e) => setField(value, e.target.value)}
                className="w-[78px] shrink-0 rounded-[7px] border border-border-md p-[7px] text-center font-bold"
              />
            </div>
          ))}
          <div className="grid grid-cols-2 gap-2">
            <div className="rounded-[9px] border border-border bg-surface-2 px-3 py-[9px] text-[11.5px] text-text-2">
              التقادم المادي{" "}
              <b dir="ltr" className="text-heading">
                {cost?.physicalObsolescencePct != null
                  ? `${cost.physicalObsolescencePct}٪`
                  : "—"}
              </b>
            </div>
            <div className="rounded-[9px] border border-border bg-surface-2 px-3 py-[9px] text-[11.5px] text-text-2">
              مجموع التقادم{" "}
              <b
                dir="ltr"
                className={cn(
                  (cost?.totalObsolescencePct ?? 0) > 100
                    ? "text-red-text"
                    : "text-heading",
                )}
              >
                {cost ? `${cost.totalObsolescencePct}٪` : "—"}
              </b>
            </div>
            <div className="rounded-[9px] border border-border bg-surface-2 px-3 py-[9px] text-[11.5px] text-text-2">
              قيمة الإهلاك{" "}
              <b dir="ltr" className="text-red-text">
                {fmt(cost?.depreciationValue)}
              </b>
            </div>
            <div className="rounded-[9px] border border-border-md bg-gold-soft px-3 py-[9px] text-[11.5px] text-text-2">
              المباني بعد الإهلاك{" "}
              <b dir="ltr" className="text-heading">
                {fmt(cost?.buildingsValueAfterDepreciation)}
              </b>
            </div>
          </div>
        </div>
      </CardPad>
    </Card>
  );
}

/** Results and recommendations — the interactive-form two-panel summary. */
export function CostResultsCard({
  derived,
  buildAreaLocal,
  buildingOnly,
}: {
  derived: CostApproachDerived;
  buildAreaLocal: number;
  buildingOnly: boolean;
}) {
  const { totalCostLocal, netValueLocal, costValueLocal, landComplete } = derived;
  return (
    <Card className="mb-6">
      <div className="flex items-stretch">
        <div className="flex-1 border-e border-border px-[22px] py-[18px]">
          <div className="mb-[9px] text-xs font-medium text-text-2">
            سعر متر المباني للعقار
          </div>
          <div dir="ltr" className="text-2xl font-extrabold leading-none text-heading">
            {buildAreaLocal > 0 ? fmt(totalCostLocal / buildAreaLocal) : "—"}
          </div>
          <div className="mt-[7px] text-[11.5px] text-text-3">
            قبل الإهلاك · التكلفة الإجمالية ÷{" "}
            <span dir="ltr">{fmt(buildAreaLocal, 1)}</span> م² مسطحات
          </div>
          <div className="mt-[5px] text-[11.5px] font-bold text-gold-d">
            بعد الإهلاك:{" "}
            <span dir="ltr">
              {buildAreaLocal > 0 ? fmt(netValueLocal / buildAreaLocal) : "—"}
            </span>{" "}
            ر.س / م²
          </div>
        </div>
        <div className="relative flex-[1.4] bg-surface-2 px-[22px] py-[18px]">
          <span className="absolute start-0 top-0 h-full w-[3px] bg-gold" />
          <div className="mb-[9px] text-xs font-bold text-heading">
            ناتج أسلوب التكلفة — المباني دون الأرض
          </div>
          <div dir="ltr" className="text-2xl font-extrabold leading-none text-heading">
            {fmt(netValueLocal)}
          </div>
          <div className="mt-[7px] text-[11.5px] text-text-3">
            التكلفة الإجمالية − الإهلاك · بلا تقريب
          </div>
          <div className="mt-[5px] text-[11.5px] font-bold text-gold-d">
            {buildingOnly
              ? "النطاق «مبنى فقط» — هذا هو مؤشر الأسلوب"
              : landComplete
                ? `مع قيمة الأرض: ${fmt(costValueLocal)} ر.س — للاسترشاد`
                : "مؤشر الأسلوب غير مكتمل — يلزم قيمة الأرض"}
          </div>
        </div>
      </div>
    </Card>
  );
}

/** Cost analysis notes — auto text until edited, then manual with a reset. */
export function CostAnalysisCard({
  notes,
  autoNarrative,
  dirty,
  saving,
  onChange,
}: {
  notes: string;
  autoNarrative: string;
  dirty: boolean;
  saving: boolean;
  onChange: (value: string) => void;
}) {
  return (
    <Card>
      <CardPad>
        <div className="mb-3 flex items-center justify-between gap-2.5">
          <span className="text-[14.5px] font-extrabold text-heading">
            تحليل التكلفة
          </span>
          <div className="flex items-center gap-2.5">
            <span
              className={cn(
                "text-[11px] font-semibold",
                dirty ? "text-red-text" : "text-gold-d",
              )}
            >
              {dirty
                ? "نص محرَّر يدوياً — لا يتحدث تلقائياً"
                : "يتحدث تلقائياً مع المبررات"}
            </span>
            {dirty ? (
              <GhostBtn disabled={saving} onClick={() => onChange("")}>
                ↺ استرجاع النص التلقائي
              </GhostBtn>
            ) : null}
          </div>
        </div>
        <textarea
          rows={10}
          value={dirty ? notes : autoNarrative}
          onChange={(e) => onChange(e.target.value)}
          className="w-full resize-y rounded-[9px] border border-border bg-surface-2 px-4 py-3.5 text-[13px] font-medium leading-[2] text-text"
        />
      </CardPad>
    </Card>
  );
}

/** Cost-approach alert list — one row per trigger, error rows announce. */
export function CostAlertsCard({ alerts }: { alerts: CostApproachAlert[] }) {
  return (
    <Card className="mb-6">
      <div className="border-b border-border px-[22px] py-3 text-[13.5px] font-extrabold text-heading">
        تنبيهات أسلوب التكلفة
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
              a.kind === "error"
                ? "bg-red"
                : a.kind === "warn"
                  ? "bg-[#d9a441]"
                  : "bg-[#3f8f5f]",
            )}
          />
          <div>
            <div
              className={cn(
                "text-[12.5px] font-bold",
                a.kind === "error"
                  ? "text-red-text"
                  : a.kind === "warn"
                    ? "text-[#a07a24]"
                    : "text-[#3f8f5f]",
              )}
            >
              {a.title}
            </div>
            <div className="mt-0.5 text-[11.5px] text-text-2">{a.body}</div>
          </div>
        </div>
      ))}
    </Card>
  );
}

/** Cost basis/unit card on the cost screen — saves over the last saved settings.
 * Drafts are local; the shell remounts it (key) when saved values change. */
export const CostBasisUnitCard = memo(function CostBasisUnitCard({
  savedBasisKey,
  savedUnitKey,
  saving,
  onSave,
}: {
  savedBasisKey: string;
  savedUnitKey: string;
  saving: boolean;
  onSave: (basisKey: string, unitKey: string) => void;
}) {
  const [basis, setBasis] = useState(savedBasisKey);
  const [unit, setUnit] = useState(savedUnitKey);
  return (
    <Card>
      <CardPad>
        <CardTitle>طريقة التكلفة وأسلوب التقدير</CardTitle>
        <FieldLabel>أساس التكلفة</FieldLabel>
        <div className="my-2 mb-3.5 flex flex-wrap gap-2">
          <ToggleChip
            active={basis === "replacement"}
            disabled={saving}
            onClick={() => setBasis("replacement")}
          >
            الإحلال / الاستبدال
          </ToggleChip>
          <ToggleChip
            active={basis === "reproduction"}
            disabled={saving}
            onClick={() => setBasis("reproduction")}
          >
            إعادة الإنتاج
          </ToggleChip>
        </div>
        <FieldLabel>وحدة التقدير</FieldLabel>
        <div className="mt-2 flex flex-wrap gap-2">
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
              active={unit === k}
              disabled={saving}
              onClick={() => setUnit(k)}
            >
              {label}
            </ToggleChip>
          ))}
        </div>
        <div className="mt-3.5">
          <GhostBtn disabled={saving} onClick={() => onSave(basis, unit)}>
            حفظ أساس/وحدة التكلفة
          </GhostBtn>
        </div>
      </CardPad>
    </Card>
  );
});
