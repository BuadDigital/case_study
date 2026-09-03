import { describe, expect, it } from "vitest";
import type { FailureRecord } from "@platform/app-shared/failures/failures-types";
import {
  isOperationsTaskBlockedByFailure,
  isOpsTaskFailurePauseReason,
  OPS_TASK_FAILURE_PAUSE_REASON,
} from "../operations-task-failure-obstruction";
import type { OperationsTask } from "../operations-tasks-model";
import type { PoIntakeRecord } from "../po-intake-data";

describe("operations-task-failure-obstruction", () => {
  it("matches the standard failure pause reason", () => {
    expect(isOpsTaskFailurePauseReason(OPS_TASK_FAILURE_PAUSE_REASON)).toBe(
      true,
    );
    expect(isOpsTaskFailurePauseReason("تعذر نشط — شيء آخر")).toBe(true);
    expect(isOpsTaskFailurePauseReason("ظرف طارئ")).toBe(false);
  });

  it("detects blocking failures on linked properties", () => {
    const task = {
      id: "t1",
      poNumber: "PO-1",
      deeds: ["111"],
      letterRows: [],
      scope: "work_order",
    } as unknown as OperationsTask;
    const poRecords = [
      {
        poNumber: "PO-1",
        properties: [
          {
            id: "prop-1",
            deedNumber: "111",
            realEstateRegNumber: "",
            identifierType: "deed",
            isRemoved: false,
          },
        ],
      } as PoIntakeRecord,
    ];
    const failures = [
      {
        id: "f1",
        poNumber: "PO-1",
        propertyId: "prop-1",
        deedNumber: "111",
        status: "internal",
        title: "تعذر",
      } as FailureRecord,
    ];
    expect(
      isOperationsTaskBlockedByFailure(task, failures, poRecords),
    ).toBe(true);
    expect(
      isOperationsTaskBlockedByFailure(
        task,
        [{ ...failures[0]!, status: "resolved" } as FailureRecord],
        poRecords,
      ),
    ).toBe(false);
  });
});
