"use client";

import { PageGutter, cn } from "@platform/design-system";
import { FailureRaisePanel } from "./FailureRaisePanel";

/**
 * Full-page failure raise — same chrome as engineering-office
 * مساحة عمل التعذرات (pp-head + card + FailureRaisePanel).
 */
export function FailureReportForm({
  poNumber,
  propertyId,
  deedNumber,
  specialist,
  raisedByRole = "الأخصائي",
  onDone,
  onCancel,
}: {
  poNumber: string;
  propertyId: string;
  deedNumber: string;
  specialist: string;
  raisedByRole?: string;
  onDone: () => void;
  onCancel: () => void;
}) {
  return (
    <PageGutter className="py-6 sm:py-[26px]">
      <div className="mx-auto w-full max-w-[1100px]">
        <div
          className={cn(
            "mb-3.5 rounded-[14px] border border-border bg-surface px-[22px] py-[18px]",
            "shadow-[0_1px_2px_rgba(18,40,76,0.03),0_6px_16px_-18px_rgba(18,40,76,0.10)]",
          )}
        >
          <h1 className="m-0 flex flex-wrap items-center gap-2.5 text-[18px] font-extrabold leading-tight text-heading">
            <span>تسجيل تعذر</span>
            {deedNumber ? (
              <span className="text-[14px] font-bold text-gold-d [direction:ltr]">
                صك {deedNumber}
              </span>
            ) : null}
          </h1>
          <div className="mt-1.5 flex flex-wrap items-center gap-2">
            <span className="inline-flex items-center gap-1 rounded-md bg-gold-soft px-2.5 py-[3px] text-[12px] font-bold text-gold-d">
              {specialist || "أخصائي"}
            </span>
          </div>
        </div>

        <div
          className={cn(
            "rounded-xl border border-border bg-surface p-[18px_20px]",
            "shadow-[0_1px_2px_rgba(18,40,76,0.03),0_6px_16px_-18px_rgba(18,40,76,0.10)]",
          )}
        >
          <FailureRaisePanel
            poNumber={poNumber}
            propertyId={propertyId}
            deedNumber={deedNumber}
            specialist={specialist}
            raisedByRole={raisedByRole}
            autoOpenRaise
            onSubmitted={onDone}
          />
          <div className="mt-4 border-t border-border pt-3">
            <button
              type="button"
              onClick={onCancel}
              className="inline-flex cursor-pointer items-center rounded-lg border border-border-2 bg-surface px-3.5 py-[7px] text-[12px] font-semibold text-text-2 transition-colors hover:bg-surface-2 hover:text-heading"
            >
              إلغاء
            </button>
          </div>
        </div>
      </div>
    </PageGutter>
  );
}
