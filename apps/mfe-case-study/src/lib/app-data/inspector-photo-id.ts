import {
  nextInspectorPhotoId,
  type InspectorWorkspaceDraft,
} from "./inspector-workspace-data";

/** Highest id handed out per task in this session — uploads in flight are not in the draft yet. */
const allocated = new Map<string, number>();

/**
 * Hands out the id of a photo that is about to be uploaded.
 *
 * How it works: the id is the larger of "next id after the photos saved in the draft" and "the last id handed out
 * for this task in this session + 1", and the answer is remembered per task.
 *
 * Edge cases: `nextInspectorPhotoId` only sees photos already in the draft, so two uploads in flight at once
 * (different slots, or a slow network) both got the same id and one overwrote the other. The in-memory counter is
 * per page session; a reload starts from the draft again, which is safe because every handed-out id was saved by then.
 */
export function allocateInspectorPhotoId(draft: InspectorWorkspaceDraft): number {
  const id = Math.max(nextInspectorPhotoId(draft), (allocated.get(draft.taskId) ?? 0) + 1);
  allocated.set(draft.taskId, id);
  return id;
}
