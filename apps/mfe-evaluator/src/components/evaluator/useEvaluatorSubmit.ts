"use client";

/**
 * The appraiser's «اعتماد وإرسال»: validates the draft, checks the issuance gates, saves the last
 * values and finalizes the submission (idempotent). Owns the submitting flag and wires `submit`
 * onto the window host. Split out of `EvaluatorWindow` so the window keeps layout and drafts only.
 */

import { useCallback, useEffect, useState } from "react";
import type { Dispatch, RefObject, SetStateAction } from "react";
import { getAuthSession } from "@platform/auth-client";
import { useIdempotentAction } from "@platform/app-shared";
import { scheduleScrollToFormField } from "@platform/app-shared/form-ux";
import type { WorkflowTask } from "@platform/app-shared/workflow/task-types";
import type { EvaluatorSubmission } from "../../lib/evaluator/evaluator-window-data";
import { updateEvaluatorDraft } from "../../lib/evaluator/evaluator-submission-commands";
import {
  firstEvaluatorError,
  firstEvaluatorErrorTarget,
  evaluatorWorkScreenForErrorTarget,
  validateEvaluatorSubmission,
  type EvaluatorRetrospectiveDraft,
  type EvaluatorSpecialistDraft,
  type EvaluatorValidationErrors,
} from "../../lib/evaluator/evaluator-validation";
import { finalizeAppraiserSubmission } from "../../lib/evaluator/finalize-appraiser-submission";
import type { EvaluatorWindowHostRefObject } from "../../lib/evaluator/evaluator-window-host";
import { isStudyReportBlockMessage } from "../../lib/evaluator/evaluator-inspection-gate";
import {
  checkIssuanceGatesFailClosed,
  readFreshStudyReportGate,
} from "../../lib/evaluator/evaluator-submit-gates";
import type { EvaluatorWindowTab } from "./evaluator-window-tabs";

export function useEvaluatorSubmit({
  task,
  hostRef,
  locked,
  draft,
  setDraft,
  saveTimer,
  retrospectiveRef,
  specialistRef,
  setFormError,
  setFieldErrors,
  setActiveTab,
  showToast,
}: {
  task: WorkflowTask;
  hostRef: EvaluatorWindowHostRefObject;
  locked: boolean;
  draft: EvaluatorSubmission;
  setDraft: Dispatch<SetStateAction<EvaluatorSubmission>>;
  saveTimer: RefObject<ReturnType<typeof setTimeout> | null>;
  retrospectiveRef: RefObject<EvaluatorRetrospectiveDraft | null>;
  specialistRef: RefObject<EvaluatorSpecialistDraft | null>;
  setFormError: (message: string | null) => void;
  setFieldErrors: (errors: EvaluatorValidationErrors) => void;
  setActiveTab: (tab: EvaluatorWindowTab) => void;
  showToast: (message: string, tone: "success" | "error") => void;
}) {
  const [submitting, setSubmitting] = useState(false);
  // Set when the study-report rule refused a submit (fresh read or server field error) — the
  // window shows the same notice it shows while the report is not issued.
  const [studyReportBlocked, setStudyReportBlocked] = useState(false);

  const { execute: executeAppraiserSubmit, loading: appraiserSubmitting } =
    useIdempotentAction(
      useCallback(
        async (idempotencyKey: string) =>
          finalizeAppraiserSubmission(task.id, idempotencyKey),
        [task.id],
      ),
    );

  // A new task flag (the specialist issued / reopened) supersedes an earlier refusal.
  const [blockedForFlag, setBlockedForFlag] = useState(task.studyReportIssued);
  if (blockedForFlag !== task.studyReportIssued) {
    setBlockedForFlag(task.studyReportIssued);
    setStudyReportBlocked(false);
  }

  const submit = useCallback(async (): Promise<boolean> => {
    if (locked) return false;
    // The specialist's study report opens the appraiser's SUBMISSION. Fresh read, checked first —
    // a stale list flag must not let a submit start (the server enforces it again regardless).
    const studyGate = await readFreshStudyReportGate(task.id);
    if (!studyGate.ready) {
      setStudyReportBlocked(isStudyReportBlockMessage(studyGate.reason));
      setFormError(studyGate.reason);
      showToast(studyGate.reason, "error");
      return false;
    }
    setStudyReportBlocked(false);

    const choices = draft.reportChoices;
    const methodOn = (key?: string) =>
      Boolean(key?.trim()) && key !== "__unused__";
    const approachesOn =
      methodOn(choices?.marketMethodKey) || methodOn(choices?.costMethodKey);
    const errors = validateEvaluatorSubmission({
      taskId: task.id,
      evaluatorPrice: draft.evaluatorPrice,
      landValue: draft.landValue,
      buildingValue: draft.buildingValue,
      forcedSaleDiscountPct: draft.forcedSaleDiscountPct,
      valueBasisKey: draft.reportChoices?.valueBasisKey,
      assetDataConfirmed: draft.assetDataConfirmed,
      assetDataVarianceNotes: draft.assetDataVarianceNotes,
      reportChoices: draft.reportChoices,
      skipManualLandBuilding: approachesOn,
      retrospective: retrospectiveRef.current,
      specialist: specialistRef.current,
    });
    setFieldErrors(errors);
    if (Object.keys(errors).length > 0) {
      const message =
        firstEvaluatorError(errors) ?? "تحقق من الحقول المطلوبة";
      setFormError(message);
      showToast(message, "error");
      const targetId = firstEvaluatorErrorTarget(errors);
      setActiveTab(evaluatorWorkScreenForErrorTarget(targetId));
      scheduleScrollToFormField(targetId, 180, { retries: 24 });
      return false;
    }

    // Fail closed: a failed / throwing gate read blocks, it never lets the submit through.
    const gates = await checkIssuanceGatesFailClosed({
      token: getAuthSession()?.token,
      propertyId: task.propertyId,
    });
    if (!gates.ok) {
      setFormError(gates.message);
      showToast(gates.message, "error");
      if (gates.kind === "blocked") setActiveTab("review");
      return false;
    }

    if (saveTimer.current) {
      clearTimeout(saveTimer.current);
      saveTimer.current = null;
    }

    setSubmitting(true);
    hostRef.current?.onSavingChange?.(true);
    setFormError(null);
    try {
      try {
        const updated = await updateEvaluatorDraft(task.id, {
          landValue: draft.landValue,
          buildingValue: draft.buildingValue,
          forcedSaleDiscountPct: draft.forcedSaleDiscountPct,
          evaluatorPrice: draft.evaluatorPrice,
          assetDataConfirmed: draft.assetDataConfirmed,
          assetDataVarianceNotes: draft.assetDataVarianceNotes,
          independenceDeclared: true,
          reportWorkers: draft.reportWorkers,
          valuationMethod: draft.valuationMethod,
          valueBasis: draft.valueBasis,
          demandLevel: draft.demandLevel,
        });
        if (updated) setDraft(updated);
      } catch (err: unknown) {
        if (err instanceof Error) console.warn("[evaluator] submit save failed:", err);
        const message = "تعذّر حفظ مسودة التقييم — حاول مرة أخرى";
        setFormError(message);
        showToast(message, "error");
        return false;
      }

      const outcome = await executeAppraiserSubmit();
      if (outcome.status === "skipped") return false;

      const result = outcome.value;
      if (result.ok) {
        setDraft(result.submission);
        showToast(
          "تم اعتماد التقييم وإرساله لأخصائي دراسة الحالة.",
          "success",
        );
        hostRef.current?.onSubmitted?.();
        return true;
      }
      if (isStudyReportBlockMessage(result.message)) setStudyReportBlocked(true);
      setFormError(result.message);
      showToast(result.message, "error");
      return false;
    } finally {
      setSubmitting(false);
      hostRef.current?.onSavingChange?.(false);
    }
  }, [
    locked,
    task.id,
    task.propertyId,
    draft.evaluatorPrice,
    draft.landValue,
    draft.buildingValue,
    draft.forcedSaleDiscountPct,
    draft.assetDataConfirmed,
    draft.assetDataVarianceNotes,
    draft.reportWorkers,
    draft.valuationMethod,
    draft.valueBasis,
    draft.demandLevel,
    draft.reportChoices,
    hostRef,
    showToast,
    executeAppraiserSubmit,
    retrospectiveRef,
    specialistRef,
    saveTimer,
    setDraft,
    setFormError,
    setFieldErrors,
    setActiveTab,
  ]);

  useEffect(() => {
    if (!hostRef.current) return;
    hostRef.current.submit = submit;
    hostRef.current.focusEvaluatorNotes = () => {
      const field = document.getElementById("evaluator_notes") as
        | HTMLTextAreaElement
        | null;
      if (!field) return;
      field.scrollIntoView({ behavior: "smooth", block: "center" });
      window.setTimeout(() => field.focus(), 120);
    };
  }, [hostRef, submit]);

  return { submit, submitBusy: submitting || appraiserSubmitting, studyReportBlocked };
}
