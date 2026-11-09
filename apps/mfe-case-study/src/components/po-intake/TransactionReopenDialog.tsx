"use client";

import { useState } from "react";
import type { TransactionStateDto } from "@platform/api-client";
import { AppModal, Button, Input, Label, Note } from "@platform/ui-kit";
import { returnPropertyFromEnfaz } from "../../lib/app-data/enfaz-handover-commands";
import {
  ENFAZ_RETURN_REASON_MIN_LENGTH,
  planTransactionReopen,
} from "../../lib/app-data/enfaz-handover-state";
import { ReasonConfirmModal, RequiredReasonField } from "./ReasonConfirmModal";

type ReopenError = { field: "reason" | "choice" | "reference" | "server"; text: string };

/**
 * «إعادة فتح المعاملة» (Omar 2026-11-05) — the one reopen after review approved a transaction, for any
 * specialist: where it came from (a note from Enfaz with its reference, or an internal error), the reason,
 * and what it affects (the study report, the valuation report, field work). It ends when the transaction is
 * uploaded to Enfaz again; one from Enfaz then waits for coordination's «تم الرد».
 *
 * How it works: the form is checked by `planTransactionReopen`, sent through the Enfaz return route (which
 * clears the handover stamp when there is one), and the server's notices are shown before closing.
 * Edge cases: a refusal stays in the dialog as the server's Arabic text; the old «إعادة من إنفاذ» card button
 * opens this same dialog (it replaced that dialog, moved here from `PropertyDetailEnfazHandoverCard`).
 */
export function TransactionReopenDialog({
  workOrderId,
  propertyId,
  onClose,
  onReopened,
}: {
  workOrderId: string;
  propertyId: string;
  onClose: () => void;
  onReopened: (state: TransactionStateDto) => void;
}) {
  const [source, setSource] = useState<"enfaz" | "internal">("enfaz");
  const [enfazReference, setEnfazReference] = useState("");
  const [reason, setReason] = useState("");
  const [reopenStudy, setReopenStudy] = useState(false);
  const [reopenValuation, setReopenValuation] = useState(false);
  const [needsFieldWork, setNeedsFieldWork] = useState(false);
  const [error, setError] = useState<ReopenError | null>(null);
  const [notices, setNotices] = useState<string[] | null>(null);
  const [busy, setBusy] = useState(false);

  async function submit() {
    if (busy) return;
    const plan = planTransactionReopen({
      source,
      enfazReference,
      reason,
      reopenStudy,
      reopenValuation,
      needsFieldWork,
    });
    if (!plan.ok) {
      setError({ field: plan.field, text: plan.error });
      return;
    }
    setError(null);
    setBusy(true);
    try {
      const result = await returnPropertyFromEnfaz(workOrderId, propertyId, plan.request);
      if (!result.ok) {
        setError({ field: "server", text: result.error });
        return;
      }
      onReopened(result.data);
      if (result.data.enfazReturnNoticesAr.length > 0) {
        setNotices(result.data.enfazReturnNoticesAr);
        return;
      }
      onClose();
    } finally {
      setBusy(false);
    }
  }

  if (notices) {
    return (
      <AppModal
        open
        title="أُعيد فتح المعاملة"
        onClose={onClose}
        maxWidthPx={470}
        look="ops-html"
        footer={
          <div className="flex w-full justify-end">
            <Button variant="primary" showActionToast={false} onClick={onClose}>
              تم
            </Button>
          </div>
        }
      >
        <ul className="m-0 flex list-none flex-col gap-1.5 p-0 text-[12.5px] leading-relaxed text-heading">
          {notices.map((notice) => (
            <li key={notice}>{notice}</li>
          ))}
        </ul>
      </AppModal>
    );
  }

  const clearChoiceError = () => {
    if (error?.field === "choice") setError(null);
  };
  const choices: { key: string; label: string; checked: boolean; set: (v: boolean) => void }[] = [
    { key: "study", label: "تقرير دراسة الحالة", checked: reopenStudy, set: setReopenStudy },
    { key: "valuation", label: "تقرير التقييم (نسخة جديدة وإيداع جديد في «قيمة»)", checked: reopenValuation, set: setReopenValuation },
    { key: "field", label: "عمل ميداني (إعادة تصوير أو زيارة — يُعاد فتح الدراسة)", checked: needsFieldWork, set: setNeedsFieldWork },
  ];

  return (
    <ReasonConfirmModal
      title="إعادة فتح المعاملة"
      subtitle="بعد الاعتماد لا تعديل إلا بإعادة الفتح. تنتهي حين تُرفع المعاملة على إنفاذ من جديد، ويُسجَّل كل ذلك في الجدول الزمني."
      confirmLabel="إعادة الفتح"
      busy={busy}
      onClose={onClose}
      onConfirm={() => void submit()}
    >
      <fieldset className="m-0 flex min-w-0 flex-col gap-2 border-0 p-0">
        <legend className="mb-1 p-0 text-[11px] font-semibold text-text-2">مصدر إعادة الفتح</legend>
        <div className="flex flex-wrap gap-4">
          {(
            [
              ["enfaz", "ملاحظة من إنفاذ"],
              ["internal", "خطأ داخلي"],
            ] as const
          ).map(([value, label]) => (
            <label key={value} className="flex cursor-pointer items-center gap-2 text-[12.5px] text-heading">
              <input
                type="radio"
                name="reopen-source"
                checked={source === value}
                disabled={busy}
                onChange={() => {
                  setSource(value);
                  if (error?.field === "reference") setError(null);
                }}
              />
              <span>{label}</span>
            </label>
          ))}
        </div>
      </fieldset>

      {source === "enfaz" ? (
        <div>
          <Label htmlFor="reopen-enfaz-reference" className="mb-1.5 text-[11px] font-semibold text-text-2">
            رقم ملاحظة إنفاذ أو مرجعها <span className="text-danger-text">*</span>
          </Label>
          <Input
            id="reopen-enfaz-reference"
            value={enfazReference}
            disabled={busy}
            maxLength={200}
            onChange={(e) => {
              setEnfazReference(e.target.value);
              if (error?.field === "reference") setError(null);
            }}
          />
          {error?.field === "reference" ? <p className="m-0 mt-1 text-[11.5px] text-danger-text">{error.text}</p> : null}
        </div>
      ) : null}

      <RequiredReasonField
        id="enfaz-return-reason"
        label={source === "enfaz" ? "نص الملاحظة وسبب إعادة الفتح" : "سبب إعادة الفتح"}
        minLength={ENFAZ_RETURN_REASON_MIN_LENGTH}
        value={reason}
        error={error?.field === "reason" ? error.text : null}
        onChange={(value) => {
          setReason(value);
          if (error?.field === "reason") setError(null);
        }}
      />

      <fieldset className="m-0 flex min-w-0 flex-col gap-2 border-0 p-0">
        <legend className="mb-1 p-0 text-[11px] font-semibold text-text-2">ما الذي يتأثر؟</legend>
        {choices.map((choice) => (
          <label key={choice.key} className="flex cursor-pointer items-center gap-2 text-[12.5px] text-heading">
            <input
              type="checkbox"
              checked={choice.checked}
              disabled={busy}
              onChange={(e) => {
                choice.set(e.target.checked);
                clearChoiceError();
              }}
            />
            <span>{choice.label}</span>
          </label>
        ))}
        {error?.field === "choice" ? <Note tone="danger">{error.text}</Note> : null}
      </fieldset>

      {error?.field === "server" ? <Note tone="warn">{error.text}</Note> : null}
    </ReasonConfirmModal>
  );
}
