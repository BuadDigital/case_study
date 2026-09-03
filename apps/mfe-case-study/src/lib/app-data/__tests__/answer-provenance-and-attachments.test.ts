import { describe, expect, it } from "vitest";
import { answeredRows } from "../property-detail-party-submission-builders";

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
