import { describe, expect, it } from "vitest";
import type { WorkflowTask } from "@platform/app-shared/workflow/task-types";
import { inspectionGateForAppraisal } from "../evaluator-inspection-gate";
import {
  appraiserInspectionAccepted,
  appraiserInspectionDone,
  appraiserReadiness,
} from "../evaluator-readiness";

const baseAppraisal = (
  overrides: Partial<WorkflowTask> = {},
): WorkflowTask =>
  ({
    id: "a1",
    kind: "property-appraisal",
    poNumber: "PO-1",
    propertyId: "p1",
    parentTaskId: "parent",
    propertyOrdinal: 1,
    title: "تقييم",
    phase: "work",
    assigneeRole: "real-estate-appraiser",
    assigneeName: "مقيّم",
    status: "open",
    createdAt: "2026-01-01T00:00:00.000Z",
    updatedAt: "2026-01-01T00:00:00.000Z",
    ...overrides,
  }) as WorkflowTask;

const baseInspection = (
  overrides: Partial<WorkflowTask> = {},
): WorkflowTask =>
  ({
    id: "i1",
    kind: "field-inspection",
    poNumber: "PO-1",
    propertyId: "p1",
    parentTaskId: "parent",
    propertyOrdinal: 1,
    title: "معاينة",
    phase: "work",
    assigneeRole: "field-inspector",
    assigneeName: "معاين",
    status: "open",
    createdAt: "2026-01-01T00:00:00.000Z",
    updatedAt: "2026-01-01T00:00:00.000Z",
    ...overrides,
  }) as WorkflowTask;

describe("appraiser readiness — specialist-accepted inspection", () => {
  it("unlocks only when specialist accepted the inspection package", () => {
    const appraisal = baseAppraisal({
      fieldInspectionCompleted: true,
      fieldInspectionAccepted: true,
    });
    const tasks = [appraisal];

    expect(appraiserInspectionDone(appraisal, tasks)).toBe(true);
    expect(appraiserInspectionAccepted(appraisal, tasks)).toBe(true);
    expect(appraiserReadiness(appraisal, tasks)).toBe("ready");
    expect(inspectionGateForAppraisal(appraisal, tasks).ready).toBe(true);
  });

  it("stays gated when inspection completed but not accepted", () => {
    const appraisal = baseAppraisal({
      fieldInspectionCompleted: true,
      fieldInspectionAccepted: false,
    });
    const tasks = [appraisal];

    expect(appraiserInspectionDone(appraisal, tasks)).toBe(true);
    expect(appraiserReadiness(appraisal, tasks)).toBe("wait_specialist");
    expect(inspectionGateForAppraisal(appraisal, tasks).ready).toBe(false);
  });

  it("stays gated when server accepted flag is false without sibling row", () => {
    const appraisal = baseAppraisal({ fieldInspectionAccepted: false });
    const tasks = [appraisal];

    expect(appraiserInspectionAccepted(appraisal, tasks)).toBe(false);
    expect(appraiserReadiness(appraisal, tasks)).toBe("wait_inspection");
    expect(inspectionGateForAppraisal(appraisal, tasks).ready).toBe(false);
  });

  it("completed sibling without accept stamp is monitor-only", () => {
    const appraisal = baseAppraisal();
    const inspection = baseInspection({ status: "completed" });
    const tasks = [appraisal, inspection];

    expect(appraiserInspectionDone(appraisal, tasks)).toBe(true);
    expect(appraiserReadiness(appraisal, tasks)).toBe("wait_specialist");
    expect(inspectionGateForAppraisal(appraisal, tasks).ready).toBe(false);
  });

  it("falls back to locked when no flag and no sibling", () => {
    const appraisal = baseAppraisal();
    const tasks = [appraisal];

    expect(appraiserInspectionDone(appraisal, tasks)).toBe(false);
    expect(appraiserReadiness(appraisal, tasks)).toBe("wait_inspection");
    expect(inspectionGateForAppraisal(appraisal, tasks).ready).toBe(false);
  });

  it("survey pending does not block start once inspection is accepted", () => {
    const appraisal = baseAppraisal({
      fieldInspectionCompleted: true,
      fieldInspectionAccepted: true,
    });
    const survey = {
      ...baseInspection({
        id: "s1",
        kind: "engineering-survey" as const,
        assigneeRole: "engineering-office",
        status: "open",
      }),
    } as WorkflowTask;
    const tasks = [appraisal, survey];

    expect(appraiserReadiness(appraisal, tasks)).toBe("ready");
    expect(inspectionGateForAppraisal(appraisal, tasks).ready).toBe(true);
  });
});
