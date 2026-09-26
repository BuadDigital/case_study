import { describe, expect, it } from "vitest";
import {
  createInspectorWorkspaceDraft,
  inspectionCompletionStamp,
  inspectionLateUploadAtUtc,
} from "@platform/app-shared/app-data/inspector-workspace-data";
import { draftToPayload, payloadToDraft } from "../inspector-workspace-model";

function draft() {
  return createInspectorWorkspaceDraft({
    taskId: "task-1",
    propertyId: "prop-1",
    poNumber: "PO-1",
  });
}

describe("ق-10 on-site completion stamp", () => {
  it("stamps the completion moment into the inspection date and time", () => {
    const now = new Date(2026, 8, 24, 10, 32);
    const stamp = inspectionCompletionStamp(now);

    expect(stamp.completedOnSiteAtUtc).toBe(now.toISOString());
    expect(stamp.inspectionDate).toBe("2026-09-24");
    expect(stamp.inspectionTime).toBe("10:32");
  });

  it("travels in the payload and back", () => {
    const next = { ...draft(), completedOnSiteAtUtc: "2026-09-24T07:32:00.000Z" };
    const payload = draftToPayload(next);
    expect(payload.completedOnSiteAtUtc).toBe("2026-09-24T07:32:00.000Z");

    const read = payloadToDraft({
      taskId: "task-1",
      kind: "field-inspection",
      status: "submitted",
      payload,
      updatedAtUtc: "",
    });
    expect(read.completedOnSiteAtUtc).toBe("2026-09-24T07:32:00.000Z");
  });

  it("shows the upload moment only when it came well after completion", () => {
    const completedOnSiteAtUtc = "2026-09-24T07:30:00.000Z";
    expect(
      inspectionLateUploadAtUtc({
        completedOnSiteAtUtc,
        submittedAtUtc: "2026-09-24T07:31:00.000Z",
      }),
    ).toBeNull();
    expect(
      inspectionLateUploadAtUtc({
        completedOnSiteAtUtc,
        submittedAtUtc: "2026-09-24T10:05:00.000Z",
      }),
    ).toBe("2026-09-24T10:05:00.000Z");
    expect(
      inspectionLateUploadAtUtc({ completedOnSiteAtUtc: "", submittedAtUtc: null }),
    ).toBeNull();
  });
});

describe("§4.4 source fingerprint", () => {
  it("echoes the downloaded fingerprint with every save", () => {
    const payload = draftToPayload({ ...draft(), sourceFingerprint: "abc123" });
    expect(payload.sourceFingerprintSeen).toBe("abc123");
    expect(draftToPayload(draft())).not.toHaveProperty("sourceFingerprintSeen");
  });

  it("takes the server's current fingerprint from each reply", () => {
    const read = payloadToDraft(
      {
        taskId: "task-1",
        kind: "field-inspection",
        status: "draft",
        payload: { sourceFingerprintSeen: "old" },
        updatedAtUtc: "",
        sourceFingerprint: "new",
      },
      { sourceFingerprint: "old" },
    );
    expect(read.sourceFingerprint).toBe("new");
  });

  it("keeps the downloaded fingerprint when the draft is re-read from the offline queue", () => {
    const queued = draftToPayload({ ...draft(), sourceFingerprint: "downloaded" });
    const read = payloadToDraft({
      taskId: "task-1",
      kind: "field-inspection",
      status: "draft",
      payload: queued,
      updatedAtUtc: "",
    });
    expect(read.sourceFingerprint).toBe("downloaded");
    expect(draftToPayload(read).sourceFingerprintSeen).toBe("downloaded");
  });
});

describe("returned package read back offline", () => {
  it("stays «معادة للتصحيح» when rebuilt from the device's queued copy", async () => {
    const { queuedSubmissionStatus } = await import(
      "@platform/app-shared/app-data/party-submission-api"
    );
    expect(queuedSubmissionStatus({ status: "reopened" })).toBe("reopened");
    expect(queuedSubmissionStatus({ status: "draft" })).toBe("draft");
    expect(queuedSubmissionStatus(null)).toBe("draft");
  });
});
