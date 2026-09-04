"use client";

import { cn } from "@platform/ui-kit";

import { panelCardClass } from "./AdjustmentsMatrixCells";
import type { MatrixAlert, MatrixBasisView } from "./lib/adjustments-matrix-state";
import { fmt } from "./lib/shell-utils";

/** The three-column output strip under the matrix — market indicator, raw. */
export function MatrixOutputsPanel({
  basisView,
  weightedPricePerSqm,
}: {
  basisView: MatrixBasisView;
  weightedPricePerSqm: number | null;
}) {
  const { isUnit, pricePerSqmDisplay, opinionRaw, opinionFinal } = basisView;
  return (
    <div className={cn(panelCardClass, "flex items-stretch")}>
      <div className="flex-1 border-e border-border px-[22px] py-[18px]">
        <div className="mb-[9px] text-[12px] font-medium text-text-2">
          {isUnit ? "قيمة المتر بعد التسوية" : "قيمة العقار بعد التسوية"}
        </div>
        <div
          dir="ltr"
          className="text-start text-[24px] font-extrabold leading-none text-heading"
        >
          {fmt(weightedPricePerSqm)}
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
  );
}

/** Alerts panel — interactive-form spec. */
export function MatrixAlertsPanel({ alerts }: { alerts: MatrixAlert[] }) {
  return (
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
  );
}
