import { beforeEach, describe, expect, it, vi } from "vitest";

/** Mirrors PARTY_SUBMISSION_LIST_CHUNK — 150 GUIDs stay under the 8 KB GET cap. */
const LIST_CHUNK = 150;

const listPartyTaskSubmissions = vi.fn();
const getPartyTaskSubmission = vi.fn();

vi.mock("@platform/api-client", () => ({
  listPartyTaskSubmissions: (...args: unknown[]) =>
    listPartyTaskSubmissions(...args),
  getPartyTaskSubmission: (...args: unknown[]) =>
    getPartyTaskSubmission(...args),
  acceptPartyTaskSubmission: vi.fn(),
  reopenPartyTaskSubmission: vi.fn(),
  savePartyTaskSubmission: vi.fn(),
  submitPartyTaskSubmission: vi.fn(),
}));

vi.mock("@platform/app-shared/app-data/work-orders-api-config", () => ({
  workOrdersApiConfig: () => ({ baseUrl: "http://test", token: "t" }),
  apiErrorMessage: () => "error",
  mutationFromApiResult: (result: { ok: boolean }) => result,
  resolveApiError: (_kind: string, _errors: unknown, fallback: string) =>
    fallback,
}));

const {
  prefetchPartySubmissionsForTasks,
  getCachedPartySubmission,
  setCachedPartySubmission,
} = await import("../src/app-data/party-submission-api");

function taskId(n: number): string {
  return `task-${String(n).padStart(4, "0")}`;
}

function submissionFor(id: string) {
  return {
    taskId: id,
    kind: "field-inspection",
    status: "submitted",
    payload: {},
    updatedAtUtc: "2026-01-01T00:00:00Z",
  };
}

describe("prefetchPartySubmissionsForTasks", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    listPartyTaskSubmissions.mockImplementation(
      (_config: unknown, ids: string[]) => ({
        ok: true,
        data: ids.map(submissionFor),
      }),
    );
  });

  it("splits a request larger than the GET url cap into batches", async () => {
    const ids = Array.from({ length: 500 }, (_, i) => taskId(i));

    await prefetchPartySubmissionsForTasks(ids);

    expect(listPartyTaskSubmissions).toHaveBeenCalledTimes(4);
    const batches = listPartyTaskSubmissions.mock.calls.map((call) => call[1] as string[]);
    expect(batches.map((batch) => batch.length)).toEqual([150, 150, 150, 50]);
    for (const batch of batches) {
      expect(batch.length).toBeLessThanOrEqual(LIST_CHUNK);
    }
  });

  it("caches submissions beyond the first chunk instead of evicting them", async () => {
    const ids = Array.from({ length: 500 }, (_, i) => taskId(i));

    await prefetchPartySubmissionsForTasks(ids);

    expect(getCachedPartySubmission(taskId(0))).not.toBeNull();
    expect(getCachedPartySubmission(taskId(350))).not.toBeNull();
    expect(getCachedPartySubmission(taskId(499))).not.toBeNull();
  });

  it("still clears ids the server reported nothing for", async () => {
    const present = taskId(1000);
    const absent = taskId(1001);
    setCachedPartySubmission(submissionFor(absent), absent);
    listPartyTaskSubmissions.mockResolvedValue({
      ok: true,
      data: [submissionFor(present)],
    });

    await prefetchPartySubmissionsForTasks([present, absent]);

    expect(getCachedPartySubmission(present)).not.toBeNull();
    expect(getCachedPartySubmission(absent)).toBeNull();
  });

  it("propagates a failed batch as an error", async () => {
    listPartyTaskSubmissions.mockResolvedValue({ ok: false, kind: "server" });

    await expect(
      prefetchPartySubmissionsForTasks([taskId(1), taskId(2)]),
    ).rejects.toThrow("تعذّر تحميل مسودات المهام");
  });

  it("uses the single-task endpoint for one id", async () => {
    getPartyTaskSubmission.mockResolvedValue({
      ok: true,
      data: submissionFor(taskId(7)),
    });

    await prefetchPartySubmissionsForTasks([taskId(7)]);

    expect(listPartyTaskSubmissions).not.toHaveBeenCalled();
    expect(getPartyTaskSubmission).toHaveBeenCalledTimes(1);
  });
});
