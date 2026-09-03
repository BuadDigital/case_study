"use client";

import { useCallback, useRef, useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import {
  AppModal,
  Button,
  useToast,
} from "@platform/ui-kit";
import { useIdempotentAction } from "@platform/app-shared";
import { appDataKeys } from "@platform/app-shared/query/app-data-keys";
import { FailureRaiseFields, failurePayloadFromProblemType } from "@failures/mfe/components/failures/FailureRaiseFields";
import { createFailure } from "@failures/mfe/lib/failures-repository";
import { FAILURE_PROBLEM_TYPES } from "@failures/mfe/lib/failure-types-data";
import { useFailureTypesQuery } from "@failures/mfe/query/failure-types-queries";

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
  if (!open) return null;
  return (
    <FailureRaiseForm
      key={propertyId}
      onClose={onClose}
      poNumber={poNumber}
      propertyId={propertyId}
      deedNumber={deedNumber}
      specialist={specialist}
      raisedByRole={raisedByRole}
      onSubmitted={onSubmitted}
    />
  );
}

function FailureRaiseForm({
  onClose,
  poNumber,
  propertyId,
  deedNumber,
  specialist,
  raisedByRole,
  onSubmitted,
}: {
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
  const [invalid, setInvalid] = useState(false);
  const pendingFailure = useRef<Parameters<typeof createFailure>[0] | null>(null);

  const { execute: executeCreateFailure, loading: saving } = useIdempotentAction(
    useCallback(async (idempotencyKey: string) => {
      const input = pendingFailure.current;
      if (!input) throw new Error("لا توجد بيانات تعذر");
      return createFailure(input, idempotencyKey);
    }, []),
  );

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
    setInvalid(false);
    pendingFailure.current = {
      poNumber,
      propertyId,
      deedNumber,
      ...payload,
      raisedByRole,
      specialist,
    };
    try {
      const outcome = await executeCreateFailure();
      if (outcome.status === "skipped") return;
      // poRecords / workflow for shells that filter by active failure — not
      // the whole prototype tree (avoids mass sidebar/finance refetch).
      // Independent query keys — invalidate in parallel, not sequentially (async-parallel).
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: appDataKeys.failures() }),
        queryClient.invalidateQueries({ queryKey: appDataKeys.operationsTasks() }),
        queryClient.invalidateQueries({ queryKey: appDataKeys.workflowTasks() }),
        queryClient.invalidateQueries({ queryKey: appDataKeys.poListRows() }),
      ]);
      showToast("تم رفع التعذر — سيظهر لأخصائي دراسة الحالة.", "success");
      onSubmitted?.();
      onClose();
    } catch {
      showToast("تعذّر تسجيل التعذر — حاول مرة أخرى", "error");
    }
  }

  const title = deedNumber.trim()
    ? `تسجيل تعذر — ${deedNumber.trim()}`
    : "تسجيل تعذر";

  return (
    <AppModal
      open
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
        autoFocus
      />
    </AppModal>
  );
}
