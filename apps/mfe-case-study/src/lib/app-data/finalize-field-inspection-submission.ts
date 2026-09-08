import type { InspectorWorkspaceDraft } from "./inspector-workspace-data";
import {
  acceptInspectorWorkspace,
  submitInspectorWorkspace,
} from "./inspector-workspace-commands";

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

/**
 * Specialist «اعتماد مدخلات المعاين»: save/submit if needed, then stamp
 * AcceptedAtUtc so the valuation tab locks.
 */
export async function finalizeSpecialistInspectionAcceptance(
  taskId: string,
  idempotencyKey?: string,
): Promise<
  | { ok: true; draft: InspectorWorkspaceDraft; queued?: boolean }
  | { ok: false; message: string; errors?: Record<string, string> }
> {
  const submitted = await submitInspectorWorkspace(taskId, idempotencyKey);
  if (!submitted.ok) return submitted;
  if (submitted.queued) return submitted;

  const accepted = await acceptInspectorWorkspace(taskId, idempotencyKey);
  if (!accepted.ok) return { ok: false, message: accepted.error };
  return { ok: true, draft: accepted.data };
}
