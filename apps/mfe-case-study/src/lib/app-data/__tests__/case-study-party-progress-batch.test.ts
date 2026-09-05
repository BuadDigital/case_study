import { beforeEach, describe, expect, it, vi } from "vitest";
import type { CaseStudyInfoRolesMatrix } from "@settings/mfe/lib/app-data/case-study-info-roles-model";
import type { CaseStudyFormBatchDto, CaseStudyFormDto } from "@platform/api-client";
import {
  computePartyCaseStudyProgress,
  loadPartyCaseStudyAnswersForParents,
  partyCaseStudyAnswersFromBatch,
} from "../case-study-party-progress";
import type { WorkflowTask } from "../tasks-storage";

const getCaseStudyFormsBatch = vi.fn();

vi.mock("@platform/api-client", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@platform/api-client")>()),
  getCaseStudyFormsBatch: (...args: unknown[]) => getCaseStudyFormsBatch(...args),
}));

vi.mock("@platform/app-shared/app-data/work-orders-api-config", async (importOriginal) => ({
  ...(await importOriginal<
    typeof import("@platform/app-shared/app-data/work-orders-api-config")
  >()),
  requireWorkOrdersApiConfig: () => ({ token: "t", baseUrl: "http://api" }),
}));

function task(
  partial: Partial<WorkflowTask> & Pick<WorkflowTask, "id" | "kind">,
): WorkflowTask {
  return {
    poNumber: "PO-1",
    propertyOrdinal: 1,
    title: "t",
    phase: "case-study",
    status: "open",
    assigneeRole: "case-specialist",
    assigneeName: "x",
    createdAt: "2026-01-01T00:00:00.000Z",
    updatedAt: "2026-01-01T00:00:00.000Z",
    propertyId: "prop-1",
    ...partial,
  };
}

function form(taskId: string, answers: Record<string, string>): CaseStudyFormDto {
  return {
    taskId,
    status: "draft",
    currentStep: 1,
    requestNumber: "",
    requestDate: "",
    deedNumber: "",
    answers,
    deedRemarks: "",
    surveyRemarks: "",
    componentsRemarks: "",
    occupancyRemarks: "",
    meterType: "",
    meterNumber: "",
    hoaFee: "",
    sigDeed: "",
    sigApprover: "",
    sigDate: "",
  };
}

const parentA = task({ id: "A", kind: "case-study-property" });
const parentB = task({ id: "B", kind: "case-study-property" });
const inspA = task({
  id: "A-insp",
  kind: "field-inspection",
  parentTaskId: "A",
  assigneeRole: "field-inspector",
});
const engA = task({
  id: "A-eng",
  kind: "engineering-survey",
  parentTaskId: "A",
  assigneeRole: "engineering-office",
});
const engB = task({
  id: "B-eng",
  kind: "engineering-survey",
  parentTaskId: "B",
  assigneeRole: "engineering-office",
});
const tasks = [parentA, inspA, engA, parentB, engB];

const batch: CaseStudyFormBatchDto = {
  byParentTaskId: {
    a: {
      parentTaskId: "a",
      parent: form("a", { survey_0: "A" }),
      partyFormsByChildTaskId: {
        "a-insp": form("a-insp", { survey_1: "B", comp_0: "A" }),
        "a-eng": form("a-eng", { survey_0: "NA" }),
      },
    },
  },
};

describe("loadPartyCaseStudyAnswersForParents", () => {
  beforeEach(() => {
    getCaseStudyFormsBatch.mockReset();
  });

  it("makes one batch request for every listed parent and folds answers per party", async () => {
    getCaseStudyFormsBatch.mockResolvedValue({ ok: true, data: batch });

    const byParent = await loadPartyCaseStudyAnswersForParents(
      [parentA, parentB],
      tasks,
    );

    expect(getCaseStudyFormsBatch).toHaveBeenCalledTimes(1);
    expect(getCaseStudyFormsBatch.mock.calls[0]?.[1]).toEqual(["A", "B"]);
    expect(byParent.get("A")).toEqual({
      specA: { survey_0: "A" },
      insp: { survey_1: "B", comp_0: "A" },
      eng: { survey_0: "NA" },
    });
    // A parent absent from the batch (hidden / gone) reads as "no answers".
    expect(byParent.get("B")).toEqual({ specA: {} });
  });

  it("chunks at the server cap", async () => {
    getCaseStudyFormsBatch.mockResolvedValue({
      ok: true,
      data: { byParentTaskId: {} },
    });
    const parents = Array.from({ length: 101 }, (_, i) =>
      task({ id: `P${i}`, kind: "case-study-property" }),
    );

    await loadPartyCaseStudyAnswersForParents(parents, parents);

    expect(getCaseStudyFormsBatch).toHaveBeenCalledTimes(2);
    expect(getCaseStudyFormsBatch.mock.calls[0]?.[1]).toHaveLength(100);
    expect(getCaseStudyFormsBatch.mock.calls[1]?.[1]).toHaveLength(1);
  });

  it("surfaces a failed batch instead of silently showing zero progress", async () => {
    getCaseStudyFormsBatch.mockResolvedValue({ ok: false, kind: "server" });

    await expect(
      loadPartyCaseStudyAnswersForParents([parentA], tasks),
    ).rejects.toThrow();
  });
});

describe("partyCaseStudyAnswersFromBatch", () => {
  const matrix: CaseStudyInfoRolesMatrix = {
    survey_0: { eng: "primary", insp: "primary" },
    survey_1: { eng: "primary", insp: "primary" },
    comp_0: { insp: "primary" },
  };

  it("feeds the same progress the per-row loader produced", () => {
    const answers = partyCaseStudyAnswersFromBatch(parentA, tasks, {
      parent: { answers: { survey_0: "A" } } as never,
      partyByChildTaskId: new Map([
        ["a-insp", { answers: { survey_1: "B", comp_0: "A" } } as never],
        ["a-eng", { answers: { survey_0: "NA" } } as never],
      ]),
    });
    const rows = computePartyCaseStudyProgress(matrix, answers, {
      includeSpecialistAnswers: false,
    });

    expect(rows.find((r) => r.partyId === "insp")).toMatchObject({
      answered: 2,
      total: 3,
      pct: 67,
    });
    expect(rows.find((r) => r.partyId === "eng")).toMatchObject({
      answered: 1,
      total: 2,
      pct: 50,
    });
  });

  it("treats a missing parent as no answers for every party", () => {
    expect(partyCaseStudyAnswersFromBatch(parentA, tasks, undefined)).toEqual({
      specA: {},
    });
  });
});
