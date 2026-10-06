"use client";

import { Spinner, opsPpHeadCard } from "@platform/ui-kit";
import {
  STUDY_REPORT_NOT_ISSUED_MESSAGE,
  isStudyReportBlockMessage,
} from "../../lib/evaluator/evaluator-inspection-gate";
import { EngInfo } from "./EvaluatorHtmlPrimitives";
import { PrimaryBtn } from "./valuation-work/atoms";

export function EvaluatorWindowBanners({
  needsSurvey,
  surveyed,
  locked,
  studyReportPending = false,
  finalIssued = false,
  formError,
}: {
  needsSurvey: boolean;
  surveyed: boolean;
  locked: boolean;
  /** The specialist's study report is not issued yet — the appraiser works in draft but cannot submit. */
  studyReportPending?: boolean;
  /** The final report is issued (deposit code + certificate) and the task is completed. */
  finalIssued?: boolean;
  formError: string | null;
}) {
  const showStudyReportNotice = studyReportPending && !locked;
  // The same rule refused a submit — the amber notice already says it, so no second red box.
  const showFormError =
    Boolean(formError) &&
    !(showStudyReportNotice && isStudyReportBlockMessage(formError));
  return (
    <>
      {needsSurvey && !surveyed && !locked ? (
        <EngInfo variant="amber">
          ℹ الرفع المساحي وصف إضافي: قد يلزم تعديل التقييم بعد صدوره.
        </EngInfo>
      ) : null}

      {showStudyReportNotice ? (
        <EngInfo variant="amber">
          {STUDY_REPORT_NOT_ISSUED_MESSAGE} — يمكنك العمل على التقييم كمسودة، ويُفتح
          الاعتماد والإرسال فور صدور التقرير.
        </EngInfo>
      ) : null}

      {locked && finalIssued ? (
        <EngInfo variant="gold">صدر التقرير النهائي — اكتمل التقييم.</EngInfo>
      ) : null}

      {locked && !finalIssued ? (
        <EngInfo variant="amber">
          سُلِّم التقييم للأخصائي وبياناته مقفلة. يُعدّ الأخصائي مسودة التقرير وسيصلك
          إشعار لاعتمادها وإيداعها في «قيمة». لتعديل الأرقام اطلب استرجاع التقييم.
        </EngInfo>
      ) : null}

      {showFormError ? (
        <EngInfo variant="red">
          <strong>!</strong> {formError}
        </EngInfo>
      ) : null}
    </>
  );
}

export function EvaluatorWindowSubmitBar({
  visible,
  submitBusy,
  submitBlockedReason,
  onSubmit,
}: {
  visible: boolean;
  submitBusy: boolean;
  /** When set, the submit control is disabled and this is shown beside it. */
  submitBlockedReason?: string | null;
  onSubmit: () => void;
}) {
  if (!visible) return null;
  return (
    <div className="mt-5 flex flex-wrap items-center justify-end gap-3">
      {submitBlockedReason ? (
        <span className="text-[12.5px] font-semibold text-text-3">
          {submitBlockedReason}
        </span>
      ) : null}
      <PrimaryBtn
        disabled={submitBusy || Boolean(submitBlockedReason)}
        onClick={onSubmit}
      >
        {submitBusy ? <Spinner /> : null}
        <span>
          {submitBusy ? "جاري الاعتماد…" : "اعتماد التقييم وإرسال للأخصائي"}
        </span>
      </PrimaryBtn>
    </div>
  );
}

export function EvaluatorWindowTitle({
  embedded,
  deedLabel,
  deedNumber,
}: {
  embedded: boolean;
  deedLabel?: string;
  deedNumber: string;
}) {
  if (embedded) return null;
  return (
    <div className={opsPpHeadCard}>
      <h1 className="m-0 flex flex-wrap items-center gap-2.5 text-[18px] font-extrabold text-heading">
        <span>نافذة المقيم العقاري</span>
        <span className="text-[14px] font-bold text-gold-d" dir="ltr">
          صك {deedLabel ?? deedNumber}
        </span>
      </h1>
    </div>
  );
}
