import { describe, expect, it } from "vitest";
import { emptyCaseStudyReportDraft } from "@platform/app-shared/app-data/case-study-report-model";
import { DeedNatureMatchOutcomes } from "@platform/app-shared/domain/case-study/deed-nature-match-outcomes";
import { buildCaseStudyReportModel } from "../case-study-report-document-model";
import { buildCaseStudyReportBodyHtml } from "../case-study-report-render";
import type { WorkflowTask } from "../tasks";

const task = { poNumber: "PO-1" } as Pick<WorkflowTask, "poNumber">;

function deedSection(outcome: string, notes = "") {
  const draft = emptyCaseStudyReportDraft("task-1");
  draft.deedNatureMatchOutcome = outcome;
  draft.deedNatureMatchNotes = notes;
  const model = buildCaseStudyReportModel(draft, null, task, null);
  return { extras: model.sections.find((s) => s.id === "deed")?.extras ?? [], html: buildCaseStudyReportBodyHtml(model) };
}

// Omar 2026-11-19: the deed↔nature result and its justification were missing from the report.
describe("case-study report — deed↔nature match", () => {
  it("prints «مطابق» with no notes", () => {
    const { extras, html } = deedSection(DeedNatureMatchOutcomes.Matched);
    expect(extras).toEqual(["مطابقة الصك على الطبيعة: مطابق"]);
    expect(html).toContain("مطابقة الصك على الطبيعة: مطابق");
  });

  it("prints the justification of «مطابق» against the inspector", () => {
    const { extras, html } = deedSection(DeedNatureMatchOutcomes.Matched, "مطابق حسب الرفع المساحي والصك");
    expect(extras).toEqual(["مطابقة الصك على الطبيعة: مطابق", "مبرر المطابقة: مطابق حسب الرفع المساحي والصك"]);
    expect(html).toContain("مبرر المطابقة: مطابق حسب الرفع المساحي والصك");
  });

  it("prints «غير مطابق» with its notes on one line", () => {
    const { extras } = deedSection(DeedNatureMatchOutcomes.Differences, "الحد الشرقي 28 م\nالحد الغربي 30 م");
    expect(extras).toEqual(["مطابقة الصك على الطبيعة: غير مطابق", "الملاحظات: الحد الشرقي 28 م — الحد الغربي 30 م"]);
  });

  it("prints nothing before a result is chosen", () => {
    expect(deedSection("").extras).toEqual([]);
  });
});
