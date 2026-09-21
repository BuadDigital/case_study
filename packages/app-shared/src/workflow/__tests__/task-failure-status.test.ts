import { describe, expect, it } from "vitest";
import {
  FAILURE_OBSTRUCTED_BADGE,
  isTaskFailureObstructed,
} from "../task-failure-status";

describe("isTaskFailureObstructed", () => {
  it("flags an open task whose property has an unresolved failure", () => {
    expect(
      isTaskFailureObstructed({
        status: "open",
        phase: "case-study",
        propertyFailureBlocked: true,
      }),
    ).toBe(true);
  });

  it("flags a task that sits in the obstruction phase", () => {
    expect(
      isTaskFailureObstructed({ status: "blocked", phase: "obstruction" }),
    ).toBe(true);
  });

  it("leaves a finished task alone even if the property is flagged", () => {
    expect(
      isTaskFailureObstructed({
        status: "completed",
        phase: "done",
        propertyFailureBlocked: true,
      }),
    ).toBe(false);
  });

  it("does not flag a plain open task", () => {
    expect(isTaskFailureObstructed({ status: "open", phase: "bourse" })).toBe(false);
    expect(FAILURE_OBSTRUCTED_BADGE.label).toBe("متعذر");
  });
});
