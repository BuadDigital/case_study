import { describe, expect, it } from "vitest";
import {
  canSpecialistApproveQuestion,
  isAnyPartyAssignedToQuestion,
  isCaseStudyQuestionVisibleToSpecialist,
  type CaseStudyInfoRolesMatrix,
} from "@settings/mfe/lib/prototype/case-study-info-roles-storage";
import { childTasksForCaseStudyParent } from "../case-study-party-answers";
import type { WorkflowTask } from "../tasks-storage";

const matrix: CaseStudyInfoRolesMatrix = {
  deed_0: { specA: "verify" },
  comp_0: { insp: "primary" },
  comp_1: { insp: "primary" },
};

describe("case study specialist visibility", () => {
  it("shows comp questions to specialist when only inspector is assigned", () => {
    expect(isCaseStudyQuestionVisibleToSpecialist(matrix, "comp_0")).toBe(true);
    expect(isCaseStudyQuestionVisibleToSpecialist(matrix, "deed_0")).toBe(true);
    expect(isCaseStudyQuestionVisibleToSpecialist(matrix, "extra_99")).toBe(
      false,
    );
  });

  it("lets specialist approve visible review questions", () => {
    expect(canSpecialistApproveQuestion(matrix, "comp_0")).toBe(true);
    expect(canSpecialistApproveQuestion(matrix, "extra_99")).toBe(false);
  });

  it("detects any party assignment", () => {
    expect(isAnyPartyAssignedToQuestion(matrix, "comp_0")).toBe(true);
    expect(isAnyPartyAssignedToQuestion(matrix, "missing_key")).toBe(false);
  });
});

describe("childTasksForCaseStudyParent", () => {
  const base = {
    phase: "case-study" as const,
    status: "open" as const,
    createdAt: "2026-01-01T00:00:00.000Z",
    updatedAt: "2026-01-01T00:00:00.000Z",
  };

  const parent: WorkflowTask = {
    ...base,
    id: "parent-1",
    kind: "case-study-property",
    poNumber: "PO-1",
    propertyId: "prop-1",
    assigneeName: "Spec",
    assigneeRole: "case-specialist",
    title: "Case study",
    propertyOrdinal: 1,
  };

  const inspection: WorkflowTask = {
    ...base,
    id: "insp-1",
    kind: "field-inspection",
    poNumber: "PO-1",
    propertyId: "prop-1",
    assigneeName: "Inspector",
    assigneeRole: "field-inspector",
    title: "Inspection",
    propertyOrdinal: 1,
  };

  it("finds children by parentTaskId", () => {
    const child = { ...inspection, parentTaskId: "parent-1" };
    expect(
      childTasksForCaseStudyParent("parent-1", [parent, child]),
    ).toEqual([child]);
  });

  it("falls back to poNumber + propertyId when parentTaskId is missing", () => {
    expect(
      childTasksForCaseStudyParent("parent-1", [parent, inspection]),
    ).toEqual([inspection]);
  });
});
