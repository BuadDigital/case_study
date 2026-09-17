import { describe, expect, it } from "vitest";
import { homePageIdForRole, isTaskReassignedAwayNotice } from "../party-reassignment-notice-state";

describe("isTaskReassignedAwayNotice", () => {
  const taskId = "3fa85f64-5717-4562-b3fc-2c963f66afa6";

  it("matches a distribution-replaced notice for this exact task", () => {
    expect(
      isTaskReassignedAwayNotice(taskId, {
        entityType: "task",
        entityId: taskId,
        sourceEvent: `distribution-replaced:${taskId}:2026-01-01T00:00:00.000Z`,
      }),
    ).toBe(true);
  });

  it("ignores a replaced notice for a different task", () => {
    expect(
      isTaskReassignedAwayNotice(taskId, {
        entityType: "task",
        entityId: "other-task-id",
        sourceEvent: `distribution-replaced:other-task-id:2026-01-01T00:00:00.000Z`,
      }),
    ).toBe(false);
  });

  it("ignores non-task entities and other notification kinds for the same task", () => {
    expect(
      isTaskReassignedAwayNotice(taskId, {
        entityType: "property",
        entityId: taskId,
        sourceEvent: `distribution-replaced:${taskId}:2026-01-01T00:00:00.000Z`,
      }),
    ).toBe(false);
    expect(
      isTaskReassignedAwayNotice(taskId, {
        entityType: "task",
        entityId: taskId,
        sourceEvent: `distribution-assigned:${taskId}`,
      }),
    ).toBe(false);
  });

  it("handles a missing item", () => {
    expect(isTaskReassignedAwayNotice(taskId, null)).toBe(false);
  });
});

describe("homePageIdForRole", () => {
  it("resolves each redistributable party role to its own queue", () => {
    expect(homePageIdForRole("field-inspector")).toBe("active-inspection");
    expect(homePageIdForRole("engineering-office")).toBe("active-survey");
    expect(homePageIdForRole("real-estate-appraiser")).toBe("property-appraisal");
  });

  it("has no home page for roles تعديل إسناد الأطراف never reassigns", () => {
    expect(homePageIdForRole("case-specialist")).toBeNull();
    expect(homePageIdForRole("section-supervisor")).toBeNull();
  });
});
