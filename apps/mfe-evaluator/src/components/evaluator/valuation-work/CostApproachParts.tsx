"use client";

import type { ValuationCostApproachDto } from "@platform/api-client";
import {
  invalidControlClass,
  scheduleScrollToFirstFormField,
} from "@platform/app-shared/form-ux";
import { cn } from "@platform/ui-kit";

import {
  Card,
  CardPad,
  FieldLabel,
} from "./atoms";
import { useValuationWorkErrors } from "./ValuationWorkErrors";
import { COST_FIELD_ERROR_KEYS } from "./lib/valuation-work-error-targets";
import { INDIRECT_COST_ITEMS } from "./lib/cost-line-math";
import { costNum } from "./lib/cost-approach-state";
import type {
  CostApproachAlert,
  CostApproachDerived,
  CostApproachFields,
} from "./lib/cost-approach-state";
import { fmt } from "./lib/shell-utils";

function formatPct2(n: number): string {
  return (Math.round(n * 100) / 100).toFixed(2);
}

type FieldSetter = <K extends keyof CostApproachFields>(
  key: K,
  value: CostApproachFields[K],
) => void;

/** The plain-text/number draft fields — everything except the indirect map. */
type CostTextFieldKey = {
  [K in keyof CostApproachFields]: CostApproachFields[K] extends string ? K : never;
}[keyof CostApproachFields];

const htmlNumInput =
  "rounded-[7px] border border-border-md bg-surface p-[7px] text-center text-[13px] font-bold text-heading";
const htmlJustInput =
  "min-w-0 flex-1 rounded-[7px] border border-dashed border-border bg-surface-2 px-[9px] py-1.5 text-[11.5px] font-medium text-text-2";

/** Land value — compact HTML strip: discount, rationale, optional share, rates. */
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
      <div className="px-[22px] py-3.5">
        <div className="mb-3 text-[13px] font-extrabold text-heading">قيمة الأرض</div>
        <div className="flex flex-wrap items-end gap-[18px]">
          <div className="flex flex-col gap-1.5">
            <FieldLabel>سعر المتر من مقارنات الأرض</FieldLabel>
            <span dir="ltr" className="py-2 text-sm font-extrabold text-heading">
              {landComplete ? fmt(cost?.landUnitRateFromMarket) : "—"}
            </span>
          </div>
          <label className="flex flex-col gap-1.5">
            <FieldLabel>خصم تقييد الاستخدام (٪)</FieldLabel>
            <input
              id="cost-useRestrictionPct"
              dir="ltr"
              type="number"
              min={0}
              max={90}
              step={5}
              value={fields.useRestrictionPct}
              onChange={(e) =>
                setField("useRestrictionPct", e.target.value.replace(/[^\d.]/g, ""))
              }
              className={cn(htmlNumInput, "w-[90px] p-2")}
            />
          </label>
          <label className="flex min-w-[220px] flex-1 flex-col gap-1.5">
            <FieldLabel>مبرر التقييد</FieldLabel>
            <input
              id="cost-useRestrictionRationale"
              placeholder="مبرر تقييد الاستخدام…"
              value={fields.useRestrictionRationale}
              onChange={(e) => setField("useRestrictionRationale", e.target.value)}
              className="w-full rounded-[7px] border border-dashed border-border-md bg-surface-2 px-2.5 py-2 text-xs font-medium text-text-2"
            />
          </label>
          {isApartmentProperty ? (
            <label className="flex flex-col gap-1.5">
              <FieldLabel>حصة الشقة من الأرض (م²)</FieldLabel>
              <input
                id="cost-apartmentLandShare"
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
                className={cn(htmlNumInput, "w-[110px] p-2")}
              />
            </label>
          ) : null}
          <div className="flex flex-col gap-1.5">
            <FieldLabel>سعر المتر بعد الخصم</FieldLabel>
            <span dir="ltr" className="py-2 text-sm font-extrabold text-gold-d">
              {landComplete ? fmt(cost?.landUnitRateAfterDiscount) : "—"}
            </span>
          </div>
          <div className="flex flex-col gap-1.5">
            <FieldLabel>قيمة الأرض</FieldLabel>
            <span
              dir="ltr"
              className={cn(
                "py-2 text-lg font-extrabold",
                landComplete ? "text-heading" : "text-red-text",
              )}
            >
              {landComplete ? fmt(cost?.landValueFromMarket) : "غير مكتمل"}
            </span>
          </div>
        </div>
      </div>
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
  const finPct = formatPct2(financingPctLocal);
  return (
    <Card id="cost-indirect" className="mb-0">
      <div className="px-[22px] pb-5 pt-[18px]">
        <div className="mb-[14px] text-[14.5px] font-extrabold text-heading">
          التكاليف غير المباشرة
        </div>
        <div className="flex flex-col gap-2.5">
          {INDIRECT_COST_ITEMS.map((item) => {
            const pctNum = costNum(fields.indirectDraft[item.key]?.pct ?? "0");
            return (
              <div key={item.key} className="flex items-center gap-2.5">
                <span className="w-[170px] shrink-0 text-[12.5px] font-medium text-text-2">
                  {item.label}
                </span>
                <input
                  value={fields.indirectDraft[item.key]?.rationale ?? ""}
                  placeholder="مبرر النسبة…"
                  onChange={(e) =>
                    setIndirect(item.key, { rationale: e.target.value })
                  }
                  className={htmlJustInput}
                />
                <span className="w-[110px] shrink-0 text-end text-[11.5px] font-medium text-text-3">
                  <span dir="ltr">{fmt((directTotal * pctNum) / 100)}</span> ر.س.
                </span>
                <input
                  dir="ltr"
                  type="number"
                  min={0}
                  max={50}
                  step={1}
                  value={fields.indirectDraft[item.key]?.pct ?? "0"}
                  onChange={(e) => setIndirect(item.key, { pct: e.target.value })}
                  className={cn(htmlNumInput, "w-[70px] shrink-0")}
                />
              </div>
            );
          })}
          <div className="flex items-center justify-between gap-3 border-t border-border pt-2.5">
            <div>
              <div className="text-[12.5px] font-medium text-text-2">التمويل</div>
              <div className="mt-0.5 text-[10.5px] font-normal text-text-3">
                معدل سنوي × (المدة ÷ ١٢) × ٥٠٪ = {finPct}٪
              </div>
            </div>
            <div className="flex items-center gap-2">
              <span
                dir="ltr"
                className="min-w-24 text-end text-[11.5px] font-medium text-text-3"
              >
                {fmt((directTotal * financingPctLocal) / 100)}
              </span>
              <input
                id="cost-financingRate"
                dir="ltr"
                type="number"
                min={0}
                max={30}
                step={0.5}
                title="المعدل السنوي"
                value={fields.financingRate}
                onChange={(e) => setField("financingRate", e.target.value)}
                className={cn(htmlNumInput, "w-[70px]")}
              />
              <input
                id="cost-financingMonths"
                dir="ltr"
                type="number"
                min={0}
                max={120}
                step={1}
                title="مدة التنفيذ بالأشهر"
                value={fields.financingMonths}
                onChange={(e) => setField("financingMonths", e.target.value)}
                className="w-[70px] rounded-[7px] border border-border-md bg-surface-2 p-[7px] text-center text-[13px] font-bold text-gold-d"
              />
            </div>
          </div>
          <div className="flex items-center justify-between gap-3 border-t border-border pt-2.5">
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
              {formatPct2(indirectSumLocal)}٪
            </span>
          </div>
          {indirectSumLocal > 45 ? (
            <div className="text-[11.5px] font-semibold text-[#c0553d]">
              مجموع النسب غير المباشرة يتجاوز ٤٥٪ — يستلزم مراجعة
            </div>
          ) : null}
          <div className="flex items-center justify-between gap-3 rounded-[9px] border border-border bg-surface-2 px-[13px] py-[11px]">
            <span className="text-[12.5px] font-bold text-heading">
              التكلفة الإجمالية
            </span>
            <span dir="ltr" className="text-[17px] font-extrabold text-heading">
              {fmt(totalCostLocal)}
            </span>
          </div>
        </div>
      </div>
    </Card>
  );
}

/** Age rows: value field plus a justification field, in form order. */
const AGE_ROWS: {
  label: string;
  value: CostTextFieldKey;
  justification: CostTextFieldKey;
}[] = [
  {
    label: "العمر الفعلي (سنة)",
    value: "actualAge",
    justification: "actualAgeRationale",
  },
  {
    label: "العمر الاقتصادي (سنة)",
    value: "economicAge",
    justification: "economicAgeRationale",
  },
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
    label: "التقدم الاقتصادي (الخارجي)",
    value: "externalObs",
    justification: "externalObsRationale",
  },
];

/** Age and depreciation inputs, with live results underneath (form spec §٢٫٤). */
export function CostAgeCard({
  fields,
  setField,
  derived,
}: {
  fields: CostApproachFields;
  setField: FieldSetter;
  derived: CostApproachDerived;
}) {
  const { fieldErrors } = useValuationWorkErrors();
  return (
    <Card id="cost-age" className="mb-0">
      <div className="px-[22px] pb-5 pt-[18px]">
        <div className="mb-[14px] text-[14.5px] font-extrabold text-heading">
          العمر والإهلاك
        </div>
        <div className="flex flex-col gap-2.5">
          {AGE_ROWS.map(({ label, value, justification }) => (
            <div key={label} className="flex items-center gap-2.5">
              <span className="w-[150px] shrink-0 text-[12.5px] font-medium text-text-2">
                {label}
              </span>
              <input
                id={`cost-${justification}`}
                placeholder="مبرر التقدير…"
                value={fields[justification]}
                onChange={(e) => setField(justification, e.target.value)}
                className={htmlJustInput}
              />
              <input
                id={`cost-${value}`}
                dir="ltr"
                type="number"
                min={0}
                step={1}
                value={fields[value]}
                onChange={(e) => setField(value, e.target.value)}
                className={cn(
                  htmlNumInput,
                  "w-[78px] shrink-0",
                  fieldErrors[COST_FIELD_ERROR_KEYS[value] ?? value] &&
                    invalidControlClass,
                )}
              />
            </div>
          ))}
          <div className="flex items-center justify-between gap-3 border-t border-border pt-2.5">
            <span className="text-[12.5px] font-medium text-text-2">
              التقادم المادي
            </span>
            <span dir="ltr" className="text-[13px] font-bold text-heading">
              {formatPct2(derived.physicalLocal)}٪
            </span>
          </div>
          <div className="flex items-center justify-between gap-3">
            <span className="text-[12.5px] font-bold text-heading">
              مجموع التقادم
            </span>
            <span
              dir="ltr"
              className={cn(
                "text-sm font-extrabold",
                derived.totalDepLocal > 100 ? "text-red-text" : "text-heading",
              )}
            >
              {formatPct2(derived.totalDepLocal)}٪
            </span>
          </div>
          <div className="flex items-center justify-between gap-3">
            <span className="text-[12.5px] font-medium text-text-2">
              قيمة الإهلاك
            </span>
            <span dir="ltr" className="text-[13px] font-bold text-[#a5432e]">
              {fmt(derived.depValueLocal)}
            </span>
          </div>
          <div className="flex items-center justify-between gap-3 rounded-[9px] border border-border bg-surface-2 px-[13px] py-[11px]">
            <span className="text-[12.5px] font-bold text-heading">
              قيمة المباني بعد الإهلاك
            </span>
            <span dir="ltr" className="text-[17px] font-extrabold text-heading">
              {fmt(derived.netValueLocal)}
            </span>
          </div>
        </div>
      </div>
    </Card>
  );
}

/**
 * Results and recommendations — laid out like the market approach's output strip: the unit
 * rate on the right, the unrounded approach value on the left.
 */
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
  const perSqm = (value: number) => (buildAreaLocal > 0 ? fmt(value / buildAreaLocal) : "—");
  return (
    <Card className="mb-6">
      <div className="flex items-stretch">
        <div className="flex-1 border-e border-border px-[22px] py-[18px]">
          <div className="mb-[9px] text-[12px] font-medium text-text-2">
            قيمة متر المباني بعد الإهلاك
          </div>
          <div
            dir="ltr"
            className="text-start text-[24px] font-extrabold leading-none text-heading"
          >
            {perSqm(netValueLocal)}
          </div>
          <div className="mt-[7px] text-[11.5px] font-normal text-text-3">ريال / م²</div>
          <div className="mt-[5px] text-[11.5px] font-bold text-gold-d">
            قبل الإهلاك: <span dir="ltr">{perSqm(totalCostLocal)}</span> ر.س/م²
          </div>
        </div>
        <div className="relative flex-[1.4] bg-surface-2 px-[22px] py-[18px]">
          <span className="absolute start-0 top-0 h-full w-[3px] bg-gold" />
          <div className="mb-[9px] text-[12px] font-bold text-heading">
            قيمة المباني قبل التقريب
          </div>
          <div
            dir="ltr"
            className="text-start text-[24px] font-extrabold leading-none text-heading"
          >
            {fmt(netValueLocal)}
          </div>
          <div className="mt-[7px] text-[11.5px] font-normal text-text-3">
            التكلفة الإجمالية − الإهلاك
            {buildingOnly ? null : landComplete ? (
              <>
                {" "}
                · مع قيمة الأرض: <span dir="ltr">{fmt(costValueLocal)}</span> ر.س
              </>
            ) : (
              " · يلزم قيمة الأرض لاكتمال مؤشر الأسلوب"
            )}
          </div>
          <div className="mt-[5px] text-[11.5px] font-normal text-text-3">
            بلا تقريب هنا — التقريب مرة واحدة بعد التوفيق النهائي
          </div>
        </div>
      </div>
    </Card>
  );
}

const ALERT_SKIN = {
  error: {
    box: "border-[rgba(192,85,61,.3)] bg-[rgba(192,85,61,.07)]",
    dot: "bg-[#c0553d]",
    title: "text-[#a5432e]",
  },
  warn: {
    box: "border-[rgba(164,144,111,.35)] bg-[rgba(164,144,111,.1)]",
    dot: "bg-[#d9a441]",
    title: "text-gold-d",
  },
  ok: {
    box: "border-[rgba(63,143,95,.3)] bg-[rgba(63,143,95,.07)]",
    dot: "bg-[#3f8f5f]",
    title: "text-[#3f8f5f]",
  },
} as const;

/**
 * Cost-approach alert list — one colored card per trigger, matching the HTML.
 * An alert that names a control is a link to it: clicking scrolls the field
 * into view, pulses it and focuses it.
 */
export function CostAlertsCard({ alerts }: { alerts: CostApproachAlert[] }) {
  return (
    <div className="mb-6 grid grid-cols-1 gap-3">
      {alerts.map((a, i) => {
        const skin = ALERT_SKIN[a.kind];
        const body = (
          <>
            <span
              className={cn("mt-1.5 size-2 shrink-0 rounded-full", skin.dot)}
            />
            <div className="min-w-0 flex-1">
              <div className={cn("text-[13px] font-bold", skin.title)}>
                {a.title}
              </div>
              <div className="mt-0.5 text-xs leading-[1.7] text-text-2">
                {a.body}
              </div>
            </div>
          </>
        );
        const box = "flex w-full items-start gap-[11px] rounded-[10px] border px-4 py-[13px] text-start";
        if (!a.targetId) {
          return (
            <div
              key={i}
              role={a.kind === "error" ? "alert" : "status"}
              className={cn(box, skin.box)}
            >
              {body}
            </div>
          );
        }
        return (
          <button
            key={i}
            type="button"
            title="انتقل إلى الحقل"
            data-target-id={a.targetId}
            onClick={() =>
              scheduleScrollToFirstFormField(
                [a.targetId, a.fallbackTargetId],
                0,
                { retries: 8 },
              )
            }
            className={cn(
              box,
              skin.box,
              "cursor-pointer transition-[box-shadow,transform] duration-150 hover:shadow-[0_1px_8px_rgba(0,0,0,.08)]",
            )}
          >
            {body}
            <span className="mt-0.5 shrink-0 text-[11px] font-bold text-text-3">
              انتقل للحقل ←
            </span>
          </button>
        );
      })}
    </div>
  );
}
