import { afterEach, describe, expect, it, vi } from "vitest";
import {
  isSnapshotFallbackActive,
  noteLiveRead,
  noteSnapshotFallback,
  resetSnapshotFallback,
  subscribeSnapshotFallback,
} from "../snapshot-fallback";
import { queryLoadFailed } from "../../query/query-load-state";

afterEach(() => resetSnapshotFallback());

describe("snapshot fallback flags", () => {
  it("is active while any source serves the cached copy", () => {
    expect(isSnapshotFallbackActive()).toBe(false);
    noteSnapshotFallback("po-records");
    noteSnapshotFallback("operations-tasks");
    expect(isSnapshotFallbackActive()).toBe(true);
    noteLiveRead("po-records");
    expect(isSnapshotFallbackActive()).toBe(true);
    noteLiveRead("operations-tasks");
    expect(isSnapshotFallbackActive()).toBe(false);
  });

  it("notifies only on a change", () => {
    const listener = vi.fn();
    const unsubscribe = subscribeSnapshotFallback(listener);
    noteSnapshotFallback("po-records");
    noteSnapshotFallback("po-records");
    noteLiveRead("operations-tasks");
    expect(listener).toHaveBeenCalledTimes(1);
    noteLiveRead("po-records");
    expect(listener).toHaveBeenCalledTimes(2);
    unsubscribe();
    noteSnapshotFallback("po-records");
    expect(listener).toHaveBeenCalledTimes(2);
  });
});

describe("queryLoadFailed", () => {
  it("fails only when the error left nothing to show", () => {
    expect(queryLoadFailed({ isError: true, data: undefined })).toBe(true);
    expect(queryLoadFailed({ isError: true, data: [] })).toBe(false);
    expect(queryLoadFailed({ isError: false, data: undefined })).toBe(false);
  });
});
