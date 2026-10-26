/**
 * The network half of the inspector's «حفظ وإرسال»: save the whole draft, add the key status and the
 * declaration, then send. Split from `useFieldInspectionWorkflow` so the hook stays within its size cap.
 *
 * A host that shows a sending dialog (`onSubmitStarted`) is told the outcome through `onSubmitted`,
 * `onSubmitQueued` or `onSubmitFailed`; it says the result itself, so no success toast then.
 */
import type { Dispatch, RefObject, SetStateAction } from "react";
import type { useToast } from "@platform/ui-kit";
import {
  ensureInspectorOriginalMapOnSubmit,
  type InspectorWorkspaceDraft,
} from "../../lib/app-data/inspector-workspace-data";
import {
  saveInspectorWorkspaceDraft,
  updateInspectorWorkspace,
} from "../../lib/app-data/inspector-workspace-commands";
import type { finalizeInspectorWorkspace } from "../../lib/app-data/finalize-field-inspection-submission";
import {
  firstInspectorWorkspaceErrorTarget,
  inspectorWizardStepForErrorTarget,
  scheduleInspectorErrorScroll,
  type InspectorWorkspaceFieldErrors,
} from "../../lib/app-data/inspector-workspace-validation";
import type { InspectorStepId } from "./InspectorStepNav";
import type { FieldInspectionWorkHostRef } from "./FieldInspectionWorkParts";
import { newerInspectorDraft } from "./field-inspection-work-state";

type SubmitResult = Awaited<ReturnType<typeof finalizeInspectorWorkspace>>;

/**
 * Saves the inspection, then sends it, and reports the outcome to the host.
 *
 * How it works: (1) switch the host's saving flag on; (2) save the whole draft, stamping the inspector's
 * original map pin; (3) patch the key status and the declaration; (4) run the idempotent submit (`execute`, one
 * key per click so a double click sends once); (5) tell the host what happened: `onSubmitted` when it was sent,
 * `onSubmitQueued` when the device is offline and the send was queued, `onSubmitFailed` when it was refused or
 * threw. The saving flag is always switched off in `finally`.
 *
 * Edge cases: a host with a sending dialog (it sets `onSubmitStarted`) says the result itself, so no success
 * toast is shown for it; failures always toast the reason and also close the dialog. A refusal that carries field
 * errors jumps to the step holding the first one. An `execute` that was skipped (a send is already running) or
 * returned nothing counts as a failure so the dialog never stays open. Returns `true` only when the inspection
 * was sent or queued.
 */
export async function sendInspectorSubmission(input: {
  draft: InspectorWorkspaceDraft;
  taskId: string;
  keyAvailable: boolean;
  hasPhone: boolean;
  execute: () => Promise<{ status: string; value?: SubmitResult }>;
  hostRef: RefObject<FieldInspectionWorkHostRef | null>;
  setDraft: Dispatch<SetStateAction<InspectorWorkspaceDraft | null>>;
  setFieldErrors: Dispatch<SetStateAction<InspectorWorkspaceFieldErrors>>;
  setFormError: Dispatch<SetStateAction<string | null>>;
  setActiveStep: Dispatch<SetStateAction<InspectorStepId>>;
  showToast: ReturnType<typeof useToast>["showToast"];
}): Promise<boolean> {
  const { draft, taskId, hostRef, showToast } = input;
  const dialogHost = Boolean(hostRef.current?.onSubmitStarted);
  const fail = (message: string) => {
    input.setFormError(message);
    showToast(message, "error");
    hostRef.current?.onSubmitFailed?.();
  };

  hostRef.current?.onSavingChange?.(true);
  input.setFormError(null);
  try {
    // The original map pin is stamped on the draft as it is when the queued PUT runs.
    const saved = await saveInspectorWorkspaceDraft(draft, ensureInspectorOriginalMapOnSubmit);
    input.setDraft((prev) => newerInspectorDraft(prev, saved));
    const patched = await updateInspectorWorkspace(taskId, {
      vacantLand: draft.vacantLand,
      keyAvailable: input.keyAvailable,
      clientDeclarationSigned: draft.clientDeclarationSigned,
      declarationPhoneSatisfied:
        draft.declarationPhoneSatisfied || (draft.clientDeclarationSigned && input.hasPhone),
    });
    if (patched) input.setDraft((prev) => newerInspectorDraft(prev, patched));
    const outcome = await input.execute();

    if (outcome.status === "skipped" || !outcome.value) {
      hostRef.current?.onSubmitFailed?.();
      return false;
    }

    const result = outcome.value;
    if (result.ok) {
      input.setDraft(result.draft);
      if (!dialogHost) {
        showToast(
          result.queued
            ? "حُفظت المعاينة وستُرسل عند عودة الاتصال."
            : "تم حفظ بيانات المعاينة وإرسالها.",
          "success",
        );
      }
      if (result.queued) hostRef.current?.onSubmitQueued?.();
      else hostRef.current?.onSubmitted?.();
      return true;
    }

    if (result.errors) {
      const nextErrors = result.errors as InspectorWorkspaceFieldErrors;
      input.setFieldErrors(nextErrors);
      const targetId = firstInspectorWorkspaceErrorTarget(nextErrors);
      if (targetId) input.setActiveStep(inspectorWizardStepForErrorTarget(targetId));
      scheduleInspectorErrorScroll(nextErrors);
    }
    fail(result.message);
    return false;
  } catch (err: unknown) {
    fail(err instanceof Error ? err.message : "تعذّر حفظ المعاينة قبل الإرسال");
    return false;
  } finally {
    hostRef.current?.onSavingChange?.(false);
  }
}
