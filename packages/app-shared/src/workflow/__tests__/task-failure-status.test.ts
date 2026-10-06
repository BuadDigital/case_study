import { describe, expect, it } from "vitest";
import {
  FAILURE_OBSTRUCTED_BADGE,
  isTaskFailureObstructed,
} from "../task-failure-status";

describe("isTaskFailureObstructed", () => {
  it("flags an open task whose property has an unresolved failure", () => {
    expect(
      isTaskFailureObstructed({
        kind: "case-study-property",
        status: "open",
        phase: "case-study",
        propertyFailureBlocked: true,
      }),
    ).toBe(true);
  });

  it("flags a task that sits in the obstruction phase", () => {
    expect(
      isTaskFailureObstructed({ kind: "case-study-property", status: "blocked", phase: "obstruction" }),
    ).toBe(true);
  });

  it("leaves a finished task alone even if the property is flagged", () => {
    expect(
      isTaskFailureObstructed({
        kind: "case-study-property",
        status: "completed",
        phase: "done",
        propertyFailureBlocked: true,
      }),
    ).toBe(false);
  });

  it("keeps flagging an open party task: its phase is born done and says nothing", () => {
    expect(
      isTaskFailureObstructed({
        kind: "property-appraisal",
        status: "open",
        phase: "done",
        propertyFailureBlocked: true,
      }),
    ).toBe(true);
  });

  it("does not flag a plain open task", () => {
    expect(isTaskFailureObstructed({ kind: "case-study-property", status: "open", phase: "bourse" })).toBe(false);
    expect(FAILURE_OBSTRUCTED_BADGE.label).toBe("متعذر");
  });
});
