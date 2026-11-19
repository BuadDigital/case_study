import { describe, expect, it } from "vitest";
import type { WorkflowTask } from "@platform/app-shared/workflow/task-types";
import { emptyProperty } from "../po-intake-data";
import {
  DISTRIBUTION_LOCKED_KEYS,
  editLiftsDistributionLock,
  isPropertyDistributed,
  keepDistributionLockedFields,
} from "../property-distribution-lock";

const task = (phase: string) =>
  ({ kind: "case-study-property", poNumber: "PO-1", propertyId: "p-1", phase }) as WorkflowTask;

describe("distribution lock (Omar 2026-11-15)", () => {
  it("locks from the confirmed distribution on", () => {
    expect(isPropertyDistributed("PO-1", "p-1", [])).toBe(false);
    for (const phase of ["enfath", "bourse", "distribution"]) {
      expect(isPropertyDistributed("PO-1", "p-1", [task(phase)])).toBe(false);
    }
    for (const phase of ["case-study", "obstruction", "done"]) {
      expect(isPropertyDistributed("PO-1", "p-1", [task(phase)])).toBe(true);
    }
  });

  it("locks the fields the parties work from, not the administrative ones", () => {
    for (const key of ["deedNumber", "deedDate", "locationMapUrl", "propertyType", "classification", "northBoundary"] as const) {
      expect(DISTRIBUTION_LOCKED_KEYS.has(key)).toBe(true);
    }
    // The area left the lock (Omar 2026-11-17): the specialist and the appraiser correct it.
    for (const key of ["area", "contacts", "requestNumber", "ownerName", "court", "assignmentDocFileNames"] as const) {
      expect(DISTRIBUTION_LOCKED_KEYS.has(key)).toBe(false);
    }
  });

  it("a whole-object replace keeps the locked values and the area, and takes the rest", () => {
    const current = { ...emptyProperty(), deedNumber: "111", area: "500", requestNumber: "R-1" };
    const incoming = { ...emptyProperty(), deedNumber: "999", area: "800", requestNumber: "R-2" };
    const kept = keepDistributionLockedFields(current, incoming);
    expect(kept.deedNumber).toBe("111");
    expect(kept.area).toBe("500");
    expect(kept.requestNumber).toBe("R-2");
  });
});

describe("editLiftsDistributionLock — «التعديل» (Omar 2026-11-18)", () => {
  const reopening = (over: Partial<{ propertyId: string; transactionId: string; reopensStudy: boolean; status: string }>) => ({
    propertyId: "p-2",
    transactionId: "t-1",
    reopensStudy: true,
    status: "open",
    ...over,
  });

  it("lifts the lock while a study reopening of the deed or its transaction is active", () => {
    expect(editLiftsDistributionLock([reopening({ propertyId: "p-1" })], "p-1", null)).toBe(true);
    expect(editLiftsDistributionLock([reopening({})], "p-1", "t-1")).toBe(true);
  });

  it("keeps it for a valuation-only, closed or other transaction's reopening", () => {
    expect(editLiftsDistributionLock([reopening({ reopensStudy: false })], "p-1", "t-1")).toBe(false);
    expect(editLiftsDistributionLock([reopening({ status: "closed" })], "p-1", "t-1")).toBe(false);
    expect(editLiftsDistributionLock([reopening({ transactionId: "t-9" })], "p-1", "t-1")).toBe(false);
  });
});
