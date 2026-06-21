import type { InspectorWorkspaceDraft } from "./inspector-workspace-data";
import { submitInspectorWorkspace } from "./inspector-workspace-storage";

/** يُنهي المعاينة الميدانية عبر API (يُكمل المهمة على الخادم). */
export async function finalizeInspectorWorkspace(
  taskId: string,
): Promise<
  | { ok: true; draft: InspectorWorkspaceDraft }
  | { ok: false; message: string; errors?: Record<string, string> }
> {
  return submitInspectorWorkspace(taskId);
}

/** @deprecated */
export const finalizeFieldInspectionSubmission = finalizeInspectorWorkspace;
