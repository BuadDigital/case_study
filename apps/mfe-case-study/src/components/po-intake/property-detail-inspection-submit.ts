import type { PoPropertyIntake } from "@platform/app-shared/app-data/po-intake-property-model";
import {
  boundariesMarkedUnavailable,
} from "../../lib/app-data/po-intake-data";
import {
  ensureInspectorOriginalMapOnSubmit,
  SPECIALIST_ACCEPT_INSPECTOR_INPUTS_SUCCESS,
  type InspectorWorkspaceDraft,
} from "@platform/app-shared/app-data/inspector-workspace-data";
import { saveInspectorWorkspaceDraft } from "../../lib/app-data/inspector-workspace-commands";
import {
  firstInspectorWorkspaceError,
  inspectorMustDecideDeedMatch,
  inspectorWorkspaceHasBlockingErrors,
  scheduleInspectorErrorScroll,
  validateInspectorWorkspace,
  type InspectorWorkspaceFieldErrors,
} from "../../lib/app-data/inspector-workspace-validation";
import {
  notifySpecialistFinishingRequired,
  specialistFinishingLevelMissingMessage,
} from "@platform/app-shared/app-data/valuation-report-specialist-finishing";
import type { WorkflowTask } from "../../lib/app-data/tasks";
import { getBuildingInventory } from "@platform/api-client";
import { specialistComponentsMissing } from "../../lib/app-data/specialist-components";
import { workOrdersApiConfig } from "@platform/app-shared/app-data/work-orders-api-config";
import type { IdempotentActionResult } from "@platform/app-shared";
import type { RoleId } from "@platform/types";
import {
  inspectorPreSubmitGate,
  inspectorSubmitStamp,
} from "../../lib/app-data/inspector-submit-gate";
import type { InspectorKeyGateStatus } from "../../lib/app-data/inspector-key-gate";

type InspectionSubmitResult =
  | { ok: true; draft: InspectorWorkspaceDraft; queued?: boolean }
  | { ok: false; message: string; errors?: Record<string, string> };

/** Null when «مكونات العقار» is complete (or cannot be read — the server gate still applies). */
async function specialistComponentsMissingFor(
  poNumber: string,
  propertyId: string,
): Promise<string | null> {
  const config = workOrdersApiConfig();
  if (!config || !poNumber || !propertyId) return null;
  const res = await getBuildingInventory(config, poNumber, propertyId);
  return res.ok ? specialistComponentsMissing(res.data) : null;
}

/**
 * The desktop «حفظ وإرسال» of the inspection tab — the inspector's submit and the specialist's
 * acceptance of the inspector's inputs.
 *
 * How it works: (1) the specialist's own gates (finishing level, «مكونات العقار»); the inspector's
 * gate (`inspectorPreSubmitGate`: declaration phone rule + a known key status); (2) save the whole
 * draft with the pledge ticked, the inspector's original map pin and — for the inspector — the
 * key / declaration stamp (`inspectorSubmitStamp`); (3) run the field validation; (4) send through
 * the idempotent `executeInspectorSubmit` and report the outcome.
 *
 * Edge cases: fixed 2026-11-04 — the inspector's desktop submit neither waited for the key status
 * nor sent it (or the declaration), so every desktop inspection went out as «no key»; the phone
 * did both. A skipped / empty idempotent run changes nothing; a refusal with field errors marks them
 * and scrolls to the first one.
 */
export async function submitPropertyDetailInspection(input: {
  inspectionTask: WorkflowTask;
  draft: InspectorWorkspaceDraft;
  property: PoPropertyIntake;
  mapActor: "inspector" | "specialist";
  includeRetiredFeatureKeys?: readonly string[];
  serviceProofFromTransactionPhotos: boolean;
  /**
   * The study's own conditions before the acceptance (finishing level, «مكونات العقار») — off on the
   * coordinator's page (Omar 2026-11-08: the coordinator accepts the inspector's package; those inputs
   * are the study's, written on the work page). Default on.
   */
  studyChecks?: boolean;
  /** The inspector's submit only: who submits and the key-envelope answer (same gate as the phone). */
  inspectorGate?: {
    role: RoleId;
    contacts: ReadonlyArray<{ phone?: string }> | null | undefined;
    keyAvailability: { status: InspectorKeyGateStatus; keyAvailable: boolean | null };
  };
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
    studyChecks = true,
    inspectorGate,
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
    if (serviceProofFromTransactionPhotos && studyChecks) {
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
      // «مكونات العقار» report text before accepting; the inventory table is not a condition.
      // The server enforces the same rule (SpecialistComponentsRules).
      const componentsError = await specialistComponentsMissingFor(
        inspectionTask.poNumber,
        property.id,
      );
      if (componentsError) {
        setFormError(componentsError);
        showToast(componentsError, "error");
        document
          .getElementById("specialist-components")
          ?.scrollIntoView({ behavior: "smooth", block: "center" });
        return;
      }
    }

    // The inspector's declaration phone rule and key status — the phone's gate.
    const preGate =
      mapActor === "inspector" && inspectorGate
        ? inspectorPreSubmitGate({ draft, ...inspectorGate })
        : null;
    if (preGate && !preGate.ok) {
      setFormError(preGate.reason);
      showToast(preGate.reason, "error");
      return;
    }

    // Applied to the draft as it is when the queued PUT runs, so it lands on the latest edits.
    const confirm = (latest: InspectorWorkspaceDraft): InspectorWorkspaceDraft => {
      const baseConfirmed: InspectorWorkspaceDraft = {
        ...latest,
        inspectionConfirmed: true,
        ...(preGate?.ok ? inspectorSubmitStamp(latest, preGate) : {}),
      };
      return mapActor === "inspector"
        ? ensureInspectorOriginalMapOnSubmit(baseConfirmed)
        : baseConfirmed;
    };
    const saved = await saveInspectorWorkspaceDraft(draft, confirm);
    setDraft(saved);

    const errors = validateInspectorWorkspace(saved, {
      boundariesUnavailable: boundariesMarkedUnavailable(
        property.boundariesAvailability,
      ),
      classification: property.classification,
      propertyType: property.propertyType,
      includeRetiredFeatureKeys,
      // The inspector's own submit only — the specialist's accept path never demands the verdict.
      requireDeedMatch:
        mapActor === "inspector" && inspectorMustDecideDeedMatch(property),
      // Same for «هل في الأرض مبانٍ أو ملاحق تستحق التقييم؟» (asked of an asset typed land).
      requireLandStructures: mapActor === "inspector",
      // And the 10 exterior / 20 interior photo floor.
      requirePhotoMinimums: mapActor === "inspector",
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
        ? "بانتظار المزامنة — ستُرسل عند عودة الاتصال"
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
