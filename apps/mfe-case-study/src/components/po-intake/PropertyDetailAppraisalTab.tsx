"use client";

import { EmptyState } from "./PropertyDetailFields";
import { PartyRoleDetailPanel } from "./PartyRoleDetailPanel";
import { ReturnedForCorrectionNote } from "../ui/ReturnedForCorrectionNote";
import { PropertyDetailPartyPackageReview } from "./PropertyDetailPartyPackageReview";
import type { PropertyDetailPartyCard } from "../../lib/prototype/property-detail-parties";
import type { PropertyDetailPartySubmission } from "../../lib/prototype/property-detail-party-submissions";

/**
 * Property-detail appraisal tab — package review + read-only payload.
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
        acceptLabel="إقرار الاستلام"
        returnPlaceholder="صف ما يجب تصحيحه في تقرير التقييم…"
        acceptSuccessToast="تم استلام تقرير التقييم — هذا إقرار بالاستلام وليس اعتماداً للقيمة"
        returnSuccessToast="أُعيد التقييم للتصحيح"
        onChanged={onReviewChanged}
      />
      {submission?.packageStatus === "reopened" && returnRemark?.trim() ? (
        <ReturnedForCorrectionNote note={returnRemark} className="mb-3" />
      ) : null}
      <PartyRoleDetailPanel
        card={appraisalCard}
        submission={submission}
        loading={loading ?? false}
      />
    </>
  );
}
