import { afterEach, describe, expect, it, vi } from "vitest";
import {
  initialEvaluatorTab,
  readRememberedEvaluatorTab,
  rememberEvaluatorTab,
  tabWaitsForApproaches,
} from "../evaluator-tab-memory";

afterEach(() => {
  window.sessionStorage.clear();
  vi.restoreAllMocks();
});

describe("evaluator tab memory (problem 19)", () => {
  it("a refresh reopens the tab the appraiser was on, per task", () => {
    rememberEvaluatorTab("t1", "review");
    rememberEvaluatorTab("t2", "final");
    expect(initialEvaluatorTab("t1", "basic")).toBe("review");
    expect(initialEvaluatorTab("t2", "basic")).toBe("final");
    expect(initialEvaluatorTab("t3", "basic")).toBe("basic");
  });

  it("an approach tab waits for the settings — the window opens on the default first", () => {
    rememberEvaluatorTab("t1", "market");
    expect(readRememberedEvaluatorTab("t1")).toBe("market");
    expect(tabWaitsForApproaches("market")).toBe(true);
    expect(tabWaitsForApproaches("output")).toBe(false);
    expect(initialEvaluatorTab("t1", "basic")).toBe("basic");
  });

  it("ignores junk and survives storage that throws", () => {
    window.sessionStorage.setItem("evaluator:tab:t1", "nope");
    expect(readRememberedEvaluatorTab("t1")).toBeNull();
    vi.spyOn(Storage.prototype, "getItem").mockImplementation(() => {
      throw new Error("blocked");
    });
    vi.spyOn(Storage.prototype, "setItem").mockImplementation(() => {
      throw new Error("blocked");
    });
    expect(() => rememberEvaluatorTab("t1", "final")).not.toThrow();
    expect(initialEvaluatorTab("t1", "basic")).toBe("basic");
  });
});
