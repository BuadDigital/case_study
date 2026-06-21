import {
  inspectorWorkspaceStatusLabel,
  isInspectorWorkspaceLocked,
} from "./inspector-workspace-data";
import { loadInspectorWorkspace } from "./inspector-workspace-storage";

export function fieldInspectionTaskStatusBadge(
  taskId: string,
  taskStatus?: string,
): { label: string; className: string } | null {
  if (taskStatus === "completed") {
    return {
      label: inspectorWorkspaceStatusLabel("submitted"),
      className: "b-done",
    };
  }

  const sub = loadInspectorWorkspace(taskId);
  if (sub?.status === "submitted") {
    return {
      label: inspectorWorkspaceStatusLabel("submitted"),
      className: "b-done",
    };
  }
  if (
    sub?.inspectionDate ||
    sub?.mapLatitude ||
    (sub?.observations?.length ?? 0) > 0
  ) {
    return { label: "مسودة", className: "b-prog" };
  }
  return { label: "جديدة", className: "b-new" };
}

export function isFieldInspectionLocked(taskId: string): boolean {
  const sub = loadInspectorWorkspace(taskId);
  return sub ? isInspectorWorkspaceLocked(sub.status) : false;
}
