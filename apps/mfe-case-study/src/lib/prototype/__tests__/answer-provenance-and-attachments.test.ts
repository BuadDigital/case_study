import { describe, expect, it } from "vitest";
import { answeredRows } from "../property-detail-party-submission-builders";
import { toDurableGovernmentReviewKeysProof } from "../government-review-keys-proof";
import type { GovernmentReviewKeysProofFile } from "../government-review-work-data";

describe("answer provenance mapping", () => {
  it("maps provenance onto property-detail answer rows", () => {
    const rows = answeredRows(
      { deed_1: "A", deed_2: null },
      {
        deed_1: {
          value: "A",
          answeredByName: "المعاين أحمد",
          answeredByUserId: "u-1",
          answeredAtUtc: "2026-07-01T10:00:00.000Z",
          sourceRole: "field-inspector",
          workflowTaskId: "task-1",
        },
      },
      "task-1",
    );

    expect(rows).toHaveLength(1);
    expect(rows[0]?.answeredByName).toBe("المعاين أحمد");
    expect(rows[0]?.sourceRole).toBe("field-inspector");
    expect(rows[0]?.taskId).toBe("task-1");
  });
});

describe("government-review durable keys proof", () => {
  it("strips dataUrl when attachmentId is present", () => {
    const file: GovernmentReviewKeysProofFile = {
      id: "p1",
      fileName: "proof.jpg",
      mimeType: "image/jpeg",
      dataUrl: "data:image/jpeg;base64,abc",
      attachmentId: "aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa",
      sizeBytes: 12,
    };
    const durable = toDurableGovernmentReviewKeysProof(file);
    expect(durable.attachmentId).toBe(file.attachmentId);
    expect(durable.dataUrl).toBeUndefined();
    expect(durable.fileName).toBe("proof.jpg");
  });

  it("keeps legacy dataUrl when no attachmentId", () => {
    const file: GovernmentReviewKeysProofFile = {
      id: "p2",
      fileName: "legacy.pdf",
      mimeType: "application/pdf",
      dataUrl: "data:application/pdf;base64,xyz",
    };
    expect(toDurableGovernmentReviewKeysProof(file).dataUrl).toBe(file.dataUrl);
  });
});
