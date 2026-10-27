"use client";

import { useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { AppModal, Button, Note, useToast } from "@platform/ui-kit";
import { appDataKeys } from "@platform/app-shared/query/app-data-keys";
import { recordFinalFailureAsync } from "../../lib/failures-api";
import { FAILURE_PROBLEM_TYPES } from "../../lib/failure-types-data";
import { invalidateFailuresRelated } from "../../query/failures-queries";
import { useFailureTypesQuery } from "../../query/failure-types-queries";
import { FailureChoiceCards, type FailureChoice } from "./FailureChoiceCards";
import { FailureRaiseFields } from "./FailureRaiseFields";
import { failuresFieldTextareaClass } from "../../views/FailuresViewResolveForm";

type NotifyChoice = "notify" | "silent";

const NOTIFY_OPTIONS: FailureChoice<NotifyChoice>[] = [
  { value: "notify", label: "إخطار الأطراف المعنية", hint: "يصل كل طرف لديه مهمة إشعار بالسبب" },
  { value: "silent", label: "تغيير الحالة دون إخطار", hint: "تتوقف مهام الأطراف دون إشعار" },
];

/**
 * «التعذر النهائي عن المعاملة» — the supervisor's one dialog, opened from the property ⋮ menu
 * and from «اعتماد التعذّر» on an escalated failure. Every live deed of the transaction turns
 * final («تعذّر»), their tasks stop, and the parties are told only when the supervisor chooses.
 *
 * The problem type is asked when the deed has no open failure (`askProblemType`), or when the
 * server answers that another deed of the transaction has none.
 *
 * How it works: the confirm button stays disabled until the reason (and the type, when asked)
 * is filled; it posts `recordFinalFailureAsync`, refreshes the failures, tasks, PO list and PO
 * records, toasts which notify choice was taken, and closes.
 *
 * Edge cases: a server field error marks its field and keeps the dialog open; a
 * `problemTypeId` error reveals the dropdown that was hidden (a sibling deed had no open
 * failure). Closing is blocked while the request is in flight, so a second click cannot post
 * twice.
 */
export function FinalFailureDialog({
  open,
  onClose,
  poNumber,
  propertyId,
  deedLabel,
  deedCount = 1,
  askProblemType,
  onDone,
}: {
  open: boolean;
  onClose: () => void;
  poNumber: string;
  propertyId: string;
  /** Shown in the title — the deed (or transaction) number. */
  deedLabel: string;
  /** Deeds in the transaction — more than one is spelled out in the warning. */
  deedCount?: number;
  askProblemType: boolean;
  onDone?: () => void;
}) {
  const queryClient = useQueryClient();
  const { showToast } = useToast();
  const { data: catalog } = useFailureTypesQuery();
  const [problemTypeId, setProblemTypeId] = useState("");
  const [needsType, setNeedsType] = useState(askProblemType);
  const [reason, setReason] = useState("");
  const [notify, setNotify] = useState<NotifyChoice>("notify");
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [saving, setSaving] = useState(false);

  const canSubmit =
    reason.trim().length > 0 && (!needsType || problemTypeId.length > 0) && !saving;

  async function submit() {
    if (!canSubmit) return;
    setSaving(true);
    const types = catalog?.problemTypes?.length ? catalog.problemTypes : FAILURE_PROBLEM_TYPES;
    const type = types.find((t) => t.id === problemTypeId);
    try {
      const result = await recordFinalFailureAsync({
        poNumber,
        propertyId,
        problemTypeId: type?.id,
        title: type?.label,
        reason: reason.trim(),
        notifyParties: notify === "notify",
      });
      if (!result.ok) {
        setErrors(result.errors ?? {});
        if (result.errors?.problemTypeId) setNeedsType(true);
        showToast(result.error, "error");
        return;
      }
      invalidateFailuresRelated(queryClient);
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: appDataKeys.poListRows() }),
        queryClient.invalidateQueries({ queryKey: appDataKeys.poRecords() }),
      ]);
      showToast(
        notify === "notify"
          ? "سُجّل التعذّر النهائي وأُخطرت الأطراف"
          : "سُجّل التعذّر النهائي دون إخطار الأطراف",
        "success",
      );
      onDone?.();
      onClose();
    } finally {
      setSaving(false);
    }
  }

  return (
    <AppModal
      open={open}
      title={`التعذّر النهائي عن المعاملة — ${deedLabel}`}
      wide
      onClose={() => {
        if (!saving) onClose();
      }}
      footer={
        <>
          <Button type="button" disabled={saving} onClick={onClose}>
            إلغاء
          </Button>
          <Button
            type="button"
            variant="danger"
            loading={saving}
            disabled={!canSubmit}
            showActionToast={false}
            onClick={() => void submit()}
          >
            تسجيل التعذّر النهائي
          </Button>
        </>
      }
    >
      <Note tone="warn" className="mb-3">
        {deedCount > 1
          ? `تتحوّل صكوك المعاملة كلها (${deedCount}) إلى «تعذّر» وتتوقف مهامها. لا يمكن التراجع من الشاشة.`
          : "تتحوّل المعاملة إلى «تعذّر» وتتوقف مهامها. لا يمكن التراجع من الشاشة."}
      </Note>

      {needsType ? (
        <div className="mb-3">
          <FailureRaiseFields
            idPrefix={`final-${propertyId}`}
            problemTypeId={problemTypeId}
            onProblemTypeChange={(v) => {
              setProblemTypeId(v);
              setErrors((e) => ({ ...e, problemTypeId: "" }));
            }}
            invalid={Boolean(errors.problemTypeId)}
          />
        </div>
      ) : null}

      <div className="mb-3">
        <label
          htmlFor={`final-reason-${propertyId}`}
          className="mb-[7px] block text-[12px] font-semibold text-text-2"
        >
          سبب التعذّر النهائي{" "}
          <span className="font-bold text-[#c0553d]" aria-hidden>
            *
          </span>
        </label>
        <textarea
          id={`final-reason-${propertyId}`}
          className={failuresFieldTextareaClass}
          rows={3}
          placeholder="مثال: قرار المركز بتوجيه أخصائي الإسناد — الصك موقوف لدى المحكمة"
          value={reason}
          aria-invalid={Boolean(errors.reason) || undefined}
          onChange={(e) => {
            setReason(e.target.value);
            setErrors((er) => ({ ...er, reason: "" }));
          }}
        />
        {errors.reason ? (
          <p className="m-0 mt-1 text-[11.5px] text-[#c0553d]">{errors.reason}</p>
        ) : null}
      </div>

      <FailureChoiceCards
        id={`final-notify-${propertyId}`}
        label="الأطراف المعنية"
        options={NOTIFY_OPTIONS}
        value={notify}
        onChange={setNotify}
        disabled={saving}
      />
    </AppModal>
  );
}
