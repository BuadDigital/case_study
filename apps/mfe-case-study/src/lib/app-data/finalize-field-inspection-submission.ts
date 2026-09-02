import type { InspectorWorkspaceDraft } from "./inspector-workspace-data";
import { submitInspectorWorkspace } from "./inspector-workspace-commands";

/** Finalizes the field inspection via API (completes the task on the server). */
export async function finalizeInspectorWorkspace(
  taskId: string,
  idempotencyKey?: string,
): Promise<
  | { ok: true; draft: InspectorWorkspaceDraft; queued?: boolean }
  | { ok: false; message: string; errors?: Record<string, string> }
> {
  return submitInspectorWorkspace(taskId, idempotencyKey);
}
