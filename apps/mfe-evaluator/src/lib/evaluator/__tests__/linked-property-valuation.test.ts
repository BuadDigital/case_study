import { describe, expect, it } from "vitest";
import type { WorkflowTask } from "@platform/app-shared/workflow/task-types";
import { holderAppraisalTaskFor } from "@platform/app-shared/workflow/task-types";
import { createEvaluatorDraft } from "../evaluator-window-data";
import { buildValuationReportLiveFill } from "../valuation-report-live-fill";
import { filterAppraiserListedTasks } from "../evaluator-queue";
import { linkedDeedsTotalArea } from "../../../components/evaluator/EvaluatorLinkedDeedsCard";

function task(over: Partial<WorkflowTask>): WorkflowTask {
  return {
    id: "t",
    kind: "property-appraisal",
    poNumber: "PO-1",
    propertyOrdinal: 1,
    title: "",
    phase: "case-study",
    assigneeRole: "real-estate-appraiser",
    assigneeName: "",
    status: "open",
    createdAt: "2026-10-19T00:00:00Z",
    updatedAt: "2026-10-19T00:00:00Z",
    ...over,
  };
}

describe("phase 5 — one valuation per transaction", () => {
  it("prints every deed of a linked property in the deed cells, else the property's own deed", () => {
    const draft = createEvaluatorDraft({ taskId: "t1", propertyId: "p1", poNumber: "PO-1" });
    const deeds = [
      { identifierType: "deed", deedNumber: "111", deedDate: "1440/01/01", isRemoved: false },
      { identifierType: "real_estate_reg", deedNumber: "", realEstateRegNumber: "REG-9", realEstateRegDate: "1441/02/02", isRemoved: false },
      { identifierType: "deed", deedNumber: "gone", isRemoved: true },
    ];
    const linked = buildValuationReportLiveFill({
      draft,
      property: { deedNumber: "111", deedDate: "1440/01/01", city: "جدة" } as never,
      transactionDeeds: deeds,
    });
    expect(linked.cells["رقم الصك"]).toBe("111 ، REG-9");
    expect(linked.cells["تاريخ الصك"]).toBe("1440/01/01 ، 1441/02/02");

    const alone = buildValuationReportLiveFill({
      draft,
      property: { deedNumber: "111", deedDate: "1440/01/01", city: "جدة" } as never,
      transactionDeeds: [deeds[0]!],
    });
    expect(alone.cells["رقم الصك"]).toBe("111");
  });

  it("hides a folded appraisal task from the appraiser queue and routes it to the holder's task", () => {
    const holder = task({ id: "h", propertyId: "holder" });
    const folded = task({ id: "f", propertyId: "other", transactionStudyHolderPropertyId: "holder" });
    const own = task({ id: "o", propertyId: "solo", transactionStudyHolderPropertyId: "solo" });
    expect(filterAppraiserListedTasks([holder, folded, own]).map((t) => t.id)).toEqual(["h", "o"]);
    expect(holderAppraisalTaskFor(folded, [holder, folded])?.id).toBe("h");
    expect(holderAppraisalTaskFor(own, [holder, own])).toBeNull();
    expect(holderAppraisalTaskFor(folded, [folded])).toBeNull();
  });

  it("sums the deed areas only when every deed has one", () => {
    expect(linkedDeedsTotalArea([{ area: "1,250" }, { area: "٧٥٠٫٥" }])).toBe("2,000.5 م²");
    expect(linkedDeedsTotalArea([{ area: "100" }, { area: null }])).toBe("—");
  });
});
