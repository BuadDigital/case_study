"use client";

import {
  PageGutter,
  opsChip,
  opsPpHeadCard,
  opsWorkspaceCard,
} from "@platform/ui-kit";
import { FailureRaisePanel } from "./FailureRaisePanel";

/**
 * Full-page failure raise — same chrome as engineering-office
 * Failures workspace (pp-head + card + FailureRaisePanel).
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
          className={opsPpHeadCard}
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
            <span className={opsChip}>
              {specialist || "أخصائي"}
            </span>
          </div>
        </div>

        <div className={opsWorkspaceCard}>
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
