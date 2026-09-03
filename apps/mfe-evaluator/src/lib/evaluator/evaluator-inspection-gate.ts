import type { WorkflowTask } from "@platform/app-shared/workflow/task-types";

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
 * Appraiser starts valuation after field inspection is completed/submitted.
 * Specialist اعتماد of the valuation report (تقرير التقييم) is a later step
 * inside دراسة الحالة — not a gate on starting appraisal.
 * Prefer server `fieldInspectionCompleted` — party lists hide the sibling row.
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
          reason:
            "راقب تقدم الأطراف. لا يبدأ التقييم إلا بعد اكتمال معاينة العقار.",
        };
  }

  const inspection = findSiblingInspectionTask(appraisalTask, tasks);
  if (!inspection) {
    return {
      ready: false,
      reason: "لم تُنشأ مهمة معاينة العقار بعد.",
    };
  }
  if (inspection.status !== "completed") {
    return {
      ready: false,
      reason:
        "راقب تقدم الأطراف. لا يبدأ التقييم إلا بعد اكتمال معاينة العقار.",
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
