"use client";

import { useAppAccess } from "@platform/app-shared/contexts/AppAccessContext";
import { PartyRecallAdvisorySection } from "@platform/app-shared/components/PartyRecallAdvisorySection";
import { canDecideAppraisalRecall, canPrepareReportDraft } from "../../lib/app-data/po-roles";
import { EmptyState } from "./PropertyDetailFields";
import { ReturnedForCorrectionNote } from "../ui/ReturnedForCorrectionNote";
import { PropertyDetailPartyPackageReview } from "./PropertyDetailPartyPackageReview";
import { evaluatorReportDraftPanel, evaluatorValuationReportPreview } from "../../lib/evaluator-bridge";
import type { PoPropertyIntake } from "../../lib/app-data/po-intake-data";
import type { WorkflowTask } from "../../lib/app-data/tasks";
import type { PropertyDetailPartyCard } from "../../lib/app-data/property-detail-parties";
import type { PropertyDetailPartySubmission } from "../../lib/app-data/property-detail-party-submissions";

/**
 * Property-detail appraisal tab — package return bar, the specialist's report-draft workspace, and the
 * valuation report exactly as the appraiser sees it in «تقرير التقييم» (read-only).
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
  const { role } = useAppAccess();
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
  const ReportDraftPanel = evaluatorReportDraftPanel();

  return (
    <>
      {/* The appraiser's recall request — the specialist decides it here (approve reopens the package). */}
      {appraisalTask ? (
        <PartyRecallAdvisorySection
          taskId={appraisalTask.id}
          partyLabel="المقيّم العقاري"
          refreshKey={0}
          canDecide={canDecideAppraisalRecall(role)}
          onResolved={onReviewChanged}
        />
      ) : null}
      <PropertyDetailPartyPackageReview
        taskId={appraisalTask?.id}
        submissionStatus={submission?.packageStatus ?? "draft"}
        acceptedAtUtc={submission?.acceptedAtUtc}
        acceptedByName={submission?.acceptedByName}
        hideAccept
        acceptedLabel="معتمد"
        returnLabel="إعادة للتصحيح"
        returnAfterAcceptLabel="إلغاء الاعتماد وإعادة للتصحيح"
        returnPlaceholder="صف ما يجب تصحيحه في تقييم المقيّم…"
        returnSuccessToast="أُعيد التقييم للمقيّم للتصحيح"
        hint="يسلّم المقيّم تقييمه فتُعدّ مسودة التقرير أدناه وتُرسلها له لاعتمادها؛ وتُعيد التقييم للمقيّم إن لزم تصحيح أرقامه."
        onChanged={onReviewChanged}
      />
      {submission?.packageStatus === "reopened" && returnRemark?.trim() ? (
        <ReturnedForCorrectionNote note={returnRemark} className="mb-3" />
      ) : null}
      {appraisalTask && ReportDraftPanel ? (
        <ReportDraftPanel
          appraisalTask={appraisalTask}
          allTasks={tasks}
          property={property}
          canEdit={canPrepareReportDraft(role)}
        />
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
