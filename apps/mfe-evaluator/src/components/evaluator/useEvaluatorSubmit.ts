// ── Valuation fixes · 2026-10-25/26 ──────────────────────────────────────────────────────────
// Round 1 (5b554f4e)
//  • D2   A blocked hand-over switches to «المراجعة النهائية» and scrolls to the blockers card
//         (HANDOVER_BLOCKERS_ID), so the full list stays on screen, not only in the toast.
//  • Price The handed-over «سعر التقييم» is the reconciliation's final value read fresh from the server
//          (readHandOverPriceFromServer), not the draft figure; a failed read stops the hand-over.
// Round 2 (1b19bedc)
//  • R2-14 A confirmation («اعتماد التقييم وإرساله», naming the final value in ر.س) is asked once after every
//          check passed, via confirmIgnoringDoubleClick; no confirmation → no hand-over.
//  • R2-14 The price read reuses the request id the gate check already read — no second
//          getOpenValuationRequestByProperty call.
// ──────────────────────────────────────────────────────────────────────────────────────────────

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
  readHandOverPriceFromServer,
} from "../../lib/evaluator/evaluator-submit-gates";
import { HANDOVER_BLOCKERS_ID } from "../../lib/evaluator/handover-blockers";
import { confirmIgnoringDoubleClick } from "../../lib/evaluator/confirm-ignoring-double-click";
import { fmt } from "@platform/app-shared/format/number";
import type { EvaluatorWindowTab } from "./evaluator-window-tabs";

export function useEvaluatorSubmit({
  task,
  hostRef,
  locked,
  draft,
  setDraft,
  flushPendingAutosave,
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
  /** Sends the debounced autosave now, so edits from the last 400ms reach the server before the submit. */
  flushPendingAutosave: () => void;
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
      if (gates.kind === "blocked") {
        // The full list stays on «المراجعة النهائية» beside the button — not only in the toast.
        setActiveTab("review");
        scheduleScrollToFormField(HANDOVER_BLOCKERS_ID, 180, { retries: 24 });
      }
      return false;
    }

    // The handed-over «سعر التقييم» is the reconciliation's final value as the server holds it —
    // the server refuses any other figure.
    const serverPrice = await readHandOverPriceFromServer({
      token: getAuthSession()?.token,
      propertyId: task.propertyId,
      // The gate check already read the open request — no second lookup.
      valuationRequestId: gates.valuationRequestId,
    });
    if (!serverPrice.ok) {
      setFormError(serverPrice.message);
      showToast(serverPrice.message, "error");
      return false;
    }
    const evaluatorPrice = serverPrice.price ?? draft.evaluatorPrice;

    // The hand-over locks the package: ask once, after every check passed (no confirm → refusal).
    const priceNumber = Number(evaluatorPrice);
    const confirmed = await confirmIgnoringDoubleClick({
      title: "اعتماد التقييم وإرساله",
      message:
        (Number.isFinite(priceNumber) && priceNumber > 0
          ? `يُرسَل التقييم بقيمة نهائية ${fmt(priceNumber)} ر.س إلى أخصائي دراسة الحالة. `
          : "يُرسَل التقييم إلى أخصائي دراسة الحالة. ") +
        "لا يمكن تعديله بعد الإرسال إلا إذا أعاده الأخصائي.",
      confirmLabel: "اعتماد وإرسال",
    });
    if (!confirmed) return false;

    flushPendingAutosave();

    // From here the hand-over is really sent. Order matters: the study report gate, the form validation, the
    // issuance gates, the server price and the confirmation all come BEFORE this point, so the sending dialog opens
    // only for a send that is going to run, and any refusal above stays on this screen with its reason.
    // `dialogHost` is true when the host shows a sending dialog (it then says the result; no success toast here).
    // After this point every way out reports to the host: success → `onSubmitted`, a refusal (`refuse`) or a thrown
    // error → `onSubmitFailed`, so the dialog can never stay open on a failure.
    const dialogHost = Boolean(hostRef.current?.onSubmitStarted);
    hostRef.current?.onSubmitStarted?.();
    const refuse = (message: string) => {
      setFormError(message);
      showToast(message, "error");
      hostRef.current?.onSubmitFailed?.();
      return false;
    };

    setSubmitting(true);
    hostRef.current?.onSavingChange?.(true);
    setFormError(null);
    try {
      try {
        const updated = await updateEvaluatorDraft(task.id, {
          landValue: draft.landValue,
          buildingValue: draft.buildingValue,
          forcedSaleDiscountPct: draft.forcedSaleDiscountPct,
          evaluatorPrice,
          assetDataConfirmed: draft.assetDataConfirmed,
          assetDataVarianceNotes: draft.assetDataVarianceNotes,
          independenceDeclared: true,
          reportWorkers: draft.reportWorkers,
          valuationMethod: draft.valuationMethod,
          valueBasis: draft.valueBasis,
          demandLevel: draft.demandLevel,
          // The ESG choices are saved after a short debounce — flush them with the submit, which
          // locks the package right after.
          reportChoices: draft.reportChoices,
        });
        if (updated) setDraft(updated);
      } catch (err: unknown) {
        if (err instanceof Error) console.warn("[evaluator] submit save failed:", err);
        return refuse("تعذّر حفظ مسودة التقييم — حاول مرة أخرى");
      }

      const outcome = await executeAppraiserSubmit();
      if (outcome.status === "skipped") {
        hostRef.current?.onSubmitFailed?.();
        return false;
      }

      const result = outcome.value;
      if (result.ok) {
        setDraft(result.submission);
        if (!dialogHost) {
          showToast(
            "تم اعتماد التقييم وإرساله لأخصائي دراسة الحالة.",
            "success",
          );
        }
        hostRef.current?.onSubmitted?.();
        return true;
      }
      if (isStudyReportBlockMessage(result.message)) setStudyReportBlocked(true);
      return refuse(result.message);
    } catch (err: unknown) {
      // The dialog must not stay up on an unexpected error; the error itself is still thrown.
      hostRef.current?.onSubmitFailed?.();
      throw err;
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
    flushPendingAutosave,
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
