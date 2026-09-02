import {
  isPersistedPartyTaskSubmission,
  type PartyTaskSubmissionDto,
} from "@platform/api-client";
import { loadQueuedDraftPayload } from "@platform/app-shared/offline/offline-write";
import { fetchPartySubmission } from "@platform/app-shared/app-data/party-submission-api";
import type { InspectorWorkspaceDraft } from "./inspector-workspace-data";
import {
  loadInspectorWorkspace,
  payloadToDraft,
  readString,
  setCache,
  type InspectorWorkspaceSnapshot,
} from "./inspector-workspace-model";
export { loadInspectorWorkspace } from "./inspector-workspace-model";

/**
 * The coordinate repair below persists a draft, so it lives on the write side.
 * Loaded lazily to keep the static import graph one-way (commands → reads).
 */
async function migrateInspectorDefaultCoords(
  draft: InspectorWorkspaceDraft,
  rawCoords?: { latitude: string; longitude: string },
): Promise<InspectorWorkspaceDraft> {
  const { migrateInspectorDefaultCoordsIfNeeded } = await import(
    "./inspector-workspace-commands"
  );
  return migrateInspectorDefaultCoordsIfNeeded(draft, rawCoords);
}

export async function fetchInspectorWorkspace(
  taskId: string,
): Promise<InspectorWorkspaceDraft | null> {
  let submission: PartyTaskSubmissionDto | null = null;
  try {
    submission = await fetchPartySubmission(taskId);
  } catch {
    submission = null;
  }

  if (!submission || !isPersistedPartyTaskSubmission(submission)) {
    const queued = await loadQueuedDraftPayload<Record<string, unknown>>(
      "field-inspection",
      taskId,
    );
    if (queued) {
      const local: PartyTaskSubmissionDto = {
        taskId,
        kind: "field-inspection",
        status: "draft",
        payload: queued,
        updatedAtUtc: new Date().toISOString(),
      };
      const draft = payloadToDraft(local);
      setCache(draft);
      return draft;
    }
    return submission ? payloadToDraft(submission) : loadInspectorWorkspace(taskId);
  }

  let draft = payloadToDraft(submission);
  const payload = submission.payload ?? {};
  draft = await migrateInspectorDefaultCoords(draft, {
    latitude: readString(payload.mapLatitude),
    longitude: readString(payload.mapLongitude),
  });
  setCache(draft);
  return draft;
}

export async function loadInspectorWorkspaceSnapshot(
  taskId: string,
): Promise<InspectorWorkspaceSnapshot | null> {
  return fetchInspectorWorkspace(taskId);
}
