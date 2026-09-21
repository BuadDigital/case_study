"use client";

import { Spinner, opsPpHeadCard } from "@platform/ui-kit";
import { EngInfo } from "./EvaluatorHtmlPrimitives";
import { PrimaryBtn } from "./valuation-work/atoms";

export function EvaluatorWindowBanners({
  needsSurvey,
  surveyed,
  locked,
  gateReady,
  formError,
}: {
  needsSurvey: boolean;
  surveyed: boolean;
  locked: boolean;
  gateReady: boolean;
  formError: string | null;
}) {
  return (
    <>
      {needsSurvey && !surveyed && !locked && gateReady ? (
        <EngInfo variant="amber">
          ℹ يمكنك التقييم الآن (بيانات معاينة العقار معتمدة) — الرفع المساحي
          وصف إضافي: قد يلزم تعديل التقييم بعد صدوره.
        </EngInfo>
      ) : null}

      {locked ? (
        <EngInfo variant="amber">
          تم الإرسال لأخصائي دراسة الحالة — لا يمكن التعديل إلا بإعادة فتح من
          الأخصائي.
        </EngInfo>
      ) : null}

      {formError ? (
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
  onSubmit,
}: {
  visible: boolean;
  submitBusy: boolean;
  onSubmit: () => void;
}) {
  if (!visible) return null;
  return (
    <div className="mt-5 flex flex-wrap items-center justify-end gap-3">
      <PrimaryBtn disabled={submitBusy} onClick={onSubmit}>
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
