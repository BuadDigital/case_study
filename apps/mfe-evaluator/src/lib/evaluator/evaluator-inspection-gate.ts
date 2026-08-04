import type { WorkflowTask } from "@case-study/mfe";

export type InspectionGateState =
  | { ready: true }
  | { ready: false; reason: string };

export function findSiblingInspectionTask(
  appraisalTask: WorkflowTask,
  tasks: WorkflowTask[],
): WorkflowTask | null {
  if (!appraisalTask.parentTaskId) return null;
  return (
    tasks.find(
      (t) =>
        t.parentTaskId === appraisalTask.parentTaskId &&
        t.propertyId === appraisalTask.propertyId &&
        t.kind === "field-inspection",
    ) ?? null
  );
}

/**
 * Prefer server `fieldInspectionCompleted` — party appraiser lists hide sibling
 * inspection tasks (same pattern as EO surveyWorkGate).
 */
export function inspectionGateForAppraisal(
  appraisalTask: WorkflowTask,
  tasks: WorkflowTask[],
): InspectionGateState {
  if (typeof appraisalTask.fieldInspectionCompleted === "boolean") {
    return appraisalTask.fieldInspectionCompleted
      ? { ready: true }
      : {
          ready: false,
          reason: "لا يمكن إدخال التقييم قبل اكتمال المعاينة الميدانية.",
        };
  }

  const inspection = findSiblingInspectionTask(appraisalTask, tasks);
  if (!inspection) {
    return {
      ready: false,
      reason: "لم تُنشأ مهمة المعاينة الميدانية بعد.",
    };
  }
  if (inspection.status !== "completed") {
    return {
      ready: false,
      reason: "لا يمكن إدخال التقييم قبل اكتمال المعاينة الميدانية.",
    };
  }
  return { ready: true };
}

export function findAppraisalChildForParent(
  parentTaskId: string,
  propertyId: string,
  tasks: WorkflowTask[],
): WorkflowTask | null {
  return (
    tasks.find(
      (t) =>
        t.parentTaskId === parentTaskId &&
        t.propertyId === propertyId &&
        t.kind === "property-appraisal",
    ) ?? null
  );
}
