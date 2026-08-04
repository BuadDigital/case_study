import { describe, expect, it } from "vitest";
import type { RoleId } from "@platform/types";
import {
  governmentReviewAssignmentBlockReason,
  governmentReviewSubmitFieldErrors,
  inspectorKeySubmitGate,
  isInformalSettlement,
  roleBypassesDocumentaryGates,
  roleCanSetLocationMapUrl,
  surveyWorkGate,
} from "../documentary-workflow-gates";
import type { WorkflowTask } from "../tasks-storage";

const baseTask = (overrides: Partial<WorkflowTask>): WorkflowTask =>
  ({
    id: "s1",
    kind: "engineering-survey",
    poNumber: "PO-1",
    propertyId: "p1",
    parentTaskId: "parent",
    assigneeName: "مكتب",
    assigneeRole: "engineering-office",
    title: "رفع",
    phase: "work",
    status: "open",
    createdAt: "2026-01-01T00:00:00.000Z",
    updatedAt: "2026-01-01T00:00:00.000Z",
    ...overrides,
  }) as WorkflowTask;

const BYPASS_ROLES: RoleId[] = ["section-supervisor", "cdo"];
const NON_BYPASS_PARTY: RoleId[] = [
  "field-inspector",
  "engineering-office",
  "government-reviewer",
  "case-specialist",
  "real-estate-appraiser",
  "general-manager",
];

describe("documentary workflow gates — role matrix", () => {
  it("treats missing plan+plot as informal (classification only)", () => {
    expect(isInformalSettlement("", "")).toBe(true);
    expect(isInformalSettlement("1", "")).toBe(false);
  });

  it.each(BYPASS_ROLES)("%s bypasses documentary gates", (role) => {
    expect(roleBypassesDocumentaryGates(role)).toBe(true);
  });

  it.each(NON_BYPASS_PARTY)("%s does not bypass documentary gates", (role) => {
    expect(roleBypassesDocumentaryGates(role)).toBe(false);
  });

  it("map URL writers: specialist + inspector + bypass roles", () => {
    expect(roleCanSetLocationMapUrl("field-inspector")).toBe(true);
    expect(roleCanSetLocationMapUrl("case-specialist")).toBe(true);
    expect(roleCanSetLocationMapUrl("section-supervisor")).toBe(true);
    expect(roleCanSetLocationMapUrl("cdo")).toBe(true);
    expect(roleCanSetLocationMapUrl("engineering-office")).toBe(false);
    expect(roleCanSetLocationMapUrl("government-reviewer")).toBe(false);
    expect(roleCanSetLocationMapUrl("general-manager")).toBe(false);
  });

  it("blocks survey until inspection completed for EO", () => {
    const survey = baseTask({});
    const inspection = baseTask({
      id: "i1",
      kind: "field-inspection",
      status: "open",
    });
    const gate = surveyWorkGate({
      role: "engineering-office",
      surveyTask: survey,
      tasks: [survey, inspection],
      hasActiveFailure: false,
    });
    expect(gate.ready).toBe(false);
  });

  it("supervisor bypasses frozen survey despite active failure", () => {
    const survey = baseTask({});
    const inspection = baseTask({
      id: "i1",
      kind: "field-inspection",
      status: "completed",
    });
    const gate = surveyWorkGate({
      role: "section-supervisor",
      surveyTask: survey,
      tasks: [survey, inspection],
      hasActiveFailure: true,
    });
    expect(gate.ready).toBe(true);
  });

  it("survey work no longer gates on informal map URL", () => {
    const survey = baseTask({});
    const inspection = baseTask({
      id: "i1",
      kind: "field-inspection",
      status: "completed",
    });
    const gate = surveyWorkGate({
      role: "engineering-office",
      surveyTask: survey,
      tasks: [survey, inspection],
      hasActiveFailure: false,
    });
    expect(gate.ready).toBe(true);
  });

  it("uses server fieldInspectionCompleted when EO cannot see sibling task", () => {
    const survey = baseTask({});
    const unlocked = surveyWorkGate({
      role: "engineering-office",
      surveyTask: survey,
      tasks: [survey],
      hasActiveFailure: false,
      fieldInspectionCompleted: true,
    });
    expect(unlocked.ready).toBe(true);

    const locked = surveyWorkGate({
      role: "engineering-office",
      surveyTask: survey,
      tasks: [survey],
      hasActiveFailure: false,
      fieldInspectionCompleted: false,
    });
    expect(locked.ready).toBe(false);
  });

  it("server flag overrides stale sibling list", () => {
    const survey = baseTask({});
    const inspection = baseTask({
      id: "i1",
      kind: "field-inspection",
      status: "completed",
    });
    const gate = surveyWorkGate({
      role: "engineering-office",
      surveyTask: survey,
      tasks: [survey, inspection],
      hasActiveFailure: false,
      fieldInspectionCompleted: false,
    });
    expect(gate.ready).toBe(false);
  });

  it("inspector key gate no longer blocks field-inspection submit", () => {
    expect(
      inspectorKeySubmitGate({
        role: "field-inspector",
        vacantLand: false,
        keyAvailable: false,
      }).ready,
    ).toBe(true);
    expect(
      inspectorKeySubmitGate({
        role: "field-inspector",
        vacantLand: true,
        keyAvailable: false,
      }).ready,
    ).toBe(true);
  });

  it("gov reviewer submit requires documentary fields; supervisor skips", () => {
    const blocked = governmentReviewSubmitFieldErrors({
      role: "government-reviewer",
      deedNumber: "1",
      requestNumber: "",
      city: "جدة",
      district: "الروضة",
      circuit: "1",
      poNumber: "PO-1",
      assignmentMandateNumber: "M-1",
      assignmentMandateDate: "2026-01-01",
    });
    expect(blocked.requestNumber).toBeTruthy();

    const bypassed = governmentReviewSubmitFieldErrors({
      role: "section-supervisor",
      deedNumber: "",
      requestNumber: "",
    });
    expect(bypassed).toEqual({});
  });

  it("blocks government-review assignment when circuit/mandate missing", () => {
    const blocked = governmentReviewAssignmentBlockReason({
      deedNumber: "1",
      requestNumber: "R-1",
      city: "جدة",
      district: "الروضة",
      circuit: "",
      poNumber: "PO-1",
      assignmentMandateNumber: "",
      assignmentMandateDate: "2026-01-01",
    });
    expect(blocked).toContain("الدائرة");
    expect(blocked).toContain("رقم التكليف");
    expect(blocked).toContain("لا يمكن إرسال المعاملة للمراجع الحكومي");

    expect(
      governmentReviewAssignmentBlockReason({
        deedNumber: "1",
        requestNumber: "R-1",
        city: "جدة",
        district: "الروضة",
        circuit: "1",
        poNumber: "PO-1",
        assignmentMandateNumber: "M-1",
        assignmentMandateDate: "2026-01-01",
      }),
    ).toBeNull();
  });
});
