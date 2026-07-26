"use client";

import {
  InfathReadOnlyBox,
  InfathSection,
  InfathTextField,
  InfathWordsValue,
} from "./InfathFormFields";
import {
  amountFigureOrDash,
  amountWordsOrZero,
  computeForcedSaleValue,
  computePropertyTotal,
} from "../../lib/evaluator/value-estimation";

type ValueEstimationSectionProps = {
  landValue: string;
  buildingValue: string;
  forcedSaleDiscountPct: string;
  disabled?: boolean;
  landError?: string;
  buildingError?: string;
  discountError?: string;
  onLandChange: (value: string) => void;
  onBuildingChange: (value: string) => void;
  onDiscountChange: (value: string) => void;
};

/**
 * قسم تقدير القيمة — مطابق تخطيط حقول إنفاذ (رقماً + كتابة).
 * الصف ١: أرض رقماً | أرض كتابة | مباني رقماً | مباني كتابة
 * الصف ٢: إجمالي رقماً | إجمالي كتابة | خصم % | بيع قسري رقماً | بيع قسري كتابة
 */
export function ValueEstimationSection({
  landValue,
  buildingValue,
  forcedSaleDiscountPct,
  disabled = false,
  landError,
  buildingError,
  discountError,
  onLandChange,
  onBuildingChange,
  onDiscountChange,
}: ValueEstimationSectionProps) {
  const total = computePropertyTotal(landValue, buildingValue);
  const forcedSale = computeForcedSaleValue(total, forcedSaleDiscountPct);

  return (
    <InfathSection title="تقدير القيمة">
      <div className="flex flex-col gap-5">
        <div className="grid grid-cols-1 gap-x-6 gap-y-4 sm:grid-cols-2 xl:grid-cols-4">
          <InfathTextField
            id="inf-land"
            label="قيمة الأرض رقماً"
            required
            inputMode="decimal"
            autoComplete="off"
            disabled={disabled}
            error={landError}
            value={landValue}
            onChange={(e) => onLandChange(e.target.value)}
          />
          <InfathWordsValue
            label="قيمة الأرض كتابة"
            value={amountWordsOrZero(landValue)}
          />
          <InfathTextField
            id="inf-building"
            label="قيمة المباني رقماً"
            required
            inputMode="decimal"
            autoComplete="off"
            disabled={disabled}
            error={buildingError}
            value={buildingValue}
            onChange={(e) => onBuildingChange(e.target.value)}
          />
          <InfathWordsValue
            label="قيمة المباني كتابة"
            value={amountWordsOrZero(buildingValue)}
          />
        </div>

        <div className="grid grid-cols-1 gap-x-6 gap-y-4 sm:grid-cols-2 xl:grid-cols-5">
          <InfathReadOnlyBox
            id="inf-total"
            label="إجمالي قيمة العقار رقماً"
            required
            value={amountFigureOrDash(total)}
          />
          <InfathWordsValue
            label="إجمالي قيمة العقار كتابة"
            value={amountWordsOrZero(total)}
          />
          <InfathTextField
            id="inf-discount"
            label="نسبة خصم البيع القسري"
            required
            inputMode="decimal"
            autoComplete="off"
            disabled={disabled}
            error={discountError}
            value={forcedSaleDiscountPct}
            onChange={(e) => onDiscountChange(e.target.value)}
          />
          <InfathWordsValue
            label="قيمة البيع القسري رقماً"
            value={amountFigureOrDash(forcedSale)}
          />
          <InfathWordsValue
            label="قيمة البيع القسري كتابة"
            value={amountWordsOrZero(forcedSale)}
          />
        </div>
      </div>
    </InfathSection>
  );
}
