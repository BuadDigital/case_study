"use client";

import { useCallback, useRef, useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import {
  AppModal,
  Button,
  Note,
  useToast,
} from "@platform/ui-kit";
import { useIdempotentAction } from "@platform/app-shared";
import { useAppAccess } from "@platform/app-shared/contexts/AppAccessContext";
import { appDataKeys } from "@platform/app-shared/query/app-data-keys";
import { FailureRaiseFields, failurePayloadFromProblemType } from "@failures/mfe/components/failures/FailureRaiseFields";
import {
  FinalFailureNotifyChoice,
  FinalFailureWarning,
  submitFinalFailure,
  type FinalFailureNotify,
} from "@failures/mfe/components/failures/FinalFailureParts";
import { createFailure, getPropertyFailure } from "@failures/mfe/lib/failures-repository";
import {
  failureDegreesFor,
  failureReasonRequired,
  type FailureDegree,
} from "@failures/mfe/lib/failure-degrees";
import { failureRecordTitle, failureStatusLabel } from "@failures/mfe/lib/failures-labels";
import { FAILURE_PROBLEM_TYPES } from "@failures/mfe/lib/failure-types-data";
import { useFailureTypesQuery } from "@failures/mfe/query/failure-types-queries";

type FailureRaiseModalProps = {
  onClose: () => void;
  poNumber: string;
  propertyId: string;
  deedNumber: string;
  specialist: string;
  raisedByRole: string;
  /** Deeds in the transaction — more than one is spelled out in the final failure's warning. */
  deedCount?: number;
  onSubmitted?: () => void;
};

/**
 * «تسجيل تعذّر» — the one window every ⋮ menu and work screen opens (Omar 2026-11-11): the three
 * degrees by permission, the failure type and the reason.
 *
 * How it works: the degrees offered come from `failureDegreesFor` — «تعذّر محتمل» for every role
 * that may raise; «تعذّر داخلي» and «تعذّر نهائي» too for the case specialist, the supervisor and
 * the CDO, who must write the reason. «تعذّر محتمل» and «تعذّر داخلي» file a failure
 * (`createFailure`); «تعذّر نهائي» records the transaction's final failure
 * (`submitFinalFailure`) with the warning and the notify choice the supervisor's dialog
 * shows. A deed that already carries an open failure takes only the final degree — its type is
 * not asked again, the open failure is finalized.
 * Edge cases: a viewer left with no degree (a party on a deed with an open failure) sees why and
 * cannot confirm; a server field error marks its field and keeps the window open, and a
 * `problemTypeId` error brings the type dropdown back (a sibling deed had no open failure).
 * The form mounts only while open, so it starts empty each time.
 */
export function FailureRaiseModal({
  open,
  ...props
}: FailureRaiseModalProps & { open: boolean }) {
  if (!open) return null;
  return <FailureRaiseForm key={props.propertyId} {...props} />;
}

function FailureRaiseForm({
  onClose,
  poNumber,
  propertyId,
  deedNumber,
  specialist,
  raisedByRole,
  deedCount = 1,
  onSubmitted,
}: FailureRaiseModalProps) {
  const queryClient = useQueryClient();
  const { showToast } = useToast();
  const { role } = useAppAccess();
  const { data: catalog } = useFailureTypesQuery();
  // Read once: the deed's open failure decides which degrees this window offers.
  const [openFailure] = useState(() => getPropertyFailure(poNumber, propertyId));
  const [degrees] = useState<FailureDegree[]>(() =>
    failureDegreesFor(role, openFailure ? openFailure.status : null),
  );
  const [degree, setDegree] = useState<FailureDegree>(() =>
    degrees.includes("internal") ? "internal" : (degrees[0] ?? "suspected"),
  );
  const [problemTypeId, setProblemTypeId] = useState("");
  const [needsType, setNeedsType] = useState(!openFailure);
  const [reason, setReason] = useState("");
  const [notify, setNotify] = useState<FinalFailureNotify>("notify");
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [savingFinal, setSavingFinal] = useState(false);
  const pendingFailure = useRef<Parameters<typeof createFailure>[0] | null>(null);

  const { execute: executeCreateFailure, loading: savingRaise } = useIdempotentAction(
    useCallback(async (idempotencyKey: string) => {
      const input = pendingFailure.current;
      if (!input) throw new Error("لا توجد بيانات تعذّر");
      return createFailure(input, idempotencyKey);
    }, []),
  );

  const saving = savingRaise || savingFinal;
  const isFinal = degree === "final";
  const types = catalog?.problemTypes?.length ? catalog.problemTypes : FAILURE_PROBLEM_TYPES;
  const canSubmit =
    degrees.length > 0 &&
    !saving &&
    (!needsType || problemTypeId.length > 0) &&
    (!failureReasonRequired(degree, problemTypeId) || reason.trim().length > 0);

  function requestClose() {
    if (saving) return;
    onClose();
  }

  async function submitFinal() {
    setSavingFinal(true);
    const refused = await submitFinalFailure({
      queryClient,
      showToast,
      poNumber,
      propertyId,
      problemType: types.find((t) => t.id === problemTypeId),
      reason,
      notify,
    }).finally(() => setSavingFinal(false));
    if (refused) {
      setErrors(refused);
      setNeedsType((asked) => asked || Boolean(refused.problemTypeId));
      return;
    }
    onSubmitted?.();
    onClose();
  }

  async function submitRaise(severity: Exclude<FailureDegree, "final">) {
    const payload = failurePayloadFromProblemType(problemTypeId, types, severity, reason);
    if (!payload) {
      setErrors((e) => ({ ...e, problemTypeId: "اختر نوع التعذّر" }));
      return;
    }
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
      showToast(
        severity === "internal"
          ? "سُجّل التعذّر الداخلي — توقّف العمل على العقار."
          : "تم رفع التعذّر — سيظهر لأخصائي دراسة الحالة.",
        "success",
      );
      onSubmitted?.();
      onClose();
    } catch {
      showToast("تعذّر تسجيل التعذّر — حاول مرة أخرى", "error");
    }
  }

  function handleSubmit() {
    if (!canSubmit) return;
    setErrors({});
    if (degree === "final") void submitFinal();
    else void submitRaise(degree);
  }

  const title = deedNumber.trim()
    ? `تسجيل تعذّر — ${deedNumber.trim()}`
    : "تسجيل تعذّر";

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
            variant={isFinal ? "danger" : "primary"}
            loading={saving}
            disabled={!canSubmit}
            className="min-w-[9.5rem]"
            showActionToast={false}
            onClick={handleSubmit}
          >
            {isFinal ? "تسجيل التعذّر النهائي" : "رفع التعذّر"}
          </Button>
        </>
      }
    >
      {openFailure ? (
        <Note tone="info" className="mb-3">
          يوجد تعذّر قائم على هذا العقار: {failureRecordTitle(openFailure)} —{" "}
          {failureStatusLabel(openFailure.status)}.
          {degrees.length > 0
            ? " يمكن تسجيل «تعذّر نهائي» عليه."
            : " أكمل معالجته قبل رفع تعذّر جديد."}
        </Note>
      ) : null}

      {degrees.length > 0 ? (
        <>
          {isFinal ? <FinalFailureWarning deedCount={deedCount} /> : null}
          <FailureRaiseFields
            idPrefix={`modal-${propertyId}`}
            degrees={degrees}
            severity={degree}
            onSeverityChange={setDegree}
            showProblemType={needsType}
            problemTypeId={problemTypeId}
            onProblemTypeChange={(v) => {
              setProblemTypeId(v);
              setErrors((e) => ({ ...e, problemTypeId: "" }));
            }}
            invalid={Boolean(errors.problemTypeId)}
            reason={reason}
            onReasonChange={(v) => {
              setReason(v);
              setErrors((e) => ({ ...e, reason: "" }));
            }}
            reasonError={errors.reason}
            disabled={saving}
            autoFocus
          />
          {isFinal ? (
            <FinalFailureNotifyChoice
              id={`modal-notify-${propertyId}`}
              value={notify}
              onChange={setNotify}
              disabled={saving}
            />
          ) : null}
        </>
      ) : null}
    </AppModal>
  );
}
