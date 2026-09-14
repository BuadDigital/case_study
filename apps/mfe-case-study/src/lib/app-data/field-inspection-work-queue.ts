import type { FieldInspectionWorkspaceListItemDto } from "@platform/api-client";
import type { WorkflowTask } from "./tasks-storage";
import {
  inspectorWorkspaceStatusLabel,
  isInspectorWorkspaceLocked,
} from "./inspector-workspace-data";

function workspaceHasDraftProgress(
  workspace: FieldInspectionWorkspaceListItemDto,
): boolean {
  return (
    Boolean(workspace.inspectionDate?.trim()) ||
    workspace.completedPhotoSlots > 0 ||
    workspace.observationCount > 0 ||
    workspace.attachmentCount > 0
  );
}

export function fieldInspectionTaskStatusBadge(
  taskId: string,
  taskStatus?: string,
  workspace?: FieldInspectionWorkspaceListItemDto | null,
): { label: string; className: string } | null {
  if (taskStatus === "completed") {
    return {
      label: inspectorWorkspaceStatusLabel("submitted"),
      className: "b-done",
    };
  }

  if (workspace) {
    if (workspace.status === "submitted") {
      return {
        label: inspectorWorkspaceStatusLabel("submitted"),
        className: "b-done",
      };
    }
    if (workspace.status === "reopened") {
      return {
        label: inspectorWorkspaceStatusLabel("reopened"),
        className: "b-returned",
      };
    }
    if (workspace.status === "draft" || workspaceHasDraftProgress(workspace)) {
      return { label: "مسودة", className: "b-prog" };
    }
    return { label: "جديدة", className: "b-new" };
  }

  return { label: "جديدة", className: "b-new" };
}

/** Hide submitted/completed معاينات until «إظهار المكتملة» is on. */
export function isVisibleInFieldInspectionQueue(
  taskStatus: string,
  options?: { showCompleted?: boolean; workspaceStatus?: string | null },
): boolean {
  if (options?.showCompleted) return true;
  if (taskStatus === "completed") return false;
  if (options?.workspaceStatus === "submitted") return false;
  return true;
}

export function filterFieldInspectionListedTasks(
  tasks: WorkflowTask[],
  options?: { showCompleted?: boolean },
): WorkflowTask[] {
  return tasks.filter(
    (t) =>
      t.kind === "field-inspection" &&
      isVisibleInFieldInspectionQueue(t.status, {
        showCompleted: options?.showCompleted,
      }),
  );
}

export function isFieldInspectionLocked(
  _taskId?: string,
  workspace?: FieldInspectionWorkspaceListItemDto | null,
  taskStatus?: string,
): boolean {
  if (taskStatus === "completed") return true;
  if (workspace) {
    return isInspectorWorkspaceLocked(
      workspace.status as "draft" | "submitted" | "reopened",
    );
  }
  return false;
}
