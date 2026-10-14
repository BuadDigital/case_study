import { describe, expect, it } from "vitest";
import { isPartyTaskDone } from "../task-done";

describe("isPartyTaskDone", () => {
  it("a party child is born in phase done and stays open until its status completes", () => {
    for (const kind of ["property-appraisal", "field-inspection", "engineering-survey"] as const) {
      expect(isPartyTaskDone({ kind, status: "open", phase: "done" })).toBe(false);
      expect(isPartyTaskDone({ kind, status: "completed", phase: "done" })).toBe(true);
    }
  });

  it("the case-study parent is done by status or by its done phase", () => {
    expect(isPartyTaskDone({ kind: "case-study-property", status: "open", phase: "done" })).toBe(true);
    expect(isPartyTaskDone({ kind: "case-study-property", status: "completed", phase: "case-study" })).toBe(true);
    expect(isPartyTaskDone({ kind: "case-study-property", status: "open", phase: "case-study" })).toBe(false);
  });
});
