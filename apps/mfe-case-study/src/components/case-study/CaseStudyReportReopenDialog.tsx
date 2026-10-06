"use client";

import { useState } from "react";
import { AppModal, Button, Label, Note, Textarea, cn } from "@platform/ui-kit";
import { invalidControlClass } from "@platform/app-shared/form-ux";
import {
  planCaseStudyReopenSubmit,
  type CaseStudyReopenOutcome,
} from "../../lib/app-data/case-study-report-issue-errors";

type Props = {
  open: boolean;
  onClose: () => void;
  /** Reopens the report; the dialog closes only on `{ ok: true }`. */
  onReopen: (
    reason: string,
    clearEnfazHandover: boolean,
  ) => Promise<CaseStudyReopenOutcome>;
  /** Deed number shown in the description, when known. */
  deedLabel?: string;
  /**
   * The property is already handed over to Enfaz (the transaction state says so): the «إلغاء تسليم
   * إنفاذ» confirmation shows up-front instead of after the server's `enfazHandover` refusal.
   */
  enfazHandedOver?: boolean;
};

/**
 * Reopen an issued case study report — the specialist's decision. A reason of at least 10
 * characters is required. When the property was already handed over to Enfaz the server answers
 * with a refusal, the «إلغاء تسليم إنفاذ» confirmation appears, and the retry carries it.
 */
export function CaseStudyReportReopenDialog({
  open,
  onClose,
  onReopen,
  deedLabel,
  enfazHandedOver,
}: Props) {
  if (!open) return null;
  return (
    <ReopenForm
      onClose={onClose}
      onReopen={onReopen}
      deedLabel={deedLabel}
      enfazHandedOver={enfazHandedOver}
    />
  );
}

function ReopenForm({
  onClose,
  onReopen,
  deedLabel,
  enfazHandedOver,
}: Omit<Props, "open">) {
  const [reason, setReason] = useState("");
  const [reasonError, setReasonError] = useState<string | null>(null);
  const [enfazPrompted, setEnfazPrompted] = useState(Boolean(enfazHandedOver));
  const [enfazConfirmed, setEnfazConfirmed] = useState(false);
  const [enfazError, setEnfazError] = useState<string | null>(null);
  const [serverError, setServerError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const deed = (deedLabel ?? "").trim();

  const submit = async () => {
    if (busy) return;
    setServerError(null);
    const plan = planCaseStudyReopenSubmit({ reason, enfazPrompted, enfazConfirmed });
    if (!plan.ok) {
      if (plan.field === "reason") setReasonError(plan.error);
      else setEnfazError(plan.error);
      return;
    }
    setReasonError(null);
    setEnfazError(null);
    setBusy(true);
    try {
      const outcome = await onReopen(plan.reason, plan.clearEnfazHandover);
      if (outcome.ok) {
        onClose();
        return;
      }
      if (outcome.needsEnfazConfirmation) {
        setEnfazPrompted(true);
        setEnfazConfirmed(false);
      }
      setServerError(outcome.error);
    } finally {
      setBusy(false);
    }
  };

  return (
    <AppModal
      open
      title="إعادة فتح تقرير دراسة الحالة"
      subtitle={
        <>
          سيعود التقرير
          {deed ? (
            <>
              {" "}الخاص بالصك{" "}
              <span dir="ltr" className="font-bold text-gold-d">
                {deed}
              </span>
            </>
          ) : null}{" "}
          إلى «مسودة» ويُفتح للتعديل حتى تُصدره من جديد.
        </>
      }
      onClose={onClose}
      maxWidthPx={470}
      look="ops-html"
      footer={
        <div className="flex w-full justify-end gap-2.5">
          <Button
            variant="default"
            showActionToast={false}
            disabled={busy}
            onClick={onClose}
          >
            إلغاء
          </Button>
          <Button
            variant="primary"
            showActionToast={false}
            loading={busy}
            onClick={() => void submit()}
          >
            إعادة فتح التقرير
          </Button>
        </div>
      }
    >
      <div className="flex flex-col gap-3">
        <div>
          <Label
            htmlFor="cs-reopen-reason"
            className="mb-1.5 text-[11px] font-semibold text-text-2"
          >
            سبب إعادة الفتح (10 أحرف على الأقل)
          </Label>
          <Textarea
            id="cs-reopen-reason"
            rows={3}
            value={reason}
            placeholder="مثال: ظهرت ملاحظة جديدة من المعاين تستدعي تعديل الإجابات"
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

        {enfazPrompted ? (
          <div className="flex flex-col gap-2 rounded-[10px] border border-border bg-surface-2/50 px-3 py-2.5">
            <label className="flex cursor-pointer items-start gap-2 text-[12.5px] font-semibold text-heading">
              <input
                type="checkbox"
                className="mt-0.5"
                checked={enfazConfirmed}
                onChange={(e) => {
                  setEnfazConfirmed(e.target.checked);
                  if (enfazError) setEnfazError(null);
                }}
              />
              <span>إلغاء تسليم إنفاذ</span>
            </label>
            <p className="m-0 text-[11.5px] leading-relaxed text-text-2">
              سُلّمت هذه المعاملة إلى إنفاذ. لا يُعاد فتح التقرير إلا بإلغاء ختم التسليم،
              وسيُسجَّل ذلك في سجل التدقيق.
            </p>
            {enfazError ? <Note tone="danger">{enfazError}</Note> : null}
          </div>
        ) : null}

        {serverError ? <Note tone="warn">{serverError}</Note> : null}
      </div>
    </AppModal>
  );
}
