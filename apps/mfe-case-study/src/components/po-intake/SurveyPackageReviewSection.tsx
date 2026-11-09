"use client";

import { ENG_DISCOUNT_REASONS } from "@platform/app-shared/fees/party-fee-meta";
import type { PropertyDetailPartyCard } from "../../lib/app-data/property-detail-parties";
import type { PropertyDetailPartySubmission } from "../../lib/app-data/property-detail-party-submissions";
import type { WorkflowTask } from "../../lib/app-data/tasks";
import { PartyRoleDetailPanel } from "./PartyRoleDetailPanel";
import { EmptyState } from "./PropertyDetailFields";
import { PropertyDetailPartyPackageReview } from "./PropertyDetailPartyPackageReview";

/**
 * The engineering survey's acceptance block: accept / accept with a proposed discount / return, then
 * the survey's data read-only.
 *
 * How it works: the specialist accepts inside the transaction — as is (the office's fee goes to
 * finance) or with a proposed discount for the section supervisor. A change calls `onChanged` so the
 * host refetches the submissions.
 * Edge cases: no survey card (no office assigned) shows an empty state. Extracted 2026-11-05 from the
 * property page's survey tab so the work page shows the same block.
 */
export function SurveyPackageReviewSection({
  surveyTask,
  surveyCard,
  submission,
  loading,
  onChanged,
}: {
  surveyTask: WorkflowTask | null | undefined;
  surveyCard: PropertyDetailPartyCard | null | undefined;
  submission: PropertyDetailPartySubmission | null | undefined;
  loading: boolean;
  onChanged: () => void;
}) {
  if (!surveyCard) {
    return (
      <EmptyState
        title="لم يُعيَّن طرف لهذا الدور"
        sub="سيظهر هنا الطرف وبيانات عمله بعد التعيين."
      />
    );
  }
  return (
    <>
      <PropertyDetailPartyPackageReview
        taskId={surveyTask?.id}
        submissionStatus={submission?.packageStatus ?? "draft"}
        acceptedAtUtc={submission?.acceptedAtUtc}
        acceptedByName={submission?.acceptedByName}
        acceptLabel="قبول المخرجات"
        returnPlaceholder="صف ما يجب تصحيحه في الرفع المساحي…"
        acceptSuccessToast="تم قبول مخرجات الرفع المساحي"
        returnSuccessToast="أُعيد الرفع المساحي للتصحيح"
        hint="قبول المخرجات يستحق أتعاب المكتب من جدول التسعير ويرسلها للمالية مباشرة، ويُظهر البيانات المعتمدة في حزمة إنفاذ. «قبول مع اقتراح حسم» يرفع الأتعاب لمشرف القسم ليقرر الحسم أولاً."
        // Acceptance is done here, inside the transaction. The specialist may accept as
        // is (fee straight to finance) or with a proposed discount for the supervisor.
        discountProposal={{
          subjectLabel: `أتعاب ${surveyTask?.assigneeName?.trim() || "المكتب الهندسي"}`,
          reasons: ENG_DISCOUNT_REASONS,
        }}
        onChanged={onChanged}
      />
      <PartyRoleDetailPanel
        card={surveyCard}
        submission={submission ?? null}
        loading={loading}
      />
    </>
  );
}
