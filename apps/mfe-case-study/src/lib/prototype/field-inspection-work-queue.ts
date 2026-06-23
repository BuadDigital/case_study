import type { FieldInspectionWorkspaceListItemDto } from "@platform/api-client";
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
    if (
      workspace.status === "draft" ||
      workspace.status === "reopened" ||
      workspaceHasDraftProgress(workspace)
    ) {
      return { label: "مسودة", className: "b-prog" };
    }
    return { label: "جديدة", className: "b-new" };
  }

  return { label: "جديدة", className: "b-new" };
}

export function isFieldInspectionLocked(
  _taskId?: string,
  workspace?: FieldInspectionWorkspaceListItemDto | null,
): boolean {
  if (workspace) {
    return isInspectorWorkspaceLocked(
      workspace.status as "draft" | "submitted" | "reopened",
    );
  }
  return false;
}
