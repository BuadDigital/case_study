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
  const [problemTypeId, setProblemTypeId] = useState("");
  const [note, setNote] = useState("");
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!open) return;
    setSeverity("internal");
    setProblemTypeId("");
    setNote("");
    setSaving(false);
  }, [open, propertyId]);

  function requestClose() {
    if (saving) return;
    onClose();
  }

  async function handleSubmit() {
    if (!problemTypeId || saving) return;
    setSaving(true);
    try {
      await createFailure({
        poNumber,
        propertyId,
        deedNumber,
        problemTypeId,
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
            disabled={saving || !problemTypeId}
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
        problemTypeId={problemTypeId}
        onProblemTypeIdChange={setProblemTypeId}
        note={note}
        onNoteChange={setNote}
      />
    </AppModal>
  );
}
