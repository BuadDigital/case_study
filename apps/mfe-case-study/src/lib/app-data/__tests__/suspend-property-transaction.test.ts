import { beforeEach, describe, expect, it, vi } from "vitest";

const suspendFailure = vi.fn();
const suspendWorkflowTasksForProperty = vi.fn();
const isPropertySuspended = vi.fn();
const notifySuspendedTransactionsChanged = vi.fn();

vi.mock("@failures/mfe/lib/failures-repository", () => ({
  suspendFailure: (...args: unknown[]) => suspendFailure(...args),
}));

vi.mock("../suspended-transactions-model", () => ({
  isPropertySuspended: (...args: unknown[]) => isPropertySuspended(...args),
  notifySuspendedTransactionsChanged: (...args: unknown[]) =>
    notifySuspendedTransactionsChanged(...args),
}));

vi.mock("../tasks-storage", () => ({
  suspendWorkflowTasksForProperty: (...args: unknown[]) =>
    suspendWorkflowTasksForProperty(...args),
}));

const { suspendPropertyTransaction } = await import(
  "../suspend-property-transaction"
);

const failure = {
  id: "f1",
  poNumber: "PO-1",
  propertyId: "p1",
  title: "تعذر",
} as never;

describe("suspendPropertyTransaction", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    isPropertySuspended.mockReturnValue(false);
    suspendWorkflowTasksForProperty.mockResolvedValue(true);
  });

  it("does not block tasks when the failure suspend fails", async () => {
    suspendFailure.mockResolvedValue({
      ok: false,
      error: "لا يمكن تعليق هذا التعذر",
    });

    const result = await suspendPropertyTransaction({
      failure,
      supervisorNote: "ملاحظة",
    });

    expect(result).toEqual({
      ok: false,
      error: "لا يمكن تعليق هذا التعذر",
    });
    expect(suspendWorkflowTasksForProperty).not.toHaveBeenCalled();
    expect(notifySuspendedTransactionsChanged).not.toHaveBeenCalled();
  });

  it("reports a distinct error when tasks fail after a real suspend", async () => {
    suspendFailure.mockResolvedValue({ ok: true, data: failure });
    suspendWorkflowTasksForProperty.mockResolvedValue(false);

    const result = await suspendPropertyTransaction({
      failure,
      supervisorNote: "ملاحظة",
    });

    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.error).toContain("تم تعليق التعذر");
    }
    expect(notifySuspendedTransactionsChanged).not.toHaveBeenCalled();
  });

  it("succeeds only when both steps succeed", async () => {
    suspendFailure.mockResolvedValue({ ok: true, data: failure });

    const result = await suspendPropertyTransaction({
      failure,
      supervisorNote: "ملاحظة",
    });

    expect(result).toEqual({ ok: true });
    expect(suspendWorkflowTasksForProperty).toHaveBeenCalledWith(
      "PO-1",
      "p1",
      "ملاحظة",
    );
    expect(notifySuspendedTransactionsChanged).toHaveBeenCalled();
  });

  it("rejects when the property is already suspended", async () => {
    isPropertySuspended.mockReturnValue(true);

    const result = await suspendPropertyTransaction({
      failure,
      supervisorNote: "",
    });

    expect(result.ok).toBe(false);
    expect(suspendFailure).not.toHaveBeenCalled();
  });
});
