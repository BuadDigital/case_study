import { act, renderHook, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { FIELD_INSPECTION_SUBMISSION_CHANGED_EVENT } from "@platform/app-shared/events/app-events";
import type { WorkflowTask } from "../../../lib/app-data/tasks";

const load = vi.hoisted(() => vi.fn());
const showToast = vi.hoisted(() => vi.fn());
vi.mock("../../../lib/app-data/inspector-workspace-reads", () => ({
  loadInspectorWorkspaceSnapshot: load,
}));
vi.mock("@platform/ui-kit", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@platform/ui-kit")>()),
  useToast: () => ({ showToast }),
}));

import { useInspectionPackage } from "../useInspectionPackage";

const task = (id: string) => ({ id }) as WorkflowTask;
// One object per task, as the panel's memoized task is: a new object reloads the package.
const t1 = task("t1");
const draft = (status: string, accepted = false) => ({
  status,
  featureValues: { assetSubject: "فيلا" },
  acceptedAtUtc: accepted ? "2026-11-19T10:00:00Z" : null,
});

describe("useInspectionPackage", () => {
  beforeEach(() => {
    load.mockReset();
    showToast.mockReset();
  });

  it("loads the task's package", async () => {
    load.mockResolvedValue(draft("submitted"));
    const { result } = renderHook(() => useInspectionPackage(t1));
    await waitFor(() => expect(result.current.loaded).toBe(true));
    expect(result.current).toMatchObject({ status: "submitted", assetSubject: "فيلا", accepted: false });
    expect(load).toHaveBeenCalledWith("t1");
  });

  it("never shows the previous task's package while the next one loads", async () => {
    load.mockResolvedValueOnce(draft("submitted", true)).mockReturnValueOnce(new Promise(() => {}));
    const { result, rerender } = renderHook(({ t }) => useInspectionPackage(t), {
      initialProps: { t: t1 },
    });
    await waitFor(() => expect(result.current.accepted).toBe(true));
    rerender({ t: task("t2") });
    expect(result.current).toMatchObject({ status: null, loaded: false, accepted: false });
  });

  it("reloads when the inspector's submission changes, and on reload", async () => {
    load.mockResolvedValue(draft("draft"));
    const { result } = renderHook(() => useInspectionPackage(t1));
    await waitFor(() => expect(result.current.loaded).toBe(true));
    load.mockResolvedValue(draft("submitted"));
    act(() => window.dispatchEvent(new Event(FIELD_INSPECTION_SUBMISSION_CHANGED_EVENT)));
    await waitFor(() => expect(result.current.status).toBe("submitted"));
    const calls = load.mock.calls.length;
    act(() => result.current.reload());
    await waitFor(() => expect(load.mock.calls.length).toBe(calls + 1));
  });

  it("shows the acceptance at once, then reloads", async () => {
    load.mockResolvedValueOnce(draft("submitted")).mockReturnValueOnce(new Promise(() => {}));
    const { result } = renderHook(() => useInspectionPackage(t1));
    await waitFor(() => expect(result.current.loaded).toBe(true));
    act(() => result.current.markAccepted());
    expect(result.current.accepted).toBe(true);
    expect(load).toHaveBeenCalledTimes(2);
  });

  it("clears the package and says why when the load fails", async () => {
    load.mockRejectedValue(new Error("تعذّر"));
    const { result } = renderHook(() => useInspectionPackage(t1));
    await waitFor(() => expect(showToast).toHaveBeenCalledWith("تعذّر", "error"));
    expect(result.current).toMatchObject({ status: null, loaded: false, accepted: false });
  });
});
