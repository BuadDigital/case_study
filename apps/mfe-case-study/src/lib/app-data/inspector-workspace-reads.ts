import {
  isPersistedPartyTaskSubmission,
  type PartyTaskSubmissionDto,
} from "@platform/api-client";
import { loadQueuedDraftPayload } from "@platform/app-shared/offline/offline-write";
import {
  fetchPartySubmission,
  queuedSubmissionStatus,
} from "@platform/app-shared/app-data/party-submission-api";
import { readLocalWorkingCopy } from "@platform/app-shared/offline/offline-write";
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

const inFlightWorkspace = new Map<
  string,
  Promise<InspectorWorkspaceDraft | null>
>();

export function fetchInspectorWorkspace(
  taskId: string,
): Promise<InspectorWorkspaceDraft | null> {
  const pending = inFlightWorkspace.get(taskId);
  if (pending) return pending;
  const run = fetchInspectorWorkspaceUncached(taskId);
  inFlightWorkspace.set(taskId, run);
  void run.finally(() => {
    if (inFlightWorkspace.get(taskId) === run) inFlightWorkspace.delete(taskId);
  });
  return run;
}

async function fetchInspectorWorkspaceUncached(
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
        status: queuedSubmissionStatus(queued),
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
  // The app was closed before the debounced save ran: the device's working copy is
  // newer than the server — open that, and send it.
  const local =
    submission.status === "submitted"
      ? null
      : await readLocalWorkingCopy<Record<string, unknown>>("field-inspection", taskId);
  if (local && Date.parse(local.updatedAtUtc) > Date.parse(submission.updatedAtUtc)) {
    draft = payloadToDraft({ ...submission, payload: local.payload }, draft);
    setCache(draft);
    void import("./inspector-workspace-commands").then((m) =>
      m.saveInspectorWorkspaceDraft(draft).catch(() => {}),
    );
    return draft;
  }
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
