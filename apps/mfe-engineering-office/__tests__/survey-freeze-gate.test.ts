import { describe, expect, it } from "vitest";
import type { FailureRecord } from "@platform/app-shared/failures/failures-types";
import { surveyWorkGate } from "@case-study/mfe/lib/app-data/documentary-workflow-gates";
import type { WorkflowTask } from "@case-study/mfe/lib/app-data/tasks";
import {
  surveyFreezingFailureForProperty,
  surveyFreezingFailuresForProperty,
} from "../../mfe-failures/src/lib/failure-property-match";

const ref = { poNumber: "PO-1", propertyId: "p1", deedNumber: "D-1" };

function failure(over: Partial<FailureRecord>): FailureRecord {
  return {
    id: "f1",
    poNumber: "PO-1",
    propertyId: "p1",
    deedNumber: "D-1",
    title: "تعذر",
    problemTypeId: "x",
    severity: "internal",
    raisedByRole: "case-specialist",
    internalNote: "",
    finalNote: "",
    resolutionReason: "",
    continueInstructions: "",
    status: "internal",
    specialist: "أخصائي",
    createdAt: "2026-10-01T00:00:00Z",
    updatedAt: "2026-10-01T00:00:00Z",
    surveyFreezeLiftedAt: null,
    surveyFreezeLiftReason: null,
    ...over,
  };
}

const surveyTask = { id: "s1", kind: "engineering-survey" } as WorkflowTask;

/** The same computation `useEngineeringSurveyData` feeds the survey gate. */
function gate(role: Parameters<typeof surveyWorkGate>[0]["role"], failures: FailureRecord[]) {
  return surveyWorkGate({
    role,
    surveyTask,
    tasks: [],
    hasActiveFailure: Boolean(surveyFreezingFailureForProperty(failures, ref)),
    fieldInspectionCompleted: true,
  });
}

describe("survey freeze gate", () => {
  it("freezes the survey while an active failure is not lifted", () => {
    expect(gate("engineering-office", [failure({})])).toMatchObject({ ready: false });
  });

  it("opens once the specialist lifted the freeze, though the failure stays open", () => {
    const lifted = failure({ surveyFreezeLiftedAt: "2026-10-02T08:00:00Z" });
    expect(gate("engineering-office", [lifted])).toEqual({ ready: true });
    expect(lifted.status).toBe("internal");
  });

  it("still freezes when only some of the active failures were lifted", () => {
    const failures = [
      failure({ id: "f1", surveyFreezeLiftedAt: "2026-10-02T08:00:00Z" }),
      failure({ id: "f2" }),
    ];
    expect(surveyFreezingFailuresForProperty(failures, ref).map((f) => f.id)).toEqual(["f2"]);
    expect(gate("engineering-office", failures)).toMatchObject({ ready: false });
  });

  it("ignores closed failures and failures on other properties", () => {
    expect(gate("engineering-office", [failure({ status: "resolved" })])).toEqual({ ready: true });
    expect(gate("engineering-office", [failure({ propertyId: "p2", deedNumber: "D-2" })])).toEqual({
      ready: true,
    });
  });

  it("keeps the supervisor's bypass of the documentary gates", () => {
    expect(gate("section-supervisor", [failure({})])).toEqual({ ready: true });
  });
});
