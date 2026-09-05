import { beforeEach, describe, expect, it, vi } from "vitest";
import type { PartyTaskSubmissionDto } from "@platform/api-client";

/**
 * Regression: overlapping draft writes must not lose fields. Each write reads
 * the cached submission and PUTs the whole payload, and the cache only advances
 * when the PUT resolves — so writes have to run one after another.
 */

type Pending = { resolve: () => void; reject: (err: Error) => void };

const cache = new Map<string, PartyTaskSubmissionDto>();
const putLog: Record<string, unknown>[] = [];
let pending: Pending[] = [];

vi.mock("@platform/app-shared/app-data/party-submission-api", () => ({
  getCachedPartySubmission: (taskId: string) => cache.get(taskId) ?? null,
  setCachedPartySubmission: (dto: PartyTaskSubmissionDto, taskId: string) => {
    cache.set(taskId, dto);
  },
  persistPartySubmissionPayload: async (
    taskId: string,
    payload: Record<string, unknown>,
  ) => {
    // The server answers only when the test lets it.
    await new Promise<void>((resolve, reject) => pending.push({ resolve, reject }));
    putLog.push(payload);
    const dto: PartyTaskSubmissionDto = {
      taskId,
      kind: "engineering-survey",
      status: "draft",
      payload,
    };
    cache.set(taskId, dto);
    return { ok: true as const, data: dto };
  },
  acceptPartySubmission: vi.fn(),
  reopenPartySubmission: vi.fn(),
  submitPartySubmission: vi.fn(),
  payloadFromDto: (dto: PartyTaskSubmissionDto) => dto.payload,
}));

vi.mock("@case-study/mfe/lib/app-data/tasks-storage", () => ({
  notifyTasksChanged: () => undefined,
}));

const { updateEngineeringSurveyDraft, awaitEngineeringSurveyDraftWrites } =
  await import("../src/lib/engineering-survey-submission-commands");

function seed(taskId: string) {
  cache.set(taskId, {
    taskId,
    kind: "engineering-survey",
    status: "draft",
    payload: { taskId, propertyId: "p1", poNumber: "PO-1", checklist: [] },
  });
}

async function answerNext() {
  await vi.waitFor(() => expect(pending.length).toBeGreaterThan(0));
  pending.shift()!.resolve();
}

describe("engineering survey draft write queue", () => {
  beforeEach(() => {
    cache.clear();
    putLog.length = 0;
    pending = [];
  });

  it("folds overlapping writes so the later PUT carries the earlier field", async () => {
    seed("t1");
    const first = updateEngineeringSurveyDraft("t1", { deedMatchesNature: "yes" });
    const second = updateEngineeringSurveyDraft("t1", { siteConfirmed: true });

    // Only the first write may be on the wire while it is unanswered.
    await vi.waitFor(() => expect(pending).toHaveLength(1));
    await new Promise((r) => setTimeout(r, 10));
    expect(pending).toHaveLength(1);

    await answerNext();
    await first;
    await answerNext();
    const result = await second;

    expect(putLog).toHaveLength(2);
    expect(putLog[0]).not.toHaveProperty("siteConfirmed");
    expect(putLog[1]).toMatchObject({ deedMatchesNature: "yes", siteConfirmed: true });
    expect(result).toMatchObject({ deedMatchesNature: "yes", siteConfirmed: true });
  });

  it("awaitEngineeringSurveyDraftWrites resolves only after the queue drains", async () => {
    seed("t2");
    const write = updateEngineeringSurveyDraft("t2", { latitude: 24.7 });
    let drained = false;
    const drain = awaitEngineeringSurveyDraftWrites("t2").then(() => {
      drained = true;
    });
    await new Promise((r) => setTimeout(r, 10));
    expect(drained).toBe(false);
    await answerNext();
    await write;
    await drain;
    expect(drained).toBe(true);
  });

  it("lets the next write proceed after a failed one", async () => {
    seed("t3");
    const failing = updateEngineeringSurveyDraft("t3", { latitude: 1 });
    await vi.waitFor(() => expect(pending).toHaveLength(1));
    pending.shift()!.reject(new Error("network"));
    await expect(failing).rejects.toThrow("network");

    const next = updateEngineeringSurveyDraft("t3", { longitude: 2 });
    await answerNext();
    await expect(next).resolves.toMatchObject({ longitude: 2 });
    expect(putLog).toHaveLength(1);
  });
});
