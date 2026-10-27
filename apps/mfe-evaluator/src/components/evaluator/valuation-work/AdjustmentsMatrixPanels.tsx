// ── Valuation fixes · 2026-10-25/26 ──────────────────────────────────────────────────────────
// Round 1 (5b554f4e)
//  • Wording  The output title comes from basisView.outputLabel: «قيمة الأرض قبل التقريب» only for the land
//             table inside the cost approach, «قيمة العقار قبل التقريب» for the market table.
// Round 2 (1b19bedc)
//  • A    The formula line under the value comes from basisView.outputFormula — for an apartment's land it
//         shows «سعر المتر بعد التسوية × حصة الشقة» with the area adjustment on the whole building plot.
//  • Alert titles and bodies go through KeepCodesTogether so CMP-… codes never break across lines.
// ──────────────────────────────────────────────────────────────────────────────────────────────

"use client";

import { cn } from "@platform/ui-kit";

import { panelCardClass } from "./AdjustmentsMatrixCells";
import type { MatrixAlert, MatrixBasisView } from "./lib/adjustments-matrix-state";
import { fmt } from "./lib/shell-utils";
import { KeepCodesTogether } from "./KeepCodesTogether";

/** Output strip under the matrix — unit rate, then the unrounded approach value. */
export function MatrixOutputsPanel({
  basisView,
  weightedPricePerSqm,
}: {
  basisView: MatrixBasisView;
  weightedPricePerSqm: number | null;
}) {
  const { isUnit, outputLabel, outputFormula, pricePerSqmDisplay, opinionRaw } = basisView;
  return (
    // Phones stack the two figures; side by side each got ~150px.
    <div className={cn(panelCardClass, "flex items-stretch max-lg:flex-col")}>
      <div className="flex-1 border-border px-[22px] py-[18px] max-lg:border-b max-lg:px-4 lg:border-e">
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
          {isUnit ? "ر.س/م²" : "ر.س — متوسط مرجّح لقيم المقارنات"}
        </div>
        <div className="mt-[5px] text-[11.5px] font-bold text-gold-d">
          قيمة المتر المربع:{" "}
          <span dir="ltr">
            {pricePerSqmDisplay != null ? fmt(pricePerSqmDisplay) : "—"}
          </span>{" "}
          ر.س/م²
        </div>
      </div>
      <div className="relative flex-[1.4] bg-surface-2 px-[22px] py-[18px] max-lg:px-4">
        <span className="absolute start-0 top-0 h-full w-[3px] bg-gold" />
        <div className="mb-[9px] text-[12px] font-bold text-heading">
          {outputLabel}
        </div>
        <div
          dir="ltr"
          className="text-start text-[24px] font-extrabold leading-none text-heading"
        >
          {fmt(opinionRaw)}
        </div>
        <div className="mt-[7px] text-[11.5px] font-normal text-text-3" data-testid="matrix-output-formula">
          {outputFormula}
        </div>
        <div className="mt-[5px] text-[11.5px] font-normal text-text-3">
          بلا تقريب هنا — التقريب مرة واحدة بعد الترجيح النهائي
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
              <KeepCodesTogether text={a.title} />
            </div>
            <div className="mt-0.5 text-[11.5px] text-text-2">
              <KeepCodesTogether text={a.body} />
            </div>
          </div>
        </div>
      ))}
    </div>
  );
}
