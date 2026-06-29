"use client";

import { useEffect, useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { AppModal } from "@case-study/mfe/components/ui/AppModal";
import { prototypeKeys } from "@platform/app-shared/query/prototype-keys";
import { Button, useToast } from "@platform/design-system";
import {
  FailureRaiseFields,
  createFailure,
  type FailureSeverity,
} from "@failures/mfe";
import { FREE_TEXT_FAILURE_PROBLEM_TYPE_ID } from "@failures/mfe/lib/failure-types-data";

export function FailureRaiseModal({
  open,
  onClose,
  poNumber,
  propertyId,
  deedNumber,
  specialist,
  raisedByRole,
  onSubmitted,
}: {
  open: boolean;
  onClose: () => void;
  poNumber: string;
  propertyId: string;
  deedNumber: string;
  specialist: string;
  raisedByRole: string;
  onSubmitted?: () => void;
}) {
  const queryClient = useQueryClient();
  const { showToast } = useToast();
  const [severity, setSeverity] = useState<FailureSeverity>("internal");
  const [problemDescription, setProblemDescription] = useState("");
  const [note, setNote] = useState("");
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!open) return;
    setSeverity("internal");
    setProblemDescription("");
    setNote("");
    setSaving(false);
  }, [open, propertyId]);

  function requestClose() {
    if (saving) return;
    onClose();
  }

  async function handleSubmit() {
    const description = problemDescription.trim();
    if (!description || saving) return;
    setSaving(true);
    try {
      await createFailure({
        poNumber,
        propertyId,
        deedNumber,
        problemTypeId: FREE_TEXT_FAILURE_PROBLEM_TYPE_ID,
        title: description,
        severity,
        raisedByRole,
        internalNote: note,
        specialist,
      });
      await queryClient.invalidateQueries({ queryKey: prototypeKeys.failures() });
      await queryClient.invalidateQueries({ queryKey: prototypeKeys.all });
      showToast("تم تسجيل التعذر.", "success");
      onSubmitted?.();
      onClose();
    } finally {
      setSaving(false);
    }
  }

  const title = deedNumber.trim()
    ? `تسجيل تعذر — ${deedNumber.trim()}`
    : "تسجيل تعذر";

  return (
    <AppModal
      open={open}
      title={title}
      wide
      onClose={requestClose}
      footer={
        <>
          <Button type="button" disabled={saving} onClick={requestClose}>
            إلغاء
          </Button>
          <Button
            type="button"
            variant="primary"
            loading={saving}
            disabled={saving || !problemDescription.trim()}
            className="min-w-[9.5rem]"
            onClick={() => void handleSubmit()}
          >
            تسجيل التعذر
          </Button>
        </>
      }
    >
      <FailureRaiseFields
        idPrefix={`modal-${propertyId}`}
        severity={severity}
        onSeverityChange={setSeverity}
        problemDescription={problemDescription}
        onProblemDescriptionChange={setProblemDescription}
        note={note}
        onNoteChange={setNote}
      />
    </AppModal>
  );
}
