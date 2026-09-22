import { describe, expect, it } from "vitest";
import { emptyCaseStudyFormDraft } from "../case-study-form-model";
import { buildCaseStudyReportModel } from "../case-study-report-model";
import { buildCaseStudyReportBodyHtml } from "../case-study-report-render";
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

describe("case-study report row notes", () => {
  it("prints a per-row note under the question in the report", () => {
    const draft = emptyCaseStudyFormDraft("task-1");
    draft.answers.deed_0 = "B";
    draft.answerNotes = { deed_0: "الحد الجنوبي أقصر من الصك" };

    const model = buildCaseStudyReportModel(draft, null, task, null);
    const deed = model.sections.find((section) => section.id === "deed");
    expect(deed?.rows[0]?.note).toBe("الحد الجنوبي أقصر من الصك");

    const html = buildCaseStudyReportBodyHtml(model);
    expect(html).toContain("الحد الجنوبي أقصر من الصك");
  });

  it("replaces the extra-section placeholder when a row note exists", () => {
    const draft = emptyCaseStudyFormDraft("task-1");
    draft.answers.extra_1 = "A";
    draft.answerNotes = { extra_1: "شقوق في الجدار الغربي" };

    const model = buildCaseStudyReportModel(draft, null, task, null);
    const extra = model.sections.find((section) => section.id === "extra");
    expect(extra?.rows[1]?.note).toBe("شقوق في الجدار الغربي");

    const html = buildCaseStudyReportBodyHtml(model);
    expect(html).toContain("شقوق في الجدار الغربي");
  });
});
