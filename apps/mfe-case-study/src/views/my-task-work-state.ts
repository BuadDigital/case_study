/**
 * Pure decisions behind `CaseStudyTaskWork` (MyTaskWorkView): which step the
 * task is on, which terminal screen replaces the form, the chrome titles and
 * save label, and the small property/distribution helpers the commands reuse.
 * No React, no I/O.
 */
import type { RoleId } from "@platform/types";
import { ROLES } from "@platform/app-shared/app-data/constants";
import {
  formatPoDisplay,
  isBourseInquiryIdentifier,
  propertySkipsBourse,
  type BourseDeedVitality,
  type PoPropertyIntake,
  type PropertyIdentifierType,
} from "../lib/app-data/po-intake-data";
import { taskDisplayPropertyLabel } from "../lib/app-data/tasks-model";
import type { WorkflowTask } from "../lib/app-data/tasks-storage";

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
export const BOURSE_OBSTRUCTION_ACTION = "إرسال للمشرف — إدارة التعذرات";
export const BOURSE_SAVE_ACTION = "حفظ والانتقال للتوزيع";
export const DISTRIBUTION_CONFIRM_ACTION = "تأكيد التوزيع وإرسال المهام";

/** Which step cards render for the effective phase (phase override applied). */
export type TaskWorkSteps = {
  /** Bourse-inquiry identifier while still on «enfath» — both forms in one step. */
  bourseInquiryFastPath: boolean;
  /** Primary-data panel: bourse-inquiry fields live on the «Bourse inquiry» tab only. */
  bourseInquiryPanelOnly: boolean;
  showEnfathStep: boolean;
  showBourseStep: boolean;
  showDistribution: boolean;
  showCaseStudy: boolean;
};

export function resolveTaskWorkSteps(
  effectivePhase: WorkflowTask["phase"],
  layout: TaskWorkLayout,
  identifierType: PropertyIdentifierType,
): TaskWorkSteps {
  const bourseInquiryFastPath =
    effectivePhase === "enfath" && isBourseInquiryIdentifier(identifierType);
  const bourseInquiryPanelOnly = layout === "panel" && bourseInquiryFastPath;
  return {
    bourseInquiryFastPath,
    bourseInquiryPanelOnly,
    showEnfathStep:
      effectivePhase === "enfath" &&
      (!bourseInquiryFastPath || bourseInquiryPanelOnly),
    showBourseStep:
      (effectivePhase === "bourse" || bourseInquiryFastPath) &&
      !bourseInquiryPanelOnly,
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

/** «غير فعال» on the bourse step routes the save to the supervisor instead. */
export function isBourseObstructionPath(
  steps: TaskWorkSteps,
  deedVitality: BourseDeedVitality | null,
): boolean {
  return steps.showBourseStep && deedVitality === "inactive";
}

export function taskWorkSaveLabel(
  steps: TaskWorkSteps,
  deedVitality: BourseDeedVitality | null,
): string {
  switch (activeTaskWorkStep(steps)) {
    case "enfath":
      return ENFATH_SAVE_ACTION;
    case "bourse":
      return isBourseObstructionPath(steps, deedVitality)
        ? BOURSE_OBSTRUCTION_ACTION
        : BOURSE_SAVE_ACTION;
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

export function taskWorkRoleFlags(role: RoleId): {
  isSupervisor: boolean;
  isSpecialist: boolean;
  /** Name stamped on a raised failure. */
  failureSpecialist: string;
} {
  return {
    isSupervisor: role === "section-supervisor" || role === "cdo",
    isSpecialist: role === "case-specialist" || role === "cdo",
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

/** Infath save persists the bourse flag: identifiers that skip bourse are complete already. */
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
