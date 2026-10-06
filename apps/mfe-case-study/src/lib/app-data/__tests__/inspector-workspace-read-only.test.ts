import { beforeEach, describe, expect, it, vi } from "vitest";
import type { PartyTaskSubmissionDto } from "@platform/api-client";

const fetchPartySubmission = vi.fn();
const readLocalWorkingCopy = vi.fn();
const loadQueuedDraftPayload = vi.fn();
const migrateInspectorDefaultCoordsIfNeeded = vi.fn();
const saveInspectorWorkspaceDraft = vi.fn();

vi.mock("@platform/app-shared/app-data/party-submission-api", () => ({
  fetchPartySubmission: (...args: unknown[]) => fetchPartySubmission(...args),
  queuedSubmissionStatus: () => "draft",
}));
vi.mock("@platform/app-shared/offline/offline-write", () => ({
  loadQueuedDraftPayload: (...args: unknown[]) => loadQueuedDraftPayload(...args),
  readLocalWorkingCopy: (...args: unknown[]) => readLocalWorkingCopy(...args),
  isBrowserOffline: () => false,
}));
vi.mock("../inspector-workspace-commands", () => ({
  migrateInspectorDefaultCoordsIfNeeded: (...args: unknown[]) =>
    migrateInspectorDefaultCoordsIfNeeded(...args),
  saveInspectorWorkspaceDraft: (...args: unknown[]) => saveInspectorWorkspaceDraft(...args),
}));

import {
  fetchInspectorWorkspace,
  fetchInspectorWorkspaceReadOnly,
} from "../inspector-workspace-reads";
import { loadInspectorWorkspace } from "../inspector-workspace-model";

function submission(
  taskId: string,
  extra: Partial<PartyTaskSubmissionDto> = {},
): PartyTaskSubmissionDto {
  return {
    id: `sub-${taskId}`,
    taskId,
    kind: "field-inspection",
    status: "draft",
    propertyId: "p1",
    poNumber: "PO-1",
    // Blank coordinates: exactly the case the owner path would repair with a PUT.
    payload: { mapLatitude: "", mapLongitude: "" },
    updatedAtUtc: "2026-10-01T09:30:00.000Z",
    ...extra,
  };
}

beforeEach(() => {
  fetchPartySubmission.mockReset();
  readLocalWorkingCopy.mockReset();
  loadQueuedDraftPayload.mockReset();
  migrateInspectorDefaultCoordsIfNeeded.mockReset();
  saveInspectorWorkspaceDraft.mockReset();
  migrateInspectorDefaultCoordsIfNeeded.mockImplementation(async (draft: unknown) => draft);
  saveInspectorWorkspaceDraft.mockResolvedValue(undefined);
  readLocalWorkingCopy.mockResolvedValue(null);
  loadQueuedDraftPayload.mockResolvedValue(null);
});

describe("fetchInspectorWorkspaceReadOnly — the appraiser's read of the inspector's draft", () => {
  it("returns the draft with its status and last update, and never writes", async () => {
    fetchPartySubmission.mockResolvedValue(submission("ro-1"));

    const draft = await fetchInspectorWorkspaceReadOnly("ro-1");

    expect(draft).toMatchObject({
      taskId: "ro-1",
      status: "draft",
      updatedAtUtc: "2026-10-01T09:30:00.000Z",
    });
    // No coordinate migration (that PUT would 403 for the appraiser) and no save.
    expect(migrateInspectorDefaultCoordsIfNeeded).not.toHaveBeenCalled();
    expect(saveInspectorWorkspaceDraft).not.toHaveBeenCalled();
  });

  it("does not touch the inspector's cache, queued draft or local working copy", async () => {
    fetchPartySubmission.mockResolvedValue(submission("ro-2"));

    await fetchInspectorWorkspaceReadOnly("ro-2");

    expect(loadInspectorWorkspace("ro-2")).toBeNull();
    expect(readLocalWorkingCopy).not.toHaveBeenCalled();
    expect(loadQueuedDraftPayload).not.toHaveBeenCalled();
  });

  it("reads a submitted package the same way", async () => {
    fetchPartySubmission.mockResolvedValue(
      submission("ro-3", { status: "submitted", submittedAtUtc: "2026-10-02T08:00:00.000Z" }),
    );
    const draft = await fetchInspectorWorkspaceReadOnly("ro-3");
    expect(draft?.status).toBe("submitted");
    expect(migrateInspectorDefaultCoordsIfNeeded).not.toHaveBeenCalled();
  });

  it("returns null when there is no package", async () => {
    fetchPartySubmission.mockResolvedValue(null);
    expect(await fetchInspectorWorkspaceReadOnly("ro-4")).toBeNull();
  });

  it("shares one in-flight read per task but keeps the owner and read-only modes apart", async () => {
    const releases: Array<(value: PartyTaskSubmissionDto) => void> = [];
    fetchPartySubmission.mockImplementation(
      () => new Promise<PartyTaskSubmissionDto>((resolve) => releases.push(resolve)),
    );
    const a = fetchInspectorWorkspaceReadOnly("ro-5");
    const b = fetchInspectorWorkspaceReadOnly("ro-5");
    expect(a).toBe(b);
    expect(fetchPartySubmission).toHaveBeenCalledTimes(1);

    const owner = fetchInspectorWorkspace("ro-5");
    expect(owner).not.toBe(a);
    expect(fetchPartySubmission).toHaveBeenCalledTimes(2);

    for (const release of releases) release(submission("ro-5"));
    await Promise.all([a, owner]);
  });
});

describe("fetchInspectorWorkspace — the inspector's own read keeps repairing and caching", () => {
  it("runs the coordinate migration and fills the cache", async () => {
    fetchPartySubmission.mockResolvedValue(submission("own-1"));

    const draft = await fetchInspectorWorkspace("own-1");

    expect(migrateInspectorDefaultCoordsIfNeeded).toHaveBeenCalledTimes(1);
    expect(loadInspectorWorkspace("own-1")).toBe(draft);
  });
});
