import type { PoPropertyIntake } from "@platform/app-shared/app-data/po-intake-data";
import {
  boundariesMarkedUnavailable,
} from "../../lib/app-data/po-intake-data";
import {
  ensureInspectorOriginalMapOnSubmit,
  SPECIALIST_ACCEPT_INSPECTOR_INPUTS_SUCCESS,
  type InspectorWorkspaceDraft,
} from "../../lib/app-data/inspector-workspace-data";
import { saveInspectorWorkspaceDraft } from "../../lib/app-data/inspector-workspace-commands";
import {
  firstInspectorWorkspaceError,
  inspectorWorkspaceHasBlockingErrors,
  scheduleInspectorErrorScroll,
  validateInspectorWorkspace,
  type InspectorWorkspaceFieldErrors,
} from "../../lib/app-data/inspector-workspace-validation";
import {
  notifySpecialistFinishingRequired,
  specialistFinishingLevelMissingMessage,
} from "../../lib/app-data/valuation-report-specialist-finishing";
import type { WorkflowTask } from "../../lib/app-data/tasks";
import type { IdempotentActionResult } from "@platform/app-shared";

type InspectionSubmitResult =
  | { ok: true; draft: InspectorWorkspaceDraft; queued?: boolean }
  | { ok: false; message: string; errors?: Record<string, string> };

export async function submitPropertyDetailInspection(input: {
  inspectionTask: WorkflowTask;
  draft: InspectorWorkspaceDraft;
  property: PoPropertyIntake;
  mapActor: "inspector" | "specialist";
  includeRetiredFeatureKeys?: readonly string[];
  serviceProofFromTransactionPhotos: boolean;
  submitSuccessToast?: string;
  lockEditMode: boolean;
  executeInspectorSubmit: () => Promise<
    IdempotentActionResult<InspectionSubmitResult>
  >;
  setSaving: (v: boolean) => void;
  setFormError: (v: string | null) => void;
  setDraft: (draft: InspectorWorkspaceDraft) => void;
  setFieldErrors: (errors: InspectorWorkspaceFieldErrors) => void;
  showToast: (message: string, kind: "success" | "error" | "info") => void;
  onSubmitted?: () => void;
  onEditModeChange?: (edit: boolean) => void;
}): Promise<void> {
  const {
    inspectionTask,
    draft,
    property,
    mapActor,
    includeRetiredFeatureKeys,
    serviceProofFromTransactionPhotos,
    submitSuccessToast,
    lockEditMode,
    executeInspectorSubmit,
    setSaving,
    setFormError,
    setDraft,
    setFieldErrors,
    showToast,
    onSubmitted,
    onEditModeChange,
  } = input;

  setSaving(true);
  setFormError(null);
  try {
    if (serviceProofFromTransactionPhotos) {
      const finishingError = specialistFinishingLevelMissingMessage({
        propertyId: property.id,
        status: draft.status,
        assetSubject: draft.featureValues.assetSubject,
        initialAssetSubject:
          property.propertyType?.trim() || property.classification?.trim() || "",
      });
      if (finishingError) {
        notifySpecialistFinishingRequired(property.id);
        setFormError(finishingError);
        showToast(finishingError, "error");
        return;
      }
    }

    const baseConfirmed: InspectorWorkspaceDraft = {
      ...draft,
      inspectionConfirmed: true,
    };
    const confirmed =
      mapActor === "inspector"
        ? ensureInspectorOriginalMapOnSubmit(baseConfirmed)
        : baseConfirmed;
    const saved = await saveInspectorWorkspaceDraft(confirmed);
    setDraft(saved);

    const errors = validateInspectorWorkspace(saved, {
      boundariesUnavailable: boundariesMarkedUnavailable(
        property.boundariesAvailability,
      ),
      classification: property.classification,
      propertyType: property.propertyType,
      includeRetiredFeatureKeys,
      specialistProofServicesOnly: serviceProofFromTransactionPhotos,
    });
    delete errors.inspectionConfirmed;
    if (inspectorWorkspaceHasBlockingErrors(errors)) {
      setFieldErrors(errors);
      const message =
        firstInspectorWorkspaceError(errors) ?? "يرجى مراجعة بيانات المعاينة";
      setFormError(message);
      showToast(message, "error");
      scheduleInspectorErrorScroll(errors);
      return;
    }

    const outcome = await executeInspectorSubmit();
    if (outcome.status === "skipped") return;

    const result = outcome.value;
    if (!result) return;
    if (!result.ok) {
      if (result.errors) {
        setFieldErrors(result.errors as InspectorWorkspaceFieldErrors);
        scheduleInspectorErrorScroll(
          result.errors as InspectorWorkspaceFieldErrors,
        );
      }
      setFormError(result.message);
      showToast(result.message, "error");
      return;
    }

    setDraft(result.draft);
    setFieldErrors({});
    showToast(
      result.queued
        ? "محفوظة للمزامنة — ستُرسل عند عودة الاتصال"
        : submitSuccessToast ??
          (serviceProofFromTransactionPhotos
            ? SPECIALIST_ACCEPT_INSPECTOR_INPUTS_SUCCESS
            : "تم حفظ بيانات المعاينة وإرسالها."),
      result.queued ? "info" : "success",
    );
    if (!result.queued) {
      onSubmitted?.();
    }
    if (!lockEditMode && !result.queued) {
      onEditModeChange?.(false);
    }
  } catch (err: unknown) {
    const message =
      err instanceof Error ? err.message : "تعذّر حفظ بيانات المعاينة";
    setFormError(message);
    showToast(message, "error");
  } finally {
    setSaving(false);
  }
}
