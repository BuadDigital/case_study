"use client";

import { SpecialistValuationReportFinishingEditor } from "./SpecialistValuationReportFinishingEditor";

/** Specialist fills finishing level on property valuation. */
export function SpecialistValuationReportInputs({
  propertyId,
  poNumber,
}: {
  propertyId: string;
  poNumber?: string;
}) {
  // Filled here by the specialist (case study → property valuation); shown read-only to the appraiser.
  return (
    <div className="mb-4">
      <div className="mb-3 flex items-center gap-2.5">
        <span className="h-[17px] w-[3px] rounded-full bg-gold" aria-hidden />
        <h3 className="m-0 text-[14px] font-extrabold text-heading">
          مدخلات تقرير التقييم
        </h3>
        <span className="flex-1 border-t border-border" aria-hidden />
      </div>
      <p className="mb-3 text-[11.5px] leading-relaxed text-text-3">
        يعبّئها الأخصائي من دراسة الحالة (تبويب تقييم العقار)، وتظهر للمقيّم للعرض
        فقط.
      </p>
      <SpecialistValuationReportFinishingEditor
        propertyId={propertyId}
        poNumber={poNumber}
      />
    </div>
  );
}
