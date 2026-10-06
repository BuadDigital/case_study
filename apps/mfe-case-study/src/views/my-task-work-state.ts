/**
 * Pure decisions behind `CaseStudyTaskWork` (MyTaskWorkView): which step the
 * task is on, which terminal screen replaces the form, the chrome titles and
 * save label, and the small property/distribution helpers the commands reuse.
 * No React, no I/O.
 */
import type { RoleId } from "@platform/types";
import { ROLES } from "@platform/app-shared/app-data/constants";
import {
  DEED_STATUS_ACTIVE,
  DEED_STATUS_INACTIVE,
  formatPoDisplay,
  propertySkipsBourse,
  type BourseDeedVitality,
  type PoPropertyIntake,
} from "../lib/app-data/po-intake-data";
import { canEditProperty as canEditPropertyRole } from "../lib/app-data/po-roles";
import { taskDisplayPropertyLabel } from "../lib/app-data/tasks-model";
import type { WorkflowTask } from "../lib/app-data/tasks";

export type TaskWorkLayout = "page" | "panel";

export const REMOVED_PROPERTY_SAVE_ERROR =
  "هذه المعاملة مرتبطة بعقار محذوف — لا يمكن الحفظ.";
export const DUPLICATE_DEED_ERROR = "رقم الصك مسجّل مسبقاً في هذا أمر العمل.";
export const NO_LINKED_PROPERTY_ERROR = "لا يوجد عقار مرتبط بهذه المهمة.";
export const DEED_VITALITY_REQUIRED_ERROR = "اختر حالة الصك: فعال أو غير فعال.";
export const CONFIRM_DISTRIBUTION_ERROR =
  "تعذّر تأكيد التوزيع — تحقق من المرحلة وحاول مرة أخرى";
export const DISTRIBUTION_SAVE_ERROR = "تعذّر حفظ التوزيع — حاول مرة أخرى";

export const ENFATH_SAVE_ACTION = "حفظ";
export const BOURSE_SAVE_ACTION = "حفظ والانتقال للتوزيع";
export const DISTRIBUTION_CONFIRM_ACTION = "تأكيد التوزيع وإرسال المهام";

/** Which step cards render for the effective phase (phase override applied). */
export type TaskWorkSteps = {
  showEnfathStep: boolean;
  showBourseStep: boolean;
  showDistribution: boolean;
  showCaseStudy: boolean;
};

export function resolveTaskWorkSteps(
  effectivePhase: WorkflowTask["phase"],
): TaskWorkSteps {
  return {
    showEnfathStep: effectivePhase === "enfath",
    showBourseStep: effectivePhase === "bourse",
    showDistribution: effectivePhase === "distribution",
    showCaseStudy: effectivePhase === "case-study",
  };
}

export type TaskWorkStep = "enfath" | "bourse" | "distribution";

/** The step the primary save button acts on — first visible card wins. */
export function activeTaskWorkStep(steps: TaskWorkSteps): TaskWorkStep | null {
  if (steps.showEnfathStep) return "enfath";
  if (steps.showBourseStep) return "bourse";
  if (steps.showDistribution) return "distribution";
  return null;
}

/** The `deedStatus` the bourse save records for the specialist's «حالة الصك» pick. */
export function bourseDeedStatus(vitality: BourseDeedVitality | null): string {
  return vitality === "inactive" ? DEED_STATUS_INACTIVE : DEED_STATUS_ACTIVE;
}

/** An inactive deed no longer forces a تعذّر: the bourse save is the same either way. */
export function taskWorkSaveLabel(steps: TaskWorkSteps): string {
  switch (activeTaskWorkStep(steps)) {
    case "enfath":
      return ENFATH_SAVE_ACTION;
    case "bourse":
      return BOURSE_SAVE_ACTION;
    case "distribution":
      return DISTRIBUTION_CONFIRM_ACTION;
    default:
      return ENFATH_SAVE_ACTION;
  }
}

export function taskWorkPanelStepTitle(steps: TaskWorkSteps): string {
  switch (activeTaskWorkStep(steps)) {
    case "enfath":
      return "البيانات الأولية";
    case "bourse":
      return "استعلام البورصة";
    case "distribution":
      return "توزيع المعاملة";
    default:
      return "تنفيذ المعاملة";
  }
}

/** Chrome title of the work screen: the step name in the panel, the deed on the page. */
export function taskWorkChromeTitle(
  steps: TaskWorkSteps,
  layout: TaskWorkLayout,
  deedTitle: string,
): string {
  return layout === "panel"
    ? taskWorkPanelStepTitle(steps)
    : `تعديل عقار — ${deedTitle}`;
}

export type TaskWorkScreen =
  | "loading"
  | "removed"
  | "obstruction"
  | "case-study"
  | "done"
  | "not-specialist"
  | "work";

/** Which screen replaces the step form — checked in this order, first match wins. */
export function resolveTaskWorkScreen({
  loading,
  linkedPropertyRemoved,
  task,
  showCaseStudy,
  isSpecialist,
}: {
  loading: boolean;
  linkedPropertyRemoved: boolean;
  task: Pick<WorkflowTask, "phase" | "status">;
  showCaseStudy: boolean;
  isSpecialist: boolean;
}): TaskWorkScreen {
  if (loading) return "loading";
  if (linkedPropertyRemoved) return "removed";
  if (task.phase === "obstruction") return "obstruction";
  if (showCaseStudy) return "case-study";
  if (task.phase === "done" || task.status === "completed") return "done";
  if (!isSpecialist) return "not-specialist";
  return "work";
}

/** The footer save button submits only while a specialist still has a step to work. */
export function canShowPrimarySave(
  task: Pick<WorkflowTask, "phase" | "status">,
  showCaseStudy: boolean,
  isSpecialist: boolean,
): boolean {
  return (
    isSpecialist &&
    !showCaseStudy &&
    task.phase !== "obstruction" &&
    task.phase !== "done" &&
    task.status !== "completed"
  );
}

/** «تسجيل تعذر» is offered once a property exists and the step is bourse or distribution. */
export function canRaiseFailure(
  task: Pick<WorkflowTask, "propertyId">,
  steps: TaskWorkSteps,
): boolean {
  return Boolean(task.propertyId) && (steps.showBourseStep || steps.showDistribution);
}

export type TaskWorkTitles = {
  deedTitle: string;
  panelDeedBadge: string;
  workSubtitle: string;
};

export function taskWorkTitles(
  task: WorkflowTask,
  property: Pick<PoPropertyIntake, "deedNumber">,
): TaskWorkTitles {
  const deed = property.deedNumber.trim();
  return {
    deedTitle:
      deed || taskDisplayPropertyLabel(task) || `خانة ${task.propertyOrdinal}`,
    panelDeedBadge: deed || `خانة ${task.propertyOrdinal}`,
    workSubtitle: `أخصائي دراسة الحالة · ${formatPoDisplay(task.poNumber)}`,
  };
}

/**
 * Whether the viewer may work the step shown. Distribution keeps its wider
 * audience; the Infath and bourse writes (and the advance after them) are the
 * case specialist's alone, as the server enforces.
 */
export function canWorkTaskStep(
  steps: Pick<TaskWorkSteps, "showEnfathStep" | "showBourseStep">,
  flags: { isSpecialist: boolean; canEditProperty: boolean },
): boolean {
  const writesProperty = steps.showEnfathStep || steps.showBourseStep;
  return flags.isSpecialist && (!writesProperty || flags.canEditProperty);
}

export function taskWorkRoleFlags(role: RoleId): {
  isSupervisor: boolean;
  isSpecialist: boolean;
  /** Infath / bourse writes — mirrors `PoRoleMatrixRules.CanEditProperty`. */
  canEditProperty: boolean;
  /** Name stamped on a raised failure. */
  failureSpecialist: string;
} {
  return {
    // The supervisor, the general manager and the CDO resolve an obstruction (hand the task back to the specialist).
    isSupervisor: role === "section-supervisor" || role === "cdo" || role === "general-manager",
    isSpecialist: role === "case-specialist" || role === "cdo",
    canEditProperty: canEditPropertyRole(role),
    failureSpecialist: ROLES[role]?.name ?? "أخصائي",
  };
}

export function removedPropertyNote(removalReason: string): string {
  const reason = removalReason.trim();
  return `هذا العقار محذوف${reason ? ` — ${reason}` : ""}. لا يمكن متابعة المعاملة.`;
}

/** The property fields `distributionValidationError` checks before confirming. */
export function distributionValidationContext(
  property: PoPropertyIntake,
  poNumber: string,
) {
  return {
    deedNumber: property.deedNumber,
    requestNumber: property.requestNumber,
    city: property.city,
    district: property.district,
    circuit: property.circuit,
    poNumber,
    assignmentMandateNumber: property.assignmentMandateNumber,
    assignmentMandateDate: property.assignmentMandateDate,
  };
}

/** Infath save never completes bourse; registered title still visits inquiry. */
export function persistedEnfathProperty(property: PoPropertyIntake): PoPropertyIntake {
  return propertySkipsBourse(property)
    ? { ...property, bourseDataCompleted: true }
    : { ...property, bourseDataCompleted: false };
}

/** What the task advances with after the save round-trips. */
export function savedEnfathProperty(
  property: PoPropertyIntake,
  saved: PoPropertyIntake,
): PoPropertyIntake {
  return propertySkipsBourse(property)
    ? { ...saved, bourseDataCompleted: true }
    : saved;
}

/**
 * Stable local-draft key for a property that has no server id yet (task.propertyId
 * is null before the first حفظ). Fixed to the task, not the property's own generated
 * id — that id is re-rolled on every remount, which orphaned the autosave draft and
 * made إنفاذ / استعلام بورصة data disappear on close→reopen before the first save.
 */
export function newPropertyDraftKey(taskId: string): string {
  return `new:${taskId}`;
}
