import { beforeEach, describe, expect, it, vi } from "vitest";

const approveEvaluatorRecallApi = vi.fn();
const getEvaluatorRecallApi = vi.fn();
const listEvaluatorRecallsApi = vi.fn();
const rejectEvaluatorRecallApi = vi.fn();
const requestEvaluatorRecallApi = vi.fn();

vi.mock("@platform/api-client", () => ({
  approveEvaluatorRecallApi: (...args: unknown[]) =>
    approveEvaluatorRecallApi(...args),
  getEvaluatorRecallApi: (...args: unknown[]) =>
    getEvaluatorRecallApi(...args),
  listEvaluatorRecallsApi: (...args: unknown[]) =>
    listEvaluatorRecallsApi(...args),
  rejectEvaluatorRecallApi: (...args: unknown[]) =>
    rejectEvaluatorRecallApi(...args),
  requestEvaluatorRecallApi: (...args: unknown[]) =>
    requestEvaluatorRecallApi(...args),
}));

const fetchPartySubmission = vi.fn();
const reopenPartySubmission = vi.fn();

vi.mock("../src/app-data/party-submission-api", () => ({
  fetchPartySubmission: (...args: unknown[]) => fetchPartySubmission(...args),
  reopenPartySubmission: (...args: unknown[]) => reopenPartySubmission(...args),
}));

vi.mock("../src/app-data/modules-api-config", () => ({
  prototypeModulesApiConfig: () => ({ baseUrl: "http://test", token: "t" }),
}));

const {
  approvePartyTaskRecall,
  hydratePartyTaskRecalls,
  getPartyTaskRecall,
  partyTaskRecallReturnNote,
} = await import("../src/app-data/party-task-recall-storage");

const TASK_ID = "11111111-1111-1111-1111-111111111111";

function recallRow(status: string, reason: string) {
  return {
    id: "r1",
    taskId: TASK_ID,
    poNumber: "PO-900",
    propertyId: "p1",
    status,
    reason,
    specialistNote: "",
    requestedAtUtc: "2026-01-01T00:00:00Z",
    resolvedAtUtc: null,
  };
}

async function seedRecall(status: string, reason: string) {
  listEvaluatorRecallsApi.mockResolvedValue({
    ok: true,
    data: [recallRow(status, reason)],
  });
  await hydratePartyTaskRecalls({ force: true });
}

describe("approvePartyTaskRecall", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    fetchPartySubmission.mockResolvedValue({ status: "submitted" });
    reopenPartySubmission.mockResolvedValue({ ok: true, data: {} });
  });

  it("falls back to a default return note when the party gave no reason", async () => {
    await seedRecall("pending", "");
    approveEvaluatorRecallApi.mockResolvedValue({
      ok: true,
      data: recallRow("approved", ""),
    });

    const result = await approvePartyTaskRecall(TASK_ID);

    expect(result.ok).toBe(true);
    expect(reopenPartySubmission).toHaveBeenCalledWith(
      TASK_ID,
      "طلب استرجاع من الطرف",
    );
  });

  it("passes the party reason through when one was given", async () => {
    await seedRecall("pending", "الأسعار غير صحيحة");
    approveEvaluatorRecallApi.mockResolvedValue({
      ok: true,
      data: recallRow("approved", "الأسعار غير صحيحة"),
    });

    await approvePartyTaskRecall(TASK_ID);

    expect(reopenPartySubmission).toHaveBeenCalledWith(
      TASK_ID,
      "الأسعار غير صحيحة",
    );
  });

  it("reports failure when the reopen is rejected", async () => {
    await seedRecall("pending", "");
    approveEvaluatorRecallApi.mockResolvedValue({
      ok: true,
      data: recallRow("approved", ""),
    });
    reopenPartySubmission.mockResolvedValue({
      ok: false,
      error: "ملاحظة الإرجاع مطلوبة",
    });

    const result = await approvePartyTaskRecall(TASK_ID);

    expect(result).toEqual({ ok: false, error: "ملاحظة الإرجاع مطلوبة" });
    expect(getPartyTaskRecall(TASK_ID)?.status).toBe("approved");
  });

  it("retries only the reopen when the recall is already approved", async () => {
    await seedRecall("approved", "");

    const result = await approvePartyTaskRecall(TASK_ID);

    expect(result.ok).toBe(true);
    expect(approveEvaluatorRecallApi).not.toHaveBeenCalled();
    expect(reopenPartySubmission).toHaveBeenCalledWith(
      TASK_ID,
      "طلب استرجاع من الطرف",
    );
  });

  it("does not reopen again when the work is no longer submitted", async () => {
    await seedRecall("approved", "");
    fetchPartySubmission.mockResolvedValue({ status: "reopened" });

    const result = await approvePartyTaskRecall(TASK_ID);

    expect(result.ok).toBe(true);
    expect(reopenPartySubmission).not.toHaveBeenCalled();
  });

  it("keeps a rejected recall untouched", async () => {
    await seedRecall("rejected", "");

    const result = await approvePartyTaskRecall(TASK_ID);

    expect(result.ok).toBe(true);
    expect(approveEvaluatorRecallApi).not.toHaveBeenCalled();
    expect(reopenPartySubmission).not.toHaveBeenCalled();
  });

  it("uses the default note only for blank reasons", () => {
    expect(partyTaskRecallReturnNote("   ")).toBe("طلب استرجاع من الطرف");
    expect(partyTaskRecallReturnNote("سبب")).toBe("سبب");
  });
});
