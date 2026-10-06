"use client";

import { useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import {
  AppModal,
  Button,
  Label,
  Note,
  Textarea,
  cn,
  useToast,
} from "@platform/ui-kit";
import { invalidControlClass } from "@platform/app-shared/form-ux";
import { useAppAccess } from "@platform/app-shared/contexts/AppAccessContext";
import { formatDateAr } from "@platform/app-shared/format/date";
import type { FailureRecord } from "@platform/app-shared/failures/failures-types";
import { liftSurveyFreeze } from "@failures/mfe/lib/failures-repository";
import { invalidateFailuresRelated } from "@failures/mfe/query/failures-queries";
import {
  SURVEY_FREEZE_LIFT_REASON_MIN_LENGTH,
  surveyFreezeLiftReasonError,
  surveyFreezeLiftView,
  surveyFreezeLiftedText,
} from "../../lib/app-data/survey-freeze-lift-state";

/**
 * «رفع تجميد الرفع المساحي» on one failure of a property — the case specialist lifts the freeze an
 * active failure puts on the engineering office's survey (the failure itself stays open). After the
 * lift the row reads «رُفع التجميد بتاريخ … — السبب …». Nothing renders for other roles.
 */
export function PropertyFailureSurveyFreezeLift({
  failure,
}: {
  failure: FailureRecord;
}) {
  const { role } = useAppAccess();
  const view = surveyFreezeLiftView(role, failure);
  const [open, setOpen] = useState(false);

  if (view === "none") return null;
  if (view === "lifted") {
    return (
      <p className="mb-0 mt-1.5 text-[11px] leading-relaxed text-text-2">
        {surveyFreezeLiftedText(failure, formatDateAr)}
      </p>
    );
  }
  return (
    <>
      <Button
        type="button"
        size="sm"
        variant="outline"
        className="mt-2"
        showActionToast={false}
        onClick={() => setOpen(true)}
      >
        رفع تجميد الرفع المساحي
      </Button>
      {open ? (
        <LiftDialog failure={failure} onClose={() => setOpen(false)} />
      ) : null}
    </>
  );
}

function LiftDialog({
  failure,
  onClose,
}: {
  failure: FailureRecord;
  onClose: () => void;
}) {
  const { showToast } = useToast();
  const queryClient = useQueryClient();
  const [reason, setReason] = useState("");
  const [reasonError, setReasonError] = useState<string | null>(null);
  const [serverError, setServerError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function submit() {
    if (busy) return;
    const error = surveyFreezeLiftReasonError(reason);
    if (error) {
      setReasonError(error);
      return;
    }
    setReasonError(null);
    setServerError(null);
    setBusy(true);
    try {
      const result = await liftSurveyFreeze({
        poNumber: failure.poNumber,
        propertyId: failure.propertyId,
        reason: reason.trim(),
      });
      if (!result.ok) {
        setServerError(result.error);
        return;
      }
      invalidateFailuresRelated(queryClient);
      showToast("رُفع تجميد الرفع المساحي — يمكن لمكتب الهندسة البدء", "success");
      onClose();
    } finally {
      setBusy(false);
    }
  }

  return (
    <AppModal
      open
      title="رفع تجميد الرفع المساحي"
      subtitle="يبقى التعذر مفتوحاً، ويُسمح لمكتب الهندسة ببدء الرفع المساحي. يُسجَّل القرار في سجل التدقيق ويُشعَر المكلّف بالمسح."
      onClose={() => {
        if (!busy) onClose();
      }}
      maxWidthPx={470}
      look="ops-html"
      footer={
        <div className="flex w-full justify-end gap-2.5">
          <Button variant="default" showActionToast={false} disabled={busy} onClick={onClose}>
            إلغاء
          </Button>
          <Button
            variant="primary"
            showActionToast={false}
            loading={busy}
            onClick={() => void submit()}
          >
            رفع التجميد
          </Button>
        </div>
      }
    >
      <div className="flex flex-col gap-3">
        <div>
          <Label
            htmlFor={`survey-freeze-lift-reason-${failure.id}`}
            className="mb-1.5 text-[11px] font-semibold text-text-2"
          >
            السبب ({SURVEY_FREEZE_LIFT_REASON_MIN_LENGTH} أحرف على الأقل){" "}
            <span className="text-danger-text">*</span>
          </Label>
          <Textarea
            id={`survey-freeze-lift-reason-${failure.id}`}
            rows={3}
            value={reason}
            aria-invalid={reasonError ? true : undefined}
            className={cn(
              "rounded-[10px] border-border-md bg-surface",
              reasonError && invalidControlClass,
            )}
            onChange={(e) => {
              setReason(e.target.value);
              if (reasonError) setReasonError(null);
            }}
          />
          {reasonError ? (
            <Note tone="danger" className="mt-2">
              {reasonError}
            </Note>
          ) : null}
        </div>
        {serverError ? <Note tone="warn">{serverError}</Note> : null}
      </div>
    </AppModal>
  );
}
