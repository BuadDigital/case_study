import { describe, expect, it, vi } from "vitest";

vi.mock("@failures/mfe", () => ({
  getPropertyFailureFromCache: () => null,
}));

const {
  isListedQueueTask,
  isTaskOnSuspendedProperty,
} = await import("../suspended-transactions-storage");

// isPropertySuspended reads memoryList + failure cache; with empty memory and
// mocked null failure, only status gating is exercised here.

describe("isListedQueueTask", () => {
  const open = {
    poNumber: "PO-1",
    propertyId: "p1",
    status: "open",
  };

  it("keeps open and blocked tasks", () => {
    expect(isListedQueueTask(open)).toBe(true);
    expect(isListedQueueTask({ ...open, status: "blocked" })).toBe(true);
  });

  it("drops completed and cancelled unless includeAllStatuses", () => {
    expect(isListedQueueTask({ ...open, status: "completed" })).toBe(false);
    expect(isListedQueueTask({ ...open, status: "cancelled" })).toBe(false);
    expect(
      isListedQueueTask(
        { ...open, status: "completed" },
        { includeAllStatuses: true },
      ),
    ).toBe(true);
  });

  it("never lists a task without a property id as suspended", () => {
    expect(
      isTaskOnSuspendedProperty({ poNumber: "PO-1", propertyId: undefined }),
    ).toBe(false);
  });
});
