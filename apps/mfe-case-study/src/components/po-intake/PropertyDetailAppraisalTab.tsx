"use client";

import { createElement } from "react";
import { useAppAccess } from "@platform/app-shared/contexts/AppAccessContext";
import { PartyRecallAdvisorySection } from "@platform/app-shared/components/PartyRecallAdvisorySection";
import {
  canDecideAppraisalRecall,
  canPrepareReportDraft,
  canRecordValuationDeposit,
  canReviewTransaction,
} from "../../lib/app-data/po-roles";
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
  showReportDraft = true,
}: {
  property: PoPropertyIntake;
  appraisalTask?: WorkflowTask | null;
  tasks: WorkflowTask[];
  appraisalCard: PropertyDetailPartyCard | null;
  submission: PropertyDetailPartySubmission | null;
  onReviewChanged?: () => void;
  /**
   * Whether this tab shows the specialist's report-draft workspace (send, approval state, attachments, final PDF).
   * The same tab component is used by the property page («تقييم العقار») and by the case-study screen
   * («مدخلات التقييم»). The draft is worked on in the second one only, so the property page passes `false`: it keeps
   * the package-return bar and the read-only report, and its hint text no longer says the draft is "below".
   */
  showReportDraft?: boolean;
}) {
  const { access } = useAppAccess();
  const isReview = canReviewTransaction(access);
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
          canDecide={canDecideAppraisalRecall(access)}
          onResolved={onReviewChanged}
        />
      ) : null}
      {/* Omar 2026-11-08: review accepts the appraiser's value or returns it to him with a reason;
          the others see the acceptance only. */}
      <PropertyDetailPartyPackageReview
        taskId={appraisalTask?.id}
        submissionStatus={submission?.packageStatus ?? "draft"}
        acceptedAtUtc={submission?.acceptedAtUtc}
        acceptedByName={submission?.acceptedByName}
        disabled={!isReview}
        acceptLabel="قبول القيمة"
        acceptedLabel="قُبلت القيمة"
        acceptSuccessToast="قُبلت القيمة — تُصدر المسودة للمقيّم بعد اعتماد الدراسة"
        returnLabel="إرجاع للمقيّم"
        returnAfterAcceptLabel="إلغاء القبول وإرجاع للمقيّم"
        returnPlaceholder="صف ما يجب تصحيحه في تقييم المقيّم…"
        returnSuccessToast="أُعيد التقييم للمقيّم للتصحيح"
        hint="يسلّم المقيّم القيمة فيراجعها المراجع: يقبلها، أو يُرجعها للمقيّم مع السبب. وبعد قبولها واعتماد الدراسة يُصدر المراجع مسودة التقرير للمقيّم."
        onChanged={onReviewChanged}
      />
      {!isReview && submission?.packageStatus === "submitted" ? (
        <p className="mb-3 mt-0 text-[12px] text-text-2" data-testid="appraisal-value-state">
          {submission.acceptedAtUtc
            ? `قبل المراجع القيمة${submission.acceptedByName?.trim() ? ` — ${submission.acceptedByName.trim()}` : ""}.`
            : "سلّم المقيّم القيمة — بانتظار مراجعة المراجع."}
        </p>
      ) : null}
      {submission?.packageStatus === "reopened" && returnRemark?.trim() ? (
        <ReturnedForCorrectionNote note={returnRemark} className="mb-3" />
      ) : null}
      {/* The evaluator bridge registers module-level components (stable identity), not ones created per render. */}
      {showReportDraft && appraisalTask && ReportDraftPanel
        ? createElement(ReportDraftPanel, {
            appraisalTask,
            allTasks: tasks,
            property,
            // The report's data is every specialist's (Omar 2026-11-08); its decisions are review's.
            canEdit: canPrepareReportDraft(access) || access.role === "case-specialist",
            canDeposit: canRecordValuationDeposit(access),
            canReview: isReview,
          })
        : null}
      {appraisalTask && ValuationReport ? (
        createElement(ValuationReport, {
          appraisalTask,
          allTasks: tasks,
          property,
        })
      ) : (
        <EmptyState
          title="تقرير التقييم غير متاح بعد"
          sub="يظهر تقرير التقييم هنا بعد فتح مهمة التقييم للعقار."
        />
      )}
    </>
  );
}
