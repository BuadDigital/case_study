import { describe, expect, it } from "vitest";
import {
  emptyProperty,
  formatPropertyDeedDisplay,
  type PoIntakeRecord,
  type PoPropertyIntake,
} from "../../lib/app-data/po-intake-data";
import type { WorkflowTask } from "../../lib/app-data/tasks";
import {
  SURVEY_ALREADY_LIVE_AR,
  SURVEY_DEED_NOT_FOUND_AR,
  SURVEY_NO_STUDY_TASK_AR,
  SURVEY_AFTER_REPORT_AR,
  SURVEY_BEFORE_DISTRIBUTION_AR,
  SURVEY_OBSTRUCTED_AR,
  SURVEY_PICK_DEED_AR,
  engineeringSurveyTarget,
} from "../create-engineering-survey-task";

/**
 * Omar 2026-11-11: the engineering office is added after the distribution from «مهمة جديدة», type
 * «رفع مساحي» — no longer from a note in the inspector's section that showed only after a type change.
 * A property the survey rule asks no survey for takes the office by exception, with a reason.
 */

function property(over: Partial<PoPropertyIntake>): PoPropertyIntake {
  return { ...emptyProperty(), classification: "أرض", propertyType: "أرض سكنية", ...over };
}

function task(over: Partial<WorkflowTask>): WorkflowTask {
  return { status: "open", ...over } as WorkflowTask;
}

function po(...properties: PoPropertyIntake[]): PoIntakeRecord[] {
  return [{ id: "PO-1", poNumber: "PO-1", properties } as unknown as PoIntakeRecord];
}

const land = property({ id: "p1", deedNumber: "111" });
const records = po(land);
const study = task({ id: "s1", kind: "case-study-property", propertyId: "p1", phase: "case-study" });
const inRule = { ok: true, parentTaskId: "s1", outsideRule: null };

function target(tasks: WorkflowTask[], poRecords = records, deed = "111") {
  return engineeringSurveyTarget({ poRecords, tasks, poNumber: " PO-1 ", deed });
}

describe("engineeringSurveyTarget", () => {
  it("points at the deed's case-study task — with no type change at all", () => {
    expect(target([study])).toEqual(inRule);
  });

  it("asks for the work order and the deed, and refuses a deed that is not in it", () => {
    expect(target([study], records, "")).toEqual({ ok: false, error: SURVEY_PICK_DEED_AR });
    expect(target([study], records, "999")).toEqual({ ok: false, error: SURVEY_DEED_NOT_FOUND_AR });
    expect(target([study], po({ ...land, isRemoved: true }))).toEqual({
      ok: false,
      error: SURVEY_DEED_NOT_FOUND_AR,
    });
  });

  it("waits for the distribution and stops once the transaction left the study phase — saying which", () => {
    expect(target([])).toEqual({ ok: false, error: SURVEY_NO_STUDY_TASK_AR });
    const inPhase = (phase: WorkflowTask["phase"]) => target([{ ...study, phase } as WorkflowTask]);
    expect(inPhase("enfath")).toEqual({ ok: false, error: SURVEY_BEFORE_DISTRIBUTION_AR });
    expect(inPhase("distribution")).toEqual({ ok: false, error: SURVEY_BEFORE_DISTRIBUTION_AR });
    expect(inPhase("obstruction")).toEqual({ ok: false, error: SURVEY_OBSTRUCTED_AR });
    expect(inPhase("done")).toEqual({ ok: false, error: SURVEY_AFTER_REPORT_AR });
    expect(target([{ ...study, status: "cancelled" } as WorkflowTask])).toEqual({
      ok: false,
      error: SURVEY_NO_STUDY_TASK_AR,
    });
  });

  it("refuses a second office while a survey is live, and allows one after the office was skipped", () => {
    const survey = task({ id: "e1", kind: "engineering-survey", parentTaskId: "s1", propertyId: "p1" });
    expect(target([study, survey])).toEqual({ ok: false, error: SURVEY_ALREADY_LIVE_AR });
    expect(target([study, { ...survey, status: "completed" } as WorkflowTask])).toEqual({
      ok: false,
      error: SURVEY_ALREADY_LIVE_AR,
    });
    expect(target([study, { ...survey, status: "cancelled" } as WorkflowTask])).toEqual(inRule);
  });

  it("takes a property outside the survey rule by exception, saying which rule it is outside of", () => {
    const platted = target([study], po({ ...land, planNumber: "12", plotNumber: "3" }));
    expect(platted).toMatchObject({ ok: true, parentTaskId: "s1" });
    expect(platted.ok && platted.outsideRule).toContain("مخطط تنظيمي معتمد");

    // A registered title is listed in the form under its own display, not the deed number.
    const titled = { ...land, realEstateRegNumber: "REG-9" };
    const registered = target([study], po(titled), formatPropertyDeedDisplay(titled) || "111");
    expect(registered.ok && registered.outsideRule).toContain("سجل عيني");

    const unit = property({ id: "p1", deedNumber: "111", classification: "وحدة داخل مبنى", propertyType: "شقة سكنية" });
    const asUnit = target([study], po(unit));
    expect(asUnit.ok && asUnit.outsideRule).toContain("وحدة داخل مبنى");
    // The inspector's corrected type decides: a unit that turned out to be a villa is inside the rule.
    expect(target([study], po({ ...unit, inspectedPropertyType: "فيلا" }))).toEqual(inRule);
  });

  it("the exception does not open what is closed for every property", () => {
    const platted = po({ ...land, planNumber: "12", plotNumber: "3" });
    const survey = task({ id: "e1", kind: "engineering-survey", parentTaskId: "s1", propertyId: "p1" });
    expect(target([study, survey], platted)).toEqual({ ok: false, error: SURVEY_ALREADY_LIVE_AR });
    expect(target([{ ...study, phase: "done" } as WorkflowTask], platted)).toEqual({
      ok: false,
      error: SURVEY_AFTER_REPORT_AR,
    });
  });
});
