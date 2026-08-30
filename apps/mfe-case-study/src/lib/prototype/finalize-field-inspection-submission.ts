import type { InspectorWorkspaceDraft } from "./inspector-workspace-data";
import { submitInspectorWorkspace } from "./inspector-workspace-storage";

/** Finalizes the field inspection via API (completes the task on the server). */
export async function finalizeInspectorWorkspace(
  taskId: string,
): Promise<
  | { ok: true; draft: InspectorWorkspaceDraft }
  | { ok: false; message: string; errors?: Record<string, string> }
> {
  return submitInspectorWorkspace(taskId);
}
