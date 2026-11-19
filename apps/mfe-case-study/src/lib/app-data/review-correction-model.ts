/**
 * «طلب تصحيح» — review's one window for sending work back (Omar 2026-11-11): where the error is,
 * the action that follows, and who it touches. Until then review had a separate return button in
 * each section and nothing said who else a return reached.
 *
 * This file decides what the window offers; the returns themselves are the commands that already
 * existed (reopening the study, returning the valuation to the appraiser). The inspection, the
 * survey and the report's attachments are not offered yet. Pure: no React, no I/O.
 */
import type { ReportDraftState } from "@platform/app-shared/workflow/report-draft-state";
import type { ReviewLock } from "./work-page-model";

export type ReviewCorrectionSource = "study" | "valuation";

export type ReviewCorrectionOption = {
  source: ReviewCorrectionSource;
  /** Where the error is. */
  title: string;
  /** What choosing it does. */
  action: string;
  /** Who it touches and how — one line each, the party's name first. */
  affected: string[];
  /** Why it cannot be chosen now; null when it can. */
  unavailable: string | null;
};

const REPORT_APPROVED_AR =
  "اعتمد المقيّم تقرير التقييم اعتمادًا نهائيًا — لا يُعاد شيء إلا بإعادة فتح المعاملة مع سبب.";

/**
 * What review may send back on a transaction, each with its action and the parties it touches.
 *
 * How it works: the study can go back to the study once it was sent (issued); the valuation can go
 * back to the appraiser once he handed it over. Each option lists who is touched, so review sees
 * the reach of a return before it confirms. The server stays the judge of every return.
 * Edge cases: once the appraiser gave the report his final approval the study does not go back from
 * here (`reviewLock` «report-approved»). The valuation still does while no deposit code is recorded:
 * the return voids his approval (Omar 2026-11-18); once the code is recorded (final copy issued) or the
 * draft state is unknown, it says so too. A study not sent yet, or a valuation not
 * handed over, is listed with the reason it cannot be chosen, so the window never looks incomplete.
 */
export function reviewCorrectionOptions(input: {
  /** The study report is issued (sent to review). */
  studyIssued: boolean;
  /** An appraisal task exists on the transaction. */
  hasAppraisal: boolean;
  /** The appraiser handed his valuation over. */
  valuationHandedOver: boolean;
  reviewLock: ReviewLock;
  draft?: Pick<ReportDraftState, "status"> & Partial<Pick<ReportDraftState, "reportStage">>;
}): ReviewCorrectionOption[] {
  const locked = input.reviewLock === "report-approved";
  const draftWithAppraiser = input.draft?.status === "sent";
  // Omar 2026-11-18: review's return voids the appraiser's approval while no deposit code is recorded
  // (the final copy is issued with the code); after the deposit the path is «التعديل».
  const approvalVoidable =
    locked && input.draft !== undefined && input.draft.reportStage !== "final_issued";

  const study: ReviewCorrectionOption = {
    source: "study",
    title: "دراسة الحالة",
    action: "تُفتح دراسة الحالة من جديد لدارس العقار، ويسقط إقرار مراجعتك لها.",
    affected: [
      "دارس العقار — يصحّح الدراسة ويرسلها من جديد.",
      !input.hasAppraisal
        ? null
        : input.valuationHandedOver
          ? "المقيّم — يُبلَّغ بفتح الدراسة، وتقييمه المسلَّم يبقى كما هو ما لم تُرجعه له."
          : "المقيّم — لا يسلّم تقييمه حتى تصدر الدراسة من جديد.",
    ].filter((line): line is string => line !== null),
    unavailable: locked
      ? REPORT_APPROVED_AR
      : input.studyIssued
        ? null
        : "لم يرسل دارس العقار الدراسة بعد.",
  };

  const valuation: ReviewCorrectionOption = {
    source: "valuation",
    title: "التقييم",
    action: approvalVoidable
      ? "يسقط اعتماد المقيّم للتقرير، ويُعاد التقييم للتصحيح، ويسقط قبولك للقيمة."
      : "يُعاد التقييم للمقيّم للتصحيح، ويسقط قبولك للقيمة.",
    affected: [
      "المقيّم — يصحّح تقييمه ويسلّمه من جديد.",
      approvalVoidable
        ? "مسودة التقرير — يسقط اعتمادها، ويعتمدها المقيّم من جديد بعد تصحيحه."
        : draftWithAppraiser
        ? "مسودة التقرير — عند المقيّم الآن؛ تُصدر له من جديد بعد تسليمه التقييم المصحَّح."
        : "مسودة التقرير — تُصدر بعد تسليمه التقييم المصحَّح وقبول قيمته.",
    ],
    unavailable: locked && !approvalVoidable
      ? REPORT_APPROVED_AR
      : !input.hasAppraisal
        ? "لم يُعيَّن مقيّم لهذه المعاملة."
        : input.valuationHandedOver
          ? null
          : "لم يسلّم المقيّم تقييمه بعد.",
  };

  return [study, valuation];
}
