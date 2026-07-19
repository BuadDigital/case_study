import { describe, expect, it } from "vitest";
import {
  canFinalizeGovernmentReviewWithGate,
  mergeGovernmentReviewWithKeyGate,
} from "../government-review-work-data";
import { governmentReviewTaskStatusBadge } from "../government-review-work-queue";
import type { WorkflowTask } from "../tasks-storage";

describe("government-review key gate helpers", () => {
  it("prefers envelope handoff for finalize overlay", () => {
    const merged = mergeGovernmentReviewWithKeyGate(
      {
        visitStatus: "completed",
        keysStatus: "pending",
        keyHandedToInspector: "no",
      },
      {
        source: "envelope",
        keysStatus: "received",
        keyHandedToInspector: "yes",
        keyAvailable: true,
      },
    );
    expect(merged.keysStatus).toBe("received");
    expect(merged.keyHandedToInspector).toBe("yes");
    expect(
      canFinalizeGovernmentReviewWithGate(
        {
          visitStatus: "completed",
          keysStatus: "pending",
          keyHandedToInspector: "no",
        },
        {
          source: "envelope",
          keysStatus: "received",
          keyHandedToInspector: "yes",
          keyAvailable: true,
        },
      ),
    ).toBe(true);
  });

  it("warns when keys received without envelope", () => {
    const merged = mergeGovernmentReviewWithKeyGate(
      {
        visitStatus: "completed",
        keysStatus: "received",
        keyHandedToInspector: "yes",
      },
      { source: "legacy", envelopeMissingWarning: true },
    );
    expect(merged.envelopeMissingWarning).toBe(true);
  });

  it("queue badge shows awaiting envelope advisory", () => {
    const task = {
      id: "t1",
      kind: "government-review",
      status: "open",
      poNumber: "PO-1",
      propertyId: "p1",
    } as WorkflowTask;
    const badge = governmentReviewTaskStatusBadge(
      task,
      {
        taskId: "t1",
        kind: "government-review",
        status: "draft",
        propertyId: "p1",
        poNumber: "PO-1",
        payload: {
          visitStatus: "completed",
          keysStatus: "received",
          keyHandedToInspector: "yes",
        },
        createdAtUtc: "",
        updatedAtUtc: "",
      } as any,
      { source: "legacy", envelopeMissingWarning: true },
    );
    expect(badge?.label).toBe("بانتظار الظرف");
  });
});
