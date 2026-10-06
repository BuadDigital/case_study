import { beforeEach, describe, expect, it, vi } from "vitest";

const readGate = vi.fn();
const loadPartyDraft = vi.fn();
const savePartyDraft = vi.fn();
const loadSubmission = vi.fn();
const saveSubmission = vi.fn();
const submitSubmission = vi.fn();
const syncChecklist = vi.fn();
const ensureOpen = vi.fn();
const snapshot = vi.fn();
const clearRecall = vi.fn();

vi.mock("../evaluator-submit-gates", () => ({
  readFreshStudyReportGate: (...a: unknown[]) => readGate(...a),
}));
vi.mock("../../case-study-bridge", () => ({
  loadPartyCaseStudyReportDraft: (...a: unknown[]) => loadPartyDraft(...a),
  savePartyCaseStudyReportDraft: (...a: unknown[]) => savePartyDraft(...a),
}));
vi.mock("../evaluator-submission-model", () => ({
  loadEvaluatorSubmission: (...a: unknown[]) => loadSubmission(...a),
}));
vi.mock("../evaluator-submission-commands", () => ({
  saveEvaluatorSubmission: (...a: unknown[]) => saveSubmission(...a),
  submitEvaluatorSubmission: (...a: unknown[]) => submitSubmission(...a),
  syncEvaluatorChecklistFromPartyCaseStudy: (...a: unknown[]) => syncChecklist(...a),
}));
vi.mock("../issue-valuation-report", () => ({
  ensureOpenValuationRequest: (...a: unknown[]) => ensureOpen(...a),
  reservedNumberFromValuationRequest: () => "VR-0001",
  snapshotIssuedValuationReport: (...a: unknown[]) => snapshot(...a),
}));
vi.mock("@platform/app-shared/app-data/party-task-recall-model", () => ({
  clearPartyTaskRecall: (...a: unknown[]) => clearRecall(...a),
}));

import { finalizeAppraiserSubmission } from "../finalize-appraiser-submission";

const draftSubmission = {
  taskId: "a1",
  propertyId: "p1",
  status: "draft",
  reportNo: "",
  reportIssueDate: "",
  appraisalDate: "",
};

beforeEach(() => {
  for (const m of [
    readGate,
    loadPartyDraft,
    savePartyDraft,
    loadSubmission,
    saveSubmission,
    submitSubmission,
    syncChecklist,
    ensureOpen,
    snapshot,
    clearRecall,
  ]) {
    m.mockReset();
  }
  readGate.mockResolvedValue({ ready: true });
  loadPartyDraft.mockResolvedValue({ taskId: "a1", status: "draft", answers: {} });
  loadSubmission.mockReturnValue(draftSubmission);
  saveSubmission.mockResolvedValue(draftSubmission);
  ensureOpen.mockResolvedValue({ id: "vr1" });
  submitSubmission.mockResolvedValue({ ok: true, submission: { ...draftSubmission, status: "submitted" } });
});

describe("finalizeAppraiserSubmission", () => {
  it("does nothing with side effects while the study report is not issued", async () => {
    readGate.mockResolvedValue({ ready: false, reason: "لم يصدر" });

    const res = await finalizeAppraiserSubmission("a1", "key");

    expect(res).toEqual({ ok: false, message: "لم يصدر" });
    expect(readGate).toHaveBeenCalledWith("a1");
    expect(loadPartyDraft).not.toHaveBeenCalled();
    expect(syncChecklist).not.toHaveBeenCalled();
    expect(ensureOpen).not.toHaveBeenCalled();
    expect(snapshot).not.toHaveBeenCalled();
    expect(saveSubmission).not.toHaveBeenCalled();
    expect(submitSubmission).not.toHaveBeenCalled();
    expect(savePartyDraft).not.toHaveBeenCalled();
  });

  it("reads the fresh flag before the first side effect", async () => {
    const order: string[] = [];
    readGate.mockImplementation(async () => {
      order.push("gate");
      return { ready: true };
    });
    ensureOpen.mockImplementation(async () => {
      order.push("ensureOpen");
      return { id: "vr1" };
    });
    saveSubmission.mockImplementation(async () => {
      order.push("save");
      return draftSubmission;
    });
    submitSubmission.mockImplementation(async () => {
      order.push("submit");
      return { ok: true, submission: draftSubmission };
    });

    await finalizeAppraiserSubmission("a1", "key");

    expect(order[0]).toBe("gate");
    expect(order).toEqual(["gate", "ensureOpen", "save", "submit"]);
  });

  it("never writes the party draft after a successful submit", async () => {
    const res = await finalizeAppraiserSubmission("a1", "key");

    expect(res.ok).toBe(true);
    expect(submitSubmission).toHaveBeenCalledWith("a1", "key");
    expect(clearRecall).toHaveBeenCalledWith("a1");
    expect(savePartyDraft).not.toHaveBeenCalled();
  });

  it("returns the submit failure untouched and does not clear the recall", async () => {
    submitSubmission.mockResolvedValue({ ok: false, message: "فشل" });

    const res = await finalizeAppraiserSubmission("a1");

    expect(res).toEqual({ ok: false, message: "فشل" });
    expect(clearRecall).not.toHaveBeenCalled();
    expect(savePartyDraft).not.toHaveBeenCalled();
  });
});
