"use client";

import { EmptyState } from "./PropertyDetailFields";
import { ReturnedForCorrectionNote } from "../ui/ReturnedForCorrectionNote";
import { PropertyDetailPartyPackageReview } from "./PropertyDetailPartyPackageReview";
import { PropertyDetailValuationFinalReport } from "./PropertyDetailValuationFinalReport";
import type { PropertyDetailPartyCard } from "../../lib/app-data/property-detail-parties";
import type { PropertyDetailPartySubmission } from "../../lib/app-data/property-detail-party-submissions";

/**
 * Property-detail appraisal tab — package review bar plus the valuation report itself
 * (final issued copy, deposit copy, or live draft preview).
 */
export function PropertyDetailAppraisalTab({
  propertyId,
  appraisalTaskId,
  appraisalCard,
  submission,
  onReviewChanged,
}: {
  propertyId: string;
  appraisalTaskId?: string | null;
  appraisalCard: PropertyDetailPartyCard | null;
  submission: PropertyDetailPartySubmission | null;
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
        acceptLabel="اعتماد تقرير التقييم"
        acceptedLabel="معتمد"
        returnLabel="إعادة للتصحيح"
        returnAfterAcceptLabel="إلغاء الاعتماد وإعادة للتصحيح"
        returnPlaceholder="صف ما يجب تصحيحه في تقرير التقييم…"
        acceptSuccessToast="تم اعتماد تقرير التقييم"
        returnSuccessToast="أُعيد التقييم للتصحيح"
        hint="اعتماد تقرير التقييم وإعادة للتصحيح من تبويب «تقييم العقار»."
        onChanged={onReviewChanged}
      />
      {submission?.packageStatus === "reopened" && returnRemark?.trim() ? (
        <ReturnedForCorrectionNote note={returnRemark} className="mb-3" />
      ) : null}
      <PropertyDetailValuationFinalReport propertyId={propertyId} />
    </>
  );
}
