"use client";

/**
 * Save/confirm commands behind `CaseStudyTaskWork`: the Infath save, the
 * bourse save (with the obstruction and bourse-inquiry fast paths), the
 * distribution confirm/patch, and the supervisor's obstruction release. Owns
 * only the idempotency guards; every other piece of state arrives from
 * `useMyTaskWorkWorkflow`, which composes this hook.
 */
import { useCallback, useRef } from "react";
import { useRouter } from "next/navigation";
import { useQueryClient } from "@tanstack/react-query";
import type { RoleId } from "@platform/types";
import { useToast } from "@platform/ui-kit";
import { useIdempotentAction } from "@platform/app-shared";
import { ROLES, type StaffUser } from "@platform/app-shared/app-data/constants";
import { scheduleScrollToFormField } from "@platform/app-shared/form-ux";
import { appDataKeys } from "@platform/app-shared/query/app-data-keys";
import {
  hasFieldErrors,
  type FieldErrors,
} from "@platform/app-shared/registration/registration-utils";
import {
  firstEnfathValidationMessage,
  mergePropertyEnfathValidation,
} from "../lib/domain/po-intake/property-enfath-validation";
import {
  firstBourseValidationMessage,
  validatePropertyBourseFields,
} from "../lib/domain/po-intake/property-bourse-validation";
import { scheduleScrollToFirstPoPropertyError } from "../lib/domain/po-intake/po-field-error-targets";
import {
  formatPropertyDeedDisplay,
  isBourseInquiryIdentifier,
  type AssignmentType,
  type BourseDeedVitality,
  type PoPropertyIntake,
  type PropertyIdentifierType,
} from "../lib/app-data/po-intake-data";
import {
  submitBourseObstruction,
  validateBourseObstructionReason,
} from "../lib/app-data/bourse-obstruction";
import { deedExistsInPo } from "../lib/app-data/po-intake-reads";
import {
  addPropertyToPo,
  completePropertyBourse,
  updatePropertyInPo,
} from "../lib/app-data/po-intake-commands";
import {
  advanceTaskAfterBourse,
  advanceTaskAfterEnfath,
  confirmTaskDistribution,
  distributionValidationError,
  migrateDistribution,
  patchTaskDistribution,
  resolveTaskObstruction,
  type TaskDistributionDraft,
  type WorkflowTask,
} from "../lib/app-data/tasks-storage";
import {
  activeTaskWorkStep,
  BOURSE_OBSTRUCTION_ACTION,
  BOURSE_SAVE_ACTION,
  CONFIRM_DISTRIBUTION_ERROR,
  DEED_VITALITY_REQUIRED_ERROR,
  DISTRIBUTION_CONFIRM_ACTION,
  distributionValidationContext,
  DUPLICATE_DEED_ERROR,
  ENFATH_SAVE_ACTION,
  NO_LINKED_PROPERTY_ERROR,
  persistedEnfathProperty,
  REMOVED_PROPERTY_SAVE_ERROR,
  savedEnfathProperty,
  type TaskWorkSteps,
} from "./my-task-work-state";

export type MyTaskWorkCommandsInput = {
  task: WorkflowTask;
  role: RoleId;
  property: PoPropertyIntake;
  assignmentType: AssignmentType;
  distribution: TaskDistributionDraft;
  showEngineering: boolean;
  deedVitality: BourseDeedVitality | null;
  obstructionReason: string;
  linkedPropertyRemoved: boolean;
  staffUsers: StaffUser[];
  steps: TaskWorkSteps;
  setFormError: (value: string | null) => void;
  setFieldErrors: (value: FieldErrors) => void;
  setSaving: (value: boolean) => void;
  setPhaseOverride: (value: WorkflowTask["phase"] | null) => void;
  setObstructionReasonError: (value: string | undefined) => void;
  setDistribution: (value: TaskDistributionDraft) => void;
  onRefresh: () => void;
  onEnfathSaved?: (
    taskId: string,
    meta: { identifierType: PropertyIdentifierType },
  ) => void | Promise<void>;
};

type EnfathSaveErrors = { errors: FieldErrors; message: string };

/** Field validation first, then the duplicate-deed check against the PO. */
async function findEnfathSaveErrors(
  property: PoPropertyIntake,
  assignmentType: AssignmentType,
  task: Pick<WorkflowTask, "poNumber" | "propertyId">,
): Promise<EnfathSaveErrors | null> {
  const errors = mergePropertyEnfathValidation(property, assignmentType);
  if (hasFieldErrors(errors)) {
    return { errors, message: firstEnfathValidationMessage(errors) };
  }
  if (
    property.deedNumber.trim() &&
    (await deedExistsInPo(
      task.poNumber,
      property.deedNumber.trim(),
      task.propertyId,
    ))
  ) {
    const errors = { deedNumber: DUPLICATE_DEED_ERROR };
    return { errors, message: errors.deedNumber };
  }
  return null;
}

export function useMyTaskWorkCommands({
  task,
  role,
  property,
  assignmentType,
  distribution,
  showEngineering,
  deedVitality,
  obstructionReason,
  linkedPropertyRemoved,
  staffUsers,
  steps,
  setFormError,
  setFieldErrors,
  setSaving,
  setPhaseOverride,
  setObstructionReasonError,
  setDistribution,
  onRefresh,
  onEnfathSaved,
}: MyTaskWorkCommandsInput) {
  const router = useRouter();
  const queryClient = useQueryClient();
  const { showToast, runWithActionToast } = useToast();
  const pendingBourseComplete = useRef<{
    poNumber: string;
    propertyId: string;
    property: PoPropertyIntake;
  } | null>(null);

  const { execute: executeBourseComplete, loading: bourseCompleting } =
    useIdempotentAction(
      useCallback(async (idempotencyKey: string) => {
        const pending = pendingBourseComplete.current;
        if (!pending) {
          throw new Error("لا توجد بيانات بورصة للإرسال");
        }
        return completePropertyBourse(
          pending.poNumber,
          pending.propertyId,
          pending.property,
          idempotencyKey,
        );
      }, []),
    );

  const { execute: executeConfirmDistribution, loading: confirmingDistribution } =
    useIdempotentAction(
      useCallback(
        async (idempotencyKey: string) =>
          confirmTaskDistribution(
            task.id,
            distribution,
            formatPropertyDeedDisplay(property),
            staffUsers,
            idempotencyKey,
          ),
        [task.id, distribution, property, staffUsers],
      ),
    );

  /** Surface a command failure on the form, then abort the action toast. */
  function failure(error: string, errors?: FieldErrors): Error {
    setFormError(error);
    if (errors) setFieldErrors(errors);
    return new Error(error);
  }

  async function rejectIfEnfathInvalid(): Promise<boolean> {
    const invalid = await findEnfathSaveErrors(property, assignmentType, task);
    if (!invalid) return false;
    setFieldErrors(invalid.errors);
    setFormError(invalid.message);
    scheduleScrollToFirstPoPropertyError(invalid.errors, property);
    return true;
  }

  async function saveEnfath() {
    setFormError(null);
    if (linkedPropertyRemoved) {
      setFormError(REMOVED_PROPERTY_SAVE_ERROR);
      return;
    }
    if (await rejectIfEnfathInvalid()) return;

    const persisted = persistedEnfathProperty(property);

    await runWithActionToast(ENFATH_SAVE_ACTION, async () => {
      setSaving(true);
      try {
        const result = task.propertyId
          ? await updatePropertyInPo(task.poNumber, task.propertyId, persisted)
          : await addPropertyToPo(task.poNumber, persisted, {
              assignToTaskId: task.id,
            });
        if (!result.ok) throw failure(result.error, result.errors);

        const updatedTask = await advanceTaskAfterEnfath(
          task.id,
          savedEnfathProperty(property, result.data),
        );
        if (!updatedTask.ok) throw failure(updatedTask.error);
        setPhaseOverride(updatedTask.task.phase);
        if (onEnfathSaved) {
          await onEnfathSaved(task.id, {
            identifierType: property.identifierType,
          });
        } else {
          onRefresh();
        }
      } finally {
        setSaving(false);
      }
    }).catch(() => {
      /* error toast already shown by runWithActionToast */
    });
  }

  async function submitObstruction() {
    const obstructionError = validateBourseObstructionReason(
      deedVitality,
      obstructionReason,
    );
    if (obstructionError) {
      setObstructionReasonError(obstructionError);
      setFormError(obstructionError);
      scheduleScrollToFormField("obstruction_reason");
      return;
    }
    if (!task.propertyId) {
      setFormError(NO_LINKED_PROPERTY_ERROR);
      return;
    }
    await runWithActionToast(BOURSE_OBSTRUCTION_ACTION, async () => {
      setSaving(true);
      try {
        await submitBourseObstruction({
          poNumber: task.poNumber,
          propertyId: task.propertyId!,
          deedNumber: property.deedNumber,
          reason: obstructionReason,
          specialist: ROLES[role]?.name ?? "أخصائي دراسة الحالة",
        });
        void queryClient.invalidateQueries({
          queryKey: appDataKeys.failures(),
        });
        void queryClient.invalidateQueries({
          queryKey: appDataKeys.workflowTasks(),
        });
        onRefresh();
      } finally {
        setSaving(false);
      }
    });
  }

  async function saveBourse() {
    setFormError(null);
    if (linkedPropertyRemoved) {
      setFormError(REMOVED_PROPERTY_SAVE_ERROR);
      return;
    }
    if (!deedVitality) {
      setFormError(DEED_VITALITY_REQUIRED_ERROR);
      return;
    }
    if (deedVitality === "inactive") {
      await submitObstruction();
      return;
    }

    // Persisted phase, not the override: the fast path only applies while the
    // task is still on «enfath» server-side.
    const bourseInquiryFastPath =
      task.phase === "enfath" && isBourseInquiryIdentifier(property.identifierType);

    if (bourseInquiryFastPath && (await rejectIfEnfathInvalid())) return;

    const errors = validatePropertyBourseFields(property);
    if (hasFieldErrors(errors)) {
      setFieldErrors(errors);
      setFormError(firstBourseValidationMessage(errors));
      scheduleScrollToFirstPoPropertyError(errors, property);
      return;
    }

    if (!task.propertyId && !bourseInquiryFastPath) {
      setFormError(NO_LINKED_PROPERTY_ERROR);
      return;
    }

    await runWithActionToast(BOURSE_SAVE_ACTION, async () => {
      setSaving(true);
      try {
        let prop = property;
        let propertyId = task.propertyId;

        if (!propertyId) {
          const insert = await addPropertyToPo(task.poNumber, property, {
            assignToTaskId: task.id,
          });
          if (!insert.ok) throw failure(insert.error, insert.errors);
          prop = insert.data;
          propertyId = insert.data.id;
        } else if (bourseInquiryFastPath) {
          const updated = await updatePropertyInPo(
            task.poNumber,
            propertyId,
            property,
          );
          if (!updated.ok) throw failure(updated.error, updated.errors);
          prop = updated.data;
          const enfathAdvance = await advanceTaskAfterEnfath(task.id, updated.data);
          if (!enfathAdvance.ok) throw failure(enfathAdvance.error);
          setPhaseOverride(enfathAdvance.task.phase);
        }

        pendingBourseComplete.current = {
          poNumber: task.poNumber,
          propertyId: propertyId!,
          property: { ...prop, deedStatus: "فعال" },
        };
        const outcome = await executeBourseComplete();
        if (outcome.status === "skipped") {
          throw new Error("duplicate-submit");
        }
        const result = outcome.value;
        if (!result.ok) throw failure(result.error, result.errors);

        const advancedTask = await advanceTaskAfterBourse(task.id, result.data);
        if (!advancedTask.ok) throw failure(advancedTask.error);
        setPhaseOverride(advancedTask.task.phase);
        onRefresh();
      } finally {
        setSaving(false);
      }
    }).catch(() => {
      /* error toast already shown by runWithActionToast */
    });
  }

  async function confirmDistribution() {
    setFormError(null);
    const validation = distributionValidationError(
      distribution,
      showEngineering,
      distributionValidationContext(property, task.poNumber),
    );
    if (validation) {
      setFormError(validation);
      return;
    }

    await runWithActionToast(DISTRIBUTION_CONFIRM_ACTION, async () => {
      setSaving(true);
      try {
        const outcome = await executeConfirmDistribution();
        if (outcome.status === "skipped") return;

        const result = outcome.value;
        if (!result.parent) {
          throw failure(result.error ?? CONFIRM_DISTRIBUTION_ERROR);
        }

        setPhaseOverride(result.parent.phase);
        void queryClient.invalidateQueries({
          queryKey: appDataKeys.workflowTasks(),
        });
        onRefresh();
      } finally {
        setSaving(false);
      }
    }).catch(() => {
      /* error toast already shown by runWithActionToast */
    });
  }

  async function patchDistribution(patch: Partial<TaskDistributionDraft>) {
    const next = migrateDistribution({ ...distribution, ...patch });
    if (!showEngineering) {
      next.engineeringOffice = false;
      next.engineeringOfficeId = "";
    }
    setDistribution(next);
    await patchTaskDistribution(task.id, next, task);
    onRefresh();
  }

  function handlePrimarySave() {
    const step = activeTaskWorkStep(steps);
    if (step === "enfath") void saveEnfath();
    else if (step === "bourse") void saveBourse();
    else if (step === "distribution") void confirmDistribution();
  }

  /** Supervisor: hand the obstructed task back to the specialist. */
  function resolveObstruction() {
    void (async () => {
      const updated = await resolveTaskObstruction(task.id, task);
      if (updated) {
        showToast("تمت إعادة المهمة للأخصائي", "success");
        onRefresh();
        return;
      }
      showToast("تعذّر إعادة المهمة للأخصائي — حاول مرة أخرى", "error");
    })();
  }

  function reviewFailures() {
    router.push("/failures");
  }

  return {
    bourseCompleting,
    confirmingDistribution,
    saveEnfath,
    saveBourse,
    confirmDistribution,
    patchDistribution,
    handlePrimarySave,
    resolveObstruction,
    reviewFailures,
  };
}
