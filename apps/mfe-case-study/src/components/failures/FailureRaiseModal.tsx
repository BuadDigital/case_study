"use client";

import { useEffect, useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { AppModal } from "@case-study/mfe/components/ui/AppModal";
import { prototypeKeys } from "@platform/app-shared/query/prototype-keys";
import { Button, useToast } from "@platform/ui-kit";
import { FailureRaiseFields, createFailure, failurePayloadFromProblemType, FAILURE_PROBLEM_TYPES, useFailureTypesQuery } from "@failures/mfe";

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
  const { data: catalog } = useFailureTypesQuery();
  const [problemTypeId, setProblemTypeId] = useState("");
  const [saving, setSaving] = useState(false);
  const [invalid, setInvalid] = useState(false);

  useEffect(() => {
    if (!open) return;
    setProblemTypeId("");
    setSaving(false);
    setInvalid(false);
  }, [open, propertyId]);

  function requestClose() {
    if (saving) return;
    onClose();
  }

  async function handleSubmit() {
    const payload = failurePayloadFromProblemType(
      problemTypeId,
      catalog?.problemTypes?.length
        ? catalog.problemTypes
        : FAILURE_PROBLEM_TYPES,
    );
    if (!payload) {
      setInvalid(true);
      return;
    }
    if (saving) return;
    setSaving(true);
    setInvalid(false);
    try {
      await createFailure({
        poNumber,
        propertyId,
        deedNumber,
        ...payload,
        raisedByRole,
        specialist,
      });
      await queryClient.invalidateQueries({
        queryKey: prototypeKeys.failures(),
      });
      await queryClient.invalidateQueries({
        queryKey: prototypeKeys.operationsTasks(),
      });
      // poRecords / workflow for shells that filter by active failure — not
      // the whole prototype tree (avoids mass sidebar/finance refetch).
      await queryClient.invalidateQueries({
        queryKey: prototypeKeys.workflowTasks(),
      });
      await queryClient.invalidateQueries({
        queryKey: prototypeKeys.poListRows(),
      });
      showToast("تم رفع التعذر — سيظهر لأخصائي دراسة الحالة.", "success");
      onSubmitted?.();
      onClose();
    } catch {
      showToast("تعذّر تسجيل التعذر — حاول مرة أخرى", "error");
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
            showActionToast={false}
            onClick={() => void handleSubmit()}
          >
            رفع التعذر
          </Button>
        </>
      }
    >
      <FailureRaiseFields
        idPrefix={`modal-${propertyId}`}
        problemTypeId={problemTypeId}
        onProblemTypeChange={(v) => {
          setProblemTypeId(v);
          if (invalid) setInvalid(false);
        }}
        invalid={invalid}
        autoFocus={open}
      />
    </AppModal>
  );
}
