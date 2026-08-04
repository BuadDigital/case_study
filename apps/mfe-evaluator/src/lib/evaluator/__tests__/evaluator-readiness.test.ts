import { describe, expect, it } from "vitest";
import type { WorkflowTask } from "@case-study/mfe";
import { inspectionGateForAppraisal } from "../evaluator-inspection-gate";
import {
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

describe("appraiser readiness — fieldInspectionCompleted", () => {
  it("unlocks when server flag is true without sibling inspection row", () => {
    const appraisal = baseAppraisal({ fieldInspectionCompleted: true });
    const tasks = [appraisal];

    expect(appraiserInspectionDone(appraisal, tasks)).toBe(true);
    expect(appraiserReadiness(appraisal, tasks)).toBe("ready");
    expect(inspectionGateForAppraisal(appraisal, tasks).ready).toBe(true);
  });

  it("stays gated when server flag is false without sibling row", () => {
    const appraisal = baseAppraisal({ fieldInspectionCompleted: false });
    const tasks = [appraisal];

    expect(appraiserInspectionDone(appraisal, tasks)).toBe(false);
    expect(appraiserReadiness(appraisal, tasks)).toBe("wait_inspection");
    expect(inspectionGateForAppraisal(appraisal, tasks).ready).toBe(false);
  });

  it("server flag overrides completed sibling in the list", () => {
    const appraisal = baseAppraisal({ fieldInspectionCompleted: false });
    const inspection = baseInspection({ status: "completed" });
    const tasks = [appraisal, inspection];

    expect(appraiserInspectionDone(appraisal, tasks)).toBe(false);
    expect(inspectionGateForAppraisal(appraisal, tasks).ready).toBe(false);
  });

  it("falls back to sibling scan when flag is absent (staff path)", () => {
    const appraisal = baseAppraisal();
    const inspection = baseInspection({ status: "completed" });
    const tasks = [appraisal, inspection];

    expect(appraiserInspectionDone(appraisal, tasks)).toBe(true);
    expect(appraiserReadiness(appraisal, tasks)).toBe("ready");
    expect(inspectionGateForAppraisal(appraisal, tasks).ready).toBe(true);
  });

  it("falls back to locked when no flag and no sibling", () => {
    const appraisal = baseAppraisal();
    const tasks = [appraisal];

    expect(appraiserInspectionDone(appraisal, tasks)).toBe(false);
    expect(appraiserReadiness(appraisal, tasks)).toBe("wait_inspection");
    expect(inspectionGateForAppraisal(appraisal, tasks).ready).toBe(false);
  });
});
