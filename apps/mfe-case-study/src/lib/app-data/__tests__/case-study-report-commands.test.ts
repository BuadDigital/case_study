import { beforeEach, describe, expect, it, vi } from "vitest";

const issueCaseStudyReport = vi.fn();
const reopenCaseStudyReport = vi.fn();

vi.mock("@platform/api-client", () => ({
  issueCaseStudyReport: (...args: unknown[]) => issueCaseStudyReport(...args),
  reopenCaseStudyReport: (...args: unknown[]) => reopenCaseStudyReport(...args),
  saveCaseStudyReport: vi.fn(),
  savePartyCaseStudyReport: vi.fn(),
}));
vi.mock("../../work-orders-api-config", () => ({
  apiErrorMessage: (kind: string) => `api:${kind}`,
  resolveApiError: (
    kind: string,
    errors?: Record<string, string>,
    fallback?: string,
    message?: string,
  ) => message ?? errors?._ ?? Object.values(errors ?? {})[0] ?? fallback ?? kind,
  workOrdersApiConfig: () => ({ token: "t" }),
}));
vi.mock("@platform/app-shared/app-data/work-orders-api-config", () => ({
  notifyWorkOrdersChanged: vi.fn(),
}));
vi.mock("../tasks-model", () => ({ notifyTasksChanged: vi.fn() }));
vi.mock("../../evaluator-bridge", () => ({
  syncEvaluatorChecklistFromPartyCaseStudy: vi.fn(),
}));

import {
  issueCaseStudyReportDraft,
  reopenCaseStudyReportDraft,
} from "../case-study-report-commands";
import {
  caseStudyReportDraftToDto,
  emptyCaseStudyReportDraft,
} from "../case-study-report-model";

describe("issueCaseStudyReportDraft", () => {
  beforeEach(() => {
    issueCaseStudyReport.mockReset();
    reopenCaseStudyReport.mockReset();
  });

  it("maps the issued DTO back to a draft", async () => {
    const draft = emptyCaseStudyReportDraft("t1");
    issueCaseStudyReport.mockResolvedValue({
      ok: true,
      data: { ...caseStudyReportDraftToDto(draft), status: "issued" },
    });
    const result = await issueCaseStudyReportDraft(draft);
    expect(result).toMatchObject({ ok: true, draft: { taskId: "t1", status: "issued" } });
    expect(issueCaseStudyReport.mock.calls[0][1]).toBe("t1");
  });

  it("returns the missing question keys as a set", async () => {
    issueCaseStudyReport.mockResolvedValue({
      ok: false,
      kind: "validation",
      errors: {
        answers: "أسئلة ناقصة: 2 من 30",
        missingQuestionKeys: "deed_1,survey_0",
      },
    });
    const result = await issueCaseStudyReportDraft(emptyCaseStudyReportDraft("t1"));
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect([...result.missingQuestionKeys]).toEqual(["deed_1", "survey_0"]);
    expect(result.answersMessage).toBe("أسئلة ناقصة: 2 من 30");
  });

  it("keeps a generic failure as a plain message", async () => {
    issueCaseStudyReport.mockResolvedValue({
      ok: false,
      kind: "forbidden",
      message: "ليس لديك صلاحية لهذا الإجراء",
      errors: { _: "ليس لديك صلاحية لهذا الإجراء" },
    });
    const result = await issueCaseStudyReportDraft(emptyCaseStudyReportDraft("t1"));
    expect(result).toMatchObject({ ok: false, error: "ليس لديك صلاحية لهذا الإجراء" });
    if (!result.ok) expect(result.missingQuestionKeys.size).toBe(0);
  });
});

describe("reopenCaseStudyReportDraft", () => {
  beforeEach(() => {
    reopenCaseStudyReport.mockReset();
  });

  it("does not call the server for a short reason", async () => {
    const result = await reopenCaseStudyReportDraft("t1", "قصير", false);
    expect(result).toMatchObject({ ok: false, needsEnfazConfirmation: false });
    expect(reopenCaseStudyReport).not.toHaveBeenCalled();
  });

  it("flags the Enfaz handover refusal so the dialog can retry confirmed", async () => {
    reopenCaseStudyReport.mockResolvedValueOnce({
      ok: false,
      kind: "validation",
      errors: { enfazHandover: "سُلّمت المعاملة إلى إنفاذ" },
    });
    const first = await reopenCaseStudyReportDraft("t1", "سبب كافٍ للفتح", false);
    expect(first).toMatchObject({ ok: false, needsEnfazConfirmation: true });
    expect(reopenCaseStudyReport.mock.calls[0][2]).toEqual({
      reason: "سبب كافٍ للفتح",
      clearEnfazHandover: false,
    });

    reopenCaseStudyReport.mockResolvedValueOnce({
      ok: true,
      data: {
        report: {
          ...caseStudyReportDraftToDto(emptyCaseStudyReportDraft("t1")),
          status: "draft",
        },
        appraiserSubmitted: true,
        enfazHandoverCleared: true,
      },
    });
    const retry = await reopenCaseStudyReportDraft("t1", "سبب كافٍ للفتح", true);
    expect(reopenCaseStudyReport.mock.calls[1][2]).toMatchObject({
      clearEnfazHandover: true,
    });
    expect(retry).toMatchObject({
      ok: true,
      appraiserSubmitted: true,
      enfazHandoverCleared: true,
      draft: { status: "draft" },
    });
  });
});
