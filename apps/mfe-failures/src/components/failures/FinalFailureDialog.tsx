"use client";

import { useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { AppModal, Button, useToast } from "@platform/ui-kit";
import { FAILURE_PROBLEM_TYPES } from "../../lib/failure-types-data";
import { useFailureTypesQuery } from "../../query/failure-types-queries";
import { FailureRaiseFields } from "./FailureRaiseFields";
import {
  FailureReasonField,
  FinalFailureNotifyChoice,
  FinalFailureWarning,
  submitFinalFailure,
  type FinalFailureNotify,
} from "./FinalFailureParts";

/**
 * «التعذر النهائي عن المعاملة» — the dialog behind «اعتماد التعذّر» on an escalated failure in the
 * failures queue. Every live deed of the transaction turns final («تعذّر»), their tasks stop, and
 * the parties are told only when asked. Row ⋮ menus record the final failure from the «تسجيل
 * تعذّر» window instead (2026-11-11); both share `FinalFailureParts`.
 *
 * The problem type is asked when the deed has no open failure (`askProblemType`), or when the
 * server answers that another deed of the transaction has none.
 *
 * How it works: the confirm button stays disabled until the reason (and the type, when asked)
 * is filled; it posts `submitFinalFailure` (which refreshes and toasts) and closes.
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
  const [notify, setNotify] = useState<FinalFailureNotify>("notify");
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [saving, setSaving] = useState(false);

  const canSubmit =
    reason.trim().length > 0 && (!needsType || problemTypeId.length > 0) && !saving;

  async function submit() {
    if (!canSubmit) return;
    setSaving(true);
    const types = catalog?.problemTypes?.length ? catalog.problemTypes : FAILURE_PROBLEM_TYPES;
    try {
      const refused = await submitFinalFailure({
        queryClient,
        showToast,
        poNumber,
        propertyId,
        problemType: types.find((t) => t.id === problemTypeId),
        reason,
        notify,
      });
      if (refused) {
        setErrors(refused);
        if (refused.problemTypeId) setNeedsType(true);
        return;
      }
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
      <FinalFailureWarning deedCount={deedCount} />

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

      <FailureReasonField
        id={`final-reason-${propertyId}`}
        label="سبب التعذّر النهائي"
        placeholder="مثال: قرار المركز بتوجيه أخصائي الإسناد — الصك موقوف لدى المحكمة"
        value={reason}
        error={errors.reason}
        onChange={(value) => {
          setReason(value);
          setErrors((er) => ({ ...er, reason: "" }));
        }}
      />

      <FinalFailureNotifyChoice
        id={`final-notify-${propertyId}`}
        value={notify}
        onChange={setNotify}
        disabled={saving}
      />
    </AppModal>
  );
}
