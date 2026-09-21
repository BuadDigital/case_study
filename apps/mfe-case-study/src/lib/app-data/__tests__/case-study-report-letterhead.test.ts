import { describe, expect, it } from "vitest";
import { emptyCaseStudyFormDraft } from "../case-study-form-model";
import { buildCaseStudyReportModel } from "../case-study-report-model";
import { buildCaseStudyReportPrintHtml } from "../case-study-report-render";
import type { WorkflowTask } from "../tasks";

const task: WorkflowTask = {
  id: "task-1",
  kind: "case-study-property",
  poNumber: "PO-1",
  propertyId: "prop-1",
  assigneeName: "أخصائي",
  assigneeRole: "case-specialist",
  title: "عقار 1",
  propertyOrdinal: 1,
  phase: "case-study",
  status: "open",
  createdAt: "2026-01-01T00:00:00.000Z",
  updatedAt: "2026-01-01T00:00:00.000Z",
};

function model() {
  return buildCaseStudyReportModel(emptyCaseStudyFormDraft("task-1"), null, task, null);
}

describe("case-study report on the organisation letterhead", () => {
  it("prints on letterhead sheets like the official letters, with no hand-built header", () => {
    const html = buildCaseStudyReportPrintHtml(model(), { origin: "http://host" });
    expect(html).toContain('url("http://host/case-study/ejadah-letterhead.png")');
    expect(html).toContain("csrd-sheets");
    expect(html).toContain("class=\"toolbar\"");
    expect(html).not.toContain("csrd-header");
    expect(html).not.toContain("csrd-footer");
    expect(html).not.toContain("csrd-watermark");
  });

  it("prints the report number under the title once one is allocated", () => {
    const html = buildCaseStudyReportPrintHtml(model(), {
      referenceNumber: "CS-2026-00012",
    });
    expect(html).toContain("CS-2026-00012");
  });

  it("leaves the toolbar out when embedded in the app's preview", () => {
    const html = buildCaseStudyReportPrintHtml(model(), { embedded: true });
    expect(html).not.toContain('class="toolbar"');
  });
});
