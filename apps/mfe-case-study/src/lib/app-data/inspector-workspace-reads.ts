import {
  isPersistedPartyTaskSubmission,
  type PartyTaskSubmissionDto,
} from "@platform/api-client";
import {
  loadQueuedDraftPayload,
  isBrowserOffline,
  readLocalWorkingCopy,
} from "@platform/app-shared/offline/offline-write";
import {
  fetchPartySubmission,
  queuedSubmissionStatus,
} from "@platform/app-shared/app-data/party-submission-api";
import {
  payloadToDraft,
  readString,
  setCache,
  type InspectorWorkspaceSnapshot,
} from "./inspector-workspace-model";
import type { InspectorWorkspaceDraft } from "./inspector-workspace-data";
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

/** `owner` = the inspector's own workspace (may repair + persist); `readOnly` = the appraiser's view. */
type InspectorFetchMode = "owner" | "readOnly";

const inFlightWorkspace = new Map<
  string,
  Promise<InspectorWorkspaceDraft | null>
>();

function fetchDeduped(
  taskId: string,
  mode: InspectorFetchMode,
  run: () => Promise<InspectorWorkspaceDraft | null>,
): Promise<InspectorWorkspaceDraft | null> {
  const key = `${mode}:${taskId}`;
  const pending = inFlightWorkspace.get(key);
  if (pending) return pending;
  const started = run();
  inFlightWorkspace.set(key, started);
  void started.finally(() => {
    if (inFlightWorkspace.get(key) === started) inFlightWorkspace.delete(key);
  });
  return started;
}

export function fetchInspectorWorkspace(
  taskId: string,
): Promise<InspectorWorkspaceDraft | null> {
  return fetchDeduped(taskId, "owner", () =>
    fetchInspectorWorkspaceUncached(taskId),
  );
}

/**
 * The appraiser's read of the inspector's package (draft, reopened or submitted). It only reads:
 * no default-coordinate migration (that PUT would 403 for the appraiser), no local working copy,
 * no queued-draft fallback and no write into the inspector's workspace cache.
 */
export function fetchInspectorWorkspaceReadOnly(
  taskId: string,
): Promise<InspectorWorkspaceDraft | null> {
  return fetchDeduped(taskId, "readOnly", () =>
    fetchInspectorWorkspaceReadOnlyUncached(taskId),
  );
}

async function fetchInspectorWorkspaceReadOnlyUncached(
  taskId: string,
): Promise<InspectorWorkspaceDraft | null> {
  const submission = await fetchPartySubmission(taskId);
  if (!submission) return null;
  return payloadToDraft(submission);
}

async function fetchInspectorWorkspaceUncached(
  taskId: string,
): Promise<InspectorWorkspaceDraft | null> {
  const submission = await fetchPartySubmission(taskId);

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
    const working = await readLocalWorkingCopy<Record<string, unknown>>(
      "field-inspection",
      taskId,
    );
    if (working) {
      const local: PartyTaskSubmissionDto = {
        taskId,
        kind: "field-inspection",
        status: queuedSubmissionStatus(working.payload),
        payload: working.payload,
        updatedAtUtc: working.updatedAtUtc,
      };
      const draft = payloadToDraft(local);
      setCache(draft);
      return draft;
    }
    if (isBrowserOffline()) {
      throw new Error("المسودة غير محمّلة على الجهاز");
    }
    return submission ? payloadToDraft(submission) : null;
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
