"use client";

import { EmptyState } from "./PropertyDetailFields";
import { ReturnedForCorrectionNote } from "../ui/ReturnedForCorrectionNote";
import { PropertyDetailPartyPackageReview } from "./PropertyDetailPartyPackageReview";
import { evaluatorValuationReportPreview } from "../../lib/evaluator-bridge";
import type { PoPropertyIntake } from "../../lib/app-data/po-intake-data";
import type { WorkflowTask } from "../../lib/app-data/tasks-storage";
import type { PropertyDetailPartyCard } from "../../lib/app-data/property-detail-parties";
import type { PropertyDetailPartySubmission } from "../../lib/app-data/property-detail-party-submissions";

/**
 * Property-detail appraisal tab — package review bar plus the valuation report exactly as
 * the appraiser sees it in «تقرير التقييم» (read-only).
 */
export function PropertyDetailAppraisalTab({
  property,
  appraisalTask,
  tasks,
  appraisalCard,
  submission,
  onReviewChanged,
}: {
  property: PoPropertyIntake;
  appraisalTask?: WorkflowTask | null;
  tasks: WorkflowTask[];
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
  const ValuationReport = evaluatorValuationReportPreview();

  return (
    <>
      <PropertyDetailPartyPackageReview
        taskId={appraisalTask?.id}
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
      {appraisalTask && ValuationReport ? (
        <ValuationReport
          appraisalTask={appraisalTask}
          allTasks={tasks}
          property={property}
        />
      ) : (
        <EmptyState
          title="تقرير التقييم غير متاح بعد"
          sub="يظهر تقرير التقييم هنا بعد فتح مهمة التقييم للعقار."
        />
      )}
    </>
  );
}
