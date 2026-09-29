"use client";

/**
 * The appraiser's «اعتماد وإرسال»: validates the draft, checks the issuance gates, saves the last
 * values and finalizes the submission (idempotent). Owns the submitting flag and wires `submit`
 * onto the window host. Split out of `EvaluatorWindow` so the window keeps layout and drafts only.
 */

import { useCallback, useEffect, useState } from "react";
import type { Dispatch, RefObject, SetStateAction } from "react";
import {
  getOpenValuationRequestByProperty,
  getValuationIssuanceGates,
} from "@platform/api-client";
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
import type { InspectionGateState } from "../../lib/evaluator/evaluator-inspection-gate";
import type { EvaluatorWindowTab } from "./evaluator-window-tabs";

export function useEvaluatorSubmit({
  task,
  hostRef,
  gate,
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
  gate: InspectionGateState;
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

  const { execute: executeAppraiserSubmit, loading: appraiserSubmitting } =
    useIdempotentAction(
      useCallback(
        async (idempotencyKey: string) =>
          finalizeAppraiserSubmission(task.id, idempotencyKey),
        [task.id],
      ),
    );

  const submit = useCallback(async (): Promise<boolean> => {
    if (locked) return false;
    if (!gate.ready) {
      setFormError(gate.reason);
      showToast(gate.reason, "error");
      return false;
    }

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

    const session = getAuthSession();
    if (session?.token && task.propertyId) {
      try {
        const open = await getOpenValuationRequestByProperty(
          { token: session.token },
          task.propertyId,
        );
        if (open.ok && open.data?.id) {
          const gatesRes = await getValuationIssuanceGates(
            { token: session.token },
            open.data.id,
          );
          if (gatesRes.ok && !gatesRes.data.allowsIssuance) {
            // Show every reason, not just the first — otherwise the appraiser fixes one,
            // resubmits, hits the next, and repeats a trial-and-error loop.
            const reasons = gatesRes.data.blockingReasonsAr;
            const reasonText = reasons.length
              ? reasons.slice(0, 4).join("؛ ") +
                (reasons.length > 4 ? ` وغيرها (${reasons.length - 4} أخرى)` : "")
              : "شروط الإصدار غير مستوفاة";
            const message = `الاعتماد ممنوع — ${reasonText}`;
            setFormError(message);
            showToast(message, "error");
            setActiveTab("review");
            return false;
          }
        }
      } catch {
        // Gate check failed (network) — the server will still reject an incomplete issue later.
      }
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
          depositCode: draft.depositCode,
          depositCertificateFileName: draft.depositCertificateFileName,
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
      setFormError(result.message);
      showToast(result.message, "error");
      return false;
    } finally {
      setSubmitting(false);
      hostRef.current?.onSavingChange?.(false);
    }
  }, [
    locked,
    gate,
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
    draft.depositCode,
    draft.depositCertificateFileName,
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

  return { submit, submitBusy: submitting || appraiserSubmitting };
}
