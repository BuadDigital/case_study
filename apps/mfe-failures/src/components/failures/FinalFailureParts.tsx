"use client";

import type { QueryClient } from "@tanstack/react-query";
import { Note, type ToastTone } from "@platform/ui-kit";
import { appDataKeys } from "@platform/app-shared/query/app-data-keys";
import { recordFinalFailureAsync } from "../../lib/failures-api";
import type { FailureProblemType } from "../../lib/failure-types-data";
import { invalidateFailuresRelated } from "../../query/failures-queries";
import { failuresFieldTextareaClass } from "../../views/FailuresViewResolveForm";
import { FailureChoiceCards, type FailureChoice } from "./FailureChoiceCards";

/**
 * The pieces every final-failure form shares — the supervisor's «اعتماد التعذّر» dialog
 * (`FinalFailureDialog`) and the «تسجيل تعذّر» window when «تعذّر نهائي» is chosen: the warning,
 * the reason, the notify choice and the request with its refresh. Extracted 2026-11-11 so the
 * window does not copy the dialog.
 */

export type FinalFailureNotify = "notify" | "silent";

const NOTIFY_OPTIONS: FailureChoice<FinalFailureNotify>[] = [
  { value: "notify", label: "إخطار الأطراف المعنية", hint: "يصل كل طرف لديه مهمة إشعار بالسبب" },
  { value: "silent", label: "تغيير الحالة دون إخطار", hint: "تتوقف مهام الأطراف دون إشعار" },
];

/**
 * The warning above a final failure: every deed of the transaction stops. The only way back is
 * coordination's «رجوع من التعذّر النهائي» on the failures page (2026-11-12) — until then the text
 * said there was none.
 */
export function FinalFailureWarning({ deedCount = 1 }: { deedCount?: number }) {
  const wayBack = "لا يرجع عنه إلا أخصائي التنسيق من صفحة التعذّرات.";
  return (
    <Note tone="warn" className="mb-3">
      {deedCount > 1
        ? `تتحوّل صكوك المعاملة كلها (${deedCount}) إلى «تعذّر» وتتوقف مهامها. ${wayBack}`
        : `تتحوّل المعاملة إلى «تعذّر» وتتوقف مهامها. ${wayBack}`}
    </Note>
  );
}

/** «الأطراف المعنية» — tell the parties holding tasks on the deeds, or stop their tasks silently. */
export function FinalFailureNotifyChoice({
  id,
  value,
  onChange,
  disabled,
}: {
  id: string;
  value: FinalFailureNotify;
  onChange: (value: FinalFailureNotify) => void;
  disabled?: boolean;
}) {
  return (
    <FailureChoiceCards
      id={id}
      label="الأطراف المعنية"
      options={NOTIFY_OPTIONS}
      value={value}
      onChange={onChange}
      disabled={disabled}
    />
  );
}

/**
 * A failure's reason: a labelled textarea with its required mark and field error.
 *
 * How it works: controlled; `required` only adds the mark — the host decides when its confirm
 * button is allowed. Edge cases: an optional reason says «(اختياري)» instead of the mark.
 */
export function FailureReasonField({
  id,
  label,
  value,
  onChange,
  required = true,
  placeholder,
  error,
  disabled,
}: {
  id: string;
  label: string;
  value: string;
  onChange: (value: string) => void;
  required?: boolean;
  placeholder?: string;
  error?: string;
  disabled?: boolean;
}) {
  return (
    <div className="mb-3">
      <label htmlFor={id} className="mb-[7px] block text-[12px] font-semibold text-text-2">
        {label}{" "}
        {required ? (
          <span className="font-bold text-[#c0553d]" aria-hidden>
            *
          </span>
        ) : (
          <span className="font-normal text-text-3">(اختياري)</span>
        )}
      </label>
      <textarea
        id={id}
        className={failuresFieldTextareaClass}
        rows={3}
        placeholder={placeholder}
        value={value}
        disabled={disabled}
        aria-required={required || undefined}
        aria-invalid={Boolean(error) || undefined}
        onChange={(e) => onChange(e.target.value)}
      />
      {error ? <p className="m-0 mt-1 text-[11.5px] text-[#c0553d]">{error}</p> : null}
    </div>
  );
}

/**
 * Records the final failure, refreshes what shows it and tells the user how it went.
 *
 * How it works: posts `recordFinalFailureAsync` with the chosen problem type (its label as the
 * title) and the trimmed reason. On success the failures, the suspended list, the tasks, the
 * bourse items, the PO list and the PO records are refetched, the toast says which notify choice
 * was taken, and null comes back. On a refusal the server's message is toasted and its field
 * errors come back (an empty map when it named no field) — nothing is refreshed, so the host
 * keeps its form open and marks the fields.
 * Edge cases: a `problemTypeId` error means a deed of the transaction had no open failure — the
 * host shows the type dropdown it had hidden.
 */
export async function submitFinalFailure(args: {
  queryClient: QueryClient;
  showToast: (message: string, tone?: ToastTone) => void;
  poNumber: string;
  propertyId: string;
  problemType: FailureProblemType | undefined;
  reason: string;
  notify: FinalFailureNotify;
}): Promise<Record<string, string> | null> {
  const result = await recordFinalFailureAsync({
    poNumber: args.poNumber,
    propertyId: args.propertyId,
    problemTypeId: args.problemType?.id,
    title: args.problemType?.label,
    reason: args.reason.trim(),
    notifyParties: args.notify === "notify",
  });
  if (!result.ok) {
    args.showToast(result.error, "error");
    return result.errors ?? {};
  }
  invalidateFailuresRelated(args.queryClient);
  await Promise.all([
    args.queryClient.invalidateQueries({ queryKey: appDataKeys.poListRows() }),
    args.queryClient.invalidateQueries({ queryKey: appDataKeys.poRecords() }),
  ]);
  args.showToast(
    args.notify === "notify"
      ? "سُجّل التعذّر النهائي وأُخطرت الأطراف"
      : "سُجّل التعذّر النهائي دون إخطار الأطراف",
    "success",
  );
  return null;
}
