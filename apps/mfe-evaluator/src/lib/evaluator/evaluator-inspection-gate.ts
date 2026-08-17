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
 * Appraiser starts valuation only after the specialist accepts inspection
 * (party data the valuer uses officially). Prefer server
 * `fieldInspectionAccepted` — party lists hide the sibling inspection row.
 */
export function inspectionGateForAppraisal(
  appraisalTask: WorkflowTask,
  tasks: WorkflowTask[],
): InspectionGateState {
  if (typeof appraisalTask.fieldInspectionAccepted === "boolean") {
    return appraisalTask.fieldInspectionAccepted
      ? { ready: true }
      : {
          ready: false,
          reason: appraisalTask.fieldInspectionCompleted
            ? "المعاينة مكتملة — بانتظار اعتماد الأخصائي لبيانات الأطراف."
            : "راقب تقدم الأطراف. لا يبدأ التقييم إلا بعد اعتماد بيانات المعاينة.",
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
      reason: "راقب تقدم الأطراف. لا يبدأ التقييم إلا بعد اعتماد بيانات المعاينة.",
    };
  }
  return {
    ready: false,
    reason: "المعاينة مكتملة — بانتظار اعتماد الأخصائي لبيانات الأطراف.",
  };
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
