"use client";

import { SpecialistValuationReportFinishingEditor } from "./SpecialistValuationReportFinishingEditor";

/** «مستوى تشطيبات البناء» for the valuation report — the specialist picks it, the appraiser reads it. */
export function SpecialistValuationReportInputs({
  propertyId,
  poNumber,
  readOnly = false,
}: {
  propertyId: string;
  poNumber?: string;
  readOnly?: boolean;
}) {
  // Filled here by the specialist (case study → property valuation); shown read-only to the appraiser.
  return (
    <div className="mb-4">
      <div className="mb-3 flex items-center gap-2.5">
        <span className="h-[17px] w-[3px] rounded-full bg-gold" aria-hidden />
        <h3 className="m-0 text-[14px] font-extrabold text-heading">
          مستوى تشطيبات البناء
          {readOnly ? null : (
            <span className="ms-1 text-danger" aria-hidden>
              *
            </span>
          )}
        </h3>
        <span className="flex-1 border-t border-border" aria-hidden />
      </div>
      <p className="mb-3 text-[11.5px] leading-relaxed text-text-3">
        {readOnly
          ? "اختاره أخصائي دراسة الحالة — يُطبع في تقرير التقييم."
          : "يُطبع في تقرير التقييم مع وصفه، ويراه المقيّم. اختره قبل تأكيد مدخلات المعاين."}
      </p>
      <SpecialistValuationReportFinishingEditor
        propertyId={propertyId}
        poNumber={poNumber}
        readOnly={readOnly}
      />
    </div>
  );
}
