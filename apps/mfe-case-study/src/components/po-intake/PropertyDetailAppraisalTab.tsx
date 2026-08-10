"use client";

import { EmptyState } from "./PropertyDetailFields";
import { PartyRoleDetailPanel } from "./PartyRoleDetailPanel";
import { PropertyDetailPartyPackageReview } from "./PropertyDetailPartyPackageReview";
import type { PropertyDetailPartyCard } from "../../lib/prototype/property-detail-parties";
import type { PropertyDetailPartySubmission } from "../../lib/prototype/property-detail-party-submissions";

/**
 * Property-detail «تقييم العقار» — package review + read-only payload.
 */
export function PropertyDetailAppraisalTab({
  appraisalTaskId,
  appraisalCard,
  submission,
  loading,
  onReviewChanged,
}: {
  appraisalTaskId?: string | null;
  appraisalCard: PropertyDetailPartyCard | null;
  submission: PropertyDetailPartySubmission | null;
  loading?: boolean;
  onReviewChanged?: () => void;
}) {
  if (!appraisalCard) {
    return (
      <EmptyState
        title="لم يُعيَّن مقيّم لهذا العقار"
        sub="سيظهر تقرير التقييم هنا بعد التعيين من التوزيع."
      />
    );
  }

  const returnRemark = submission?.remarks.find(
    (r) => r.label === "ملاحظة الإرجاع",
  )?.value;

  return (
    <>
      <PropertyDetailPartyPackageReview
        taskId={appraisalTaskId}
        submissionStatus={submission?.packageStatus ?? "draft"}
        acceptedAtUtc={submission?.acceptedAtUtc}
        acceptedByName={submission?.acceptedByName}
        acceptLabel="اعتماد التقييم"
        returnPlaceholder="صف ما يجب تصحيحه في تقرير التقييم…"
        acceptSuccessToast="تم اعتماد التقييم — يظهر في حزمة إنفاذ"
        returnSuccessToast="أُعيد التقييم للتصحيح"
        onChanged={onReviewChanged}
      />
      {submission?.packageStatus === "reopened" && returnRemark?.trim() ? (
        <div className="mb-3 rounded-lg border border-amber border-e-[3px] border-e-amber bg-amber-light px-3.5 py-2.5 text-xs leading-relaxed text-amber-text">
          <strong>مُعاد للتعديل</strong> — {returnRemark.trim()}
        </div>
      ) : null}
      <PartyRoleDetailPanel
        card={appraisalCard}
        submission={submission}
        loading={loading ?? false}
      />
    </>
  );
}
