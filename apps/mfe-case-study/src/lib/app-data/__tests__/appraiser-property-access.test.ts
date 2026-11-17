import { describe, expect, it } from "vitest";
import {
  appraiserAssignedToProperty,
  editsOnlyAssignedProperties,
} from "../appraiser-property-access";
import type { WorkflowTask } from "../tasks";

const appraisal = (over: Partial<WorkflowTask>): WorkflowTask => ({
  id: "t1",
  kind: "property-appraisal",
  poNumber: "PO-1",
  propertyId: "p1",
  propertyOrdinal: 1,
  title: "تقييم",
  phase: "done",
  assigneeRole: "real-estate-appraiser",
  assigneeName: "مقيم",
  status: "open",
  createdAt: "2026-11-17T00:00:00.000Z",
  updatedAt: "2026-11-17T00:00:00.000Z",
  ...over,
});

describe("appraiser edits only assigned properties (2026-11-17)", () => {
  it("limits the appraiser only", () => {
    expect(editsOnlyAssignedProperties("real-estate-appraiser")).toBe(true);
    expect(editsOnlyAssignedProperties("case-specialist")).toBe(false);
  });

  it("matches the property, or a deed of the same transaction", () => {
    const tasks = [appraisal({ propertyId: "p1", transactionId: "tx1" })];
    expect(appraiserAssignedToProperty(tasks, "p1", null)).toBe(true);
    expect(appraiserAssignedToProperty(tasks, "p2", "tx1")).toBe(true);
    expect(appraiserAssignedToProperty(tasks, "p2", "tx2")).toBe(false);
    expect(appraiserAssignedToProperty(tasks, null, null)).toBe(false);
  });

  it("ignores cancelled tasks and other kinds", () => {
    expect(appraiserAssignedToProperty([appraisal({ status: "cancelled" })], "p1", null)).toBe(false);
    expect(appraiserAssignedToProperty([appraisal({ kind: "field-inspection" })], "p1", null)).toBe(false);
  });
});
