import { afterEach, describe, expect, it } from "vitest";
import {
  appraiserProgressPct,
  appraisalStageLabel,
  clearReportDraftStates,
  getReportDraftState,
  putReportDraftStates,
} from "../report-draft-state";

afterEach(() => clearReportDraftStates());

describe("appraisalStageLabel", () => {
  it("says nothing finer when there is no draft or it is still being prepared", () => {
    expect(appraisalStageLabel(undefined)).toBeNull();
    expect(appraisalStageLabel({ status: "none", reportStage: "draft" })).toBeNull();
    expect(appraisalStageLabel({ status: "preparing", reportStage: "draft" })).toBeNull();
  });

  it("a sent draft waits for the appraiser's approval", () => {
    const stage = appraisalStageLabel({ status: "sent", reportStage: "draft" });
    expect(stage?.group).toBe("draft_sent");
    expect(stage?.label).toBe("مسودة بانتظار اعتمادك");
  });

  it("an approved report waits for the deposit code", () => {
    expect(appraisalStageLabel({ status: "approved", reportStage: "deposit_issued" })?.group).toBe("approved");
    expect(appraisalStageLabel({ status: "approved", reportStage: "draft" })?.group).toBe("approved");
  });

  it("the final copy closes it, whatever the draft says", () => {
    expect(appraisalStageLabel({ status: "approved", reportStage: "final_issued" })?.group).toBe("closed");
  });
});

describe("the draft-state cache", () => {
  it("keeps the latest state per property", () => {
    putReportDraftStates([{ propertyId: "p1", status: "sent", reportStage: "draft" }]);
    expect(getReportDraftState("p1")?.status).toBe("sent");
    putReportDraftStates([{ propertyId: "p1", status: "approved", reportStage: "deposit_issued" }]);
    expect(getReportDraftState("p1")?.reportStage).toBe("deposit_issued");
    expect(getReportDraftState("p2")).toBeUndefined();
    expect(getReportDraftState(null)).toBeUndefined();
  });
});

describe("appraiserProgressPct", () => {
  const state = (progressPct?: number) => ({ status: "none" as const, reportStage: "draft" as const, progressPct });

  it("shows the server's ladder while he works", () => {
    expect(appraiserProgressPct({ state: state(30), packageSubmitted: false, completed: false })).toBe(30);
    expect(appraiserProgressPct({ state: undefined, packageSubmitted: false, completed: false })).toBe(0);
  });

  it("raises it to the hand-over rung once the package is submitted, never lowers a higher rung", () => {
    expect(appraiserProgressPct({ state: state(65), packageSubmitted: true, completed: false })).toBe(75);
    expect(appraiserProgressPct({ state: state(85), packageSubmitted: true, completed: false })).toBe(85);
  });

  it("is full when the task is completed", () => {
    expect(appraiserProgressPct({ state: state(10), packageSubmitted: false, completed: true })).toBe(100);
  });

  it("keeps the last ladder value when a single draft read arrives without one", () => {
    putReportDraftStates([{ propertyId: "p9", status: "none", reportStage: "draft", progressPct: 50 }]);
    putReportDraftStates([{ propertyId: "p9", status: "none", reportStage: "draft" }]);
    expect(getReportDraftState("p9")?.progressPct).toBe(50);
  });
});
