import { describe, expect, it } from "vitest";
import { emptyCaseStudyReportDraft } from "../case-study-report-model";
import {
  buildCaseStudyReportModel,
  caseStudyReportDeeds,
} from "../case-study-report-document-model";
import { buildCaseStudyReportBodyHtml } from "../case-study-report-render";
import type { WorkflowTask } from "../tasks";

const task: WorkflowTask = {
  id: "task-1",
  kind: "case-study-property",
  poNumber: "PO-2026-001",
  propertyOrdinal: 1,
  title: "",
  phase: "case-study",
  assigneeRole: "case-specialist",
  assigneeName: "",
  status: "open",
  createdAt: "2026-10-19T00:00:00Z",
  updatedAt: "2026-10-19T00:00:00Z",
};

describe("caseStudyReportDeeds (phase 4 — one study per transaction)", () => {
  it("is absent for a one-deed transaction so the report reads as before", () => {
    expect(caseStudyReportDeeds([{ propertyId: "a", poNumber: "PO-1", deedNumber: "1", area: "100" }])).toBeUndefined();
    expect(caseStudyReportDeeds(undefined)).toBeUndefined();
  });

  it("lists every live deed, labels registry deeds by registry number and sums the areas", () => {
    const deeds = caseStudyReportDeeds([
      { propertyId: "a", poNumber: "PO-2026-001", deedNumber: "310105", area: "1,250" },
      { propertyId: "b", poNumber: "PO-2026-002", deedNumber: "", realEstateRegNumber: "REG-9", identifierType: "real_estate_reg", area: "٧٥٠٫٥ م²" },
      { propertyId: "c", poNumber: "PO-2026-003", deedNumber: "gone", area: "1", isRemoved: true },
    ]);
    expect(deeds?.rows.map((d) => d.label)).toEqual(["310105", "REG-9"]);
    expect(deeds?.totalArea).toBe("2,000.5 م²");
  });

  it("shows no total when any deed area is missing", () => {
    const deeds = caseStudyReportDeeds([
      { propertyId: "a", poNumber: "PO-1", deedNumber: "1", area: "100" },
      { propertyId: "b", poNumber: "PO-2", deedNumber: "2", area: null },
    ]);
    expect(deeds?.totalArea).toBe("—");
    expect(deeds?.rows[1]?.area).toBe("—");
  });

  it("names every deed in the approval row and prints the deeds table", () => {
    const deeds = caseStudyReportDeeds([
      { propertyId: "a", poNumber: "PO-1", deedNumber: "111", area: "100" },
      { propertyId: "b", poNumber: "PO-2", deedNumber: "222", area: "200" },
    ]);
    const model = buildCaseStudyReportModel(
      emptyCaseStudyReportDraft("task-1"),
      null,
      task,
      null,
      undefined,
      deeds,
    );
    expect(model.approval.deedNumber).toBe("111 ، 222");
    const html = buildCaseStudyReportBodyHtml(model);
    expect(html).toContain("صكوك العقار (2)");
    expect(html).toContain("300 م²");
  });

  it("prints no deeds table for an ordinary property", () => {
    const model = buildCaseStudyReportModel(emptyCaseStudyReportDraft("task-1"), null, task, null);
    expect(buildCaseStudyReportBodyHtml(model)).not.toContain("صكوك العقار");
  });
});
