"use client";

import { EngSection } from "./EvaluatorHtmlPrimitives";
import {
  amountWordsOrZero,
  computeForcedSaleValue,
  parseEvaluatorAmount,
} from "../../lib/evaluator/value-estimation";
import { cn } from "@platform/ui-kit";
import { evaluatorInvalidControlClass } from "../../lib/evaluator/evaluator-validation";

type ValueEstimationSectionProps = {
  landValue: string;
  buildingValue: string;
  /**
   * Case Study.html `price` — total property value.
   * Auto-filled as land + buildings; still editable for overrides.
   */
  propertyTotal: string;
  forcedSaleDiscountPct: string;
  disabled?: boolean;
  landError?: string;
  buildingError?: string;
  totalError?: string;
  discountError?: string;
  onLandChange: (value: string) => void;
  onBuildingChange: (value: string) => void;
  onTotalChange: (value: string) => void;
  onDiscountChange: (value: string) => void;
};

/** Case Study.html value estimation — 3 columns + discount and forced sale. */
export function ValueEstimationSection({
  landValue,
  buildingValue,
  propertyTotal,
  forcedSaleDiscountPct,
  disabled = false,
  landError,
  buildingError,
  totalError,
  discountError,
  onLandChange,
  onBuildingChange,
  onTotalChange,
  onDiscountChange,
}: ValueEstimationSectionProps) {
  const totalNum = parseEvaluatorAmount(propertyTotal) ?? 0;
  const forcedSale = computeForcedSaleValue(totalNum, forcedSaleDiscountPct);

  function amountField(
    id: string,
    label: string,
    value: string,
    onChange: (v: string) => void,
    error?: string,
    unit = "ر.س",
    required = true,
  ) {
    return (
      <div className="flex flex-col gap-1.5">
        <label htmlFor={id} className="text-[11px] font-medium text-text-2">
          {label}
          {required ? <span className="text-[#a5432e]"> *</span> : null}
        </label>
        <div
          className={cn(
            "flex overflow-hidden rounded-[10px] border border-border bg-surface",
            error && evaluatorInvalidControlClass,
            disabled && "opacity-65",
          )}
        >
          <input
            id={id}
            dir="ltr"
            inputMode="decimal"
            disabled={disabled}
            value={value}
            placeholder="0"
            onChange={(e) => onChange(e.target.value)}
            className="min-w-0 flex-1 border-none bg-transparent px-3 py-2 text-[13.5px] font-bold text-text outline-none"
          />
          <span className="flex items-center border-s border-border bg-surface-2 px-2.5 text-[11.5px] font-bold text-text-2">
            {unit}
          </span>
        </div>
        <span className="min-h-[15px] text-[10px] leading-snug text-text-3">
          {value.trim() ? amountWordsOrZero(value) : ""}
        </span>
        {error ? (
          <span className="text-[11px] text-danger-text">{error}</span>
        ) : null}
      </div>
    );
  }

  return (
    <div>
      <EngSection>تقدير القيمة</EngSection>
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
        {amountField(
          "inf-land",
          "قيمة الأرض",
          landValue,
          onLandChange,
          landError,
        )}
        {amountField(
          "inf-building",
          "قيمة المباني",
          buildingValue,
          onBuildingChange,
          buildingError,
        )}
        {amountField(
          "inf-total",
          "إجمالي قيمة العقار",
          propertyTotal,
          onTotalChange,
          totalError,
        )}
      </div>
      <div className="mt-3 grid grid-cols-1 items-start gap-3 sm:grid-cols-3">
        {amountField(
          "inf-discount",
          "نسبة خصم البيع القسري",
          forcedSaleDiscountPct,
          onDiscountChange,
          discountError,
          "%",
        )}
        <div className="flex flex-col gap-1.5 sm:col-span-2">
          <span className="text-[11px] font-medium text-text-2">
            قيمة البيع القسري
          </span>
          <div className="flex min-h-[37px] items-center justify-between gap-2.5 rounded-[10px] border border-border bg-surface-2 px-3 py-2">
            <span dir="ltr" className="text-[13.5px] font-bold text-heading">
              {forcedSale > 0 ? forcedSale.toLocaleString("en-US") : "—"}
            </span>
            <span className="text-start text-[10px] leading-snug text-text-3">
              {forcedSale > 0 ? amountWordsOrZero(String(forcedSale)) : ""}
            </span>
          </div>
        </div>
      </div>
    </div>
  );
}
