import { beforeEach, describe, expect, it, vi } from "vitest";

const decideEvaluatorRecallApi = vi.fn();
const getEvaluatorRecallApi = vi.fn();
const listEvaluatorRecallsApi = vi.fn();
const requestEvaluatorRecallApi = vi.fn();

vi.mock("@platform/api-client", () => ({
  decideEvaluatorRecallApi: (...args: unknown[]) =>
    decideEvaluatorRecallApi(...args),
  getEvaluatorRecallApi: (...args: unknown[]) =>
    getEvaluatorRecallApi(...args),
  listEvaluatorRecallsApi: (...args: unknown[]) =>
    listEvaluatorRecallsApi(...args),
  requestEvaluatorRecallApi: (...args: unknown[]) =>
    requestEvaluatorRecallApi(...args),
}));

const fetchPartySubmission = vi.fn();

vi.mock("../src/app-data/party-submission-api", () => ({
  fetchPartySubmission: (...args: unknown[]) => fetchPartySubmission(...args),
}));

vi.mock("../src/app-data/modules-api-config", () => ({
  prototypeModulesApiConfig: () => ({ baseUrl: "http://test", token: "t" }),
}));

const { getPartyTaskRecall } = await import(
  "../src/app-data/party-task-recall-model"
);
const { hydratePartyTaskRecalls } = await import(
  "../src/app-data/party-task-recall-reads"
);
const {
  approvePartyTaskRecall,
  rejectPartyTaskRecall,
  RECALL_DECISION_REFUSED_FALLBACK,
} = await import("../src/app-data/party-task-recall-commands");

const TASK_ID = "11111111-1111-1111-1111-111111111111";

function recallRow(status: string, reason = "") {
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

async function seedRecall(status: string, reason = "") {
  listEvaluatorRecallsApi.mockResolvedValue({
    ok: true,
    data: [recallRow(status, reason)],
  });
  await hydratePartyTaskRecalls({ force: true });
}

describe("recall decision — one call", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    fetchPartySubmission.mockResolvedValue({ status: "reopened" });
  });

  it("approves with a single decide call and refreshes the cached package", async () => {
    await seedRecall("pending", "الأسعار غير صحيحة");
    decideEvaluatorRecallApi.mockResolvedValue({
      ok: true,
      data: recallRow("approved", "الأسعار غير صحيحة"),
    });

    const result = await approvePartyTaskRecall(TASK_ID);

    expect(result.ok).toBe(true);
    expect(decideEvaluatorRecallApi).toHaveBeenCalledTimes(1);
    expect(decideEvaluatorRecallApi).toHaveBeenCalledWith(
      expect.anything(),
      TASK_ID,
      "approve",
      undefined,
    );
    expect(fetchPartySubmission).toHaveBeenCalledWith(TASK_ID);
    expect(getPartyTaskRecall(TASK_ID)?.status).toBe("approved");
  });

  it("rejects with the specialist note in the same decide call and leaves the package alone", async () => {
    await seedRecall("pending");
    decideEvaluatorRecallApi.mockResolvedValue({
      ok: true,
      data: { ...recallRow("rejected"), specialistNote: "الأسعار سليمة" },
    });

    const result = await rejectPartyTaskRecall(TASK_ID, "الأسعار سليمة");

    expect(result.ok).toBe(true);
    expect(decideEvaluatorRecallApi).toHaveBeenCalledWith(
      expect.anything(),
      TASK_ID,
      "reject",
      "الأسعار سليمة",
    );
    expect(fetchPartySubmission).not.toHaveBeenCalled();
    expect(getPartyTaskRecall(TASK_ID)?.status).toBe("rejected");
  });

  it("keeps the request pending when the server fails, and the same call retries it", async () => {
    await seedRecall("pending");
    decideEvaluatorRecallApi.mockResolvedValueOnce({ ok: false, kind: "server" });

    const failed = await approvePartyTaskRecall(TASK_ID);
    expect(failed.ok).toBe(false);
    expect(getPartyTaskRecall(TASK_ID)?.status).toBe("pending");

    decideEvaluatorRecallApi.mockResolvedValueOnce({
      ok: true,
      data: recallRow("approved"),
    });
    const retried = await approvePartyTaskRecall(TASK_ID);

    expect(retried.ok).toBe(true);
    expect(decideEvaluatorRecallApi).toHaveBeenCalledTimes(2);
    expect(getPartyTaskRecall(TASK_ID)?.status).toBe("approved");
  });

  it("shows the server's Arabic refusal after a deposit", async () => {
    await seedRecall("pending");
    decideEvaluatorRecallApi.mockResolvedValue({
      ok: false,
      kind: "validation",
      errors: { _: "أودع المقيّم تقريره" },
      message: "أودع المقيّم تقريره",
    });

    const result = await approvePartyTaskRecall(TASK_ID);

    expect(result).toEqual({ ok: false, error: "أودع المقيّم تقريره" });
    expect(getPartyTaskRecall(TASK_ID)?.status).toBe("pending");
  });

  it("falls back to a clear Arabic refusal when the server gave no text", async () => {
    await seedRecall("pending");
    decideEvaluatorRecallApi.mockResolvedValue({ ok: false, kind: "validation" });

    const result = await approvePartyTaskRecall(TASK_ID);

    expect(result).toEqual({ ok: false, error: RECALL_DECISION_REFUSED_FALLBACK });
  });

  it("explains a 403 — only the specialist decides", async () => {
    await seedRecall("pending");
    decideEvaluatorRecallApi.mockResolvedValue({ ok: false, kind: "forbidden" });

    const result = await approvePartyTaskRecall(TASK_ID);

    expect(result.ok).toBe(false);
    expect(result.ok === false && result.error).toContain("للأخصائي");
  });

  it("does nothing for an already decided request", async () => {
    await seedRecall("approved");

    const approved = await approvePartyTaskRecall(TASK_ID);
    const rejected = await rejectPartyTaskRecall(TASK_ID, "x");

    expect(approved.ok).toBe(true);
    expect(rejected.ok).toBe(true);
    expect(decideEvaluatorRecallApi).not.toHaveBeenCalled();
    expect(fetchPartySubmission).not.toHaveBeenCalled();
  });
});
