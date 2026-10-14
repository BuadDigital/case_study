import {
  nextInspectorPhotoId,
  type InspectorWorkspaceDraft,
} from "./inspector-workspace-data";

/** Highest id handed out per task in this session — uploads in flight are not in the draft yet. */
const allocated = new Map<string, number>();

/**
 * The next photo id for a task. `nextInspectorPhotoId` only sees photos already saved in the draft, so two
 * uploads running at the same time (different slots, or a slow network) would both get the same id.
 */
export function allocateInspectorPhotoId(draft: InspectorWorkspaceDraft): number {
  const id = Math.max(nextInspectorPhotoId(draft), (allocated.get(draft.taskId) ?? 0) + 1);
  allocated.set(draft.taskId, id);
  return id;
}
